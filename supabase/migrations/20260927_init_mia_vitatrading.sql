-- ==============================================================================
-- MIGRACIÓN SUPABASE: ESQUEMA AISLADO mia_vitatrading (BY TONI)
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS mia_vitatrading;
GRANT USAGE ON SCHEMA mia_vitatrading TO anon, authenticated, service_role, authenticator;
GRANT ALL ON ALL TABLES IN SCHEMA mia_vitatrading TO anon, authenticated, service_role, authenticator;
GRANT ALL ON ALL SEQUENCES IN SCHEMA mia_vitatrading TO anon, authenticated, service_role, authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA mia_vitatrading GRANT ALL ON TABLES TO anon, authenticated, service_role, authenticator;

CREATE TABLE IF NOT EXISTS mia_vitatrading.accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  broker TEXT,
  firm TEXT,
  type TEXT NOT NULL,
  phase TEXT NOT NULL,
  currency TEXT DEFAULT 'USD',
  initial_balance NUMERIC NOT NULL,
  current_balance NUMERIC NOT NULL,
  profit_target NUMERIC,
  drawdown_limit NUMERIC,
  drawdown_type TEXT DEFAULT 'trailing',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mia_vitatrading.strategies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  timeframe TEXT,
  win_rate NUMERIC,
  profit_factor NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mia_vitatrading.trades (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES mia_vitatrading.accounts(id) ON DELETE CASCADE,
  strategy_id TEXT REFERENCES mia_vitatrading.strategies(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  size NUMERIC NOT NULL,
  pnl NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  open_time TIMESTAMPTZ DEFAULT now(),
  close_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mia_vitatrading.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mia_vitatrading.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mia_vitatrading.trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for accounts" ON mia_vitatrading.accounts;
DROP POLICY IF EXISTS "Allow all for strategies" ON mia_vitatrading.strategies;
DROP POLICY IF EXISTS "Allow all for trades" ON mia_vitatrading.trades;

CREATE POLICY "Allow all for accounts" ON mia_vitatrading.accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for strategies" ON mia_vitatrading.strategies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for trades" ON mia_vitatrading.trades FOR ALL USING (true) WITH CHECK (true);
