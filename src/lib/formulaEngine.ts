import { create, all } from 'mathjs'
import type { FormulaScope, FormulaEvalResult, PartialFormulaScope, ModifierType } from '../types/domain.types'
import type { PriceItem } from '../types/domain.types'
import { DEFAULT_SCOPE_VALUES } from './constants'

// Create a restricted mathjs instance
const math = create(all)

// Block unsafe functions
math.import(
  {
    import: () => { throw new Error('disabled') },
    createUnit: () => { throw new Error('disabled') },
    evaluate: () => { throw new Error('disabled') },
    parse: () => { throw new Error('disabled') },
    simplify: () => { throw new Error('disabled') },
    derivative: () => { throw new Error('disabled') },
  },
  { override: true }
)

// Allowed safe math functions injected into scope
const SAFE_FUNCTIONS = {
  abs:   Math.abs,
  max:   (...args: number[]) => Math.max(...args),
  min:   (...args: number[]) => Math.min(...args),
  round: Math.round,
  ceil:  Math.ceil,
  floor: Math.floor,
  sqrt:  Math.sqrt,
  pow:   Math.pow,
}

const FORMULA_TIMEOUT_MS = 100

/**
 * Build a complete formula scope from partial quote inputs + item-level values.
 */
export function buildScope(
  quoteInputs: Partial<PartialFormulaScope>,
  itemOverrides: { base_price: number; qty: number }
): FormulaScope {
  return {
    ...DEFAULT_SCOPE_VALUES,
    ...quoteInputs,
    base_price: itemOverrides.base_price,
    qty: itemOverrides.qty,
  }
}

/**
 * Evaluate a single formula string against a scope.
 * Returns { value, error } — never throws.
 */
export function evaluateFormula(formula: string, scope: FormulaScope): FormulaEvalResult {
  const startTime = Date.now()

  try {
    const node = math.parse(formula)

    // Walk the AST and block unsafe node types
    let unsafe = false
    node.traverse((n: { type: string }) => {
      if (n.type === 'AssignmentNode') unsafe = true
      if (n.type === 'BlockNode') unsafe = true
      if (n.type === 'FunctionAssignmentNode') unsafe = true
    })

    if (unsafe) {
      return { value: 0, error: 'Formula contains unsafe operations (assignment not allowed)' }
    }

    const fullScope = { ...SAFE_FUNCTIONS, ...scope }
    const result = node.evaluate(fullScope)

    if (Date.now() - startTime > FORMULA_TIMEOUT_MS) {
      return { value: 0, error: 'Formula evaluation timed out' }
    }

    if (typeof result !== 'number' || !isFinite(result) || isNaN(result)) {
      return { value: 0, error: `Formula returned non-numeric result: ${result}` }
    }

    // Prices are never negative (rebates use negative base_price intentionally via formula)
    return { value: result, error: null }
  } catch (err) {
    return { value: 0, error: err instanceof Error ? err.message : 'Formula error' }
  }
}

/**
 * Compute the final total for a line item including any modifier.
 */
export function computeLineItemTotal(
  item: Pick<PriceItem, 'formula' | 'base_price'>,
  qty: number,
  scope: PartialFormulaScope,
  modifier: { type: ModifierType; value: number }
): number {
  const fullScope = buildScope(scope, { base_price: item.base_price, qty })

  let raw: number
  if (item.formula && item.formula.trim()) {
    const result = evaluateFormula(item.formula, fullScope)
    raw = result.value
  } else {
    raw = item.base_price * qty
  }

  // Apply modifier
  if (modifier.type === 'flat') {
    raw += modifier.value
  } else if (modifier.type === 'percent') {
    raw *= 1 + modifier.value / 100
  }

  return raw
}

/**
 * Get a human-readable description of what each scope variable resolves to.
 * Used in the FormulaTooltip to help sales staff understand the calculation.
 */
export function describeScope(scope: FormulaScope): Array<{ key: string; value: string | number | boolean }> {
  const entries = Object.entries(scope) as Array<[string, unknown]>
  return entries
    .filter(([key]) => key !== 'base_price' && key !== 'qty') // shown separately
    .map(([key, value]) => ({ key, value: value as string | number | boolean }))
}

/**
 * Validate a formula string without evaluating it.
 * Returns null if valid, or an error message.
 */
export function validateFormula(formula: string): string | null {
  if (!formula || !formula.trim()) return null
  try {
    const node = math.parse(formula)
    let unsafe = false
    node.traverse((n: { type: string }) => {
      if (n.type === 'AssignmentNode') unsafe = true
      if (n.type === 'FunctionAssignmentNode') unsafe = true
    })
    if (unsafe) return 'Assignment operations are not allowed in formulas'
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid formula syntax'
  }
}
