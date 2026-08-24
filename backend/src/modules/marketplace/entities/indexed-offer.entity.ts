import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "indexed_offers" })
@Index("idx_indexed_offers_active", ["active"])
export class IndexedOffer {
  @PrimaryColumn({ name: "order_id", type: "text" })
  orderId!: string;

  @Column({ type: "text" })
  seller!: string;

  @Column({ type: "text" })
  quantity!: string;

  @Column({ name: "price_wei", type: "text" })
  priceWei!: string;

  @Column({ type: "text" })
  timestamp!: string;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @Column({ name: "created_block", type: "integer", nullable: true })
  createdBlock!: number | null;

  @Column({ name: "created_tx_hash", type: "text", nullable: true })
  createdTxHash!: string | null;

  @Column({ name: "created_log_index", type: "integer", nullable: true })
  createdLogIndex!: number | null;

  @Column({ name: "updated_at", type: "datetime" })
  updatedAt!: Date;
}
