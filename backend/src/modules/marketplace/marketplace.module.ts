import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MarketplaceController } from "./controllers/marketplace.controller";
import { IndexedOffer } from "./entities/indexed-offer.entity";
import { IndexedOfferRepository } from "./repositories/indexed-offer.repository";
import { MarketplaceIndexerService } from "./services/marketplace-indexer.service";

@Module({
  imports: [TypeOrmModule.forFeature([IndexedOffer])],
  controllers: [MarketplaceController],
  providers: [MarketplaceIndexerService, IndexedOfferRepository],
})
export class MarketplaceModule {}