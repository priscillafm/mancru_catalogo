import { create } from 'zustand'

const SEEN_KEY = 'potato_admin_tour_seen_v1'

export const useTourStore = create((set) => ({
  active: false,

  start() {
    set({ active: true })
  },
  stop() {
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode, etc. */ }
    set({ active: false })
  },
  startIfFirstVisit() {
    let seen = false
    try { seen = localStorage.getItem(SEEN_KEY) === '1' } catch { /* private mode, etc. */ }
    if (!seen) set({ active: true })
  },
}))
