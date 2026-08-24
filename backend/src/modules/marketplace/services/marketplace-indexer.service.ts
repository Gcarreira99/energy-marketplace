import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Contract, EventLog, JsonRpcProvider } from "ethers";

const MARKETPLACE_ABI = [
  "event SellOrderCreated(uint256 indexed orderId, address indexed seller, uint256 quantity, uint256 price, uint256 timestamp)",
  "event EnergyPurchased(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 quantity, uint256 price)",
  "event SellOrderCancelled(uint256 indexed orderId, address indexed seller)",
] as const;

type IndexedOffer = {
  orderId: bigint;
  seller: string;
  quantity: bigint;
  priceWei: bigint;
  timestamp: bigint;
  active: boolean;
};

@Injectable()
export class MarketplaceIndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly offers = new Map<bigint, IndexedOffer>();
  private readonly contract: Contract;
  private readonly deploymentBlock: number;

  constructor() {
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

  getActiveOffers() {
    return [...this.offers.values()]
      .filter((offer) => offer.active)
      .map((offer) => ({
        orderId: offer.orderId.toString(),
        seller: offer.seller,
        quantity: offer.quantity.toString(),
        priceWei: offer.priceWei.toString(),
        timestamp: offer.timestamp.toString(),
        active: offer.active,
      }));
  }

  private async backfill() {
    const createdEvents = await this.contract.queryFilter(
      this.contract.filters.SellOrderCreated(),
      this.deploymentBlock,
      "latest",
    );
    for (const event of createdEvents) {
      if (event instanceof EventLog && event.args) {
        this.handleOrderCreated(
          event.args.orderId,
          event.args.seller,
          event.args.quantity,
          event.args.price,
          event.args.timestamp,
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
        this.handleOrderPurchased(event.args.orderId);
      }
    }

    const cancelledEvents = await this.contract.queryFilter(
      this.contract.filters.SellOrderCancelled(),
      this.deploymentBlock,
      "latest",
    );
    for (const event of cancelledEvents) {
      if (event instanceof EventLog && event.args) {
        this.handleOrderCancelled(event.args.orderId);
      }
    }
  }

  private readonly handleOrderCreated = (
    orderId: bigint,
    seller: string,
    quantity: bigint,
    price: bigint,
    timestamp: bigint,
  ) => {
    this.offers.set(orderId, {
      orderId,
      seller,
      quantity,
      priceWei: price,
      timestamp,
      active: true,
    });
  };

  private readonly handleOrderPurchased = (orderId: bigint) => {
    const offer = this.offers.get(orderId);
    if (offer) offer.active = false;
  };

  private readonly handleOrderCancelled = (orderId: bigint) => {
    const offer = this.offers.get(orderId);
    if (offer) offer.active = false;
  };
}