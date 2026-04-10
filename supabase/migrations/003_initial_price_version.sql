-- ============================================================
-- Migration 003: Initial Price Version Seed (FY25 V22.9)
-- Ported from Excel workbook V22.9
-- ============================================================

DO $$
DECLARE
  v_version_id UUID;
BEGIN

-- Create the initial published version
INSERT INTO public.price_versions (version_name, notes, is_draft, published_at, created_by, published_by)
VALUES (
  'FY25 V22.9',
  'Initial version — ported from Excel workbook V22.9. Update base prices before use.',
  FALSE,
  NOW(),
  NULL,
  NULL
)
RETURNING id INTO v_version_id;

-- ============================================================
-- A. PRELIM
-- ============================================================

INSERT INTO public.price_items (version_id, category, code, name, unit, base_price, formula, sort_order, notes) VALUES
(v_version_id, 'Prelim', 'PRE-001', 'Design & Engineering — Solar',       'lot',  2500.00, NULL, 10, 'Fixed per project'),
(v_version_id, 'Prelim', 'PRE-002', 'Structural Engineering Report',       'lot',  1800.00, NULL, 20, 'Required for carport & roof installations'),
(v_version_id, 'Prelim', 'PRE-003', 'Electrical Engineering Sign-off',     'lot',  1200.00, NULL, 30, NULL),
(v_version_id, 'Prelim', 'PRE-004', 'Council/DA Fees',                     'lot',  1500.00, 'system_kw > 100 ? base_price : 0', 40, 'Only required for systems >100kW'),
(v_version_id, 'Prelim', 'PRE-005', 'Project Management',                  'lot',  3500.00, NULL, 50, NULL),
(v_version_id, 'Prelim', 'PRE-006', 'Site Survey & Assessment',            'lot',   950.00, NULL, 60, NULL),
(v_version_id, 'Prelim', 'PRE-007', 'Grid Connection Application Fee',     'lot',      0.00, 'dnsp_application_fee', 70, 'Populated from DNSP rules — may be $0 for some networks'),
(v_version_id, 'Prelim', 'PRE-008', 'Network Study / Technical Review',    'lot',      0.00, 'system_kw >= dnsp_study_threshold ? dnsp_study_fee : 0', 80, 'Triggered when system size exceeds DNSP threshold');

-- ============================================================
-- B. PV COMPONENTS
-- ============================================================

INSERT INTO public.price_items (version_id, category, code, name, unit, base_price, formula, sort_order, is_optional, notes) VALUES
(v_version_id, 'PV_Components', 'PVC-001', 'Solar Panels',                  'kW',  285.00, 'base_price * system_kw', 10, FALSE, 'Price per kW installed — update per panel selection'),
(v_version_id, 'PV_Components', 'PVC-002', 'String Inverter',               'ea',    0.00, NULL, 20, FALSE, 'Enter price based on selected model'),
(v_version_id, 'PV_Components', 'PVC-003', 'Microinverter (alternative)',   'ea',    0.00, NULL, 25, TRUE,  'Alternative to string — mark included if applicable'),
(v_version_id, 'PV_Components', 'PVC-004', 'DC Isolator',                   'ea',   85.00, NULL, 30, FALSE, NULL),
(v_version_id, 'PV_Components', 'PVC-005', 'AC Isolator',                   'ea',   95.00, NULL, 40, FALSE, NULL),
(v_version_id, 'PV_Components', 'PVC-006', 'Combiner Box / DC Switchboard', 'ea',  650.00, 'system_kw > 50 ? base_price * qty : 0', 50, TRUE, 'Required for systems >50kW with multiple strings'),
(v_version_id, 'PV_Components', 'PVC-007', 'Generation Meter',              'ea',  420.00, NULL, 60, FALSE, NULL),
(v_version_id, 'PV_Components', 'PVC-008', 'Racking System — Roof',         'kW',   45.00, 'install_type == "rooftop" ? base_price * system_kw : 0', 70, FALSE, NULL),
(v_version_id, 'PV_Components', 'PVC-009', 'Racking System — Ground Mount', 'kW',   95.00, 'install_type == "ground" ? base_price * system_kw : 0', 80, TRUE, NULL),
(v_version_id, 'PV_Components', 'PVC-010', 'Racking System — Carport',      'kW',  185.00, 'install_type == "carport" ? base_price * system_kw : 0', 90, TRUE, NULL);

