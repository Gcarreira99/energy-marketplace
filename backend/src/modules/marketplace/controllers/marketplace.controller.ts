import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { isAddress } from "ethers";
import { MarketplaceIndexerService } from "../services/marketplace-indexer.service";

@Controller("marketplace")
export class MarketplaceController {
  constructor(private readonly indexer: MarketplaceIndexerService) {}

  @Get("offers")
  getOffers() {
    return this.indexer.getActiveOffers();
  }

  @Get("history")
  getHistory(@Query("account") account?: string) {
    if (account !== undefined && !isAddress(account)) {
      throw new BadRequestException("account must be an address");
    }
    return this.indexer.getHistory(account);
  }
}
