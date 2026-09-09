CREATE TABLE `daily_logs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`day` date NOT NULL,
	`mortality` int NOT NULL DEFAULT 0,
	`culls` int NOT NULL DEFAULT 0,
	`waterLiters` decimal(12,1),
	`feedKg` decimal(12,1),
	`tempC` decimal(4,1),
	`humidityPct` decimal(4,1),
	`ammoniaPpm` decimal(5,1),
	`note` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `daily_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feed_deliveries` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`siloId` bigint unsigned NOT NULL,
	`batchId` bigint unsigned NOT NULL,
	`recipeId` bigint unsigned,
	`day` date NOT NULL,
	`kg` decimal(12,1) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `feed_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feed_program_stages` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`programId` bigint unsigned NOT NULL,
	`name` varchar(128) NOT NULL,
	`dayFrom` int NOT NULL,
	`dayTo` int NOT NULL,
	`recipeId` bigint unsigned,
	`proteinTargetPct` decimal(5,2),
	`energyTargetKcal` int,
	`feedPerBirdG` int,
	CONSTRAINT `feed_program_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feed_programs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`sex` enum('toms','hens','mixed') NOT NULL DEFAULT 'mixed',
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `feed_programs_id` PRIMARY KEY(`id`)
);
