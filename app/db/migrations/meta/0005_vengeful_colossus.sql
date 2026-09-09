CREATE TABLE `carcass_class_dict` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned,
	`code` varchar(32) NOT NULL,
	`label` varchar(128) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `carcass_class_dict_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `carcass_classifications` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`slaughterBatchId` bigint unsigned NOT NULL,
	`classCode` varchar(32) NOT NULL,
	`count` int NOT NULL,
	`weightKg` decimal(12,2) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `carcass_classifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slaughter_batches` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`planId` bigint unsigned,
	`companyId` bigint unsigned NOT NULL,
	`farmId` bigint unsigned NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`isDemo` boolean NOT NULL DEFAULT false,
	`status` enum('created','transport','reception','slaughtered','settled','closed') NOT NULL DEFAULT 'created',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `slaughter_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `slaughter_batches_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `slaughter_events` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`slaughterBatchId` bigint unsigned NOT NULL,
	`eventType` varchar(48) NOT NULL,
	`message` varchar(255) NOT NULL,
	`payload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `slaughter_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slaughter_plans` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`farmId` bigint unsigned NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`plannedDate` date NOT NULL,
	`plannedCount` int NOT NULL,
	`targetAvgWeightKg` decimal(6,3),
	`status` enum('planned','confirmed','inProgress','completed','cancelled') NOT NULL DEFAULT 'planned',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `slaughter_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slaughter_receptions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`slaughterBatchId` bigint unsigned NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`receivedCount` int NOT NULL,
	`deadOnArrival` int NOT NULL DEFAULT 0,
	`rejectedCount` int NOT NULL DEFAULT 0,
	`liveWeightKg` decimal(12,2) NOT NULL,
	`notes` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `slaughter_receptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slaughter_results` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`slaughterBatchId` bigint unsigned NOT NULL,
	`slaughteredAt` timestamp NOT NULL DEFAULT (now()),
	`carcassCount` int NOT NULL,
	`carcassWeightKg` decimal(12,2) NOT NULL,
	`yieldPct` decimal(5,2) NOT NULL,
	`wasteKg` decimal(10,2) NOT NULL DEFAULT '0.00',
	`byproductsKg` decimal(10,2) NOT NULL DEFAULT '0.00',
	`notes` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `slaughter_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `slaughter_settlements` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`slaughterBatchId` bigint unsigned NOT NULL,
	`pricePerKg` decimal(8,3) NOT NULL,
	`bonuses` decimal(10,2) NOT NULL DEFAULT '0.00',
	`deductions` decimal(10,2) NOT NULL DEFAULT '0.00',
	`grossAmount` decimal(12,2) NOT NULL,
	`netAmount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'PLN',
	`documentNumber` varchar(64),
	`settledAt` date,
	`notes` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `slaughter_settlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transports` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`slaughterBatchId` bigint unsigned NOT NULL,
	`vehiclePlate` varchar(32),
	`driverName` varchar(128),
	`cratesCount` int,
	`loadedCount` int NOT NULL DEFAULT 0,
	`loadStartAt` timestamp,
	`loadEndAt` timestamp,
	`departureAt` timestamp,
	`arrivalAt` timestamp,
	`distanceKm` decimal(8,1),
	`transportCost` decimal(10,2) NOT NULL DEFAULT '0.00',
	`deadInTransport` int NOT NULL DEFAULT 0,
	`notes` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `transports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `companies` ADD `isDemo` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `address` varchar(255);--> statement-breakpoint
ALTER TABLE `companies` ADD `nip` varchar(16);--> statement-breakpoint
ALTER TABLE `companies` ADD `contact` varchar(255);--> statement-breakpoint
ALTER TABLE `companies` ADD `declaredHouses` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `farms` ADD `isDemo` boolean DEFAULT false NOT NULL;