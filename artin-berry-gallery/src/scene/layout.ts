/**
 * Plan « La Rotonde » (en mètres).
 * x : ouest (-) → est (+) · y : hauteur · z : nord (-) → sud (+)
 * Rotonde au centre (origine), hall au sud, salles à l'ouest, au nord et à l'est.
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
export const PLINTH = 0.1
/** Rotonde : rayon, hauteur, demi-largeur et hauteur des quatre portails. */
export const ROT = { r: 6, h: 7, door: 1.5, doorH: 3.6 }
export const HALL = { x0: -5, x1: 5, z0: 6.4, z1: 12, h: 4.6 }

/** Salles : emprise intérieure, hauteur sous plafond et couleur des murs. */
export const ROOMS = [
  { id: 'nuit', name: 'Salle Bleu nuit', color: '#22364f', x0: -6, x1: 6, z0: -14, z1: -6.4, h: 5 },
  { id: 'terra', name: 'Salle Terracotta', color: '#b8694a', x0: -14, x1: -6.4, z0: -6, z1: 6, h: 5 },
  { id: 'ocre', name: 'Salle Ocre', color: '#c99a4f', x0: 6.4, x1: 14, z0: -6, z1: 6, h: 5 },
  { id: 'hall', name: 'Hall', color: '#3b3733', x0: HALL.x0, x1: HALL.x1, z0: HALL.z0, z1: HALL.z1, h: HALL.h },
]

const IN = 5.75 // face intérieure du carré qui porte la rotonde
const OUT = 6.4
const D = ROT.door
const TOP = 7.3
const P = PLINTH

/** Couleur du mur vu depuis le point (x, z) ; null = blanc galerie. */
export function wallColorAt(x: number, z: number): string | null {
  if (Math.abs(x) < IN && Math.abs(z) < IN) return null
  for (const r of ROOMS) if (x > r.x0 - 0.1 && x < r.x1 + 0.1 && z > r.z0 - 0.1 && z < r.z1 + 0.1) return r.color
  return null
}

export const WALLS: Box[] = [
  // carré de la rotonde, percé de quatre portails. Les quatre angles sont des poteaux distincts :
  // aucune boîte ne se chevauche, donc aucune face coplanaire (pas de scintillement dans les angles).
  b(-IN, -D, P, TOP, -OUT, -IN), b(D, IN, P, TOP, -OUT, -IN),
  b(-IN, -D, P, TOP, IN, OUT), b(D, IN, P, TOP, IN, OUT),
  b(-OUT, -IN, P, TOP, -IN, -D), b(-OUT, -IN, P, TOP, D, IN),
  b(IN, OUT, P, TOP, -IN, -D), b(IN, OUT, P, TOP, D, IN),
  b(-OUT, -IN, P, TOP, -OUT, -IN), b(IN, OUT, P, TOP, -OUT, -IN),
  b(-OUT, -IN, P, TOP, IN, OUT), b(IN, OUT, P, TOP, IN, OUT),
  // salle nord
  b(-6.4, -6, P, 5.3, -14.4, -6.4), b(6, 6.4, P, 5.3, -14.4, -6.4), b(-6.4, 6.4, P, 5.3, -14.4, -14),
  // salle ouest
  b(-14.4, -6.4, P, 5.3, -6.4, -6), b(-14.4, -6.4, P, 5.3, 6, 6.4), b(-14.4, -14, P, 5.3, -6.4, 6.4),
  // salle est
  b(6.4, 14.4, P, 5.3, -6.4, -6), b(6.4, 14.4, P, 5.3, 6, 6.4), b(14, 14.4, P, 5.3, -6.4, 6.4),
  // hall
  b(-5.4, -5, P, 4.9, 6.4, 12.2), b(5, 5.4, P, 4.9, 6.4, 12.2),
]

/** Nombre de boîtes qui composent le carré de la rotonde, en tête de WALLS (collisions et joints creux). */
export const SQUARE_BOXES = 12

/** Linteaux, plafonds et couverture. */
export const UPPER: Box[] = [
  b(-D, D, ROT.doorH, TOP, -OUT, -IN), b(-D, D, ROT.doorH, TOP, IN, OUT),
  b(-OUT, -IN, ROT.doorH, TOP, -D, D), b(IN, OUT, ROT.doorH, TOP, -D, D),
  b(-6.4, 6.4, 5, 5.3, -14.4, -6.4), b(-14.4, -6.4, 5, 5.3, -6.4, 6.4), b(6.4, 14.4, 5, 5.3, -6.4, 6.4),
  b(-5.4, 5.4, HALL.h, 4.9, 6.4, 12.2),
  b(-OUT, OUT, TOP, 7.5, -OUT, OUT),
]

