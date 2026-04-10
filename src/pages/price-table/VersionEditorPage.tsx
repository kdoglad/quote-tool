import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Send, ArrowLeft, ChevronDown, ChevronRight, Trash2, Save, Upload, Download, AlertCircle, CheckCircle2, GripVertical, PlusCircle } from 'lucide-react'
import { usePriceVersion } from '../../hooks/usePriceVersions'
import { usePriceItems, useUpdatePriceItem, useCreatePriceItem, useDeletePriceItem } from '../../hooks/usePriceItems'
import { useSingleItemOptions, useSaveItemOptions } from '../../hooks/usePriceItemOptions'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Dialog from '../../components/ui/Dialog'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import FormulaEditor from '../../components/price-table/FormulaEditor'
import PublishDialog from '../../components/price-table/PublishDialog'
import { useToast } from '../../components/ui/Toast'
import { CATEGORIES, UNITS } from '../../lib/constants'
import type { PriceItem, ItemCategory, PriceItemOptionGroup } from '../../types/domain.types'
import { clsx } from 'clsx'

// ── CSV helpers ──────────────────────────────────────────────

const VALID_CATEGORIES = new Set(CATEGORIES.map((c) => c.value))
const CSV_TEMPLATE_HEADERS = 'category,code,name,unit,base_price,formula,is_optional,sort_order,notes'
const CSV_TEMPLATE_ROWS = [
  'PV_Components,PVC-001,Solar Panels,kWp,290.00,base_price * system_kw,FALSE,10,Tier 1 panels',
  'Install,INS-001,Installation Labour,kWp,120.00,,FALSE,100,Per kWp installed',
  'Rebates,REB-001,STC Rebate,kWp,-1,,FALSE,200,stc_zone_factor * stc_years * system_kw * stc_price',
]

function downloadTemplate() {
  const content = [CSV_TEMPLATE_HEADERS, ...CSV_TEMPLATE_ROWS].join('\n')
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'price_items_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

interface CSVRow {
  category: string
  code: string
  name: string
  unit: string
  base_price: string
  formula: string
  is_optional: string
  sort_order: string
  notes: string
  _valid: boolean
  _errors: string[]
}

function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'))

  return lines.slice(1).map((line) => {
    const vals = parseCSVLine(line)
    const raw: Record<string, string> = {}
    headers.forEach((h, i) => { raw[h] = vals[i] ?? '' })

    const errors: string[] = []
    const category = raw.category ?? ''
    const code = raw.code?.trim() ?? ''
    const name = raw.name?.trim() ?? ''

    if (!VALID_CATEGORIES.has(category)) errors.push(`Unknown category "${category}"`)
    if (!code) errors.push('Code is required')
    if (!name) errors.push('Name is required')
    const basePrice = parseFloat(raw.base_price ?? '0')
    if (isNaN(basePrice)) errors.push('base_price must be a number')

    return {
      category,
      code,
      name,
      unit: raw.unit?.trim() || 'ea',
      base_price: raw.base_price ?? '0',
      formula: raw.formula?.trim() ?? '',
      is_optional: raw.is_optional?.trim() ?? 'false',
      sort_order: raw.sort_order?.trim() ?? '999',
      notes: raw.notes?.trim() ?? '',
      _valid: errors.length === 0,
      _errors: errors,
    }
  })
}

// ── Main page ────────────────────────────────────────────────

