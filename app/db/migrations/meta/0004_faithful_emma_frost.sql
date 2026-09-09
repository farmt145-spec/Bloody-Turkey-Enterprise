CREATE TABLE `api_keys` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`label` varchar(128) NOT NULL,
	`keyHash` varchar(64) NOT NULL,
	`keyPrefix` varchar(12) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_keyHash_unique` UNIQUE(`keyHash`)
);
--> statement-breakpoint
ALTER TABLE `feed_ingredients` ADD `moisturePct` decimal(5,2) DEFAULT '12' NOT NULL;--> statement-breakpoint
ALTER TABLE `feed_ingredients` ADD `ashPct` decimal(5,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `feed_ingredients` ADD `starchPct` decimal(5,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `feed_ingredients` ADD `cystinePct` decimal(5,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `feed_ingredients` ADD `threoninePct` decimal(5,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `feed_ingredients` ADD `tryptophanPct` decimal(5,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `feed_ingredients` ADD `argininePct` decimal(5,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `feed_ingredients` ADD `sodiumPct` decimal(5,3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `feed_ingredients` ADD `producer` varchar(255);--> statement-breakpoint
ALTER TABLE `feed_ingredients` ADD `code` varchar(32);--> statement-breakpoint
ALTER TABLE `feed_ingredients` ADD `extraParams` json;--> statement-breakpoint
ALTER TABLE `recipes` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `author` varchar(128) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `status` enum('draft','active','archived') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `sex` enum('toms','hens','mixed') DEFAULT 'mixed' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `season` enum('winter','summer','all') DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `genetics` varchar(128);