-- Add password column to users table for authentication
ALTER TABLE `users` ADD COLUMN `password` varchar(255);

