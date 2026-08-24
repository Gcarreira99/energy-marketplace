import { Module } from "@nestjs/common";
import { MarketplaceController } from "./controllers/marketplace.controller";
import { MarketplaceIndexerService } from "./services/marketplace-indexer.service";

@Module({
  controllers: [MarketplaceController],
  providers: [MarketplaceIndexerService],
})
export class MarketplaceModule {}