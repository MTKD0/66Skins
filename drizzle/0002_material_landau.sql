CREATE TABLE `price_sync_state` (
	`source` text PRIMARY KEY NOT NULL,
	`last_attempt_at` text NOT NULL,
	`last_success_at` text,
	`status` text NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`error_message` text
);
