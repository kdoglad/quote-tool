import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Copy, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { ComputedLineItem, PartialFormulaScope, ModifierType, InclusionStatus } from '../../types/domain.types'
import FormulaTooltip from './FormulaTooltip'
import ModifierCell from './ModifierCell'

const INCLUSION_OPTIONS: { value: InclusionStatus; label: string }[] = [
  { value: 'included',        label: 'Included' },
  { value: 'not_required',    label: 'Not Required' },
  { value: 'provisional_sum', label: 'Provisional Sum' },
  { value: 'appears_adequate', label: 'Appears Adequate' },
]

function statusStyle(status: InclusionStatus) {
  switch (status) {
    case 'included':
      return 'bg-emerald-950 border-emerald-800/60 text-emerald-300'
    case 'not_required':
      return 'bg-slate-900 border-slate-700 text-slate-500'
    case 'provisional_sum':
      return 'bg-amber-950 border-amber-800/60 text-amber-300'
    case 'appears_adequate':
      return 'bg-blue-950 border-blue-800/60 text-blue-300'
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
  onVariantChange: (optionId: string | null) => void
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
  onVariantChange,
}: LineItemRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const showDelta = comparisonTotal !== undefined
  const delta = showDelta ? item.computed_total - comparisonTotal! : 0
  const hasModifier = item.modifier_type !== 'none' && item.modifier_value !== 0
  const isExcluded = !item.is_included

  // Close context menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <tr
      className={clsx(
        'border-b border-slate-800/50 last:border-0 group text-sm transition-opacity',
        isExcluded && 'opacity-50',
        item.is_duplicate && 'bg-slate-900/40'
      )}
    >
      {/* Inclusion status */}
      <td className="pl-3 pr-2 py-2 w-36">
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
      <td className="pr-3 py-2 w-20">
        <code className="text-xs text-slate-600 font-mono">{item.code}</code>
        {item.is_duplicate && (
          <span className="block text-xs text-slate-700 font-mono">(copy)</span>
        )}
      </td>

      {/* Name + optional variant selector + formula info */}
      <td className="pr-3 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={clsx(
            'text-slate-200',
            isExcluded && 'line-through text-slate-500',
            item.inclusion_status === 'appears_adequate' && 'italic',
          )}>
            {item.name}
          </span>
          {item.inclusion_status === 'provisional_sum' && (
            <span className="text-xs font-semibold text-amber-400 bg-amber-900/40 px-1.5 py-0.5 rounded shrink-0">
              PS
            </span>
          )}
          {item.inclusion_status === 'appears_adequate' && (
            <span className="text-xs text-blue-400 bg-blue-900/30 px-1 rounded shrink-0">
              appears adequate
            </span>
          )}
          {item.is_custom && (
            <span className="text-xs text-amber-500 bg-amber-900/30 px-1 rounded shrink-0">custom</span>
          )}
          <FormulaTooltip item={item} scope={scope} />
        </div>

        {/* Variant selector */}
        {item.available_options.length > 0 && !isExcluded && (
          <div className="mt-1">
            <select
              value={item.selected_option_id ?? ''}
              onChange={(e) => onVariantChange(e.target.value || null)}
              disabled={readOnly}
              className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-400
                         focus:outline-none focus:ring-1 focus:ring-brand-500 max-w-[260px]"
            >
              <option value="">— Default rate —</option>
              {item.available_options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} (${opt.unit_price.toLocaleString('en-AU', { maximumFractionDigits: 0 })})
                </option>
              ))}
            </select>
          </div>
        )}

        {hasModifier && item.modifier_note && (
          <p className="text-xs text-amber-400/70 mt-0.5 truncate max-w-[280px]" title={item.modifier_note}>
            ↳ {item.modifier_note}
          </p>
        )}
      </td>

      {/* Unit */}
      <td className="pr-3 py-2 text-slate-500 text-xs w-10">{item.unit}</td>

      {/* Qty */}
      <td className="pr-3 py-2 w-20">
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

      {/* Base unit price */}
      <td className="pr-3 py-2 text-right font-mono text-slate-400 text-xs w-24">
        ${item.base_unit_price.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
      </td>

      {/* Modifier */}
      <td className="pr-3 py-2 w-24 text-center">
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
      <td className="pr-3 py-2 text-right font-mono text-sm w-28">
        {item.is_included ? (
          <span className={clsx(
            item.computed_total < 0 ? 'text-green-400' : 'text-slate-200',
            hasModifier && 'text-amber-300',
            item.inclusion_status === 'provisional_sum' && 'text-amber-300',
          )}>
            ${item.computed_total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>

      {/* Comparison delta */}
      {showDelta && (
        <td className="pr-3 py-2 text-right font-mono text-xs w-24">
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
      <td className="pr-2 py-2 w-8">
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
                              rounded-lg shadow-2xl py-1 min-w-[148px]">
                <button
                  onClick={() => { onDuplicate(); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700
                             flex items-center gap-2 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  Duplicate row
                </button>
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
