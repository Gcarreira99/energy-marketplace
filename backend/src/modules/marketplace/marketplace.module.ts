import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RealtimeModule } from "../realtime/realtime.module";
import { MarketplaceController } from "./controllers/marketplace.controller";
import { IndexedOffer } from "./entities/indexed-offer.entity";
import { MarketActivity } from "./entities/market-activity.entity";
import { IndexedOfferRepository } from "./repositories/indexed-offer.repository";
import { MarketActivityRepository } from "./repositories/market-activity.repository";
import { MarketplaceIndexerService } from "./services/marketplace-indexer.service";

@Module({
  imports: [TypeOrmModule.forFeature([IndexedOffer, MarketActivity]), RealtimeModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceIndexerService, IndexedOfferRepository, MarketActivityRepository],
})
export class MarketplaceModule {}