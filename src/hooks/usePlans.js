import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const ORDER = ['free', 'pro', 'enterprise']

/** Public pricing plans, in display order, with live price data from Supabase. */
export function usePlans() {
  return useQuery({
    queryKey: ['plans-public'],
    queryFn: async () => {
      const { data } = await supabase
        .from('plans')
        .select('id, name, display_name, price_monthly_uyu, promo_price_monthly_uyu, promo_label, limits')
        .eq('is_public', true)
      const rows = data ?? []
      return ORDER.map(name => rows.find(r => r.name === name)).filter(Boolean)
    },
    staleTime: 5 * 60 * 1000,
  })
}
