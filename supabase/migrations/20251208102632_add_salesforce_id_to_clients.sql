-- Add salesforce_id column for future CRM integration
ALTER TABLE clients ADD COLUMN salesforce_id TEXT UNIQUE;

-- Add index for lookups (partial index for non-null values only)
CREATE INDEX idx_clients_salesforce_id ON clients(salesforce_id) WHERE salesforce_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN clients.salesforce_id IS 'Salesforce Account/Contact ID for CRM integration (15 or 18 character format)';
