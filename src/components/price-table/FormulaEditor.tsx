import { useState, useCallback } from 'react'
import { Info, AlertCircle, CheckCircle } from 'lucide-react'
import { validateFormula, evaluateFormula, buildScope } from '../../lib/formulaEngine'
import { DEFAULT_SCOPE_VALUES } from '../../lib/constants'
import type { FormulaScope } from '../../types/domain.types'

interface FormulaEditorProps {
  value: string
  onChange: (value: string) => void
  basePrice?: number
  disabled?: boolean
}

const FORMULA_VARIABLES = [
  { name: 'system_kw', desc: 'System size in kilowatts' },
  { name: 'system_kva', desc: 'System size in kVA' },
  { name: 'bess_kwh', desc: 'Battery capacity in kWh' },
  { name: 'site_state', desc: 'State abbreviation (e.g. "VIC")' },
  { name: 'install_type', desc: '"rooftop" | "ground" | "carport"' },
  { name: 'has_bess', desc: 'true if BESS is included' },
  { name: 'has_ev', desc: 'true if EV charging is included' },
  { name: 'cable_run_m', desc: 'Total cable run in metres' },
  { name: 'trench_m', desc: 'Trench length in metres' },
  { name: 'trench_type', desc: '"none" | "soft" | "hard"' },
  { name: 'trench_depth_m', desc: 'Trench depth in metres' },
  { name: 'roof_perimeter_m', desc: 'Roof perimeter in metres' },
  { name: 'existing_solar_kw', desc: 'Existing solar on site (kW)' },
  { name: 'dnsp_application_fee', desc: 'DNSP application fee ($)' },
  { name: 'dnsp_study_fee', desc: 'DNSP connection study fee ($)' },
  { name: 'stc_zone_factor', desc: 'STC zone multiplier' },
  { name: 'stc_price', desc: 'STC spot price per certificate ($)' },
  { name: 'base_price', desc: "This item's base_price field" },
  { name: 'qty', desc: "Quantity entered in the quote" },
]

export default function FormulaEditor({ value, onChange, basePrice = 0, disabled }: FormulaEditorProps) {
  const [showVars, setShowVars] = useState(false)
  const [testScope] = useState<Partial<FormulaScope>>({
    system_kw: 150,
    system_kva: 187.5,
    install_type: 'rooftop',
    has_bess: false,
    has_ev: false,
    site_state: 'VIC',
  })

  const validationError = validateFormula(value)

  const previewResult = useCallback(() => {
    if (!value.trim() || validationError) return null
    const scope = buildScope({ ...DEFAULT_SCOPE_VALUES, ...testScope }, { base_price: basePrice, qty: 1 })
    return evaluateFormula(value, scope)
  }, [value, basePrice, testScope, validationError])

  const preview = previewResult()

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="e.g. system_kw > 200 ? base_price * 1.35 * qty : base_price * qty"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-mono
                     placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500
                     px-3 py-2 resize-none disabled:opacity-50"
          spellCheck={false}
        />
      </div>

      {/* Validation state */}
      {value.trim() && (
        <div className={`flex items-center gap-1.5 text-xs ${validationError ? 'text-red-400' : 'text-green-400'}`}>
          {validationError
            ? <><AlertCircle className="w-3.5 h-3.5" /> {validationError}</>
            : <><CheckCircle className="w-3.5 h-3.5" /> Syntax OK</>
          }
        </div>
      )}

      {/* Preview */}
      {preview !== null && !validationError && (
        <div className="bg-slate-800/60 rounded-lg px-3 py-2 text-xs">
          <span className="text-slate-500">Preview (system_kw={testScope.system_kw}, install={testScope.install_type}): </span>
          {preview.error
            ? <span className="text-red-400">{preview.error}</span>
            : <span className="text-brand-300 font-mono font-medium">
                ${preview.value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
          }
        </div>
      )}

      {/* Variable reference */}
      <div>
        <button
          type="button"
          onClick={() => setShowVars((v) => !v)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Info className="w-3 h-3" />
          {showVars ? 'Hide' : 'Show'} available variables
        </button>

        {showVars && (
          <div className="mt-2 bg-slate-800/60 rounded-lg p-3 grid grid-cols-2 gap-1.5 text-xs">
            {FORMULA_VARIABLES.map((v) => (
              <div key={v.name} className="flex items-start gap-1.5">
                <code
                  className="text-brand-300 font-mono cursor-pointer hover:text-brand-200"
                  onClick={() => !disabled && onChange(value + v.name)}
                  title="Click to insert"
                >
                  {v.name}
                </code>
                <span className="text-slate-500">{v.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
