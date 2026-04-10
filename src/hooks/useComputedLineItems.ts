import { useMemo } from 'react'
import type {
  PriceItem,
  ComputedLineItem,
  QuoteLineItemState,
  PriceItemOption,
  PartialFormulaScope,
  InclusionStatus,
} from '../types/domain.types'
import { computeLineItemTotal } from '../lib/formulaEngine'

/**
 * Compute all line items with their formula-evaluated totals.
 *
 * Standard items that have no stored QuoteLineItemState are treated as "virtual defaults":
 *   - optional items default to 'not_required'
 *   - non-optional items default to 'included'
 * Their instance_id is set to price_item_id (so first interaction persists cleanly).
 *
 * Duplicate instances (instance_id !== price_item_id) appear immediately after
 * the primary instance in the output order.
 *
 * Custom items (price_item_id === null) appear at the end, sorted by sort_order.
 */
export function useComputedLineItems(
  priceItems: PriceItem[],
  lineItems: QuoteLineItemState[],
  scope: PartialFormulaScope,
  priceItemOptions: PriceItemOption[] = []
): ComputedLineItem[] {
  return useMemo(() => {
    // Index stored line items by price_item_id
    const storedByPriceItemId = new Map<string, QuoteLineItemState[]>()
    const customLineItems: QuoteLineItemState[] = []

    for (const li of lineItems) {
      if (li.price_item_id !== null) {
        const arr = storedByPriceItemId.get(li.price_item_id) ?? []
        arr.push(li)
        storedByPriceItemId.set(li.price_item_id, arr)
      } else {
        customLineItems.push(li)
      }
    }

    // Index options by price_item_id
    const optionsByPriceItemId = new Map<string, PriceItemOption[]>()
    for (const opt of priceItemOptions) {
      const arr = optionsByPriceItemId.get(opt.price_item_id) ?? []
      arr.push(opt)
      optionsByPriceItemId.set(opt.price_item_id, arr)
    }

    const results: ComputedLineItem[] = []

    // ── Standard price items (maintain priceItems order from DB) ──
    for (const item of priceItems) {
      const availableOptions = optionsByPriceItemId.get(item.id) ?? []
      const stored = storedByPriceItemId.get(item.id)

      if (stored && stored.length > 0) {
        // Sort stored instances: primary (instance_id === price_item_id) first, then by sort_order
        const sorted = [...stored].sort((a, b) => {
          const aPrimary = a.instance_id === item.id ? 0 : 1
          const bPrimary = b.instance_id === item.id ? 0 : 1
          if (aPrimary !== bPrimary) return aPrimary - bPrimary
          return a.sort_order - b.sort_order
        })

        for (const inst of sorted) {
          results.push(buildFromStored(item, inst, availableOptions, scope))
        }
      } else {
        // Virtual default — never been touched by user
        results.push(buildVirtualDefault(item, availableOptions, scope))
      }
    }

    // ── Custom items (at end, sorted by sort_order) ──
    const sortedCustom = [...customLineItems].sort((a, b) => a.sort_order - b.sort_order)
    for (const li of sortedCustom) {
      results.push(buildCustomItem(li, scope))
    }

    return results
  }, [priceItems, lineItems, scope, priceItemOptions])
}

// ── Private helpers ──────────────────────────────────────────

function inclusionToBoolean(status: InclusionStatus): boolean {
  return status === 'included' || status === 'provisional_sum'
}