-- ============================================================
-- C. BESS (Battery Energy Storage System)
-- ============================================================

INSERT INTO public.price_items (version_id, category, code, name, unit, base_price, formula, sort_order, is_optional, notes) VALUES
(v_version_id, 'BESS', 'BESS-001', 'Battery System — Supply',              'kWh',  850.00, 'has_bess ? base_price * bess_kwh : 0', 10, TRUE, 'Price per kWh — update per product selection'),
(v_version_id, 'BESS', 'BESS-002', 'Battery Inverter / Hybrid Inverter',   'ea',     0.00, 'has_bess ? base_price * qty : 0', 20, TRUE, 'Enter price based on selected model'),
(v_version_id, 'BESS', 'BESS-003', 'Battery Management System',            'ea',  1200.00, 'has_bess ? base_price * qty : 0', 30, TRUE, NULL),
(v_version_id, 'BESS', 'BESS-004', 'BESS Switchboard / Protection',        'ea',  2200.00, 'has_bess ? base_price * qty : 0', 40, TRUE, NULL),
(v_version_id, 'BESS', 'BESS-005', 'BESS Installation & Commissioning',    'ea',  3500.00, 'has_bess ? base_price * qty : 0', 50, TRUE, 'Fixed installation allowance — adjust for complexity');

-- ============================================================
-- D. CABLING
-- ============================================================

INSERT INTO public.price_items (version_id, category, code, name, unit, base_price, formula, sort_order, notes) VALUES
(v_version_id, 'Cabling', 'CAB-001', 'DC Cable (string to inverter)',      'm',     4.50, 'base_price * dc_cable_m', 10, 'Price per metre installed'),
(v_version_id, 'Cabling', 'CAB-002', 'AC Cable (inverter to MSB)',         'm',    12.00, 'base_price * ac_cable_m', 20, 'Price per metre — includes conduit'),
(v_version_id, 'Cabling', 'CAB-003', 'Earthing & Bonding',                 'lot',  850.00, NULL, 30, NULL),
(v_version_id, 'Cabling', 'CAB-004', 'Conduit & Cable Management',         'lot',  650.00, 'base_price + (cable_run_m > 30 ? (cable_run_m - 30) * 18 : 0)', 40, 'Base allowance + overflow for long runs'),
(v_version_id, 'Cabling', 'CAB-005', 'Trenching — Standard (soft ground)', 'm',    28.00, 'trench_m > 0 && trench_type == "soft" ? base_price * trench_m : 0', 50, NULL),
(v_version_id, 'Cabling', 'CAB-006', 'Trenching — Hard (concrete/rock)',   'm',   380.00, 'trench_m > 0 && trench_type == "hard" ? base_price * trench_m : 0', 60, 'Includes saw-cutting and reinstatement'),
(v_version_id, 'Cabling', 'CAB-007', 'Cable Pit / Junction Box',           'ea',  320.00, NULL, 70, NULL);

-- ============================================================
-- E. SWITCHGEAR
-- ============================================================

