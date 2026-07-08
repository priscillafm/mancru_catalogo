import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'

/**
 * Returns the company's current usage vs plan limits.
 *
 * limits:    { max_products, max_catalogs_active, max_users, ... }
 * usage:     { products, catalogs_active, users }
 * canAdd*:   boolean shortcuts
 * pct*:      percentage used (0-100) for progress bars
 */
export function usePlanLimits() {
  const membership = useAuthStore(s => s.membership)
  const companyId  = membership?.company_id
  const plan       = membership?.companies?.plan ?? membership?.plan ?? 'basic'

  // Fetch plan limits
  const { data: limits } = useQuery({
    queryKey: ['plan-limits', plan],
    queryFn: async () => {
      const { data } = await supabase
        .from('plans')
        .select('max_products, max_users, max_brands')
        .eq('name', plan)
        .single()
      // max_catalogs_active not in plans table — hardcode per plan
      const catalogLimits = { basic: 1, pro: 50, empresa: null }
      return {
        max_products:        data?.max_products        ?? 75,
        max_users:           data?.max_users           ?? 1,
        max_brands:          data?.max_brands          ?? 3,
        max_catalogs_active: catalogLimits[plan]       ?? 1,
      }
    },
    enabled: !!plan,
    staleTime: 5 * 60 * 1000,
  })

  // Fetch current usage
  const { data: usage } = useQuery({
    queryKey: ['plan-usage', companyId],
    queryFn: async () => {
      const [productsRes, catalogsRes, usersRes] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .is('deleted_at', null),
        supabase
          .from('catalogs')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('status', 'shared')
          .is('deleted_at', null),
        supabase
          .from('user_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('active', true),
      ])
      return {
        products:        productsRes.count  ?? 0,
        catalogs_active: catalogsRes.count  ?? 0,
        users:           usersRes.count     ?? 0,
      }
    },
    enabled: !!companyId,
  })

  const l = limits ?? { max_products: 75, max_users: 1, max_brands: 3, max_catalogs_active: 1 }
  const u = usage  ?? { products: 0, catalogs_active: 0, users: 0 }

  const canAddProducts = l.max_products === null || u.products < l.max_products
  const canAddCatalog  = l.max_catalogs_active === null || u.catalogs_active < l.max_catalogs_active
  const canAddUser     = l.max_users === null || u.users < l.max_users

  const pctProducts = l.max_products ? Math.round((u.products / l.max_products) * 100) : 0
  const pctCatalogs = l.max_catalogs_active ? Math.round((u.catalogs_active / l.max_catalogs_active) * 100) : 0
  const pctUsers    = l.max_users ? Math.round((u.users / l.max_users) * 100) : 0

  return {
    plan,
    limits: l,
    usage:  u,
    canAddProducts,
    canAddCatalog,
    canAddUser,
    pctProducts,
    pctCatalogs,
    pctUsers,
    isLoaded: !!limits && !!usage,
  }
}
