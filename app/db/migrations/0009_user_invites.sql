CREATE TABLE `user_invites` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`companyId` bigint unsigned NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('worker','manager','admin') NOT NULL DEFAULT 'worker',
	`token` varchar(64) NOT NULL,
	`status` enum('pending','accepted','cancelled') NOT NULL DEFAULT 'pending',
	`message` text,
	`sentAt` timestamp DEFAULT CURRENT_TIMESTAMP,
	`acceptedAt` timestamp,
	`createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_invites_id` PRIMARY KEY (`id`),
	CONSTRAINT `user_invites_token_unique` UNIQUE KEY (`token`)
);

