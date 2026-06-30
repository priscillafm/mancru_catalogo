import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export const useAuthStore = create((set, get) => ({
  session:    null,
  user:       null,
  membership: null,   // { role, company_id, companies: {...} }
  loading:    true,

  init() {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, loading: false })
      if (data.session) get().loadMembership(data.session.user.id)
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, loading: false })
      if (session) get().loadMembership(session.user.id)
      else set({ membership: null, user: null })
    })
  },

  async loadMembership(userId) {
    const { data: user, error: ue } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    const { data: membership, error: me } = await supabase
      .from('user_memberships')
      .select('*, companies(*)')
      .eq('user_id', userId)
      .eq('active', true)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()

    if (ue) console.error('user load error', ue)
    if (me) console.error('membership load error', me)

    set({ user, membership })
  },
}))
