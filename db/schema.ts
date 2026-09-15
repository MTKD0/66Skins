import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gameUsers = sqliteTable("game_users", {
  id: text("id").primaryKey(), username: text("username").notNull().unique(), nickname: text("nickname").notNull(),
  passwordHash: text("password_hash").notNull(), salt: text("salt").notNull(),
  balanceCents: integer("balance_cents").notNull().default(100000), tradeUrl: text("trade_url").notNull().default(""), createdAt: integer("created_at").notNull(),
});
export const gameSessions = sqliteTable("game_sessions", {
  tokenHash: text("token_hash").primaryKey(), userId: text("user_id").notNull(), expiresAt: integer("expires_at").notNull(),
});
export const gameAttempts = sqliteTable("game_attempts", { key: text("key").primaryKey(), count: integer("count").notNull(), since: integer("since").notNull() });
export const gameRooms = sqliteTable("game_rooms", {
  id: text("id").primaryKey(), hostId: text("host_id").notNull(), opponentId: text("opponent_id"),
  hostName: text("host_name").notNull(), opponentName: text("opponent_name"), robot: integer("robot").notNull().default(0),
  status: text("status").notNull(), costCents: integer("cost_cents").notNull(), boxIds: text("box_ids").notNull(),
  catalog: text("catalog").notNull(), results: text("results").notNull().default("[]"),
  startedAt: integer("started_at"), createdAt: integer("created_at").notNull(), winnerId: text("winner_id"),
}, t => [index("idx_game_rooms_status_created").on(t.status,t.createdAt)]);
export const gameInventory = sqliteTable("game_inventory", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), roomId: text("room_id"), boxId: integer("box_id").notNull(),
  itemName: text("item_name").notNull(), imageUrl: text("image_url").notNull(), valueCents: integer("value_cents").notNull(),
  acquiredAt: integer("acquired_at").notNull(), status: text("status").notNull().default("available"), recycledAt: integer("recycled_at"),
}, t => [index("idx_game_inventory_owner_status").on(t.userId,t.status)]);
export const gameWalletOps = sqliteTable("game_wallet_ops", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), amountCents: integer("amount_cents").notNull(), createdAt: integer("created_at").notNull(),
});

export const accessories = sqliteTable(
  "accessories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    marketName: text("market_name").notNull().default(""),
    description: text("description").notNull().default(""),
    weaponId: text("weapon_id").notNull(),
    weaponName: text("weapon_name").notNull(),
    categoryId: text("category_id").notNull(),
    categoryName: text("category_name").notNull(),
    patternName: text("pattern_name").notNull().default(""),
    minFloat: real("min_float"),
    maxFloat: real("max_float"),
    rarityId: text("rarity_id").notNull(),
    rarityName: text("rarity_name").notNull(),
    rarityColor: text("rarity_color").notNull().default("#b0c3d9"),
    stattrak: integer("stattrak", { mode: "boolean" }).notNull().default(false),
    souvenir: integer("souvenir", { mode: "boolean" }).notNull().default(false),
    paintIndex: text("paint_index"),
    wearsJson: text("wears_json").notNull().default("[]"),
    imageUrl: text("image_url").notNull(),
    priceCny: real("price_cny"),
    priceTokens: real("price_tokens"),
    priceSource: text("price_source"),
    source: text("source").notNull(),
    sourceUrl: text("source_url").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_accessories_category").on(table.categoryName),
    index("idx_accessories_weapon").on(table.weaponName),
    index("idx_accessories_rarity").on(table.rarityId),
  ]
);

export const backpackItems = sqliteTable(
  "backpack_items",
  {
    id: text("id").primaryKey(),
    boxId: integer("box_id").notNull(),
    itemName: text("item_name").notNull(),
    imageUrl: text("image_url").notNull(),
    value: real("value").notNull(),
    acquiredAt: text("acquired_at").notNull(),
    status: text("status").notNull().default("available"),
  },
  (table) => [
    index("idx_backpack_items_status_acquired").on(table.status, table.acquiredAt),
  ]
);

export const recycleRecords = sqliteTable(
  "recycle_records",
  {
    id: text("id").primaryKey(),
    backpackItemId: text("backpack_item_id").notNull(),
    itemName: text("item_name").notNull(),
    imageUrl: text("image_url").notNull(),
    value: real("value").notNull(),
    recycledAt: text("recycled_at").notNull(),
  },
  (table) => [
    index("idx_recycle_records_recycled_at").on(table.recycledAt),
  ]
);

export const tradeSettings = sqliteTable("trade_settings", {
  id: integer("id").primaryKey(),
  tradeUrl: text("trade_url").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

export const recentDrops = sqliteTable(
  "recent_drops",
  {
    id: text("id").primaryKey(),
    boxId: integer("box_id").notNull(),
    boxName: text("box_name").notNull(),
    boxImageUrl: text("box_image_url").notNull(),
    itemId: integer("item_id").notNull(),
    itemName: text("item_name").notNull(),
    itemImageUrl: text("item_image_url").notNull(),
    rarity: text("rarity").notNull(),
    userName: text("user_name").notNull(),
    openedAt: text("opened_at").notNull(),
  },
  (table) => [
    index("idx_recent_drops_opened_at").on(table.openedAt),
    index("idx_recent_drops_box_opened").on(table.boxId, table.openedAt),
  ],
);

export const priceSyncState = sqliteTable("price_sync_state", {
  source: text("source").primaryKey(),
  lastAttemptAt: text("last_attempt_at").notNull(),
  lastSuccessAt: text("last_success_at"),
  status: text("status").notNull(),
  updatedCount: integer("updated_count").notNull().default(0),
  errorMessage: text("error_message"),
});

export const accessoryPrices = sqliteTable("accessory_prices", {
  accessoryId: text("accessory_id").notNull(),
  source: text("source").notNull(),
  priceCny: real("price_cny").notNull(),
  quantity: integer("quantity"),
  observedAt: text("observed_at").notNull(),
  accepted: integer("accepted", { mode: "boolean" }).notNull().default(false),
  note: text("note"),
}, (table) => [
  primaryKey({ columns: [table.accessoryId, table.source] }),
  index("idx_accessory_prices_observed").on(table.observedAt),
]);

export const accessoryPriceVariants = sqliteTable("accessory_price_variants", {
  accessoryId: text("accessory_id").notNull(),
  marketHashName: text("market_hash_name").notNull(),
  exteriorName: text("exterior_name"),
  stattrak: integer("stattrak", { mode: "boolean" }).notNull().default(false),
  souvenir: integer("souvenir", { mode: "boolean" }).notNull().default(false),
  source: text("source").notNull(),
  priceCny: real("price_cny").notNull(),
  priceTokens: real("price_tokens").notNull(),
  suggestedPriceCny: real("suggested_price_cny"),
  quantity: integer("quantity"),
  observedAt: text("observed_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.marketHashName, table.source] }),
  index("idx_price_variants_accessory").on(table.accessoryId),
  index("idx_price_variants_observed").on(table.observedAt),
]);
