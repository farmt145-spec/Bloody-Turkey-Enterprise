-- Migracja: moduł finansowy
-- Uruchom na bazie przed deploy

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  companyId BIGINT UNSIGNED NOT NULL,
  farmId BIGINT UNSIGNED,
  type ENUM('purchase', 'sale', 'cost', 'correction') NOT NULL,
  number VARCHAR(50) NOT NULL UNIQUE,
  externalNumber VARCHAR(100),
  counterpartyId BIGINT UNSIGNED,
  counterpartyName VARCHAR(255) NOT NULL,
  counterpartyNip VARCHAR(16),
  counterpartyAddress TEXT,
  issueDate DATE NOT NULL,
  saleDate DATE,
  dueDate DATE NOT NULL,
  paymentDate DATE,
  netAmount DECIMAL(12,2) NOT NULL,
  vatAmount DECIMAL(12,2) NOT NULL,
  grossAmount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PLN',
  exchangeRate DECIMAL(10,4) DEFAULT 1.0000,
  paymentStatus ENUM('unpaid', 'partial', 'paid', 'overdue') DEFAULT 'unpaid',
  paidAmount DECIMAL(12,2) DEFAULT 0.00,
  category ENUM('feed', 'chicks', 'medicine', 'equipment', 'energy', 'labor', 'transport', 'veterinary', 'insurance', 'tax', 'other') NOT NULL,
  batchId BIGINT UNSIGNED,
  slaughterBatchId BIGINT UNSIGNED,
  isActive BOOLEAN DEFAULT TRUE,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  createdBy BIGINT UNSIGNED,
  INDEX idx_company_type (companyId, type),
  INDEX idx_company_status (companyId, paymentStatus),
  INDEX idx_company_date (companyId, issueDate),
  INDEX idx_batch (batchId)
);

CREATE TABLE IF NOT EXISTS invoiceItems (
  id SERIAL PRIMARY KEY,
  invoiceId BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(20) DEFAULT 'szt.',
  quantity DECIMAL(10,3) NOT NULL,
  unitPrice DECIMAL(12,4) NOT NULL,
  netAmount DECIMAL(12,2) NOT NULL,
  vatRate DECIMAL(4,2) NOT NULL,
  vatAmount DECIMAL(12,2) NOT NULL,
  grossAmount DECIMAL(12,2) NOT NULL,
  category VARCHAR(50),
  INDEX idx_invoice (invoiceId)
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  companyId BIGINT UNSIGNED NOT NULL,
  invoiceId BIGINT UNSIGNED,
  type ENUM('income', 'expense', 'transfer') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PLN',
  paymentDate DATE NOT NULL,
  method ENUM('cash', 'bank_transfer', 'card', 'direct_debit', 'other') NOT NULL,
  counterpartyName VARCHAR(255),
  category ENUM('feed', 'chicks', 'medicine', 'equipment', 'energy', 'labor', 'transport', 'veterinary', 'insurance', 'tax', 'other') NOT NULL,
  batchId BIGINT UNSIGNED,
  farmId BIGINT UNSIGNED,
  isConfirmed BOOLEAN DEFAULT FALSE,
  confirmedAt TIMESTAMP,
  confirmedBy BIGINT UNSIGNED,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  createdBy BIGINT UNSIGNED,
  INDEX idx_company_date (companyId, paymentDate),
  INDEX idx_invoice (invoiceId)
);

CREATE TABLE IF NOT EXISTS counterparties (
  id SERIAL PRIMARY KEY,
  companyId BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('supplier', 'customer', 'both') NOT NULL,
  nip VARCHAR(16),
  regon VARCHAR(16),
  krs VARCHAR(16),
  address TEXT,
  city VARCHAR(100),
  postalCode VARCHAR(10),
  country VARCHAR(2) DEFAULT 'PL',
  email VARCHAR(320),
  phone VARCHAR(20),
  website VARCHAR(255),
  bankAccount VARCHAR(34),
  bankName VARCHAR(255),
  supplierCategory ENUM('feed', 'chicks', 'medicine', 'equipment', 'transport', 'veterinary', 'other'),
  isActive BOOLEAN DEFAULT TRUE,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_company (companyId),
  INDEX idx_nip (nip)
);

CREATE TABLE IF NOT EXISTS fixedCosts (
  id SERIAL PRIMARY KEY,
  companyId BIGINT UNSIGNED NOT NULL,
  farmId BIGINT UNSIGNED,
  name VARCHAR(255) NOT NULL,
  category ENUM('rent', 'insurance', 'depreciation', 'salary', 'utilities', 'maintenance', 'other') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PLN',
  period ENUM('monthly', 'quarterly', 'yearly') NOT NULL,
  startDate DATE NOT NULL,
  endDate DATE,
  autoPost BOOLEAN DEFAULT FALSE,
  autoPostDay INT DEFAULT 1,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  companyId BIGINT UNSIGNED NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  category ENUM('feed', 'chicks', 'medicine', 'equipment', 'energy', 'labor', 'transport', 'veterinary', 'insurance', 'tax', 'other', 'revenue') NOT NULL,
  plannedAmount DECIMAL(12,2) NOT NULL,
  actualAmount DECIMAL(12,2) DEFAULT 0.00,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_budget (companyId, year, month, category)
);

CREATE TABLE IF NOT EXISTS exchangeRates (
  id SERIAL PRIMARY KEY,
  currency VARCHAR(3) NOT NULL,
  date DATE NOT NULL,
  rate DECIMAL(10,4) NOT NULL,
  source VARCHAR(100),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_rate (currency, date)
);
