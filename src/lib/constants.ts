import type { ItemCategory } from '../types/domain.types'

export const CATEGORIES: { value: ItemCategory; label: string; code: string }[] = [
  { value: 'Prelim',        label: 'A. Preliminary',                  code: 'A' },
  { value: 'PV_Components', label: 'B. PV Components',                code: 'B' },
  { value: 'BESS',          label: 'C. Battery Energy Storage',        code: 'C' },
  { value: 'Cabling',       label: 'D. Cabling',                      code: 'D' },
  { value: 'Switchgear',    label: 'E. Switchgear',                   code: 'E' },
  { value: 'Install',       label: 'F. Installation & Logistics',     code: 'F' },
  { value: 'Safety',        label: 'G. Safety & Compliance',          code: 'G' },
  { value: 'Monitoring',    label: 'H. Monitoring & Warranty',        code: 'H' },
  { value: 'EV',            label: 'I. EV Charging',                  code: 'I' },
  { value: 'Rebates',       label: 'J. Rebates & Incentives',         code: 'J' },
  { value: 'Custom',        label: 'Custom Items',                    code: 'Z' },
]

export const AUSTRALIAN_STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'SA',  label: 'South Australia' },
  { value: 'WA',  label: 'Western Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NT',  label: 'Northern Territory' },
]

export const UNITS = [
  { value: 'ea',  label: 'Each' },
  { value: 'lot', label: 'Lot' },
  { value: 'kW',  label: 'kW' },
  { value: 'kWh', label: 'kWh' },
  { value: 'kVA', label: 'kVA' },
  { value: 'm',   label: 'Metre' },
  { value: 'm2',  label: 'Square Metre' },
  { value: 'hr',  label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'yr',  label: 'Year' },
]

export const INSTALL_TYPES = [
  { value: 'rooftop', label: 'Rooftop' },
  { value: 'ground',  label: 'Ground Mount' },
  { value: 'carport', label: 'Carport / Shade Structure' },
]

export const TRENCH_TYPES = [
  { value: 'none', label: 'No Trenching' },
  { value: 'soft', label: 'Soft Ground' },
  { value: 'hard', label: 'Hard Ground / Concrete / Rock' },
]

// STC zone factors by state (approximate; update quarterly)
export const STC_ZONE_FACTORS: Record<string, number> = {
  NSW: 1.382,
  VIC: 1.185,
  QLD: 1.536,
  SA:  1.382,
  WA:  1.382,
  TAS: 1.000,
  ACT: 1.185,
  NT:  1.690,
}

// Default formula scope defaults (used when a variable is not provided)
export const DEFAULT_SCOPE_VALUES = {
  system_kw:            0,
  system_kva:           0,
  bess_kwh:             0,
  site_state:           '',
  postcode:             '',
  nmi_prefix:           '',
  install_type:         'rooftop' as const,
  has_bess:             false,
  has_ev:               false,
  dc_cable_m:           0,
  ac_cable_m:           20,
  cable_run_m:          20,
  trench_m:             0,
  trench_type:          'none' as const,
  trench_depth_m:       0,
  roof_perimeter_m:     0,
  existing_solar_kw:    0,
  dnsp_application_fee: 0,
  dnsp_study_threshold: 30,
  dnsp_study_fee:       0,
  stc_zone_factor:      1.382,
  stc_years:            10,
  stc_price:            38.0,
  lgc_factor:           1.382,
  lgc_price:            45.0,
  veec_count:           0,
  veec_price:           35.0,
  fit_rate:             0,
  fit_hours:            0,
}

export const GST_RATE = 0.10

export const QUOTE_VALIDITY_DAYS = 30

export const AUTOSAVE_INTERVAL_MS = 30_000

export const COMPARISON_SIGNIFICANCE_THRESHOLD = 50 // dollars
