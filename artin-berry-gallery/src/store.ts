import { create } from 'zustand'

export type Phase = 'landing' | 'visiting'
export type Quality = 'high' | 'medium' | 'low'

const params = new URLSearchParams(window.location.search)
const forced = params.get('quality') as Quality | null
const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

interface GalleryState {
  phase: Phase
  ready: boolean
  /** œuvre dont la fiche est ouverte */
  selectedId: string | null
  /** œuvre survolée / à proximité (légende discrète) */
  hoveredId: string | null
  nearId: string | null
  lightbox: boolean
  menuOpen: boolean
  helpOpen: boolean
  /** voile blanc utilisé pour les transitions de caméra lointaines */
  veil: boolean
  hintShown: boolean
  quality: Quality
  qualityLocked: boolean
  isTouch: boolean
  setReady: () => void
  enter: () => void
  goHome: () => void
  select: (id: string | null) => void
  setHovered: (id: string | null) => void
  setNear: (id: string | null) => void
  setLightbox: (v: boolean) => void
  setMenu: (v: boolean) => void
  setHelp: (v: boolean) => void
  setVeil: (v: boolean) => void
  dismissHint: () => void
  degrade: () => void
  /** panier : identifiant de l'œuvre → quantité */
  cart: Record<string, number>
  cartOpen: boolean
  /** dernière œuvre ajoutée : déclenche l'animation et le message */
  burst: { id: string; at: number } | null
  addToCart: (id: string) => void
  setQty: (id: string, qty: number) => void
  clearCart: () => void
  setCart: (v: boolean) => void
  setQuality: (q: Quality) => void
}

const CART_KEY = 'artin-berry-panier'
function loadCart(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(CART_KEY) ?? '{}')
  } catch {
    return {}
  }
}
function saveCart(cart: Record<string, number>) {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart))
  } catch {
    /* stockage indisponible : le panier vit le temps de la visite */
  }
}

export const useGallery = create<GalleryState>((set, get) => ({
  cart: loadCart(),
  cartOpen: false,
  burst: null,
  addToCart: (id) => {
    const cart = { ...get().cart, [id]: (get().cart[id] ?? 0) + 1 }
    saveCart(cart)
    set({ cart, burst: { id, at: performance.now() } })
  },
  setQty: (id, qty) => {
    const cart = { ...get().cart }
    if (qty <= 0) delete cart[id]
    else cart[id] = qty
    saveCart(cart)
    set({ cart })
  },
  clearCart: () => {
    saveCart({})
    set({ cart: {} })
  },
  setCart: (v) => set({ cartOpen: v, menuOpen: false, helpOpen: false }),
  phase: 'landing',
  ready: false,
  selectedId: null,
  hoveredId: null,
  nearId: null,
  lightbox: false,
  menuOpen: false,
  helpOpen: false,
  veil: false,
  hintShown: false,
  quality: forced && ['high', 'medium', 'low'].includes(forced) ? forced : isTouch ? 'medium' : 'high',
  qualityLocked: !!forced,
  isTouch,
  setReady: () => set({ ready: true }),
  enter: () => set({ phase: 'visiting', menuOpen: false, helpOpen: false, selectedId: null, lightbox: false }),
  goHome: () => set({ phase: 'landing', menuOpen: false, helpOpen: false, selectedId: null, lightbox: false, nearId: null }),
  select: (id) => set({ selectedId: id, lightbox: false, menuOpen: false, helpOpen: false, hoveredId: null }),
  setHovered: (id) => set({ hoveredId: id }),
  setNear: (id) => {
    if (get().nearId !== id) set({ nearId: id })
  },
  setLightbox: (v) => set({ lightbox: v }),
  setMenu: (v) => set({ menuOpen: v, helpOpen: false }),
  setHelp: (v) => set({ helpOpen: v, menuOpen: false }),
  setVeil: (v) => set({ veil: v }),
  dismissHint: () => set({ hintShown: true }),
  degrade: () => {
    const { quality, qualityLocked } = get()
    if (qualityLocked) return
    if (quality === 'high') set({ quality: 'medium' })
    else if (quality === 'medium') set({ quality: 'low' })
  },
  // choix manuel : désactive l'adaptation automatique
  setQuality: (q) => set({ quality: q, qualityLocked: true }),
}))

/** Manette tactile : valeurs lues à chaque image par le contrôleur de déplacement. */
export const joystick = { x: 0, y: 0 }
/** Manette tactile du regard (à droite) : x = gauche / droite, y = haut / bas. */
export const lookStick = { x: 0, y: 0 }
