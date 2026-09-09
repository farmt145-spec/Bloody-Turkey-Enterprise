ALTER TABLE `slaughter_plans` MODIFY COLUMN `status` enum('active','archived','planned','confirmed','inProgress','completed','cancelled') NOT NULL DEFAULT 'planned';
--> statement-breakpoint
UPDATE `slaughter_plans` SET `status` = 'planned' WHERE `status` NOT IN ('planned','confirmed','inProgress','completed','cancelled');
--> statement-breakpoint
ALTER TABLE `slaughter_plans` MODIFY COLUMN `status` enum('planned','confirmed','inProgress','completed','cancelled') NOT NULL DEFAULT 'planned';
--> statement-breakpoint
ALTER TABLE `slaughter_batches` MODIFY COLUMN `status` enum('active','archived','created','transport','reception','slaughtered','settled','closed') NOT NULL DEFAULT 'created';
--> statement-breakpoint
UPDATE `slaughter_batches` SET `status` = 'created' WHERE `status` NOT IN ('created','transport','reception','slaughtered','settled','closed');
--> statement-breakpoint
ALTER TABLE `slaughter_batches` MODIFY COLUMN `status` enum('created','transport','reception','slaughtered','settled','closed') NOT NULL DEFAULT 'created';
