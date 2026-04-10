import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Quote } from '../types/domain.types'

export function useQuotes() {
  return useQuery<Quote[]>({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useQuote(id: string | undefined) {
  return useQuery<Quote | null>({
    queryKey: ['quotes', id],
    queryFn: async () => {
      if (!id || id === 'new') return null
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id && id !== 'new',
  })
}

export function useSaveQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (quote: Partial<Quote> & { id?: string }) => {
      if (quote.id) {
        const { data, error } = await supabase
          .from('quotes')
          .update(quote)
          .eq('id', quote.id)
          .select()
          .single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('quotes')
          .insert(quote)
          .select()
          .single()
        if (error) throw error
        return data
      }
    },
    onSuccess: (data: Quote) => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['quotes', data.id] })
    },
  })
}

export function useUpdateQuoteStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Quote['status'] }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update({ status })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data: Quote) => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['quotes', data.id] })
    },
  })
}
