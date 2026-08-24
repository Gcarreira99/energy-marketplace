import { Controller, Get } from "@nestjs/common";
import { MarketplaceIndexerService } from "../services/marketplace-indexer.service";

@Controller("marketplace")
export class MarketplaceController {
  constructor(private readonly indexer: MarketplaceIndexerService) {}

  @Get("offers")
  getOffers() {
    return this.indexer.getActiveOffers();
  }
}