INSERT INTO public.price_items (version_id, category, code, name, unit, base_price, formula, sort_order, notes) VALUES
(v_version_id, 'Switchgear', 'SWG-001', 'Main Switchboard Modification',        'ea',  2200.00, NULL, 10, 'Includes new breaker, bus extension'),
(v_version_id, 'Switchgear', 'SWG-002', 'Sub-Switchboard — Solar Distribution', 'ea',  3500.00, 'system_kva > 100 ? base_price * qty : 0', 20, 'Required for systems >100kVA'),
(v_version_id, 'Switchgear', 'SWG-003', 'Power Factor Correction Unit',         'ea',     0.00, NULL, 30, 'Enter price if applicable — optional'),
(v_version_id, 'Switchgear', 'SWG-004', 'Metering Panel Upgrade',               'ea',  1800.00, NULL, 40, NULL),
(v_version_id, 'Switchgear', 'SWG-005', 'Anti-Islanding Protection',            'ea',   950.00, 'system_kva > 200 ? base_price * qty : 0', 50, 'Required by some DNSPs for >200kVA');

-- ============================================================
-- F. INSTALL
-- ============================================================

INSERT INTO public.price_items (version_id, category, code, name, unit, base_price, formula, sort_order, notes) VALUES
(v_version_id, 'Install', 'INS-001', 'Installation Labour — Roof',        'kW',   95.00, 'install_type == "rooftop" ? base_price * system_kw : 0', 10, 'Per kW installed on roof'),
(v_version_id, 'Install', 'INS-002', 'Installation Labour — Ground',      'kW',  125.00, 'install_type == "ground" ? base_price * system_kw : 0', 20, 'Per kW installed on ground mount'),
(v_version_id, 'Install', 'INS-003', 'Installation Labour — Carport',     'kW',  180.00, 'install_type == "carport" ? base_price * system_kw : 0', 30, 'Per kW installed on carport structure'),
(v_version_id, 'Install', 'INS-004', 'Electrical Works & Commissioning',  'lot', 3500.00, NULL, 40, NULL),
(v_version_id, 'Install', 'INS-005', 'Crane Hire — Setup',                'day', 1200.00, '(install_type == "carport" || trench_depth_m > 1.2) ? base_price * qty : 0', 50, 'Required for carport or deep-trench installations'),
(v_version_id, 'Install', 'INS-006', 'Crane Hire — Hourly Rate',          'hr',   380.00, '(install_type == "carport" || trench_depth_m > 1.2) ? base_price * qty : 0', 60, NULL),
(v_version_id, 'Install', 'INS-007', 'Traffic Management Plan',           'lot',  2200.00, NULL, 70, 'Required for street-facing works'),
(v_version_id, 'Install', 'INS-008', 'Scaffolding',                       'lot',     0.00, NULL, 80, 'Enter if required — varies by height & area'),
(v_version_id, 'Install', 'INS-009', 'Freight & Logistics',               'lot',  1500.00, 'base_price + (system_kw > 200 ? (system_kw - 200) * 3.5 : 0)', 90, 'Base freight + oversize allowance for large systems');

-- ============================================================
-- G. SAFETY
-- ============================================================

INSERT INTO public.price_items (version_id, category, code, name, unit, base_price, formula, sort_order, notes) VALUES
(v_version_id, 'Safety', 'SAF-001', 'Height Safety System — Handrail',   'm',    95.00, 'install_type == "rooftop" ? base_price * roof_perimeter_m : 0', 10, 'Per metre of roof perimeter'),
(v_version_id, 'Safety', 'SAF-002', 'Fall Arrest Anchor Points',          'ea',  285.00, NULL, 20, NULL),
(v_version_id, 'Safety', 'SAF-003', 'Bird Mesh / Panel Undershield',      'kW',   18.00, 'install_type == "rooftop" ? base_price * system_kw : 0', 30, 'Per kW of roof-mounted panels'),
(v_version_id, 'Safety', 'SAF-004', 'Safety Signage & Labels',            'lot',  350.00, NULL, 40, NULL),
(v_version_id, 'Safety', 'SAF-005', 'Fire Safety Compliance (AS5033)',    'lot',  950.00, NULL, 50, 'AS5033 compliant DC isolators and labelling');

