-- ============================================================
-- Migration 005: Option Groups (replaces flat price_item_options)
--
-- Each price item can have zero or more *option groups* — independent
-- selection axes that the salesperson chooses from when quoting.
--
-- Example: PVDB/GPU
--   Group "Configuration"  → Normal (+$0) | Master-Slave (+$2,200)
--   Group "Enclosure"      → Internal mild steel (+$0)
--                          | External mild steel (+$850)
--                          | External stainless steel (+$1,600)
--
-- The total for a line item is:
--   formula_total + SUM( modifier_value for each selected option )
-- (or a percent markup, or a full price replacement — see modifier_type)
-- ============================================================

-- Drop the old flat table from migration 004 (no data yet)
DROP TABLE IF EXISTS public.price_item_options;

-- ── Option groups ─────────────────────────────────────────────
-- One row per named dimension of choice for a price item.

CREATE TABLE public.price_item_option_groups (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  price_item_id UUID NOT NULL REFERENCES public.price_items(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,          -- e.g. "Configuration", "Enclosure Type"
  sort_order    INT  NOT NULL DEFAULT 0,
  is_required   BOOLEAN NOT NULL DEFAULT FALSE,  -- if true, salesperson must pick one
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX price_item_option_groups_item_idx
  ON public.price_item_option_groups (price_item_id);

-- ── Options ───────────────────────────────────────────────────
-- One row per selectable choice within a group.

CREATE TABLE public.price_item_options (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id      UUID NOT NULL REFERENCES public.price_item_option_groups(id) ON DELETE CASCADE,
  price_item_id UUID NOT NULL REFERENCES public.price_items(id) ON DELETE CASCADE,  -- denormalised for fast lookup
  label         TEXT NOT NULL,          -- e.g. "Master-Slave", "External Stainless Steel"
  -- How this option modifies the formula-evaluated line total:
  --   flat    → add modifier_value dollars (absolute, not per-unit)
  --   percent → multiply total by (1 + modifier_value / 100)
  --   replace → set total to modifier_value regardless of formula
  modifier_type  TEXT NOT NULL DEFAULT 'flat'
                   CHECK (modifier_type IN ('flat', 'percent', 'replace')),
  modifier_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order     INT  NOT NULL DEFAULT 0,
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX price_item_options_group_idx
  ON public.price_item_options (group_id);
CREATE INDEX price_item_options_item_idx
  ON public.price_item_options (price_item_id);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.price_item_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_item_options       ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "option_groups_select" ON public.price_item_option_groups
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "options_select" ON public.price_item_options
  FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can write (internal tool — DB is not public-facing)
CREATE POLICY "option_groups_write" ON public.price_item_option_groups
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "options_write" ON public.price_item_options
  FOR ALL USING (auth.role() = 'authenticated');
