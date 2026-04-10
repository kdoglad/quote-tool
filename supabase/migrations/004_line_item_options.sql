-- ============================================================
-- Migration 004: Price Item Options (Variant Selectors)
-- Allows each price item to have multiple selectable options
-- with individual prices (e.g. different panel brands/models).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.price_item_options (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  price_item_id UUID NOT NULL REFERENCES public.price_items(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,              -- e.g. "Jinko Tiger Neo 475W"
  unit_price    NUMERIC(12, 2) NOT NULL,    -- overrides base_price when selected
  notes         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS price_item_options_price_item_id_idx
  ON public.price_item_options (price_item_id);

-- At most one default per price_item_id
CREATE UNIQUE INDEX IF NOT EXISTS price_item_options_one_default_idx
  ON public.price_item_options (price_item_id)
  WHERE is_default = TRUE;

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.price_item_options ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read options
CREATE POLICY "options_select_authenticated"
  ON public.price_item_options FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins and engineers can write options (draft versions only)
CREATE POLICY "options_insert_engineers"
  ON public.price_item_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'engineer')
        AND is_active = TRUE
    )
  );

CREATE POLICY "options_update_engineers"
  ON public.price_item_options FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'engineer')
        AND is_active = TRUE
    )
  );

CREATE POLICY "options_delete_engineers"
  ON public.price_item_options FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'engineer')
        AND is_active = TRUE
    )
  );

-- ── Example seed data (commented out — add via price table editor UI) ──
-- INSERT INTO public.price_item_options (price_item_id, label, unit_price, sort_order, is_default)
-- SELECT id, 'Jinko Tiger Neo 475W', 290.00, 10, TRUE  FROM public.price_items WHERE code = 'PVC-001' LIMIT 1;
-- SELECT id, 'Trina Vertex S+ 440W', 275.00, 20, FALSE FROM public.price_items WHERE code = 'PVC-001' LIMIT 1;
-- SELECT id, 'REC Alpha Pure 430W',  310.00, 30, FALSE FROM public.price_items WHERE code = 'PVC-001' LIMIT 1;
