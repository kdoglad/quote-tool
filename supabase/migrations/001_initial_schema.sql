-- ============================================================
-- Smart Commercial Solar — Quote Tool
-- Migration 001: Initial Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'engineer', 'sales');

CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired');

CREATE TYPE modifier_type AS ENUM ('none', 'flat', 'percent');

CREATE TYPE item_category AS ENUM (
  'Prelim',
  'PV_Components',
  'BESS',
  'Cabling',
  'Switchgear',
  'Install',
  'Safety',
  'Monitoring',
  'EV',
  'Rebates',
  'Custom'
);

-- ============================================================
-- TABLE: user_profiles
-- ============================================================

CREATE TABLE public.user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role NOT NULL DEFAULT 'sales',
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON public.user_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- TABLE: price_versions
-- ============================================================

CREATE TABLE public.price_versions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_name   TEXT NOT NULL,
  notes          TEXT,
  is_draft       BOOLEAN NOT NULL DEFAULT TRUE,
  published_at   TIMESTAMPTZ,
  published_by   UUID REFERENCES public.user_profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES public.user_profiles(id),
  CONSTRAINT unique_version_name UNIQUE (version_name)
);

ALTER TABLE public.price_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read versions"
  ON public.price_versions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Engineers and admins can create versions"
  ON public.price_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('engineer', 'admin')
    )
  );

CREATE POLICY "Engineers and admins can update draft versions"
  ON public.price_versions FOR UPDATE
  USING (
    is_draft = TRUE AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('engineer', 'admin')
    )
  );

-- ============================================================
-- TABLE: price_items
-- ============================================================

CREATE TABLE public.price_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id     UUID NOT NULL REFERENCES public.price_versions(id) ON DELETE CASCADE,
  category       item_category NOT NULL,
  subcategory    TEXT,
  code           TEXT NOT NULL,
  name           TEXT NOT NULL,
  unit           TEXT NOT NULL DEFAULT 'ea',
  base_price     NUMERIC(12,4) NOT NULL DEFAULT 0,
  formula        TEXT,            -- mathjs expression; NULL = base_price * qty
  conditions     JSONB DEFAULT '{}'::JSONB,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_optional    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_code_per_version UNIQUE (version_id, code)
);

CREATE INDEX idx_price_items_version   ON public.price_items(version_id);
CREATE INDEX idx_price_items_category  ON public.price_items(category);
CREATE INDEX idx_price_items_code      ON public.price_items(code);

ALTER TABLE public.price_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read price items"
  ON public.price_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Engineers/admins can insert into draft versions"
  ON public.price_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.price_versions pv
      WHERE pv.id = version_id AND pv.is_draft = TRUE
    ) AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('engineer', 'admin')
    )
  );

CREATE POLICY "Engineers/admins can update items in draft versions"
  ON public.price_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.price_versions pv
      WHERE pv.id = version_id AND pv.is_draft = TRUE
    ) AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('engineer', 'admin')
    )
  );

CREATE POLICY "Engineers/admins can delete from draft versions"
  ON public.price_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.price_versions pv
      WHERE pv.id = version_id AND pv.is_draft = TRUE
    ) AND
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('engineer', 'admin')
    )
  );

-- ============================================================
-- TABLE: quotes
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS quote_seq START 1;

CREATE TABLE public.quotes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number        TEXT UNIQUE,          -- auto-generated: SCS-2025-0042
  project_name        TEXT NOT NULL,
  status              quote_status NOT NULL DEFAULT 'draft',
  price_version_id    UUID NOT NULL REFERENCES public.price_versions(id),

  -- Customer
  customer_name       TEXT NOT NULL,
  customer_company    TEXT,
  customer_email      TEXT,
  customer_phone      TEXT,
  customer_abn        TEXT,

  -- Site
  site_address        TEXT NOT NULL,
  site_suburb         TEXT NOT NULL,
  site_state          TEXT NOT NULL,
  site_postcode       TEXT NOT NULL,
  nmi                 TEXT,
  dnsp                TEXT,

  -- System summary (duplicated from quote_inputs for quick reads)
  system_kw           NUMERIC(10,3),
  system_kva          NUMERIC(10,3),
  has_bess            BOOLEAN DEFAULT FALSE,
  has_ev              BOOLEAN DEFAULT FALSE,
  existing_solar_kw   NUMERIC(10,3) DEFAULT 0,

  -- Metadata
  valid_until         DATE,
  internal_notes      TEXT,
  created_by          UUID NOT NULL REFERENCES public.user_profiles(id),
  assigned_to         UUID REFERENCES public.user_profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_created_by ON public.quotes(created_by);
CREATE INDEX idx_quotes_status     ON public.quotes(status);
CREATE INDEX idx_quotes_version    ON public.quotes(price_version_id);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales see own quotes; engineers/admins see all"
  ON public.quotes FOR SELECT
  USING (
    created_by = auth.uid() OR
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'engineer')
    )
  );

CREATE POLICY "Authenticated can create quotes"
  ON public.quotes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Creator and admins can update quotes"
  ON public.quotes FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Auto-generate quote number
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := 'SCS-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                        LPAD(NEXTVAL('quote_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_quote_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION generate_quote_number();

-- ============================================================
-- TABLE: quote_inputs
-- ============================================================

