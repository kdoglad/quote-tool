import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PriceItemOptionGroup, PriceItemOption } from '../types/domain.types'

export interface GroupedOptions {
  groups: PriceItemOptionGroup[]   // each has .options populated
  options: PriceItemOption[]       // flat list for easy lookups
}

/**
 * Fetch all option groups (with nested options) for a set of price items.
 * Returns empty gracefully if the tables don't exist yet.
 */
export function usePriceItemOptions(priceItemIds: string[]) {
  const key = [...priceItemIds].sort().join(',')
  return useQuery<GroupedOptions>({
    queryKey: ['price-item-options', key],
    queryFn: async () => {
      if (priceItemIds.length === 0) return { groups: [], options: [] }

      const [groupRes, optionRes] = await Promise.all([
        supabase
          .from('price_item_option_groups')
          .select('*')
          .in('price_item_id', priceItemIds)
          .order('sort_order', { ascending: true }),
        supabase
          .from('price_item_options')
          .select('*')
          .in('price_item_id', priceItemIds)
          .order('sort_order', { ascending: true }),
      ])

      // Gracefully handle table-not-found (migration not applied yet)
      if (groupRes.error?.code === '42P01' || optionRes.error?.code === '42P01') {
        return { groups: [], options: [] }
      }
      if (groupRes.error) throw groupRes.error
      if (optionRes.error) throw optionRes.error

      const options: PriceItemOption[] = optionRes.data ?? []
      const optionsByGroup = new Map<string, PriceItemOption[]>()
      for (const opt of options) {
        const arr = optionsByGroup.get(opt.group_id) ?? []
        arr.push(opt)
        optionsByGroup.set(opt.group_id, arr)
      }

      const groups: PriceItemOptionGroup[] = (groupRes.data ?? []).map((g) => ({
        ...g,
        options: optionsByGroup.get(g.id) ?? [],
      }))

      return { groups, options }
    },
    enabled: priceItemIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetch option groups for a single price item (used in the editor).
 */
export function useSingleItemOptions(priceItemId: string | undefined) {
  return useQuery<PriceItemOptionGroup[]>({
    queryKey: ['price-item-options-single', priceItemId],
    queryFn: async () => {
      if (!priceItemId) return []
      const [groupRes, optionRes] = await Promise.all([
        supabase
          .from('price_item_option_groups')
          .select('*')
          .eq('price_item_id', priceItemId)
          .order('sort_order', { ascending: true }),
        supabase
          .from('price_item_options')
          .select('*')
          .eq('price_item_id', priceItemId)
          .order('sort_order', { ascending: true }),
      ])
      if (groupRes.error?.code === '42P01') return []
      if (groupRes.error) throw groupRes.error
      if (optionRes.error) throw optionRes.error

      const options: PriceItemOption[] = optionRes.data ?? []
      const byGroup = new Map<string, PriceItemOption[]>()
      for (const opt of options) {
        const arr = byGroup.get(opt.group_id) ?? []
        arr.push(opt)
        byGroup.set(opt.group_id, arr)
      }
      return (groupRes.data ?? []).map((g) => ({ ...g, options: byGroup.get(g.id) ?? [] }))
    },
    enabled: !!priceItemId,
  })
}

/**
 * Save option groups for a price item.
 * Replaces all existing groups+options with the provided data.
 * Pass groups with a temporary id (e.g. crypto.randomUUID()) for new ones —
 * the real DB id is assigned by Postgres.
 */
export function useSaveItemOptions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      priceItemId,
      groups,
    }: {
      priceItemId: string
      groups: Array<{
        label: string
        sort_order: number
        is_required: boolean
        options: Array<{
          label: string
          modifier_type: 'flat' | 'percent' | 'replace'
          modifier_value: number
          sort_order: number
          is_default: boolean
          notes: string
        }>
      }>
    }) => {
      // 1. Delete existing groups (cascade deletes options)
      const { error: delErr } = await supabase
        .from('price_item_option_groups')
        .delete()
        .eq('price_item_id', priceItemId)
      if (delErr) throw delErr

      // 2. Insert new groups one by one so we get the IDs back, then insert their options
      for (const group of groups) {
        const { data: newGroup, error: gErr } = await supabase
          .from('price_item_option_groups')
          .insert({ price_item_id: priceItemId, label: group.label, sort_order: group.sort_order, is_required: group.is_required })
          .select()
          .single()
        if (gErr) throw gErr

        if (group.options.length > 0) {
          const { error: oErr } = await supabase
            .from('price_item_options')
            .insert(group.options.map((opt) => ({
              group_id: newGroup.id,
              price_item_id: priceItemId,
              label: opt.label,
              modifier_type: opt.modifier_type,
              modifier_value: opt.modifier_value,
              sort_order: opt.sort_order,
              is_default: opt.is_default,
              notes: opt.notes || null,
            })))
          if (oErr) throw oErr
        }
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['price-item-options-single', variables.priceItemId] })
      qc.invalidateQueries({ queryKey: ['price-item-options'] })
    },
  })
}
