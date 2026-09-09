CREATE TABLE `biosecurity_checks` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`farmId` bigint unsigned NOT NULL,
	`day` date NOT NULL,
	`area` varchar(128) NOT NULL,
	`checkName` varchar(255) NOT NULL,
	`passed` boolean NOT NULL DEFAULT true,
	`score` int,
	`inspector` varchar(255) NOT NULL DEFAULT 'system',
	`note` varchar(500),
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `biosecurity_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `climate_logs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`houseId` bigint unsigned NOT NULL,
	`ts` timestamp NOT NULL DEFAULT (now()),
	`tempC` decimal(4,1),
	`humidityPct` decimal(4,1),
	`co2Ppm` int,
	`ammoniaPpm` decimal(5,1),
	`ventilationPct` int,
	`source` varchar(32) NOT NULL DEFAULT 'sensor',
	CONSTRAINT `climate_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`party` varchar(255) NOT NULL,
	`kind` enum('purchase','sale','service','lease') NOT NULL,
	`number` varchar(64) NOT NULL,
	`validFrom` date NOT NULL,
	`validTo` date,
	`valueEur` decimal(14,2),
	`terms` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` enum('vet','contract','invoice','protocol','certificate','other') NOT NULL DEFAULT 'other',
	`reference` varchar(128),
	`docDate` date NOT NULL,
	`url` varchar(500),
	`note` varchar(500),
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `energy_logs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`farmId` bigint unsigned NOT NULL,
	`kind` enum('power','gas','water','fuel') NOT NULL,
	`day` date NOT NULL,
	`consumption` decimal(12,2) NOT NULL,
	`unit` varchar(16) NOT NULL,
	`costEur` decimal(12,2) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `energy_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hatchery_batches` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`geneticLineId` bigint unsigned NOT NULL,
	`code` varchar(64) NOT NULL,
	`eggsSet` int NOT NULL,
	`fertilePct` decimal(5,2),
	`hatchedCount` int,
	`hatchPct` decimal(5,2),
	`setDate` date NOT NULL,
	`hatchDate` date,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `hatchery_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`number` varchar(64) NOT NULL,
	`kind` enum('sale','purchase') NOT NULL,
	`counterparty` varchar(255) NOT NULL,
	`issueDate` date NOT NULL,
	`dueDate` date,
	`amountNet` decimal(14,2) NOT NULL,
	`vatPct` int NOT NULL DEFAULT 23,
	`currency` varchar(3) NOT NULL DEFAULT 'EUR',
	`paid` boolean NOT NULL DEFAULT false,
	`batchId` bigint unsigned,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lab_results` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`farmId` bigint unsigned NOT NULL,
	`batchId` bigint unsigned,
	`sampleType` enum('blood','swab','water','feed','litter','carcass') NOT NULL,
	`testName` varchar(255) NOT NULL,
	`resultValue` varchar(255) NOT NULL,
	`unit` varchar(32),
	`refRange` varchar(64),
	`verdict` enum('ok','warning','critical') NOT NULL DEFAULT 'ok',
	`labName` varchar(255),
	`day` date NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `lab_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenance_tickets` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`farmId` bigint unsigned NOT NULL,
	`houseId` bigint unsigned,
	`title` varchar(255) NOT NULL,
	`description` text,
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`ticketStatus` enum('open','in_progress','done','cancelled') NOT NULL DEFAULT 'open',
	`reportedBy` varchar(255) NOT NULL DEFAULT 'system',
	`dueDate` date,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `maintenance_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `medicines` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`substance` varchar(255),
	`form` varchar(64),
	`stockQty` decimal(12,2) NOT NULL DEFAULT '0',
	`unit` varchar(16) NOT NULL DEFAULT 'ml',
	`expiryDate` date,
	`minStock` decimal(12,2) NOT NULL DEFAULT '0',
	`pricePerUnit` decimal(10,2),
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `medicines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`author` varchar(255) NOT NULL DEFAULT 'system',
	`channel` varchar(64) NOT NULL DEFAULT 'general',
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`title` varchar(255) NOT NULL,
	`body` varchar(500),
	`link` varchar(255),
	`read_flag` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`supplierId` bigint unsigned NOT NULL,
	`number` varchar(64) NOT NULL,
	`item` varchar(255) NOT NULL,
	`quantity` decimal(14,2) NOT NULL,
	`unit` varchar(16) NOT NULL DEFAULT 'kg',
	`priceNet` decimal(14,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'EUR',
	`orderDate` date NOT NULL,
	`deliveryDate` date,
	`orderStatus` enum('draft','sent','confirmed','delivered','cancelled') NOT NULL DEFAULT 'draft',
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` enum('feed','chicks','medicine','equipment','energy','transport','other') NOT NULL,
	`countryCode` varchar(2),
	`nip` varchar(32),
	`email` varchar(255),
	`phone` varchar(32),
	`rating` int NOT NULL DEFAULT 3,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`farmId` bigint unsigned,
	`title` varchar(255) NOT NULL,
	`description` text,
	`assignee` varchar(255),
	`dueDate` date,
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`done` boolean NOT NULL DEFAULT false,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedBy` varchar(255) NOT NULL DEFAULT 'system',
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
