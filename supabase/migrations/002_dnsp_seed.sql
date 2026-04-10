-- ============================================================
-- Migration 002: DNSP Seed Data — All Australian DNSPs
-- ============================================================

INSERT INTO public.dnsp_rules (dnsp_name, state, nmi_prefixes, application_fee, export_limit_kw, notes, rules_json) VALUES

-- NSW
('Ausgrid',          'NSW', ARRAY['41','42','43','44','45'], 0,    10,   'Sydney metro, Central Coast, Hunter Valley',
  '{"connection_study_threshold_kw": 30, "connection_study_fee": 3300}'),
('Endeavour Energy', 'NSW', ARRAY['51','52','53','54','55'], 0,    10,   'Western Sydney, Wollongong, Southern Highlands, Blue Mountains',
  '{"connection_study_threshold_kw": 30, "connection_study_fee": 2750}'),
('Essential Energy', 'NSW', ARRAY['71','72','73'],           0,    10,   'Regional NSW and ACT border areas',
  '{"connection_study_threshold_kw": 30, "connection_study_fee": 2200}'),

-- ACT
('Evoenergy',        'ACT', ARRAY['74'],                     0,    10,   'Australian Capital Territory',
  '{"connection_study_threshold_kw": 30, "connection_study_fee": 2200}'),

-- VIC
('Jemena',           'VIC', ARRAY['61'],                     0,    200,  'Northern and western Melbourne suburbs',
  '{"veec_eligible": true, "connection_study_threshold_kw": 200, "connection_study_fee": 3000}'),
('AusNet Services',  'VIC', ARRAY['62'],                     0,    200,  'Eastern Victoria and Melbourne eastern suburbs',
  '{"veec_eligible": true, "connection_study_threshold_kw": 200, "connection_study_fee": 3000}'),
('CitiPower',        'VIC', ARRAY['63'],                     0,    200,  'Melbourne CBD and inner suburbs',
  '{"veec_eligible": true, "connection_study_threshold_kw": 200, "connection_study_fee": 3000}'),
('Powercor',         'VIC', ARRAY['64'],                     0,    200,  'Western and Central Victoria',
  '{"veec_eligible": true, "connection_study_threshold_kw": 200, "connection_study_fee": 3000}'),
('United Energy',    'VIC', ARRAY['65'],                     0,    200,  'Mornington Peninsula and south-east Melbourne',
  '{"veec_eligible": true, "connection_study_threshold_kw": 200, "connection_study_fee": 3000}'),

-- QLD
('Energex',          'QLD', ARRAY['31','32','33'],           330,  30,   'South East Queensland — application fee applies',
  '{"connection_study_threshold_kw": 30, "connection_study_fee": 4000, "testing_fee": 1500}'),
('Ergon Energy',     'QLD', ARRAY['34','35','36'],           330,  30,   'Regional Queensland — application fee applies',
  '{"connection_study_threshold_kw": 30, "connection_study_fee": 3500, "testing_fee": 1500}'),

-- SA
('SA Power Networks','SA',  ARRAY['21','22','23'],           0,    10,   'South Australia statewide',
  '{"connection_study_threshold_kw": 30, "connection_study_fee": 2500}'),

-- WA
('Western Power',    'WA',  ARRAY['11','12','13'],           400,  5,    'South-West Interconnected System — strict export limits, fee applies',
  '{"connection_study_threshold_kw": 5, "connection_study_fee": 5000, "testing_fee": 2000}'),
('Horizon Power',    'WA',  ARRAY['14','15'],                400,  5,    'Regional Western Australia',
  '{"connection_study_threshold_kw": 5, "connection_study_fee": 4500, "testing_fee": 2000}'),

-- TAS
('TasNetworks',      'TAS', ARRAY['81','82'],                0,    30,   'Tasmania statewide',
  '{"connection_study_threshold_kw": 30, "connection_study_fee": 2200}'),

-- NT
('Power and Water',  'NT',  ARRAY['91','92'],                0,    10,   'Darwin, Katherine and surrounding areas',
  '{"connection_study_threshold_kw": 30, "connection_study_fee": 3000}');