-- ============================================================
-- H. MONITORING + WARRANTY
-- ============================================================

INSERT INTO public.price_items (version_id, category, code, name, unit, base_price, formula, sort_order, is_optional, notes) VALUES
(v_version_id, 'Monitoring', 'MON-001', 'Monitoring Hardware (Solar Analytics)',  'ea',   600.00, NULL, 10, FALSE, 'Standard monitoring platform'),
(v_version_id, 'Monitoring', 'MON-002', 'Monitoring — Annual Subscription',       'yr',   240.00, NULL, 20, TRUE,  '12 months included; enter years for ongoing'),
(v_version_id, 'Monitoring', 'MON-003', 'Extended Workmanship Warranty — 5yr',    'lot',  1800.00, NULL, 30, TRUE,  NULL),
(v_version_id, 'Monitoring', 'MON-004', 'Extended Workmanship Warranty — 10yr',   'lot',  3500.00, NULL, 40, TRUE,  NULL),
(v_version_id, 'Monitoring', 'MON-005', 'O&M Service Package — Annual',           'yr',   1200.00, NULL, 50, TRUE,  'Annual inspection and system health report');

-- ============================================================
-- I. EV CHARGING
-- ============================================================

INSERT INTO public.price_items (version_id, category, code, name, unit, base_price, formula, sort_order, is_optional, notes) VALUES
(v_version_id, 'EV', 'EV-001', 'EV Charger — AC Level 2 (7kW)',           'ea',  2200.00, 'has_ev ? base_price * qty : 0', 10, TRUE, 'Wall-mounted AC charger'),
(v_version_id, 'EV', 'EV-002', 'EV Charger — AC Level 2 (22kW)',          'ea',  4500.00, 'has_ev ? base_price * qty : 0', 20, TRUE, '3-phase AC charger'),
(v_version_id, 'EV', 'EV-003', 'EV Charger — DC Fast Charge (50kW)',      'ea', 28000.00, 'has_ev ? base_price * qty : 0', 30, TRUE, 'DC fast charger — requires dedicated circuit'),
(v_version_id, 'EV', 'EV-004', 'EV Cabling & Installation',                'ea',  1800.00, 'has_ev ? base_price * qty : 0', 40, TRUE, 'Per charger installation'),
(v_version_id, 'EV', 'EV-005', 'EV Load Management System',               'lot',  3200.00, 'has_ev && qty > 2 ? base_price : 0', 50, TRUE, 'Required when >2 chargers on same supply');

-- ============================================================
-- J. REBATES (negative values = credits)
-- ============================================================

INSERT INTO public.price_items (version_id, category, code, name, unit, base_price, formula, sort_order, notes) VALUES
(v_version_id, 'Rebates', 'REB-001', 'STC Rebate (Small-scale Technology Certificates)', 'lot', 0.00,
  'system_kw <= 100 ? -(system_kw * stc_zone_factor * stc_years * stc_price) : 0',
  10, 'Only for systems <=100kW. Zone factor and price updated quarterly.'),
(v_version_id, 'Rebates', 'REB-002', 'LGC Rebate (Large-scale Generation Certificates)', 'lot', 0.00,
  'system_kw > 100 ? -(system_kw * lgc_factor * lgc_price) : 0',
  20, 'Only for systems >100kW. Requires LRET accreditation.'),
(v_version_id, 'Rebates', 'REB-003', 'VEEC Rebate (Victorian Energy Efficiency Certificates)', 'lot', 0.00,
  'site_state == "VIC" ? -(veec_count * veec_price) : 0',
  30, 'VIC only. Requires accredited assessor.'),
(v_version_id, 'Rebates', 'REB-004', 'Feed-in Tariff Credit (Annual Est.)', 'lot', 0.00,
  '-(system_kw * fit_rate * fit_hours)',
  40, 'Indicative only — enter in notes, not typically on quote');

END $$;
