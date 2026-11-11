import { COLLIDERS, HALL, ROT, type Rect } from './layout'

export const PLAYER_R = 0.42
export interface P2 {
  x: number
  z: number
}

const clamp = (v: number, a: number, c: number) => Math.min(c, Math.max(a, v))

/** Repousse le visiteur hors des murs et du mobilier (cercle contre rectangles). */
export function resolve(p: P2, r = PLAYER_R, rects: Rect[] = COLLIDERS): void {
  for (let iter = 0; iter < 3; iter++) {
    for (const c of rects) {
      const cx = clamp(p.x, c.x0, c.x1)
      const cz = clamp(p.z, c.z0, c.z1)
      const dx = p.x - cx
      const dz = p.z - cz
      const d2 = dx * dx + dz * dz
      if (d2 >= r * r) continue
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2)
        p.x = cx + (dx / d) * r
        p.z = cz + (dz / d) * r
      } else {
        const l = p.x - c.x0
        const rr = c.x1 - p.x
        const t = p.z - c.z0
        const bt = c.z1 - p.z
        const m = Math.min(l, rr, t, bt)
        if (m === l) p.x = c.x0 - r
        else if (m === rr) p.x = c.x1 + r
        else if (m === t) p.z = c.z0 - r
        else p.z = c.z1 + r
      }
    }
    // mur courbe de la rotonde (hors des quatre portails)
    const h = Math.hypot(p.x, p.z)
    if (h < 6.4 && h > ROT.r - r && Math.abs(p.x) > ROT.door && Math.abs(p.z) > ROT.door) {
      const k = (ROT.r - r) / h
      p.x *= k
      p.z *= k
    }
  }
}

/** Le segment a→b traverse-t-il le rectangle élargi de `pad` ? */
function segHits(a: P2, bb: P2, c: Rect, pad: number): boolean {
  const x0 = c.x0 - pad
  const x1 = c.x1 + pad
  const z0 = c.z0 - pad
  const z1 = c.z1 + pad
  let t0 = 0
  let t1 = 1
  const dx = bb.x - a.x
  const dz = bb.z - a.z
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-9) return q >= 0
    const r = q / p
    if (p < 0) {
      if (r > t1) return false
      if (r > t0) t0 = r
    } else {
      if (r < t0) return false
      if (r < t1) t1 = r
    }
    return true
  }
  if (!clip(-dx, a.x - x0)) return false
  if (!clip(dx, x1 - a.x)) return false
  if (!clip(-dz, a.z - z0)) return false
  if (!clip(dz, z1 - a.z)) return false
  return t1 - t0 > 1e-6
}

const VIS_PAD = PLAYER_R - 0.03
const NODE_PAD = PLAYER_R + 0.1

export function clearLine(a: P2, bb: P2): boolean {
  for (const c of COLLIDERS) if (segHits(a, bb, c, VIS_PAD)) return false
  return true
}

const inside = (p: P2, pad: number) =>
  COLLIDERS.some((c) => p.x > c.x0 - pad && p.x < c.x1 + pad && p.z > c.z0 - pad && p.z < c.z1 + pad)

const NODES: P2[] = (() => {
  const out: P2[] = []
  for (const c of COLLIDERS) {
    for (const p of [
      { x: c.x0 - NODE_PAD, z: c.z0 - NODE_PAD },
      { x: c.x1 + NODE_PAD, z: c.z0 - NODE_PAD },
      { x: c.x0 - NODE_PAD, z: c.z1 + NODE_PAD },
      { x: c.x1 + NODE_PAD, z: c.z1 + NODE_PAD },
    ]) {
      // on écarte les angles situés dans un mur ou hors du bâtiment
      if (inside(p, VIS_PAD)) continue
      if (Math.abs(p.x) > 14 || p.z < -14 || p.z > HALL.z1) continue
      out.push(p)
    }
  }
  return out
})()

/**
 * Chemin le plus court entre deux points en contournant murs et mobilier
 * (graphe de visibilité + Dijkstra). Retourne les points à rejoindre, arrivée incluse.
 */
export function findPath(start: P2, goalIn: P2): P2[] | null {
  const goal = { x: goalIn.x, z: goalIn.z }
  resolve(goal, PLAYER_R + 0.02)
  if (clearLine(start, goal)) return [goal]
  const pts = [start, goal, ...NODES]
  const n = pts.length
  const dist = new Array<number>(n).fill(Infinity)
  const prev = new Array<number>(n).fill(-1)
  const done = new Array<boolean>(n).fill(false)
  dist[0] = 0
  for (let k = 0; k < n; k++) {
    let u = -1
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i
    if (u < 0 || dist[u] === Infinity) break
    if (u === 1) break
    done[u] = true
    for (let v = 0; v < n; v++) {
      if (done[v]) continue
      const d = Math.hypot(pts[u].x - pts[v].x, pts[u].z - pts[v].z)
      if (dist[u] + d >= dist[v]) continue
      if (!clearLine(pts[u], pts[v])) continue
      dist[v] = dist[u] + d
      prev[v] = u
    }
  }
  if (dist[1] === Infinity) return null
  const path: P2[] = []
  for (let i = 1; i > 0; i = prev[i]) path.unshift(pts[i])
  return path
}

export function pathLength(start: P2, path: P2[]): number {
  let len = 0
  let p = start
  for (const q of path) {
    len += Math.hypot(q.x - p.x, q.z - p.z)
    p = q
  }
  return len
}
