import { create } from 'zustand'
import {
  GuestTabSession,
  MenuItemRecord,
} from '@/lib/data/restaurant-data'

export interface CartItem {
  item: MenuItemRecord
  quantity: number
  notes?: string
}

interface DineScanState {
  // Session & Location state
  isAuthenticated: boolean
  guestSession: GuestTabSession | null
  locationIdentifier: string | null
  locationName: string | null

  // Cart state
  cart: CartItem[]
  specialInstructions: string

  // UI Drawer / Modal states
  isCartOpen: boolean
  isTabDrawerOpen: boolean

  // Actions
  setSession: (session: GuestTabSession | null) => void
  setLocationInfo: (identifier: string, name: string) => void
  setSpecialInstructions: (instructions: string) => void
  addToCart: (item: MenuItemRecord, notes?: string) => void
  removeFromCart: (itemId: string) => void
  updateQuantity: (itemId: string, delta: number) => void
  clearCart: () => void
  setCartOpen: (open: boolean) => void
  setTabDrawerOpen: (open: boolean) => void
  updateSessionFromAppend: (session: GuestTabSession) => void
}

export const useDineScanStore = create<DineScanState>((set) => ({
  isAuthenticated: false,
  guestSession: null,
  locationIdentifier: null,
  locationName: null,
  cart: [],
  specialInstructions: '',
  isCartOpen: false,
  isTabDrawerOpen: false,

  setSession: (session) =>
    set({
      guestSession: session,
      isAuthenticated: !!session,
      locationIdentifier: session?.locationIdentifier || null,
      locationName: session?.locationName || null,
    }),

  setLocationInfo: (identifier, name) =>
    set({ locationIdentifier: identifier, locationName: name }),

  setSpecialInstructions: (instructions) =>
    set({ specialInstructions: instructions }),

  addToCart: (item, notes) =>
    set((state) => {
      const existing = state.cart.find((c) => c.item.id === item.id)
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.item.id === item.id
              ? { ...c, quantity: c.quantity + 1, notes: notes || c.notes }
              : c
          ),
        }
      }
      return { cart: [...state.cart, { item, quantity: 1, notes }] }
    }),

  removeFromCart: (itemId) =>
    set((state) => ({
      cart: state.cart.filter((c) => c.item.id !== itemId),
    })),

  updateQuantity: (itemId, delta) =>
    set((state) => ({
      cart: state.cart
        .map((c) =>
          c.item.id === itemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0),
    })),

  clearCart: () => set({ cart: [], specialInstructions: '' }),

  setCartOpen: (open) => set({ isCartOpen: open }),
  setTabDrawerOpen: (open) => set({ isTabDrawerOpen: open }),

  updateSessionFromAppend: (session) =>
    set({
      guestSession: session,
      cart: [],
      specialInstructions: '',
      isCartOpen: false,
    }),
}))
