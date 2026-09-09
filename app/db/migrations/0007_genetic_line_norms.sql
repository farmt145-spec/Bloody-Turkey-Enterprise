CREATE TABLE `genetic_line_norms` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`geneticLineId` bigint unsigned NOT NULL,
	`phaseKey` varchar(32) NOT NULL,
	`dayFrom` int NOT NULL,
	`dayTo` int NOT NULL,
	`proteinPct` decimal(5,2) NOT NULL,
	`energyKcal` int NOT NULL,
	`lysinePct` decimal(5,3) NOT NULL,
	`methioninePct` decimal(5,3) NOT NULL,
	`feedPerBirdG` int NOT NULL DEFAULT 0,
	`targetWeightG` int NOT NULL DEFAULT 0,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `genetic_line_norms_id` PRIMARY KEY(`id`)
);
