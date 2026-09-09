CREATE TABLE `audit_log` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tableName` varchar(64) NOT NULL,
	`recordId` bigint unsigned NOT NULL,
	`action` enum('create','update','delete') NOT NULL,
	`oldValues` json,
	`newValues` json,
	`author` varchar(255) NOT NULL DEFAULT 'system',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `batches` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`houseId` bigint unsigned NOT NULL,
	`sectorId` bigint unsigned,
	`geneticLineId` bigint unsigned,
	`code` varchar(64) NOT NULL,
	`geneticLine` varchar(128) NOT NULL,
	`sex` enum('toms','hens','mixed') NOT NULL,
	`chickSupplier` varchar(255),
	`chickPrice` decimal(8,3) NOT NULL DEFAULT '0.000',
	`startDate` date NOT NULL,
	`plannedEndDate` date,
	`initialCount` int NOT NULL,
	`currentCount` int NOT NULL,
	`soldCount` int NOT NULL DEFAULT 0,
	`status` enum('active','closed','planned','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`countryCode` varchar(2) NOT NULL,
	`baseCurrency` varchar(3) NOT NULL DEFAULT 'EUR',
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `costs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`category` enum('chicks','feed','vet','energy','litter','labor','transport','other') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'EUR',
	`day` date NOT NULL,
	`note` varchar(255),
	CONSTRAINT `costs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `farms` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`countryCode` varchar(2) NOT NULL,
	`city` varchar(255) NOT NULL,
	`lat` decimal(9,5) NOT NULL,
	`lng` decimal(9,5) NOT NULL,
	`capacity` int NOT NULL DEFAULT 0,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `farms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feed_ingredients` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned,
	`name` varchar(255) NOT NULL,
	`countryCode` varchar(2) NOT NULL,
	`pricePerTon` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'EUR',
	`proteinPct` decimal(5,2) NOT NULL,
	`energyKcal` int NOT NULL,
	`lysinePct` decimal(5,3) NOT NULL DEFAULT '0',
	`methioninePct` decimal(5,3) NOT NULL DEFAULT '0',
	`fiberPct` decimal(5,2) NOT NULL DEFAULT '0',
	`fatPct` decimal(5,2) NOT NULL DEFAULT '0',
	`calciumPct` decimal(5,2) NOT NULL DEFAULT '0',
	`phosphorusPct` decimal(5,2) NOT NULL DEFAULT '0',
	`stockTons` decimal(10,2) NOT NULL DEFAULT '0',
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `feed_ingredients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feed_usages` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`day` date NOT NULL,
	`kg` decimal(12,1) NOT NULL,
	`recipeId` bigint unsigned,
	CONSTRAINT `feed_usages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `genetic_lines` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`name` varchar(128) NOT NULL,
	`supplier` varchar(255),
	`notes` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `genetic_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `houses` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`farmId` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`houseType` enum('brooder','finisher') NOT NULL,
	`areaM2` decimal(10,1) NOT NULL,
	`maxDensityKgM2` decimal(5,1) NOT NULL DEFAULT '42.0',
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `houses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `litter` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`houseId` bigint unsigned NOT NULL,
	`material` varchar(128) NOT NULL,
	`thicknessCm` decimal(4,1) NOT NULL,
	`moisturePct` decimal(5,2),
	`cost` decimal(10,2) NOT NULL DEFAULT '0',
	`laidAt` date NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `litter_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mortalities` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`day` date NOT NULL,
	`count` int NOT NULL,
	`cause` varchar(255),
	CONSTRAINT `mortalities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipe_items` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`recipeId` bigint unsigned NOT NULL,
	`ingredientId` bigint unsigned NOT NULL,
	`percent` decimal(5,2) NOT NULL,
	CONSTRAINT `recipe_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned,
	`name` varchar(255) NOT NULL,
	`ageGroup` varchar(64) NOT NULL,
	`strategy` enum('cheapest','maxGrowth','balanced') NOT NULL,
	`costPerTon` decimal(10,2) NOT NULL,
	`proteinPct` decimal(5,2) NOT NULL,
	`energyKcal` int NOT NULL,
	`lysinePct` decimal(5,3) NOT NULL,
	`explanation` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recipes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`day` date NOT NULL,
	`birdCount` int NOT NULL,
	`totalWeightKg` decimal(12,1) NOT NULL,
	`pricePerKg` decimal(6,3) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'EUR',
	`buyer` varchar(255),
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_events` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`day` date NOT NULL,
	`eventType` enum('placement','vaccination','weighing','feedChange','litter','treatment','sampling','washing','disinfection','housePrep','sale') NOT NULL,
	`title` varchar(255) NOT NULL,
	`done` boolean NOT NULL DEFAULT false,
	`doneAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `schedule_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sectors` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`houseId` bigint unsigned NOT NULL,
	`name` varchar(128) NOT NULL,
	`areaM2` decimal(10,1) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `sectors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `selects` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`name` varchar(128) NOT NULL,
	`criteria` varchar(255) NOT NULL,
	`origin` enum('manual','dynamic') NOT NULL DEFAULT 'manual',
	`birdCount` int NOT NULL,
	`avgWeightG` int NOT NULL,
	`fcr` decimal(5,3),
	`mortalityPct` decimal(5,2),
	`waterIntakeMl` int,
	`status` enum('ok','warning','critical') NOT NULL DEFAULT 'ok',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `selects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `silos` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`farmId` bigint unsigned NOT NULL,
	`name` varchar(128) NOT NULL,
	`capacityTons` decimal(10,1) NOT NULL,
	`currentTons` decimal(10,2) NOT NULL DEFAULT '0',
	`recipeId` bigint unsigned,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `silos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`sourceBatchId` bigint unsigned NOT NULL,
	`targetBatchId` bigint unsigned NOT NULL,
	`birdCount` int NOT NULL,
	`avgWeightG` int,
	`transportMortality` int NOT NULL DEFAULT 0,
	`transferDate` timestamp NOT NULL,
	`durationMin` int,
	`driver` varchar(255),
	`vehicle` varchar(255),
	`signatureFrom` varchar(255),
	`signatureTo` varchar(255),
	`documentNo` varchar(64) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `transfers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `treatments` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`startedAt` date NOT NULL,
	`product` varchar(255) NOT NULL,
	`activeSubstance` varchar(255) NOT NULL,
	`dose` varchar(128) NOT NULL,
	`reason` varchar(255),
	`withdrawalDays` int NOT NULL DEFAULT 0,
	`vet` varchar(255),
	`cost` decimal(10,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `treatments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`unionId` varchar(255) NOT NULL,
	`name` varchar(255),
	`email` varchar(320),
	`avatar` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`companyId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignInAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_unionId_unique` UNIQUE(`unionId`)
);
--> statement-breakpoint
CREATE TABLE `vaccinations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`day` date NOT NULL,
	`vaccine` varchar(255) NOT NULL,
	`method` varchar(128),
	`done` boolean NOT NULL DEFAULT false,
	CONSTRAINT `vaccinations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`farmId` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`capacityTons` decimal(10,1) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weighings` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`weighedAt` timestamp NOT NULL,
	`dayAge` int NOT NULL,
	`sampleSize` int NOT NULL,
	`avgWeightG` int NOT NULL,
	`medianG` int,
	`stdDevG` int,
	`minG` int,
	`maxG` int,
	`cv` decimal(5,2),
	`operator` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weighings_id` PRIMARY KEY(`id`)
);
