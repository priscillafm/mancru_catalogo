import { supabase } from './supabase'

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * Returns the current user's membership for a given company_id,
 * or their first active membership if company_id is null.
 */
export async function getUserMembership(userId, companyId = null) {
  let query = supabase
    .from('user_memberships')
    .select('*, companies(*)')
    .eq('user_id', userId)
    .eq('active', true)

  if (companyId) query = query.eq('company_id', companyId)

  const { data, error } = await query.limit(1).single()
  if (error) throw error
  return data
}
