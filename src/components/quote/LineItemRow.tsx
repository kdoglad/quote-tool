import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Copy, Trash2, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { ComputedLineItem, PartialFormulaScope, ModifierType, InclusionStatus } from '../../types/domain.types'
import FormulaTooltip from './FormulaTooltip'
import ModifierCell from './ModifierCell'
import { validateFormula, evaluateFormula, buildScope } from '../../lib/formulaEngine'
import { DEFAULT_SCOPE_VALUES } from '../../lib/constants'

const INCLUSION_OPTIONS: { value: InclusionStatus; label: string }[] = [
  { value: 'included',         label: 'Included' },
  { value: 'not_required',     label: 'Not Required' },
  { value: 'provisional_sum',  label: 'Provisional Sum' },
  { value: 'appears_adequate', label: 'Appears Adequate' },
]

function statusStyle(status: InclusionStatus) {
  switch (status) {
    case 'included':          return 'bg-emerald-950 border-emerald-800/60 text-emerald-300'
    case 'not_required':      return 'bg-slate-900 border-slate-700 text-slate-500'
    case 'provisional_sum':   return 'bg-amber-950 border-amber-800/60 text-amber-300'
    case 'appears_adequate':  return 'bg-blue-950 border-blue-800/60 text-blue-300'
  }
}

interface LineItemRowProps {
  item: ComputedLineItem
  scope: PartialFormulaScope
  comparisonTotal?: number
  readOnly?: boolean
  onStatusChange: (status: InclusionStatus) => void
  onQtyChange: (qty: number) => void
  onModifierChange: (type: ModifierType, value: number, note: string) => void
  onDuplicate: () => void
  onRemove?: () => void
  onOptionChange: (groupId: string, optionId: string | null) => void
  /** null = revert to price item default */
  onFormulaOverride: (formula: string | null) => void
}

