CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `media_tree_idx` ON `media` (`tree_id`);--> statement-breakpoint
CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`kind` text DEFAULT 'text' NOT NULL,
	`body` text NOT NULL,
	`occurred_text` text,
	`author_name` text,
	`media_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `memories_person_idx` ON `memories` (`person_id`);--> statement-breakpoint
CREATE TABLE `parent_child` (
	`id` text PRIMARY KEY NOT NULL,
	`union_id` text NOT NULL,
	`child_id` text NOT NULL,
	`relation` text DEFAULT 'biological' NOT NULL,
	FOREIGN KEY (`union_id`) REFERENCES `unions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `parent_child_union_idx` ON `parent_child` (`union_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `parent_child_union_child_idx` ON `parent_child` (`union_id`,`child_id`);--> statement-breakpoint
CREATE TABLE `persons` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`also_known_as` text,
	`gender` text,
	`living` integer DEFAULT true NOT NULL,
	`birth_date_text` text,
	`birth_place` text,
	`death_date_text` text,
	`death_place` text,
	`notes` text,
	`photo_media_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `persons_tree_idx` ON `persons` (`tree_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `trees` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`focus_person_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trees_owner_idx` ON `trees` (`owner_id`);--> statement-breakpoint
CREATE TABLE `unions` (
	`id` text PRIMARY KEY NOT NULL,
	`tree_id` text NOT NULL,
	`partner_a_id` text NOT NULL,
	`partner_b_id` text,
	`status` text,
	`date_text` text,
	`place_text` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`partner_a_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`partner_b_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `unions_tree_idx` ON `unions` (`tree_id`);--> statement-breakpoint
CREATE INDEX `unions_partner_a_idx` ON `unions` (`partner_a_id`);--> statement-breakpoint
CREATE INDEX `unions_partner_b_idx` ON `unions` (`partner_b_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);