export const BENCHES = [
  { x: -10.2, z: 0, len: 2.4 },
  { x: 10.2, z: 0, len: 2.4 },
  { x: 0, z: -10.2, len: 2.4 },
]
export const DESK = { x: 3.3, z: 9.7, w: 2.2, d: 0.7, h: 1.06 }
/** Banquette ronde sous l'oculus de la rotonde. */
export const OTTOMAN = { r: 0.85, h: 0.42 }

const rectOf = (box: Box): Rect => ({ x0: box.min[0], x1: box.max[0], z0: box.min[2], z1: box.max[2] })
export const COLLIDERS: Rect[] = [
  ...WALLS.map(rectOf),
  { x0: -5.4, x1: 5.4, z0: HALL.z1 - 0.14, z1: HALL.z1 + 0.4 },
  ...BENCHES.map((bn) => ({ x0: bn.x - 0.33, x1: bn.x + 0.33, z0: bn.z - bn.len / 2, z1: bn.z + bn.len / 2 })),
  { x0: DESK.x - DESK.w / 2, x1: DESK.x + DESK.w / 2, z0: DESK.z - DESK.d / 2, z1: DESK.z + DESK.d / 2 },
  { x0: -0.62, x1: 0.62, z0: -0.62, z1: 0.62 },
]

/** Murs d'accrochage référencés dans src/data/artworks.json. */
export const MOUNT_WALLS: Record<string, { axis: 'x' | 'z'; plane: number; normal: [number, number]; ceiling: number }> = {
  'nuit-nord': { axis: 'x', plane: -14, normal: [0, 1], ceiling: 5 },
  'nuit-ouest': { axis: 'z', plane: -6, normal: [1, 0], ceiling: 5 },
  'nuit-est': { axis: 'z', plane: 6, normal: [-1, 0], ceiling: 5 },
  'terra-ouest': { axis: 'z', plane: -14, normal: [1, 0], ceiling: 5 },
  'terra-nord': { axis: 'x', plane: -6, normal: [0, 1], ceiling: 5 },
  'terra-sud': { axis: 'x', plane: 6, normal: [0, -1], ceiling: 5 },
  'ocre-est': { axis: 'z', plane: 14, normal: [-1, 0], ceiling: 5 },
  'ocre-nord': { axis: 'x', plane: -6, normal: [0, 1], ceiling: 5 },
  'ocre-sud': { axis: 'x', plane: 6, normal: [0, -1], ceiling: 5 },
}

/** Direction du soleil (du soleil vers la scène). */
export const SUN_DIR: [number, number, number] = [0.3, -0.5, -0.78]

/** Tablette de verre posée à droite de chaque œuvre : largeur, hauteur, écart au cadre, décollement du mur (mètres). */
export const TABLET = { w: 0.64, h: 1.31, gap: 0.14, z: 0.045 }

/** Pan de mur intérieur d'une salle : extrémités, normale (vers la salle) et présence d'un portail. */
export interface WallSeg {
  ax: number
  az: number
  bx: number
  bz: number
  nx: number
  nz: number
}
/**
 * Pans de mur d'une salle. `split` : le mur tourné vers la rotonde est coupé de part et d'autre
 * du portail (utile pour ce qui touche le sol) ; sinon il est rendu d'un seul tenant.
 */
export function wallSegments(r: (typeof ROOMS)[number], split: boolean): WallSeg[] {
  const out: WallSeg[] = []
  const add = (fixed: 'x' | 'z', v: number, n: [number, number], a: number, c: number) => {
    const piece = (p: number, q: number) =>
      out.push(fixed === 'z' ? { ax: p, az: v, bx: q, bz: v, nx: n[0], nz: n[1] } : { ax: v, az: p, bx: v, bz: q, nx: n[0], nz: n[1] })
    const door = split && Math.abs(v) <= OUT + 1e-6 && a < -D && c > D
    if (door) {
      piece(a, -D)
      piece(D, c)
    } else piece(a, c)
  }
  add('z', r.z0, [0, 1], r.x0, r.x1)
  if (r.id !== 'hall') add('z', r.z1, [0, -1], r.x0, r.x1) // le hall s'ouvre au sud par la façade vitrée
  add('x', r.x0, [1, 0], r.z0, r.z1)
  add('x', r.x1, [-1, 0], r.z0, r.z1)
  return out
}

/**
 * Boîtes affichées telles quelles. Le carré de la rotonde et ses linteaux sont, eux, construits
 * face par face (voir Architecture) : découpés en boîtes, leurs faces internes affleureraient
 * à la surface des murs et scintilleraient.
 */
export const SHELL_BOXES: Box[] = [...WALLS.slice(SQUARE_BOXES), ...UPPER.slice(4)]
