import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MarketActivity } from "../entities/market-activity.entity";

const HISTORY_LIMIT = 100;

@Injectable()
export class MarketActivityRepository {
  constructor(
    @InjectRepository(MarketActivity)
    private readonly repository: Repository<MarketActivity>,
  ) {}

  // Returns the stored row, or null when the event was already recorded.
  async record(activity: Omit<MarketActivity, "id">) {
    // Backfill replays events the live listener may already have stored.
    const existing = await this.repository.existsBy({
      txHash: activity.txHash,
      logIndex: activity.logIndex,
    });
    if (existing) return null;
    await this.repository
      .createQueryBuilder()
      .insert()
      .values({ ...activity })
      .orIgnore()
      .execute();
    return this.repository.findOneBy({
      txHash: activity.txHash,
      logIndex: activity.logIndex,
    });
  }

  findRecent(account?: string) {
    const query = this.repository
      .createQueryBuilder("activity")
      .orderBy("activity.blockNumber", "DESC")
      .addOrderBy("activity.logIndex", "DESC")
      .limit(HISTORY_LIMIT);

    if (account) {
      query.where(
        "LOWER(activity.seller) = :account OR LOWER(activity.buyer) = :account",
        { account: account.toLowerCase() },
      );
    }

    return query.getMany();
  }
}
