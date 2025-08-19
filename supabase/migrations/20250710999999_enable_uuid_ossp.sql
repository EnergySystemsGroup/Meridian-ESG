-- Enable uuid-ossp extension before other migrations need it
-- This ensures uuid_generate_v4() function is available for subsequent migrations

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;