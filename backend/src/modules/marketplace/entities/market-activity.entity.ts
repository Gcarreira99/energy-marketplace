import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export type MarketActivityKind = "created" | "purchased" | "cancelled";

@Entity({ name: "market_activity" })
@Index("idx_market_activity_seller", ["seller"])
@Index("idx_market_activity_buyer", ["buyer"])
export class MarketActivity {
  @PrimaryGeneratedColumn({ type: "integer" })
  id!: number;

  @Column({ type: "text" })
  kind!: MarketActivityKind;

  @Column({ name: "order_id", type: "text" })
  orderId!: string;

  @Column({ type: "text" })
  seller!: string;

  @Column({ type: "text", nullable: true })
  buyer!: string | null;

  @Column({ type: "text" })
  quantity!: string;

  @Column({ name: "price_wei", type: "text" })
  priceWei!: string;

  @Column({ name: "block_number", type: "integer" })
  blockNumber!: number;

  @Column({ name: "block_timestamp", type: "text" })
  blockTimestamp!: string;

  @Column({ name: "tx_hash", type: "text" })
  txHash!: string;

  @Column({ name: "log_index", type: "integer" })
  logIndex!: number;
}
