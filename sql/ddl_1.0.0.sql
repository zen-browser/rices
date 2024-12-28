--DROP TABLE IF EXISTS rices;

CREATE TABLE rices (
    id UUID NOT NULL,                      -- Unique identifier
    slug VARCHAR(75) NOT NULL,             -- Unique user-friendly identifier
    version VARCHAR(10) NOT NULL,          -- Data version
    os VARCHAR(30) NOT NULL,               -- Operating system
    name VARCHAR(75) NOT NULL,             -- Name of the rice
    author VARCHAR(100) NOT NULL,             -- Name of the rice
    token UUID NOT NULL,                   -- Unique authorization token
    visits INTEGER DEFAULT 0 NOT NULL,     -- Visit counter, initialized to 0
    level INTEGER DEFAULT 0 NOT NULL,      -- Level: 0 (Public), 1 (Verified)
    created_at TIMESTAMP DEFAULT NOW(),    -- Creation date
    updated_at TIMESTAMP,                  -- Last update date
    PRIMARY KEY (id),                -- Composite primary key
    UNIQUE (slug)                         -- Ensure slug is unique
);

CREATE OR REPLACE FUNCTION increment_visits(slug_param TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE rices
  SET visits = visits + 1
  WHERE slug = slug_param;
END;
$$ LANGUAGE plpgsql;