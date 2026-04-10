import { useState } from 'react'
import { Settings2, X } from 'lucide-react'
import type { ModifierType } from '../../types/domain.types'
import Dialog from '../ui/Dialog'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { clsx } from 'clsx'

interface ModifierCellProps {
  itemName: string
  modifierType: ModifierType
  modifierValue: number
  modifierNote: string
  onSave: (type: ModifierType, value: number, note: string) => void
  disabled?: boolean
}

export default function ModifierCell({
  itemName,
  modifierType,
  modifierValue,
  modifierNote,
  onSave,
  disabled,
}: ModifierCellProps) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<ModifierType>(modifierType)
  const [value, setValue] = useState(String(modifierValue))
  const [note, setNote] = useState(modifierNote)

  const hasModifier = modifierType !== 'none' && modifierValue !== 0

  function handleSave() {
    onSave(type, parseFloat(value) || 0, note)
    setOpen(false)
  }

  function handleClear() {
    onSave('none', 0, '')
    setType('none')
    setValue('0')
    setNote('')
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className={clsx(
          'flex items-center gap-1 text-xs transition-colors',
          hasModifier
            ? 'text-amber-300 hover:text-amber-200'
            : 'text-slate-600 hover:text-slate-400',
          disabled && 'opacity-40 cursor-not-allowed'
        )}
        title={hasModifier ? `${modifierType === 'percent' ? modifierValue + '%' : '$' + modifierValue} adjustment: ${modifierNote}` : 'Add adjustment'}
      >
        <Settings2 className="w-3.5 h-3.5" />
        {hasModifier && (
          <span className="font-mono">
            {modifierType === 'percent'
              ? `${modifierValue > 0 ? '+' : ''}${modifierValue}%`
              : `${modifierValue > 0 ? '+' : ''}$${Math.abs(modifierValue).toFixed(0)}`
            }
          </span>
        )}
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => !o && setOpen(false)}
        title={`Adjust: ${itemName}`}
        description="Apply a one-off price adjustment to this line item without changing the underlying price table."
        size="sm"
      >
        <div className="space-y-4">
          {/* Type toggle */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Adjustment type</label>
            <div className="flex gap-2">
              {(['none', 'percent', 'flat'] as ModifierType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={clsx(
                    'flex-1 py-1.5 text-sm rounded-lg border transition-colors',
                    type === t
                      ? 'bg-brand-900/40 border-brand-700 text-brand-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  )}
                >
                  {t === 'none' ? 'None' : t === 'percent' ? 'Percentage %' : 'Fixed $'}
                </button>
              ))}
            </div>
          </div>

          {type !== 'none' && (
            <Input
              label={type === 'percent' ? 'Percentage (use negative to reduce)' : 'Amount in $ (use negative to reduce)'}
              type="number"
              step={type === 'percent' ? '1' : '0.01'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              prefix={type === 'flat' ? '$' : undefined}
              suffix={type === 'percent' ? '%' : undefined}
            />
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Reason (required)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Promotional cable price from supplier, valid this month only"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white
                         placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500
                         px-3 py-2 resize-none"
            />
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={handleClear} icon={<X className="w-3.5 h-3.5" />}>
              Clear
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={type !== 'none' && !note.trim()}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </>
  )
}
