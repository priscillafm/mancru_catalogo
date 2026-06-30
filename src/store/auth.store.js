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
    const { data: { user: authUser } } = await supabase.auth.getUser()

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    let { data: membership } = await supabase
      .from('user_memberships')
      .select('*, companies(*)')
      .eq('user_id', userId)
      .eq('active', true)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()

    // Si no tiene membresía pero la invitación incluía company_id/role, crearla
    if (!membership && authUser?.user_metadata?.company_id) {
      const { company_id, role = 'vendor' } = authUser.user_metadata
      await supabase.from('user_memberships').insert({
        user_id:    userId,
        company_id,
        role,
        active:     true,
      })
      const { data: created } = await supabase
        .from('user_memberships')
        .select('*, companies(*)')
        .eq('user_id', userId)
        .single()
      membership = created
    }

    set({ user, membership })
  },
}))
