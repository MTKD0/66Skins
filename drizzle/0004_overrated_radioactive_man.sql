CREATE TABLE `game_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`since` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`room_id` text,
	`box_id` integer NOT NULL,
	`item_name` text NOT NULL,
	`image_url` text NOT NULL,
	`value_cents` integer NOT NULL,
	`acquired_at` integer NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`recycled_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_game_inventory_owner_status` ON `game_inventory` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `game_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`opponent_id` text,
	`host_name` text NOT NULL,
	`opponent_name` text,
	`robot` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`cost_cents` integer NOT NULL,
	`box_ids` text NOT NULL,
	`catalog` text NOT NULL,
	`results` text DEFAULT '[]' NOT NULL,
	`started_at` integer,
	`created_at` integer NOT NULL,
	`winner_id` text
);
--> statement-breakpoint
CREATE INDEX `idx_game_rooms_status_created` ON `game_rooms` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `game_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`nickname` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`balance_cents` integer DEFAULT 100000 NOT NULL,
	`trade_url` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_users_username_unique` ON `game_users` (`username`);--> statement-breakpoint
CREATE TABLE `game_wallet_ops` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` integer NOT NULL
);
