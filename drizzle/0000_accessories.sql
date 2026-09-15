CREATE TABLE `accessories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`weapon_id` text NOT NULL,
	`weapon_name` text NOT NULL,
	`category_id` text NOT NULL,
	`category_name` text NOT NULL,
	`pattern_name` text DEFAULT '' NOT NULL,
	`min_float` real,
	`max_float` real,
	`rarity_id` text NOT NULL,
	`rarity_name` text NOT NULL,
	`rarity_color` text DEFAULT '#b0c3d9' NOT NULL,
	`stattrak` integer DEFAULT false NOT NULL,
	`souvenir` integer DEFAULT false NOT NULL,
	`paint_index` text,
	`wears_json` text DEFAULT '[]' NOT NULL,
	`image_url` text NOT NULL,
	`price_cny` real,
	`price_source` text,
	`source` text NOT NULL,
	`source_url` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_accessories_category` ON `accessories` (`category_name`);
--> statement-breakpoint
CREATE INDEX `idx_accessories_weapon` ON `accessories` (`weapon_name`);
--> statement-breakpoint
CREATE INDEX `idx_accessories_rarity` ON `accessories` (`rarity_id`);
