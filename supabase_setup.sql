-- SQL to set up tables and RLS for the Code Rush app
-- Run this in your Supabase SQL Editor

-- 1. Create ships table
CREATE TABLE IF NOT EXISTS ships (
    ship_id TEXT PRIMARY KEY,
    name TEXT,
    lat FLOAT8,
    lng FLOAT8,
    speed FLOAT,
    heading FLOAT,
    destination TEXT,
    fuel FLOAT,
    cargo TEXT,
    status TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create zones table
CREATE TABLE IF NOT EXISTS zones (
    id TEXT PRIMARY KEY,
    name TEXT,
    coordinates JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    ship_id TEXT,
    ship_id_b TEXT,
    type TEXT,
    message TEXT,
    severity TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create ship_snapshots table
CREATE TABLE IF NOT EXISTS ship_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot JSONB,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS and setup policies for Anonymous access (for competition/testing)
ALTER TABLE ships ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ship_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for anon" ON ships FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON zones FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON alerts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON ship_snapshots FOR ALL TO anon USING (true) WITH CHECK (true);
