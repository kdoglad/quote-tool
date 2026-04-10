import { useState } from 'react'
import type { ItemCategory, CustomLineItem } from '../../types/domain.types'
import Dialog from '../ui/Dialog'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import FormulaEditor from '../price-table/FormulaEditor'
import { CATEGORIES, UNITS } from '../../lib/constants'

interface CustomLineItemFormProps {
  onAdd: (item: CustomLineItem) => void
  onClose: () => void
}

export default function CustomLineItemForm({ onAdd, onClose }: CustomLineItemFormProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ItemCategory>('Custom')
  const [unit, setUnit] = useState('ea')
  const [qty, setQty] = useState('1')
  const [basePrice, setBasePrice] = useState('0')
  const [formula, setFormula] = useState('')
  const [code, setCode] = useState('')

  function handleAdd() {
    if (!name.trim()) return
    const item: CustomLineItem = {
      id: Math.random().toString(36).slice(2),
      category,
      code: code.trim() || `CUST-${Date.now().toString(36).toUpperCase()}`,
      name: name.trim(),
      unit,
      qty: parseFloat(qty) || 1,
      base_unit_price: parseFloat(basePrice) || 0,
      formula: formula.trim() || null,
      modifier_type: 'none',
      modifier_value: 0,
      modifier_note: '',
      sort_order: 9999,
    }
    onAdd(item)
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Add Custom Line Item"
      description="Add a one-off line item to this quote. Use a formula to make it respond dynamically to quote inputs."
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Item code (optional)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. CUST-001"
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ItemCategory)}
            options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
        </div>

        <Input
          label="Description"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Additional conduit for plant room"
        />

        <div className="grid grid-cols-3 gap-4">
          <Select
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            options={UNITS}
          />
          <Input
            label="Quantity"
            type="number"
            min="0"
            step="0.01"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <Input
            label="Base price ($)"
            type="number"
            step="0.01"
            min="0"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            prefix="$"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1.5">
            Formula (optional — makes this item dynamic)
          </label>
          <FormulaEditor
            value={formula}
            onChange={setFormula}
            basePrice={parseFloat(basePrice) || 0}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={handleAdd}
          >
            Add to Quote
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
