import { Info } from 'lucide-react'
import Tooltip from '../ui/Tooltip'
import type { ComputedLineItem, PartialFormulaScope } from '../../types/domain.types'
import { buildScope, evaluateFormula } from '../../lib/formulaEngine'

interface FormulaTooltipProps {
  item: ComputedLineItem
  scope: PartialFormulaScope
}

export default function FormulaTooltip({ item, scope }: FormulaTooltipProps) {
  if (!item.formula) return null

  const fullScope = buildScope(scope, { base_price: item.base_unit_price, qty: item.qty })
  const result = evaluateFormula(item.formula, fullScope)

  const content = (
    <div className="space-y-2">
      <div>
        <div className="text-slate-400 text-xs mb-1 font-medium uppercase tracking-wide">Formula</div>
        <code className="text-brand-300 font-mono text-xs block whitespace-pre-wrap break-all">
          {item.formula}
        </code>
      </div>
      <div>
        <div className="text-slate-400 text-xs mb-1 font-medium uppercase tracking-wide">Key Variables</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
          <span className="text-slate-500">system_kw</span>
          <span className="text-slate-300 font-mono">{scope.system_kw ?? 0}</span>
          <span className="text-slate-500">system_kva</span>
          <span className="text-slate-300 font-mono">{scope.system_kva ?? 0}</span>
          <span className="text-slate-500">install_type</span>
          <span className="text-slate-300 font-mono">"{scope.install_type ?? 'rooftop'}"</span>
          <span className="text-slate-500">site_state</span>
          <span className="text-slate-300 font-mono">"{scope.site_state ?? ''}"</span>
          <span className="text-slate-500">has_bess</span>
          <span className="text-slate-300 font-mono">{String(scope.has_bess ?? false)}</span>
          <span className="text-slate-500">has_ev</span>
          <span className="text-slate-300 font-mono">{String(scope.has_ev ?? false)}</span>
          <span className="text-slate-500">base_price</span>
          <span className="text-slate-300 font-mono">${item.base_unit_price.toFixed(2)}</span>
          <span className="text-slate-500">qty</span>
          <span className="text-slate-300 font-mono">{item.qty}</span>
        </div>
      </div>
      <div className="pt-1 border-t border-slate-700">
        <span className="text-slate-400 text-xs">Result: </span>
        {result.error
          ? <span className="text-red-400 text-xs">{result.error}</span>
          : <span className="text-brand-300 font-mono text-xs font-medium">
              ${result.value.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
        }
      </div>
    </div>
  )

  return (
    <Tooltip content={content} side="left" maxWidth="360px">
      <button
        type="button"
        className="text-slate-600 hover:text-brand-400 transition-colors p-0.5"
        tabIndex={-1}
      >
        <Info className="w-3.5 h-3.5" />
      </button>
    </Tooltip>
  )
}
