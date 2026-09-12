-- Dodaj kolumnę userRole do users (worker/manager/admin)
ALTER TABLE users ADD COLUMN userRole VARCHAR(20) NOT NULL DEFAULT 'worker' COMMENT 'Rola w firmie: worker, manager, admin';

