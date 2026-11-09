/**
 * Plan de la galerie (en mètres).
 * x : ouest (-) → est (+) · y : hauteur · z : nord (-) → sud (+)
 * Le hall est au sud (façade vitrée), la grande galerie au nord.
 */
export interface Box {
  min: [number, number, number]
  max: [number, number, number]
}
export interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}

const b = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({
  min: [x0, y0, z0],
  max: [x1, y1, z1],
})

export const EYE = 1.62
export const GAL = { x0: -8, x1: 8, z0: -26, z1: -0.3, h: 7 }
export const HALL = { x0: -7, x1: 7, z0: 0.3, z1: 10, h: 5.6 }
export const PORTAL = { hw: 2.4, h: 4.6 }
export const SKYLIGHT = { x0: -3.2, x1: 3.2, z0: -22.8, z1: -2.6, top: 8.15 }
export const PLINTH = 0.1 // joint creux en pied de mur

/** Murs porteurs (du joint creux jusqu'au plafond). */
export const WALLS: Box[] = [
  // grande galerie
  b(-8.4, -8, PLINTH, 7.3, -26.4, 0.3),
  b(8, 8.4, PLINTH, 7.3, -26.4, 0.3),
  b(-8.4, 8.4, PLINTH, 7.3, -26.4, -26),
  // mur de refend hall / galerie, percé du grand portail
  b(-8.4, -PORTAL.hw, PLINTH, 7.3, -0.3, 0.3),
  b(PORTAL.hw, 8.4, PLINTH, 7.3, -0.3, 0.3),
  // hall
  b(-7.4, -7, PLINTH, 5.9, 0.3, 10.2),
  b(7, 7.4, PLINTH, 5.9, 0.3, 10.2),
]

/** Éléments hauts : linteau, plafonds, puits de lumière. */
export const UPPER: Box[] = [
  b(-PORTAL.hw, PORTAL.hw, PORTAL.h, 7.3, -0.3, 0.3),
  // plafond du hall
  b(-7.4, 7.4, HALL.h, 5.9, 0.3, 10.2),
  // plafond de la galerie autour de la verrière
  b(-8.4, SKYLIGHT.x0, GAL.h, 7.3, -26.4, 0.3),
  b(SKYLIGHT.x1, 8.4, GAL.h, 7.3, -26.4, 0.3),
  b(SKYLIGHT.x0, SKYLIGHT.x1, GAL.h, 7.3, -26.4, SKYLIGHT.z0),
  b(SKYLIGHT.x0, SKYLIGHT.x1, GAL.h, 7.3, SKYLIGHT.z1, 0.3),
  // joues du puits de lumière
  b(SKYLIGHT.x0 - 0.2, SKYLIGHT.x0, 7.3, 8.4, SKYLIGHT.z0 - 0.2, SKYLIGHT.z1 + 0.2),
  b(SKYLIGHT.x1, SKYLIGHT.x1 + 0.2, 7.3, 8.4, SKYLIGHT.z0 - 0.2, SKYLIGHT.z1 + 0.2),
  b(SKYLIGHT.x0 - 0.2, SKYLIGHT.x1 + 0.2, 7.3, 8.4, SKYLIGHT.z0 - 0.2, SKYLIGHT.z0),
  b(SKYLIGHT.x0 - 0.2, SKYLIGHT.x1 + 0.2, 7.3, 8.4, SKYLIGHT.z1, SKYLIGHT.z1 + 0.2),
  // couverture (invisible depuis l'intérieur, bloque le soleil)
  b(SKYLIGHT.x0 - 0.2, SKYLIGHT.x1 + 0.2, 8.4, 8.6, SKYLIGHT.z0 - 0.2, SKYLIGHT.z1 + 0.2),
]

/** Lames de la verrière (caissons). */
export const FINS: Box[] = (() => {
  const out: Box[] = []
  const n = 19
  const step = (SKYLIGHT.z1 - SKYLIGHT.z0) / n
  for (let i = 1; i < n; i++) {
    const z = SKYLIGHT.z0 + i * step
    out.push(b(SKYLIGHT.x0, SKYLIGHT.x1, 7.0, 7.72, z - 0.022, z + 0.022))
  }
  for (const x of [-1.07, 1.07]) out.push(b(x - 0.022, x + 0.022, 7.0, 7.72, SKYLIGHT.z0, SKYLIGHT.z1))
  return out
})()

/** Mobilier (emprise au sol utilisée pour les collisions). */
export const BENCHES = [
  { x: 0, z: -8.2, len: 2.6 },
  { x: 0, z: -18.1, len: 2.6 },
]
export const DESK = { x: -4.55, z: 4.5, w: 2.8, d: 0.8, h: 1.06 }

const rectOf = (box: Box): Rect => ({ x0: box.min[0], x1: box.max[0], z0: box.min[2], z1: box.max[2] })

export const COLLIDERS: Rect[] = [
  ...WALLS.map(rectOf),
  // façade vitrée
  { x0: -7.4, x1: 7.4, z0: 9.86, z1: 10.4 },
  ...BENCHES.map((bn) => ({ x0: bn.x - 0.33, x1: bn.x + 0.33, z0: bn.z - bn.len / 2, z1: bn.z + bn.len / 2 })),
  { x0: DESK.x - DESK.w / 2, x1: DESK.x + DESK.w / 2, z0: DESK.z - DESK.d / 2, z1: DESK.z + DESK.d / 2 },
]

/** Murs d'accrochage référencés dans src/data/artworks.json. */
export const MOUNT_WALLS: Record<
  string,
  { axis: 'x' | 'z'; plane: number; normal: [number, number]; ceiling: number }
> = {
  'galerie-ouest': { axis: 'z', plane: GAL.x0, normal: [1, 0], ceiling: GAL.h },
  'galerie-est': { axis: 'z', plane: GAL.x1, normal: [-1, 0], ceiling: GAL.h },
  'galerie-nord': { axis: 'x', plane: GAL.z0, normal: [0, 1], ceiling: GAL.h },
  'hall-nord': { axis: 'x', plane: HALL.z0, normal: [0, 1], ceiling: HALL.h },
}

/** Direction du soleil (du soleil vers la scène). */
export const SUN_DIR: [number, number, number] = [0.3, -0.5, -0.78]
