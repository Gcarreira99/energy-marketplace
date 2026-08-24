import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IndexedOffer } from "../entities/indexed-offer.entity";

@Injectable()
export class IndexedOfferRepository {
  constructor(
    @InjectRepository(IndexedOffer)
    private readonly repository: Repository<IndexedOffer>,
  ) {}

  findActive() {
    return this.repository.find({
      where: { active: true },
      order: { orderId: "ASC" },
    });
  }

  async upsertCreated(offer: Omit<IndexedOffer, "updatedAt">) {
    await this.repository.upsert(
      { ...offer, updatedAt: new Date() },
      ["orderId"],
    );
  }

  async markInactive(orderId: bigint) {
    await this.repository.update(
      { orderId: orderId.toString() },
      { active: false, updatedAt: new Date() },
    );
  }
}