CREATE TABLE public.quote_inputs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id   UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      JSONB NOT NULL,
  CONSTRAINT unique_key_per_quote UNIQUE (quote_id, key)
);

CREATE INDEX idx_quote_inputs_quote ON public.quote_inputs(quote_id);

ALTER TABLE public.quote_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_inputs follow quote access (select)"
  ON public.quote_inputs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id AND (
        q.created_by = auth.uid() OR
        q.assigned_to = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'engineer'))
      )
    )
  );

CREATE POLICY "quote_inputs follow quote access (insert)"
  ON public.quote_inputs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id AND (
        q.created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "quote_inputs follow quote access (update)"
  ON public.quote_inputs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id AND (
        q.created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "quote_inputs follow quote access (delete)"
  ON public.quote_inputs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id AND (
        q.created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

-- ============================================================
-- TABLE: quote_line_items
-- ============================================================

CREATE TABLE public.quote_line_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id         UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  price_item_id    UUID REFERENCES public.price_items(id),
  is_custom        BOOLEAN NOT NULL DEFAULT FALSE,
  is_included      BOOLEAN NOT NULL DEFAULT TRUE,

  category         item_category NOT NULL,
  subcategory      TEXT,
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  unit             TEXT NOT NULL DEFAULT 'ea',

  qty              NUMERIC(12,4) NOT NULL DEFAULT 1,
  base_unit_price  NUMERIC(12,4) NOT NULL DEFAULT 0,
  formula          TEXT,

  modifier_type    modifier_type NOT NULL DEFAULT 'none',
  modifier_value   NUMERIC(12,4) DEFAULT 0,
  modifier_note    TEXT,

  computed_total   NUMERIC(14,4),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qli_quote    ON public.quote_line_items(quote_id);
CREATE INDEX idx_qli_category ON public.quote_line_items(category);

ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Line items follow quote access (select)"
  ON public.quote_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id AND (
        q.created_by = auth.uid() OR
        q.assigned_to = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin','engineer'))
      )
    )
  );

CREATE POLICY "Line items follow quote access (insert)"
  ON public.quote_line_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id AND (
        q.created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "Line items follow quote access (update)"
  ON public.quote_line_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id AND (
        q.created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

CREATE POLICY "Line items follow quote access (delete)"
  ON public.quote_line_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id AND (
        q.created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

-- ============================================================
-- TABLE: quote_snapshots
-- ============================================================

CREATE TABLE public.quote_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  snapshot        JSONB NOT NULL,
  change_note     TEXT,
  created_by      UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_snapshot_version UNIQUE (quote_id, version_number)
);

CREATE INDEX idx_snapshots_quote ON public.quote_snapshots(quote_id);

ALTER TABLE public.quote_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Snapshots follow quote access"
  ON public.quote_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id AND (
        q.created_by = auth.uid() OR
        q.assigned_to = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin','engineer'))
      )
    )
  );

CREATE POLICY "Authenticated can insert snapshots for own quotes"
  ON public.quote_snapshots FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_id AND (
        q.created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
      )
    )
  );

-- Auto-increment snapshot version per quote
CREATE OR REPLACE FUNCTION set_snapshot_version()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO NEW.version_number
  FROM public.quote_snapshots
  WHERE quote_id = NEW.quote_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_snapshot_version
  BEFORE INSERT ON public.quote_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_snapshot_version();

-- ============================================================
-- DNSP LOOKUP TABLE
-- ============================================================

CREATE TABLE public.dnsp_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dnsp_name       TEXT NOT NULL,
  state           TEXT NOT NULL,
  nmi_prefixes    TEXT[] NOT NULL,
  application_fee NUMERIC(10,2) DEFAULT 0,
  export_limit_kw NUMERIC(10,2),
  notes           TEXT,
  rules_json      JSONB DEFAULT '{}'::JSONB
);

ALTER TABLE public.dnsp_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read DNSP rules"
  ON public.dnsp_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage DNSP rules"
  ON public.dnsp_rules FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCTION: publish_price_version
-- (called via Supabase Edge Function after auth check)
-- ============================================================

CREATE OR REPLACE FUNCTION publish_price_version(
  p_source_version_id UUID,
  p_new_version_name  TEXT,
  p_notes             TEXT,
  p_published_by      UUID
)
RETURNS UUID AS $$
DECLARE
  v_new_version_id UUID;
BEGIN
  -- Validate source version exists
  IF NOT EXISTS (SELECT 1 FROM public.price_versions WHERE id = p_source_version_id) THEN
    RAISE EXCEPTION 'Source version not found: %', p_source_version_id;
  END IF;

  -- Create the new published version record
  INSERT INTO public.price_versions (version_name, notes, is_draft, published_at, published_by, created_by)
  VALUES (p_new_version_name, p_notes, FALSE, NOW(), p_published_by, p_published_by)
  RETURNING id INTO v_new_version_id;

  -- Deep copy all items from source version into the new version
  INSERT INTO public.price_items
    (version_id, category, subcategory, code, name, unit, base_price,
     formula, conditions, sort_order, is_optional, is_active, notes)
  SELECT
    v_new_version_id, category, subcategory, code, name, unit, base_price,
    formula, conditions, sort_order, is_optional, is_active, notes
  FROM public.price_items
  WHERE version_id = p_source_version_id AND is_active = TRUE;

  RETURN v_new_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'sales'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
