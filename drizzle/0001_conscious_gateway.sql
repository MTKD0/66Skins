CREATE TABLE `backpack_items` (
	`id` text PRIMARY KEY NOT NULL,
	`box_id` integer NOT NULL,
	`item_name` text NOT NULL,
	`image_url` text NOT NULL,
	`value` real NOT NULL,
	`acquired_at` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_backpack_items_status_acquired` ON `backpack_items` (`status`,`acquired_at`);--> statement-breakpoint
CREATE TABLE `recycle_records` (
	`id` text PRIMARY KEY NOT NULL,
	`backpack_item_id` text NOT NULL,
	`item_name` text NOT NULL,
	`image_url` text NOT NULL,
	`value` real NOT NULL,
	`recycled_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_recycle_records_recycled_at` ON `recycle_records` (`recycled_at`);--> statement-breakpoint
CREATE TABLE `trade_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`trade_url` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