export default function VersionEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const { data: version, isLoading: vLoading } = usePriceVersion(id)
  const { data: items = [], isLoading: iLoading } = usePriceItems(id)
  const updateItem = useUpdatePriceItem()
  const createItem = useCreatePriceItem()
  const deleteItem = useDeletePriceItem()

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Prelim', 'PV_Components'])
  )
  const [editingItem, setEditingItem] = useState<PriceItem | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)

  const isDraft = version?.is_draft ?? false

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  async function handleSaveItem(item: PriceItem, updates: Partial<PriceItem>) {
    try {
      await updateItem.mutateAsync({ id: item.id, versionId: item.version_id, updates })
      addToast('success', 'Item saved.')
      setEditingItem(null)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save item')
    }
  }

  async function handleDelete(item: PriceItem) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    try {
      await deleteItem.mutateAsync({ id: item.id, versionId: item.version_id })
      addToast('success', 'Item deleted.')
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to delete item')
    }
  }

  if (vLoading || iLoading) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>
  }

  if (!version) {
    return <div className="p-6 text-slate-400">Version not found.</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900 shrink-0">
        <button
          onClick={() => navigate('/price-table')}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-white">{version.version_name}</h1>
            <Badge variant={isDraft ? 'draft' : 'success'}>{isDraft ? 'Draft' : 'Published'}</Badge>
          </div>
          {version.notes && <p className="text-xs text-slate-500 mt-0.5">{version.notes}</p>}
        </div>
        {isDraft && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => setShowImportDialog(true)}
            >
              Import CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowAddDialog(true)}
            >
              Add Item
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Send className="w-3.5 h-3.5" />}
              onClick={() => setShowPublishDialog(true)}
            >
              Publish Version
            </Button>
          </div>
        )}
        {!isDraft && (
          <Badge variant="info">Read-only — published versions cannot be edited</Badge>
        )}
      </div>

      {/* Item count summary */}
      <div className="px-6 py-2 bg-slate-950/50 border-b border-slate-800 shrink-0 flex items-center gap-4">
        <span className="text-xs text-slate-500">{items.length} items across {CATEGORIES.length} categories</span>
        {isDraft && items.length === 0 && (
          <span className="text-xs text-amber-400">
            Import a CSV or add items individually to get started.
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {CATEGORIES.map(({ value: cat, label }) => {
          const catItems = items.filter((i) => i.category === cat)
          if (catItems.length === 0 && !isDraft) return null
          const isExpanded = expandedCategories.has(cat)

          return (
            <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
              >
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-slate-500" />
                  : <ChevronRight className="w-4 h-4 text-slate-500" />
                }
                <span className="font-medium text-slate-200 text-sm">{label}</span>
                <span className="text-xs text-slate-600 ml-auto">{catItems.length} items</span>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-800">
                  {catItems.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-600">No items in this category.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 border-b border-slate-800">
                          <th className="px-4 py-2 text-left w-24">Code</th>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left w-16">Unit</th>
                          <th className="px-4 py-2 text-right w-28">Base Price</th>
                          <th className="px-4 py-2 text-left">Formula</th>
                          <th className="px-4 py-2 w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {catItems.map((item) => (
                          <PriceItemRow
                            key={item.id}
                            item={item}
                            isDraft={isDraft}
                            onEdit={() => setEditingItem(item)}
                            onDelete={() => handleDelete(item)}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Edit item dialog */}
      {editingItem && (
        <EditItemDialog
          item={editingItem}
          onSave={(updates) => handleSaveItem(editingItem, updates)}
          onClose={() => setEditingItem(null)}
          saving={updateItem.isPending}
        />
      )}

      {/* Add item dialog */}
      {showAddDialog && id && (
        <AddItemDialog
          versionId={id}
          onClose={() => setShowAddDialog(false)}
          onCreate={async (item) => {
            try {
              await createItem.mutateAsync(item)
              addToast('success', 'Item added.')
              setShowAddDialog(false)
            } catch (err) {
              addToast('error', err instanceof Error ? err.message : 'Failed to add item')
            }
          }}
          creating={createItem.isPending}
        />
      )}

      {/* CSV import dialog */}
      {showImportDialog && id && (
        <CSVImportDialog
          versionId={id}
          onClose={() => setShowImportDialog(false)}
          onImported={(count) => {
            addToast('success', `Imported ${count} items successfully.`)
            setShowImportDialog(false)
          }}
        />
      )}

      {/* Publish dialog */}
      {showPublishDialog && id && (
        <PublishDialog
          sourceVersionId={id}
          sourceVersionName={version.version_name}
          onClose={() => setShowPublishDialog(false)}
          onPublished={() => {
            setShowPublishDialog(false)
            navigate('/price-table')
          }}
        />
      )}
    </div>
  )
}

// ── PriceItemRow ─────────────────────────────────────────────

function PriceItemRow({
  item, isDraft, onEdit, onDelete,
}: {
  item: PriceItem
  isDraft: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <tr className={clsx('border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 group', !item.is_active && 'opacity-40')}>
      <td className="px-4 py-2.5">
        <code className="text-xs text-slate-500 font-mono">{item.code}</code>
      </td>
      <td className="px-4 py-2.5">
        <span className="text-slate-200">{item.name}</span>
        {item.is_optional && <span className="ml-2 text-xs text-slate-600">(optional)</span>}
      </td>
      <td className="px-4 py-2.5 text-slate-500 text-xs">{item.unit}</td>
      <td className="px-4 py-2.5 text-right font-mono text-slate-300 text-xs">
        ${item.base_price.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
      </td>
      <td className="px-4 py-2.5 max-w-[240px]">
        {item.formula ? (
          <code className="text-xs text-brand-400 font-mono truncate block" title={item.formula}>
            {item.formula.length > 50 ? item.formula.slice(0, 50) + '…' : item.formula}
          </code>
        ) : (
          <span className="text-xs text-slate-600">base_price × qty</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {isDraft && (
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-slate-700"
              title="Edit item"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-slate-700"
              title="Delete item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

// ── EditItemDialog ───────────────────────────────────────────

// Local types for in-memory option editing (no DB ids yet for new entries)
interface LocalOption {
  _key: string
  label: string
  modifier_type: 'flat' | 'percent' | 'replace'
  modifier_value: string
  is_default: boolean
  notes: string
}
interface LocalGroup {
  _key: string
  label: string
  is_required: boolean
  options: LocalOption[]
}

function makeOption(): LocalOption {
  return { _key: crypto.randomUUID(), label: '', modifier_type: 'flat', modifier_value: '0', is_default: false, notes: '' }
}
function makeGroup(): LocalGroup {
  return { _key: crypto.randomUUID(), label: '', is_required: false, options: [makeOption()] }
}

function EditItemDialog({
  item, onSave, onClose, saving,
}: {
  item: PriceItem
  onSave: (updates: Partial<PriceItem>) => void
  onClose: () => void
  saving: boolean
}) {
  const { addToast } = useToast()
  const saveOptions = useSaveItemOptions()
  const { data: existingGroups = [], isLoading: groupsLoading } = useSingleItemOptions(item.id)

  const [name, setName] = useState(item.name)
  const [unit, setUnit] = useState(item.unit)
  const [basePrice, setBasePrice] = useState(String(item.base_price))
  const [formula, setFormula] = useState(item.formula ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [isOptional, setIsOptional] = useState(item.is_optional)

  // Convert existing DB groups into local editing state
  const [groups, setGroups] = useState<LocalGroup[] | null>(null)

  // Populate local groups once DB data arrives
  if (!groupsLoading && groups === null) {
    if (existingGroups.length > 0) {
      setGroups(existingGroups.map((g) => ({
        _key: g.id,
        label: g.label,
        is_required: g.is_required,
        options: (g.options ?? []).map((o) => ({
          _key: o.id,
          label: o.label,
          modifier_type: o.modifier_type,
          modifier_value: String(o.modifier_value),
          is_default: o.is_default,
          notes: o.notes ?? '',
        })),
      })))
    } else {
      setGroups([])
    }
  }

  function updateGroup(key: string, patch: Partial<LocalGroup>) {
    setGroups((gs) => gs?.map((g) => g._key === key ? { ...g, ...patch } : g) ?? [])
  }
  function updateOption(groupKey: string, optKey: string, patch: Partial<LocalOption>) {
    setGroups((gs) => gs?.map((g) => g._key !== groupKey ? g : {
      ...g,
      options: g.options.map((o) => o._key === optKey ? { ...o, ...patch } : o),
    }) ?? [])
  }
  function removeGroup(key: string) {
    setGroups((gs) => gs?.filter((g) => g._key !== key) ?? [])
  }
  function removeOption(groupKey: string, optKey: string) {
    setGroups((gs) => gs?.map((g) => g._key !== groupKey ? g : {
      ...g,
      options: g.options.filter((o) => o._key !== optKey),
    }) ?? [])
  }
  function setDefault(groupKey: string, optKey: string) {
    setGroups((gs) => gs?.map((g) => g._key !== groupKey ? g : {
      ...g,
      options: g.options.map((o) => ({ ...o, is_default: o._key === optKey })),
    }) ?? [])
  }

  async function handleSave() {
    // Save item fields
    onSave({ name, unit, base_price: parseFloat(basePrice) || 0, formula: formula || null, notes: notes || null, is_optional: isOptional })
    // Save option groups
    if (groups !== null) {
      try {
        await saveOptions.mutateAsync({
          priceItemId: item.id,
          groups: groups
            .filter((g) => g.label.trim())
            .map((g, gi) => ({
              label: g.label,
              sort_order: gi * 10,
              is_required: g.is_required,
              options: g.options
                .filter((o) => o.label.trim())
                .map((o, oi) => ({
                  label: o.label,
                  modifier_type: o.modifier_type,
                  modifier_value: parseFloat(o.modifier_value) || 0,
                  sort_order: oi * 10,
                  is_default: o.is_default,
                  notes: o.notes,
                })),
            })),
        })
      } catch (err) {
        addToast('error', err instanceof Error ? err.message : 'Failed to save option groups')
      }
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Edit: ${item.name}`} size="xl">
      <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
        {/* ── Item fields ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-mono mb-1.5">Code</p>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400 font-mono">
              {item.code}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} options={UNITS} />
          <Input label="Base price ($)" type="number" step="0.01" value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)} prefix="$" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">
            Default formula
            <span className="ml-2 text-xs text-slate-600 font-normal">
              (template — salespeople can override per quote)
            </span>
          </label>
          <FormulaEditor value={formula} onChange={setFormula} basePrice={parseFloat(basePrice) || 0} />
        </div>
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes about this line item" />
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isOptional} onChange={(e) => setIsOptional(e.target.checked)}
            className="rounded border-slate-700 bg-slate-800 text-brand-500" />
          <span className="text-sm text-slate-400">Optional (excluded by default in new quotes)</span>
        </label>

        {/* ── Option Groups ── */}
        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-slate-300">Configuration Options</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Add selection groups (e.g. "Enclosure Type") with options that adjust the price.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<PlusCircle className="w-3.5 h-3.5" />}
              onClick={() => setGroups((gs) => [...(gs ?? []), makeGroup()])}
            >
              Add Group
            </Button>
          </div>

          {groupsLoading || groups === null ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : groups.length === 0 ? (
            <p className="text-xs text-slate-600 py-2">
              No option groups — this item has a fixed price from its base price / formula.
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group._key} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-3">
                    <GripVertical className="w-4 h-4 text-slate-600 shrink-0" />
                    <input
                      type="text"
                      value={group.label}
                      onChange={(e) => updateGroup(group._key, { label: e.target.value })}
                      placeholder="Group label, e.g. Enclosure Type"
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5
                                 text-sm text-white placeholder-slate-600
                                 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={group.is_required}
                        onChange={(e) => updateGroup(group._key, { is_required: e.target.checked })}
                        className="rounded border-slate-600 bg-slate-700 text-brand-500"
                      />
                      Required
                    </label>
                    <button
                      onClick={() => removeGroup(group._key)}
                      className="text-slate-600 hover:text-red-400 transition-colors p-1"
                      title="Remove group"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Options within group */}
                  <div className="space-y-1.5 ml-6">
                    <div className="grid grid-cols-[1fr_100px_90px_24px_24px] gap-1.5 text-xs text-slate-600 mb-1 px-1">
                      <span>Option label</span>
                      <span>Modifier type</span>
                      <span>Value</span>
                      <span title="Default">Def.</span>
                      <span />
                    </div>
                    {group.options.map((opt) => (
                      <div key={opt._key} className="grid grid-cols-[1fr_100px_90px_24px_24px] gap-1.5 items-center">
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => updateOption(group._key, opt._key, { label: e.target.value })}
                          placeholder="e.g. External stainless"
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white
                                     placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <select
                          value={opt.modifier_type}
                          onChange={(e) => updateOption(group._key, opt._key, { modifier_type: e.target.value as LocalOption['modifier_type'] })}
                          className="bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-xs text-white
                                     focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="flat">+ flat $</option>
                          <option value="percent">+ percent %</option>
                          <option value="replace">= replace $</option>
                        </select>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs pointer-events-none">
                            {opt.modifier_type === 'percent' ? '%' : '$'}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={opt.modifier_value}
                            onChange={(e) => updateOption(group._key, opt._key, { modifier_value: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded pl-5 pr-2 py-1
                                       text-xs text-white font-mono text-right
                                       focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </div>
                        <button
                          onClick={() => setDefault(group._key, opt._key)}
                          title={opt.is_default ? 'Default option' : 'Set as default'}
                          className={clsx(
                            'w-5 h-5 rounded-full border text-xs flex items-center justify-center transition-colors',
                            opt.is_default
                              ? 'bg-brand-600 border-brand-500 text-white'
                              : 'border-slate-600 text-slate-600 hover:border-slate-400'
                          )}
                        >
                          {opt.is_default ? '●' : '○'}
                        </button>
                        <button
                          onClick={() => removeOption(group._key, opt._key)}
                          className="text-slate-600 hover:text-red-400 transition-colors"
                          title="Remove option"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setGroups((gs) => gs?.map((g) => g._key !== group._key ? g : {
                        ...g, options: [...g.options, makeOption()],
                      }) ?? [])}
                      className="text-xs text-slate-600 hover:text-slate-400 flex items-center gap-1 mt-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add option
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={saving || saveOptions.isPending}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ── AddItemDialog ────────────────────────────────────────────

function AddItemDialog({
  versionId, onClose, onCreate, creating,
}: {
  versionId: string
  onClose: () => void
  onCreate: (item: Omit<PriceItem, 'id' | 'created_at'>) => void
  creating: boolean
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ItemCategory>('Prelim')
  const [unit, setUnit] = useState('ea')
  const [basePrice, setBasePrice] = useState('0')
  const [formula, setFormula] = useState('')
  const [notes, setNotes] = useState('')
  const [isOptional, setIsOptional] = useState(false)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Add Line Item" size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. PVC-011"
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ItemCategory)}
            options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
        </div>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Solar Panel Mounting System" />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            options={UNITS}
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
          <label className="block text-sm text-slate-400 mb-1">
            Default formula
            <span className="ml-2 text-xs text-slate-600 font-normal">(optional — overridable per quote)</span>
          </label>
          <FormulaEditor value={formula} onChange={setFormula} basePrice={parseFloat(basePrice) || 0} />
        </div>
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isOptional}
            onChange={(e) => setIsOptional(e.target.checked)}
            className="rounded border-slate-700 bg-slate-800 text-brand-500"
          />
          <span className="text-sm text-slate-400">Optional (excluded by default in new quotes)</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={creating}
            disabled={!code.trim() || !name.trim()}
            onClick={() => onCreate({
              version_id: versionId,
              category,
              subcategory: null,
              code: code.trim(),
              name: name.trim(),
              unit,
              base_price: parseFloat(basePrice) || 0,
              formula: formula || null,
              conditions: {},
              sort_order: 999,
              is_optional: isOptional,
              is_active: true,
              notes: notes || null,
            })}
          >
            Add Item
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ── CSVImportDialog ──────────────────────────────────────────

function CSVImportDialog({
  versionId,
  onClose,
  onImported,
}: {
  versionId: string
  onClose: () => void
  onImported: (count: number) => void
}) {
  const createItem = useCreatePriceItem()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<CSVRow[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const validRows = rows.filter((r) => r._valid)
  const invalidRows = rows.filter((r) => !r._valid)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setRows(parseCSV(text))
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)
    setProgress(0)
    let imported = 0

    for (const row of validRows) {
      try {
        await createItem.mutateAsync({
          version_id: versionId,
          category: row.category as ItemCategory,
          subcategory: null,
          code: row.code,
          name: row.name,
          unit: row.unit || 'ea',
          base_price: parseFloat(row.base_price) || 0,
          formula: row.formula || null,
          conditions: {},
          sort_order: parseInt(row.sort_order) || 999,
          is_optional: row.is_optional.toLowerCase() === 'true' || row.is_optional === '1',
          is_active: true,
          notes: row.notes || null,
        })
        imported++
        setProgress(Math.round((imported / validRows.length) * 100))
      } catch {
        // Continue importing remaining rows even if one fails
      }
    }

    setImporting(false)
    onImported(imported)
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Import Line Items from CSV"
      size="xl"
    >
      <div className="space-y-4">
        {/* Instructions */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-xs text-slate-400 space-y-1.5">
          <p className="font-medium text-slate-300">CSV format</p>
          <p>Required columns: <code className="text-brand-400">category, code, name</code></p>
          <p>Optional columns: <code className="text-slate-400">unit, base_price, formula, is_optional, sort_order, notes</code></p>
          <p>Valid categories: <code className="text-slate-400">{CATEGORIES.map((c) => c.value).join(', ')}</code></p>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 mt-2"
          >
            <Download className="w-3.5 h-3.5" />
            Download template CSV
          </button>
        </div>

        {/* File picker */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="hidden"
          />
          <Button
            variant="secondary"
            icon={<Upload className="w-4 h-4" />}
            onClick={() => fileRef.current?.click()}
          >
            {rows.length > 0 ? 'Choose different file' : 'Choose CSV file'}
          </Button>
        </div>

        {/* Preview */}
        {rows.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm text-slate-300 font-medium">{rows.length} rows parsed</span>
              {validRows.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {validRows.length} valid
                </span>
              )}
              {invalidRows.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {invalidRows.length} errors (will be skipped)
                </span>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-700 rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="text-slate-500 border-b border-slate-700">
                    <th className="px-3 py-2 text-left w-6">#</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-right">Base Price</th>
                    <th className="px-3 py-2 text-left">Formula</th>
                    <th className="px-3 py-2 text-left w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={clsx(
                        'border-b border-slate-800/50 last:border-0',
                        !row._valid && 'bg-red-950/20'
                      )}
                    >
                      <td className="px-3 py-2 text-slate-600">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-400">{row.category || <span className="text-red-400">missing</span>}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{row.code || <span className="text-red-400">missing</span>}</td>
                      <td className="px-3 py-2 text-slate-300 max-w-[180px] truncate">{row.name || <span className="text-red-400">missing</span>}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-400">
                        {row.base_price ? `$${parseFloat(row.base_price).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-brand-400/70 max-w-[150px] truncate">
                        {row.formula || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row._valid ? (
                          <span className="text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> OK
                          </span>
                        ) : (
                          <span
                            className="text-red-400 flex items-center gap-1 cursor-help"
                            title={row._errors.join('; ')}
                          >
                            <AlertCircle className="w-3 h-3" /> Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Progress */}
        {importing && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Importing…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={importing}>Cancel</Button>
          <Button
            variant="primary"
            loading={importing}
            disabled={validRows.length === 0}
            onClick={handleImport}
            icon={<Upload className="w-3.5 h-3.5" />}
          >
            Import {validRows.length} items
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
