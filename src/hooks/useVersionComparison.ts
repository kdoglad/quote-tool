import { useMemo } from 'react'
import type { PriceItem, ComparisonRow, PartialFormulaScope } from '../types/domain.types'
import { computeLineItemTotal } from '../lib/formulaEngine'
import { COMPARISON_SIGNIFICANCE_THRESHOLD } from '../lib/constants'

/**
 * Compute a diff between two price versions at a given scope.
 * Returns rows with delta information for each line item code.
 */
export function useVersionComparison(
  itemsA: PriceItem[],   // primary version
  itemsB: PriceItem[],   // comparison version
  scope: PartialFormulaScope
): ComparisonRow[] {
  return useMemo(() => {
    if (!itemsA.length && !itemsB.length) return []

    const mapA = new Map(itemsA.map((i) => [i.code, i]))
    const mapB = new Map(itemsB.map((i) => [i.code, i]))
    const allCodes = new Set([...mapA.keys(), ...mapB.keys()])

    const rows: ComparisonRow[] = []

    for (const code of allCodes) {
      const itemA = mapA.get(code)
      const itemB = mapB.get(code)

      const totalA = itemA
        ? computeLineItemTotal(itemA, 1, scope, { type: 'none', value: 0 })
        : 0
      const totalB = itemB
        ? computeLineItemTotal(itemB, 1, scope, { type: 'none', value: 0 })
        : 0

      const delta = totalB - totalA
      const deltaPercent = totalA !== 0 ? (delta / Math.abs(totalA)) * 100 : 0

      rows.push({
        code,
        name: itemA?.name ?? itemB?.name ?? code,
        category: itemA?.category ?? itemB?.category ?? 'Custom',
        totalA,
        totalB,
        delta,
        deltaPercent,
        isNew: !itemA && !!itemB,
        isRemoved: !!itemA && !itemB,
        isSignificant: Math.abs(delta) >= COMPARISON_SIGNIFICANCE_THRESHOLD,
      })
    }

    return rows.sort((a, b) => {
      // Significant changes first, then alphabetical
      if (a.isSignificant && !b.isSignificant) return -1
      if (!a.isSignificant && b.isSignificant) return 1
      return a.code.localeCompare(b.code)
    })
  }, [itemsA, itemsB, scope])
}
