-- Migracja: autentykacja
-- Uruchom przed deploy: node dist/migrate-all.js

-- Rozszerz tabelę users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS passwordHash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS isActive BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS resetToken VARCHAR(255),
  ADD COLUMN IF NOT EXISTS resetTokenExpiry TIMESTAMP,
  ADD COLUMN IF NOT EXISTS farmId BIGINT UNSIGNED;

-- Zmień enum role (MySQL nie pozwala na IF NOT EXISTS dla MODIFY)
-- ALTER TABLE users MODIFY COLUMN role ENUM('owner', 'admin', 'user', 'viewer') DEFAULT 'user';

-- Dodaj unique na email (jeśli nie istnieje)
-- ALTER TABLE users ADD UNIQUE KEY idx_users_email (email);

-- Tabela sesji (opcjonalnie)
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  userId BIGINT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expiresAt TIMESTAMP NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ipAddress VARCHAR(45),
  userAgent TEXT,
  INDEX idx_sessions_user (userId),
  INDEX idx_sessions_token (token)
);

-- Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_users_company ON users(companyId);
CREATE INDEX IF NOT EXISTS idx_users_reset ON users(resetToken);
