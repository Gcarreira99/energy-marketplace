import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Contract, ContractEventPayload, EventLog, JsonRpcProvider } from "ethers";
import { MarketActivityKind } from "../entities/market-activity.entity";
import { IndexedOfferRepository } from "../repositories/indexed-offer.repository";
import { MarketActivityRepository } from "../repositories/market-activity.repository";

const MARKETPLACE_ABI = [
  "event SellOrderCreated(uint256 indexed orderId, address indexed seller, uint256 quantity, uint256 price, uint256 timestamp)",
  "event EnergyPurchased(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 quantity, uint256 price)",
  "event SellOrderCancelled(uint256 indexed orderId, address indexed seller)",
] as const;

@Injectable()
export class MarketplaceIndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly contract: Contract;
  private readonly deploymentBlock: number;

  constructor(
    private readonly offerRepository: IndexedOfferRepository,
    private readonly activityRepository: MarketActivityRepository,
  ) {
    const rpcUrl = process.env.RPC_URL;
    const marketplaceAddress = process.env.MARKETPLACE_ADDRESS;
    const deploymentBlock = process.env.MARKETPLACE_DEPLOYMENT_BLOCK ?? "0";

    if (!rpcUrl || !marketplaceAddress) {
      throw new Error("RPC_URL and MARKETPLACE_ADDRESS are required");
    }

    this.deploymentBlock = Number(deploymentBlock);
    if (!Number.isSafeInteger(this.deploymentBlock) || this.deploymentBlock < 0) {
      throw new Error("MARKETPLACE_DEPLOYMENT_BLOCK must be a non-negative integer");
    }

    this.contract = new Contract(
      marketplaceAddress,
      MARKETPLACE_ABI,
      new JsonRpcProvider(rpcUrl),
    );
  }

  async onModuleInit() {
    await this.backfill();
    this.contract.on("SellOrderCreated", this.handleOrderCreated);
    this.contract.on("EnergyPurchased", this.handleOrderPurchased);
    this.contract.on("SellOrderCancelled", this.handleOrderCancelled);
  }

  onModuleDestroy() {
    this.contract.removeAllListeners();
  }

  async getActiveOffers() {
    return this.offerRepository.findActive();
  }

  async getHistory(account?: string) {
    return this.activityRepository.findRecent(account);
  }

  private async backfill() {
    const createdEvents = await this.contract.queryFilter(
      this.contract.filters.SellOrderCreated(),
      this.deploymentBlock,
      "latest",
    );
    for (const event of createdEvents) {
      if (event instanceof EventLog && event.args) {
        await this.handleOrderCreated(
          event.args.orderId,
          event.args.seller,
          event.args.quantity,
          event.args.price,
          event.args.timestamp,
          event,
        );
      }
    }

    const purchasedEvents = await this.contract.queryFilter(
      this.contract.filters.EnergyPurchased(),
      this.deploymentBlock,
      "latest",
    );
    for (const event of purchasedEvents) {
      if (event instanceof EventLog && event.args) {
        await this.handleOrderPurchased(
          event.args.orderId,
          event.args.buyer,
          event.args.seller,
          event.args.quantity,
          event.args.price,
          event,
        );
      }
    }

    const cancelledEvents = await this.contract.queryFilter(
      this.contract.filters.SellOrderCancelled(),
      this.deploymentBlock,
      "latest",
    );
    for (const event of cancelledEvents) {
      if (event instanceof EventLog && event.args) {
        await this.handleOrderCancelled(event.args.orderId, event.args.seller, event);
      }
    }
  }

  private readonly handleOrderCreated = async (
    orderId: bigint,
    seller: string,
    quantity: bigint,
    price: bigint,
    timestamp: bigint,
    event: EventLog | ContractEventPayload,
  ) => {
    const log = toEventLog(event);
    await this.offerRepository.upsertCreated({
      orderId: orderId.toString(),
      seller,
      quantity: quantity.toString(),
      priceWei: price.toString(),
      timestamp: timestamp.toString(),
      active: true,
      createdBlock: log.blockNumber,
      createdTxHash: log.transactionHash,
      createdLogIndex: log.index,
    });
    await this.recordActivity("created", log, {
      orderId,
      seller,
      buyer: null,
      quantity,
      price,
    });
  };

  private readonly handleOrderPurchased = async (
    orderId: bigint,
    buyer: string,
    seller: string,
    quantity: bigint,
    price: bigint,
    event: EventLog | ContractEventPayload,
  ) => {
    await this.offerRepository.markInactive(orderId);
    await this.recordActivity("purchased", toEventLog(event), {
      orderId,
      seller,
      buyer,
      quantity,
      price,
    });
  };

  private readonly handleOrderCancelled = async (
    orderId: bigint,
    seller: string,
    event: EventLog | ContractEventPayload,
  ) => {
    await this.offerRepository.markInactive(orderId);
    // The cancel event carries no amounts, so take them from the indexed offer.
    const offer = await this.offerRepository.findById(orderId);
    await this.recordActivity("cancelled", toEventLog(event), {
      orderId,
      seller,
      buyer: null,
      quantity: BigInt(offer?.quantity ?? "0"),
      price: BigInt(offer?.priceWei ?? "0"),
    });
  };

  private async recordActivity(
    kind: MarketActivityKind,
    log: EventLog,
    details: {
      orderId: bigint;
      seller: string;
      buyer: string | null;
      quantity: bigint;
      price: bigint;
    },
  ) {
    const block = await log.getBlock();
    await this.activityRepository.record({
      kind,
      orderId: details.orderId.toString(),
      seller: details.seller,
      buyer: details.buyer,
      quantity: details.quantity.toString(),
      priceWei: details.price.toString(),
      blockNumber: log.blockNumber,
      blockTimestamp: block.timestamp.toString(),
      txHash: log.transactionHash,
      logIndex: log.index,
    });
  }
}

// Backfill passes the EventLog itself; live listeners pass a payload wrapping it.
function toEventLog(event: EventLog | ContractEventPayload): EventLog {
  return event instanceof ContractEventPayload ? event.log : event;
}