/** Compact inline formula editor shown when the ƒ button is expanded. */
function InlineFormulaEditor({
  item,
  scope,
  onSave,
  onClose,
}: {
  item: ComputedLineItem
  scope: PartialFormulaScope
  onSave: (formula: string | null) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(item.formula_override ?? item.default_formula ?? '')
  const isOverridden = item.formula_override !== null
  const validationError = draft.trim() ? validateFormula(draft) : null

  const preview = (() => {
    if (!draft.trim() || validationError) return null
    const fullScope = buildScope(
      { ...DEFAULT_SCOPE_VALUES, ...scope },
      { base_price: item.base_unit_price, qty: item.qty }
    )
    return evaluateFormula(draft, fullScope)
  })()

  function handleSave() {
    // If draft equals the default, treat as "no override"
    const override = draft.trim() === (item.default_formula ?? '').trim() ? null : draft.trim() || null
    onSave(override)
    onClose()
  }

  return (
    <div className="mt-2 bg-slate-800/80 border border-slate-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-400">Formula</span>
        {isOverridden && (
          <button
            onClick={() => { onSave(null); onClose() }}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            title="Revert to price table default"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to default
          </button>
        )}
      </div>

      {/* Default formula hint */}
      {item.default_formula && (
        <div className="text-xs text-slate-600 font-mono bg-slate-900/60 rounded px-2 py-1">
          <span className="text-slate-500 not-italic">Default: </span>
          <span
            className="cursor-pointer hover:text-slate-400 transition-colors"
            onClick={() => setDraft(item.default_formula ?? '')}
            title="Click to restore"
          >
            {item.default_formula}
          </span>
        </div>
      )}

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder="e.g. base_price * system_kw * qty"
        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white
                   font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500
                   resize-none"
        spellCheck={false}
        autoFocus
      />

      {/* Validation + live preview */}
      {draft.trim() && (
        <div className="flex items-center gap-1.5 text-xs">
          {validationError
            ? <><AlertCircle className="w-3 h-3 text-red-400" /><span className="text-red-400">{validationError}</span></>
            : preview?.error
              ? <><AlertCircle className="w-3 h-3 text-red-400" /><span className="text-red-400">{preview.error}</span></>
              : preview !== null
                ? <><CheckCircle className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">
                      = ${preview.value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-slate-600">(live scope)</span>
                  </>
                : null
          }
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!!validationError}
          className="text-xs bg-brand-700 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed
                     text-white rounded px-2.5 py-1 transition-colors"
        >
          Apply
        </button>
        <button
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function LineItemRow({
  item,
  scope,
  comparisonTotal,
  readOnly,
  onStatusChange,
  onQtyChange,
  onModifierChange,
  onDuplicate,
  onRemove,
  onOptionChange,
  onFormulaOverride,
}: LineItemRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [formulaOpen, setFormulaOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const showDelta = comparisonTotal !== undefined
  const delta = showDelta ? item.computed_total - comparisonTotal! : 0
  const hasModifier = item.modifier_type !== 'none' && item.modifier_value !== 0
  const isExcluded = !item.is_included
  const hasOptions = item.option_groups.length > 0
  const isFormulaOverridden = item.formula_override !== null
  const optionDelta = item.computed_total - item.formula_total

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <tr
      className={clsx(
        'border-b border-slate-800/50 last:border-0 group text-sm',
        isExcluded && 'opacity-50',
        item.is_duplicate && 'bg-slate-900/40',
      )}
    >
      {/* Inclusion status */}
      <td className="pl-3 pr-2 py-2 w-36 align-top">
        <select
          value={item.inclusion_status}
          onChange={(e) => onStatusChange(e.target.value as InclusionStatus)}
          disabled={readOnly}
          className={clsx(
            'w-full text-xs rounded px-1.5 py-1 border focus:outline-none focus:ring-1 focus:ring-brand-500',
            'cursor-pointer transition-colors appearance-none',
            statusStyle(item.inclusion_status),
            readOnly && 'opacity-60 cursor-default'
          )}
        >
          {INCLUSION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </td>

      {/* Code */}
      <td className="pr-3 py-2 w-20 align-top pt-2.5">
        <code className="text-xs text-slate-600 font-mono">{item.code}</code>
        {item.is_duplicate && (
          <span className="block text-xs text-slate-700 font-mono">(copy)</span>
        )}
      </td>

      {/* Name + formula editor + option group selectors */}
      <td className="pr-3 py-2 align-top">
        {/* Name row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={clsx(
            'text-slate-200',
            isExcluded && 'line-through text-slate-500',
            item.inclusion_status === 'appears_adequate' && 'italic',
          )}>
            {item.name}
          </span>
          {item.inclusion_status === 'provisional_sum' && (
            <span className="text-xs font-semibold text-amber-400 bg-amber-900/40 px-1.5 py-0.5 rounded shrink-0">PS</span>
          )}
          {item.inclusion_status === 'appears_adequate' && (
            <span className="text-xs text-blue-400 bg-blue-900/30 px-1 rounded shrink-0">appears adequate</span>
          )}
          {item.is_custom && (
            <span className="text-xs text-amber-500 bg-amber-900/30 px-1 rounded shrink-0">custom</span>
          )}

          {/* Formula toggle button — always shown, overridden state highlighted */}
          {!readOnly && !isExcluded && (
            <button
              onClick={() => setFormulaOpen((v) => !v)}
              title={isFormulaOverridden ? 'Formula overridden for this quote — click to edit' : 'Edit formula for this quote'}
              className={clsx(
                'text-xs px-1.5 py-0.5 rounded font-mono transition-colors',
                formulaOpen
                  ? 'bg-brand-800 text-brand-200'
                  : isFormulaOverridden
                    ? 'bg-amber-900/50 text-amber-400 hover:bg-amber-900/70'
                    : 'bg-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-700'
              )}
            >
              ƒ{isFormulaOverridden ? '*' : ''}
            </button>
          )}

          <FormulaTooltip item={item} scope={scope} />
        </div>

        {/* Inline formula editor */}
        {formulaOpen && !readOnly && (
          <InlineFormulaEditor
            item={item}
            scope={scope}
            onSave={onFormulaOverride}
            onClose={() => setFormulaOpen(false)}
          />
        )}

        {/* Option group selectors */}
        {hasOptions && !isExcluded && !formulaOpen && (
          <div className="mt-1.5 space-y-1">
            {item.option_groups.map((group) => {
              const selectedId = item.selected_options[group.id] ?? ''
              const defaultOpt = (group.options ?? []).find((o) => o.is_default)
              return (
                <div key={group.id} className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600 shrink-0 min-w-[60px]">{group.label}:</span>
                  <select
                    value={selectedId}
                    onChange={(e) => onOptionChange(group.id, e.target.value || null)}
                    disabled={readOnly}
                    className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5
                               text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500
                               max-w-[240px] flex-1"
                  >
                    <option value="">
                      {defaultOpt ? `${defaultOpt.label} (default)` : '— Select —'}
                    </option>
                    {(group.options ?? []).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                        {opt.modifier_value !== 0
                          ? ` (${opt.modifier_type === 'percent'
                              ? `${opt.modifier_value > 0 ? '+' : ''}${opt.modifier_value}%`
                              : `${opt.modifier_value > 0 ? '+' : ''}$${Math.abs(opt.modifier_value).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}

        {hasModifier && item.modifier_note && (
          <p className="text-xs text-amber-400/70 mt-0.5 truncate max-w-[300px]" title={item.modifier_note}>
            ↳ {item.modifier_note}
          </p>
        )}
      </td>

      {/* Unit */}
      <td className="pr-3 py-2 text-slate-500 text-xs w-10 align-top pt-2.5">{item.unit}</td>

      {/* Qty */}
      <td className="pr-3 py-2 w-20 align-top">
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.qty}
          onChange={(e) => onQtyChange(parseFloat(e.target.value) || 0)}
          disabled={readOnly || isExcluded}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono
                     focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-40 text-right"
        />
      </td>

      {/* Base unit rate */}
      <td className="pr-3 py-2 text-right font-mono text-slate-400 text-xs w-24 align-top pt-2.5">
        ${item.base_unit_price.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
      </td>

      {/* Modifier */}
      <td className="pr-3 py-2 w-24 text-center align-top">
        <ModifierCell
          itemName={item.name}
          modifierType={item.modifier_type}
          modifierValue={item.modifier_value}
          modifierNote={item.modifier_note ?? ''}
          onSave={onModifierChange}
          disabled={readOnly || isExcluded}
        />
      </td>

      {/* Total */}
      <td className="pr-3 py-2 text-right font-mono text-sm w-28 align-top pt-2.5">
        {item.is_included ? (
          <div>
            <span className={clsx(
              item.computed_total < 0 ? 'text-green-400' : 'text-slate-200',
              hasModifier && 'text-amber-300',
              item.inclusion_status === 'provisional_sum' && 'text-amber-300',
            )}>
              ${item.computed_total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
            {hasOptions && optionDelta !== 0 && (
              <div className="text-xs text-slate-600 mt-0.5">
                base {item.formula_total < 0 ? '-' : ''}${Math.abs(item.formula_total).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                {' '}{optionDelta > 0 ? '+' : ''}${optionDelta.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
              </div>
            )}
          </div>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>

      {/* Comparison delta */}
      {showDelta && (
        <td className="pr-3 py-2 text-right font-mono text-xs w-24 align-top pt-2.5">
          {item.is_included && delta !== 0 ? (
            <span className={delta > 0 ? 'text-red-400' : 'text-green-400'}>
              {delta > 0 ? '+' : ''}${delta.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-slate-700">—</span>
          )}
        </td>
      )}

      {/* Context menu */}
      <td className="pr-2 py-2 w-8 align-top">
        {!readOnly && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-slate-300
                         opacity-0 group-hover:opacity-100 transition-opacity"
              title="More actions"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-50 bg-slate-800 border border-slate-700
                              rounded-lg shadow-2xl py-1 min-w-[160px]">
                <button
                  onClick={() => { onDuplicate(); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700
                             flex items-center gap-2 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  Duplicate row
                </button>
                {isFormulaOverridden && (
                  <button
                    onClick={() => { onFormulaOverride(null); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs text-amber-400 hover:bg-slate-700
                               flex items-center gap-2 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    Reset formula
                  </button>
                )}
                {item.is_removable && onRemove && (
                  <button
                    onClick={() => { onRemove(); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-slate-700
                               flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    Remove row
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
