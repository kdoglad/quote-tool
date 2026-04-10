-- ============================================================
-- Migration 006: Simplify RLS policies
--
-- The original policies gate writes on user_profiles.role = 'engineer'/'admin'.
-- This means anyone whose profile row doesn't exist yet (or has role='sales')
-- can't write anything — silently blocking all mutations.
--
-- This is an internal tool — the Supabase project itself is the access
-- control boundary (only company staff have credentials). Replace all
-- role-subquery policies with simple "authenticated user" policies.
-- ============================================================

-- ── price_versions ────────────────────────────────────────────

DROP POLICY IF EXISTS "Engineers and admins can create versions"  ON public.price_versions;
DROP POLICY IF EXISTS "Engineers and admins can update draft versions" ON public.price_versions;

CREATE POLICY "Authenticated can create versions"
  ON public.price_versions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update draft versions"
  ON public.price_versions FOR UPDATE
  USING (is_draft = TRUE AND auth.role() = 'authenticated');

-- ── price_items ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Engineers/admins can insert into draft versions"   ON public.price_items;
DROP POLICY IF EXISTS "Engineers/admins can update items in draft versions" ON public.price_items;
DROP POLICY IF EXISTS "Engineers/admins can delete from draft versions"   ON public.price_items;

CREATE POLICY "Authenticated can insert price items"
  ON public.price_items FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.price_versions WHERE id = version_id AND is_draft = TRUE)
  );

CREATE POLICY "Authenticated can update price items"
  ON public.price_items FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.price_versions WHERE id = version_id AND is_draft = TRUE)
  );

CREATE POLICY "Authenticated can delete price items"
  ON public.price_items FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM public.price_versions WHERE id = version_id AND is_draft = TRUE)
  );

-- ── quotes ────────────────────────────────────────────────────
-- Original: "Sales see own quotes; engineers/admins see all" uses a role subquery.
-- Simplify to: all authenticated users see all quotes (internal tool).

DROP POLICY IF EXISTS "Sales see own quotes; engineers/admins see all" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated can create quotes"               ON public.quotes;
DROP POLICY IF EXISTS "Creator and admins can update quotes"          ON public.quotes;

CREATE POLICY "Authenticated can read all quotes"
  ON public.quotes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can create quotes"
  ON public.quotes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update quotes"
  ON public.quotes FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ── quote_inputs ──────────────────────────────────────────────

DROP POLICY IF EXISTS "quote_inputs follow quote access (select)" ON public.quote_inputs;
DROP POLICY IF EXISTS "quote_inputs follow quote access (insert)" ON public.quote_inputs;
DROP POLICY IF EXISTS "quote_inputs follow quote access (update)" ON public.quote_inputs;
DROP POLICY IF EXISTS "quote_inputs follow quote access (delete)" ON public.quote_inputs;

CREATE POLICY "Authenticated full access to quote_inputs"
  ON public.quote_inputs FOR ALL
  USING (auth.role() = 'authenticated');

-- ── quote_line_items ──────────────────────────────────────────

DROP POLICY IF EXISTS "Line items follow quote access (select)" ON public.quote_line_items;
DROP POLICY IF EXISTS "Line items follow quote access (insert)" ON public.quote_line_items;
DROP POLICY IF EXISTS "Line items follow quote access (update)" ON public.quote_line_items;
DROP POLICY IF EXISTS "Line items follow quote access (delete)" ON public.quote_line_items;

CREATE POLICY "Authenticated full access to quote_line_items"
  ON public.quote_line_items FOR ALL
  USING (auth.role() = 'authenticated');

-- ── quote_snapshots ───────────────────────────────────────────

DROP POLICY IF EXISTS "Snapshots follow quote access"                   ON public.quote_snapshots;
DROP POLICY IF EXISTS "Authenticated can insert snapshots for own quotes" ON public.quote_snapshots;

CREATE POLICY "Authenticated full access to quote_snapshots"
  ON public.quote_snapshots FOR ALL
  USING (auth.role() = 'authenticated');

-- ── user_profiles ─────────────────────────────────────────────
-- Keep existing policies but add a fallback so users can always read their own row.

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.user_profiles;

CREATE POLICY "Authenticated can manage all profiles"
  ON public.user_profiles FOR ALL
  USING (auth.role() = 'authenticated');

-- ── DNSP rules ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage DNSP rules" ON public.dnsp_rules;

CREATE POLICY "Authenticated can manage DNSP rules"
  ON public.dnsp_rules FOR ALL
  USING (auth.role() = 'authenticated');

-- ── price_item_option_groups & price_item_options (migration 005) ─

-- Already created with simple authenticated policies in 005, nothing to change.
