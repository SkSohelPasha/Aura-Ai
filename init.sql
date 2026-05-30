-- Enable UUID extension (tables are created by SQLAlchemy on startup)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for full-text search later

-- Optional: seed data for development
-- INSERT INTO users ...
