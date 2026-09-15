ALTER TABLE `accessories` ADD `market_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `accessories` ADD `price_tokens` real;
--> statement-breakpoint
CREATE TABLE `accessory_price_variants` (
	`accessory_id` text NOT NULL,
	`market_hash_name` text NOT NULL,
	`exterior_name` text,
	`stattrak` integer DEFAULT false NOT NULL,
	`souvenir` integer DEFAULT false NOT NULL,
	`source` text NOT NULL,
	`price_cny` real NOT NULL,
	`price_tokens` real NOT NULL,
	`suggested_price_cny` real,
	`quantity` integer,
	`observed_at` text NOT NULL,
	PRIMARY KEY(`market_hash_name`, `source`)
);
--> statement-breakpoint
CREATE INDEX `idx_price_variants_accessory` ON `accessory_price_variants` (`accessory_id`);
--> statement-breakpoint
CREATE INDEX `idx_price_variants_observed` ON `accessory_price_variants` (`observed_at`);
