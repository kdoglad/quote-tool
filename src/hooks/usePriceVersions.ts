import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PriceVersion } from '../types/domain.types'

let patched = false
if (!patched) {
  patched = true
  const origFetch = globalThis.fetch
  globalThis.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
    console.log('[Net] Sending:', url)
    const res = await origFetch(...args)
    console.log('[Net] Received:', url, 'Status:', res.status)
    return res
  }
}

export function usePriceVersions() {
  return useQuery<PriceVersion[]>({
    queryKey: ['price-versions'],
    queryFn: async () => {
      console.log('[usePriceVersions] Starting fetch...')
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn('[usePriceVersions] Force-aborting hung request after 15s')
        controller.abort()
      }, 15000)

      try {
        const { data, error } = await supabase
          .from('price_versions')
          .select('*')
          .order('created_at', { ascending: false })
          .abortSignal(controller.signal)
        
        clearTimeout(timeoutId)

        if (error) {
          console.error('[usePriceVersions] Fetch error:', error)
          throw error
        }
        
        console.log('[usePriceVersions] Fetch success. Items:', data?.length)
        return data ?? []
      } catch (err) {
        clearTimeout(timeoutId)
        console.error('[usePriceVersions] Exception:', err)
        throw err
      }
    },
  })
}

export function useLatestPublishedVersion() {
  return useQuery<PriceVersion | null>({
    queryKey: ['price-versions', 'latest-published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_versions')
        .select('*')
        .eq('is_draft', false)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function usePriceVersion(id: string | undefined) {
  return useQuery<PriceVersion | null>({
    queryKey: ['price-versions', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('price_versions')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCreateDraftVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      versionName,
      notes,
      sourceVersionId,
      userId,
    }: {
      versionName: string
      notes: string
      sourceVersionId?: string
      userId: string
    }) => {
      // Create the new draft version record
      const { data: newVersion, error: vErr } = await supabase
        .from('price_versions')
        .insert({ version_name: versionName, notes, is_draft: true, created_by: userId })
        .select()
        .single()
      if (vErr) throw vErr

      // If sourceVersionId provided, copy all its items into the new draft
      if (sourceVersionId) {
        const { data: sourceItems, error: iErr } = await supabase
          .from('price_items')
          .select('category, subcategory, code, name, unit, base_price, formula, conditions, sort_order, is_optional, is_active, notes')
          .eq('version_id', sourceVersionId)
        if (iErr) throw iErr

        if (sourceItems && sourceItems.length > 0) {
          const itemsToInsert = sourceItems.map((item: Record<string, unknown>) => ({
            ...item,
            version_id: newVersion.id,
          }))
          const { error: insertErr } = await supabase.from('price_items').insert(itemsToInsert)
          if (insertErr) throw insertErr
        }
      }

      return newVersion
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['price-versions'] })
    },
  })
}