function buildFromStored(
  item: PriceItem,
  inst: QuoteLineItemState,
  availableOptions: PriceItemOption[],
  scope: PartialFormulaScope
): ComputedLineItem {
  // Resolve unit price: use selected option if set
  let unitPrice = item.base_price
  if (inst.selected_option_id) {
    const opt = availableOptions.find((o) => o.id === inst.selected_option_id)
    if (opt) unitPrice = opt.unit_price
  }

  const isIncluded = inclusionToBoolean(inst.inclusion_status)
  const isDuplicate = inst.instance_id !== item.id
  const computedTotal = isIncluded
    ? computeLineItemTotal(
        { ...item, base_price: unitPrice },
        inst.qty,
        scope,
        { type: inst.modifier_type, value: inst.modifier_value }
      )
    : 0

  return {
    id: inst.instance_id,
    instance_id: inst.instance_id,
    quote_id: '',
    price_item_id: item.id,
    is_custom: false,
    is_duplicate: isDuplicate,
    is_removable: isDuplicate,
    inclusion_status: inst.inclusion_status,
    is_included: isIncluded,
    category: item.category,
    subcategory: item.subcategory,
    code: item.code,
    name: item.name,
    unit: item.unit,
    qty: inst.qty,
    base_unit_price: unitPrice,
    formula: item.formula,
    modifier_type: inst.modifier_type,
    modifier_value: inst.modifier_value,
    modifier_note: inst.modifier_note,
    computed_total: computedTotal,
    available_options: availableOptions,
    selected_option_id: inst.selected_option_id,
    sort_order: item.sort_order + (isDuplicate ? inst.sort_order * 0.001 : 0),
  }
}

function buildVirtualDefault(
  item: PriceItem,
  availableOptions: PriceItemOption[],
  scope: PartialFormulaScope
): ComputedLineItem {
  const inclusionStatus: InclusionStatus = item.is_optional ? 'not_required' : 'included'
  const isIncluded = !item.is_optional
  const computedTotal = isIncluded
    ? computeLineItemTotal(item, 1, scope, { type: 'none', value: 0 })
    : 0

  return {
    id: item.id,
    instance_id: item.id,
    quote_id: '',
    price_item_id: item.id,
    is_custom: false,
    is_duplicate: false,
    is_removable: false,
    inclusion_status: inclusionStatus,
    is_included: isIncluded,
    category: item.category,
    subcategory: item.subcategory,
    code: item.code,
    name: item.name,
    unit: item.unit,
    qty: 1,
    base_unit_price: item.base_price,
    formula: item.formula,
    modifier_type: 'none',
    modifier_value: 0,
    modifier_note: '',
    computed_total: computedTotal,
    available_options: availableOptions,
    selected_option_id: null,
    sort_order: item.sort_order,
  }
}

function buildCustomItem(
  li: QuoteLineItemState,
  scope: PartialFormulaScope
): ComputedLineItem {
  const isIncluded = inclusionToBoolean(li.inclusion_status)
  const computedTotal = isIncluded
    ? computeLineItemTotal(
        { formula: li.custom_formula ?? null, base_price: li.custom_base_price ?? 0 },
        li.qty,
        scope,
        { type: li.modifier_type, value: li.modifier_value }
      )
    : 0

  return {
    id: li.instance_id,
    instance_id: li.instance_id,
    quote_id: '',
    price_item_id: null,
    is_custom: true,
    is_duplicate: false,
    is_removable: true,
    inclusion_status: li.inclusion_status,
    is_included: isIncluded,
    category: li.custom_category ?? 'Custom',
    subcategory: null,
    code: li.custom_code ?? 'CUST',
    name: li.custom_name ?? 'Custom Item',
    unit: li.custom_unit ?? 'ea',
    qty: li.qty,
    base_unit_price: li.custom_base_price ?? 0,
    formula: li.custom_formula ?? null,
    modifier_type: li.modifier_type,
    modifier_value: li.modifier_value,
    modifier_note: li.modifier_note,
    computed_total: computedTotal,
    available_options: [],
    selected_option_id: null,
    sort_order: li.sort_order,
  }
}

/**
 * Calculate financial totals from computed line items.
 */
export function useQuoteTotals(items: ComputedLineItem[]) {
  return useMemo(() => {
    const includedItems = items.filter((i) => i.is_included)
    const rebateItems = includedItems.filter((i) => i.category === 'Rebates')
    const nonRebateItems = includedItems.filter((i) => i.category !== 'Rebates')

    const subtotal = nonRebateItems.reduce((sum, i) => sum + i.computed_total, 0)
    const rebateTotal = rebateItems.reduce((sum, i) => sum + i.computed_total, 0)
    const netBeforeGST = subtotal + rebateTotal
    const gst = netBeforeGST * 0.10
    const total = netBeforeGST + gst

    return { subtotal, rebateTotal, netBeforeGST, gst, total }
  }, [items])
}
