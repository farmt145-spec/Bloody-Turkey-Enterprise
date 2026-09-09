CREATE TABLE `benchmarks` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`farmId` bigint unsigned,
	`metric` varchar(64) NOT NULL,
	`value` decimal(12,4) NOT NULL,
	`period` varchar(32) NOT NULL,
	`source` varchar(64) NOT NULL DEFAULT 'internal',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `benchmarks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `diseases` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`latinName` varchar(255),
	`category` enum('viral','bacterial','parasitic','metabolic','fungal','other') NOT NULL,
	`symptoms` text,
	`diagnosis` text,
	`treatmentProtocol` text,
	`prevention` text,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `diseases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dynamic_entities` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`entity` varchar(64) NOT NULL,
	`data` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dynamic_entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forecast_accuracy` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`metric` varchar(64) NOT NULL,
	`predicted` decimal(12,4) NOT NULL,
	`actual` decimal(12,4) NOT NULL,
	`accuracyPct` decimal(6,2) NOT NULL,
	`day` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forecast_accuracy_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`sourceModule` varchar(64) NOT NULL,
	`targetModule` varchar(64) NOT NULL,
	`kind` enum('api','webhook','device','file') NOT NULL DEFAULT 'api',
	`config` json,
	`enabled` boolean NOT NULL DEFAULT true,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `necropsy` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`day` date NOT NULL,
	`birdCount` int NOT NULL DEFAULT 1,
	`findings` text NOT NULL,
	`suspectedDiseaseId` bigint unsigned,
	`vet` varchar(255) NOT NULL DEFAULT 'system',
	`verdict` varchar(255),
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `necropsy_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipe_history` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`recipeId` bigint unsigned NOT NULL,
	`changeNote` varchar(500) NOT NULL,
	`oldProfile` json,
	`newProfile` json,
	`expertReport` text,
	`author` varchar(255) NOT NULL DEFAULT 'system',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recipe_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned,
	`name` varchar(255) NOT NULL,
	`assumptions` json NOT NULL,
	`result` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scenarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`lotId` bigint unsigned NOT NULL,
	`kind` enum('in','out','transfer','adjust') NOT NULL,
	`qty` decimal(12,2) NOT NULL,
	`reference` varchar(128),
	`batchId` bigint unsigned,
	`day` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouse_lots` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`warehouseId` bigint unsigned NOT NULL,
	`product` varchar(255) NOT NULL,
	`lotNumber` varchar(64) NOT NULL,
	`qty` decimal(12,2) NOT NULL,
	`unit` varchar(16) NOT NULL DEFAULT 'kg',
	`receivedDate` date NOT NULL,
	`expiryDate` date,
	`supplierId` bigint unsigned,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `warehouse_lots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `withdrawal_periods` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`treatmentId` bigint unsigned NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`medicine` varchar(255) NOT NULL,
	`startDay` date NOT NULL,
	`withdrawalDays` int NOT NULL,
	`safeFrom` date NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `withdrawal_periods_id` PRIMARY KEY(`id`)
);
