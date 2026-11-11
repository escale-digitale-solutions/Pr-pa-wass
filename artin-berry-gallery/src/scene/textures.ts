import * as THREE from 'three'

/** Générateur pseudo-aléatoire reproductible. */
export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Rectangle arrondi (sans dépendre de ctx.roundRect, absent des anciens navigateurs). */
export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Forme noire aux bords fondus, pour les ombres portées. On dessine la forme hors champ
 * et on ne garde que son ombre : ctx.filter n'existe pas sur Safari / iOS.
 */
export function softRectTexture(W: number, H: number, x: number, y: number, w: number, h: number, blur: number, radius = 1) {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.shadowColor = '#000'
  ctx.shadowBlur = blur
  ctx.shadowOffsetX = W * 2
  ctx.fillStyle = '#000'
  rrect(ctx, x - W * 2, y, w, h, radius)
  ctx.fill()
  return new THREE.CanvasTexture(c)
}

/** Dégradé vertical 0 → 1 (v = 0 en bas), utilisé pour les halos et l'occlusion des pieds de mur. */
export function gradientTexture(power = 2, flip = false) {
  const n = 64
  const data = new Uint8Array(n * 4)
  for (let i = 0; i < n; i++) {
    const v = flip ? 1 - i / (n - 1) : i / (n - 1)
    const g = Math.round(255 * Math.pow(v, power))
    data.set([g, g, g, 255], i * 4)
  }
  const t = new THREE.DataTexture(data, 1, n)
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

/** Nappe de lumière d'un projecteur sur le mur : cône net en haut, fondu vers le bas. */
export function poolTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 176
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 128, 176)
  for (const [ry, y0, y1] of [
    [64, 0, 70],
    [100, 70, 176],
  ]) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, y0, 128, y1 - y0)
    ctx.clip()
    ctx.translate(64, 70)
    ctx.scale(60, ry)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.32, 'rgba(255,255,255,0.6)')
    g.addColorStop(0.64, 'rgba(255,255,255,0.18)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(-2, -2, 4, 4)
    ctx.restore()
  }
  return new THREE.CanvasTexture(c)
}

/** Ombre intérieure du cadre sur l'œuvre (le cadre fait saillie de 2 cm). */
export function frameInnerShadowTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 192
  const ctx = c.getContext('2d')!
  const band = (x0: number, y0: number, x1: number, y1: number, a: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, `rgba(0,0,0,${a})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 192)
  }
  band(0, 0, 0, 7, 0.34)
  band(0, 0, 4, 0, 0.16)
  band(128, 0, 124, 0, 0.1)
  band(0, 192, 0, 189, 0.08)
  return new THREE.CanvasTexture(c)
}

function vein(
  ctx: CanvasRenderingContext2D,
  rnd: () => number,
  T: number,
  x: number,
  y: number,
  angle: number,
  width: number,
  alpha: number,
  steps: number,
  rgb: string,
  depth = 0,
) {
  const pts: [number, number][] = [[x, y]]
  let a = angle
  for (let s = 0; s < steps; s++) {
    a += (rnd() - 0.5) * 0.6 + (angle - a) * 0.14
    const len = T * 0.02 * (0.6 + rnd() * 0.9)
    x += Math.cos(a) * len
    y += Math.sin(a) * len
    pts.push([x, y])
    if (depth < 1 && rnd() < 0.045)
      vein(ctx, rnd, T, x, y, a + (rnd() < 0.5 ? 1 : -1) * (0.35 + rnd() * 0.5), width * 0.5, alpha * 0.7, 14 + Math.floor(rnd() * 20), rgb, depth + 1)
  }
  const stroke = (from: number, to: number, w: number, al: number) => {
    ctx.beginPath()
    ctx.moveTo(pts[from][0], pts[from][1])
    for (let i = from + 1; i <= to; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.lineWidth = w
    ctx.strokeStyle = `rgba(${rgb},${al})`
    ctx.shadowColor = `rgba(${rgb},${al * 0.55})`
    ctx.shadowBlur = w * 3.5
    ctx.stroke()
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  stroke(0, pts.length - 1, Math.max(0.5, width * 0.45), alpha * 0.8)
  // renflements : la veine s'épaissit par endroits
  for (let k = 0; k < 3; k++) {
    const from = Math.floor(rnd() * (pts.length - 6))
    const to = Math.min(pts.length - 1, from + 4 + Math.floor(rnd() * 14))
    stroke(from, to, width * (0.7 + rnd() * 0.6), alpha * 0.55)
  }
  ctx.shadowBlur = 0
}

/**
 * Marbre noir veiné, dessiné une fois au chargement : 3 × 3 dalles de 1,40 m, toutes différentes,
 * séparées par un joint fin. La texture se répète sans raccord visible (les joints sont sur les bords).
 */
export function marbleTexture(size = 2048) {
  const N = 3
  const T = size / N
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const rnd = mulberry32(11)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x0 = i * T
      const y0 = j * T
      ctx.save()
      ctx.beginPath()
      ctx.rect(x0, y0, T, T)
      ctx.clip()
      const tone = 17 + rnd() * 7
      ctx.fillStyle = `rgb(${tone + 3},${tone + 1},${tone})`
      ctx.fillRect(x0, y0, T, T)
      for (let k = 0; k < 30; k++) {
        const cx = x0 + rnd() * T
        const cy = y0 + rnd() * T
        const r = T * (0.1 + rnd() * 0.32)
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        g.addColorStop(0, rnd() < 0.62 ? 'rgba(92,82,72,0.15)' : 'rgba(0,0,0,0.3)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(x0, y0, T, T)
      }
      const dir = rnd() * Math.PI
      const start = (ang: number): [number, number] => [
        x0 + T * (0.5 - Math.cos(ang) * 0.72 + (rnd() - 0.5) * 0.95),
        y0 + T * (0.5 - Math.sin(ang) * 0.72 + (rnd() - 0.5) * 0.95),
      ]
      const main = 2 + Math.floor(rnd() * 3)
      for (let v = 0; v < main; v++) {
        const ang = dir + (rnd() - 0.5) * 0.8
        const [sx, sy] = start(ang)
        vein(ctx, rnd, T, sx, sy, ang, 1.6 + rnd() * 2.6, 0.55 + rnd() * 0.35, 78, rnd() < 0.28 ? '205,172,118' : '236,228,212')
      }
      for (let v = 0; v < 9; v++) {
        const ang = dir + (rnd() - 0.5) * 2.4
        const [sx, sy] = start(ang)
        vein(ctx, rnd, T, sx, sy, ang, 0.7 + rnd() * 0.5, 0.14 + rnd() * 0.2, 60, '226,218,204', 1)
      }
      ctx.restore()
    }
  ctx.strokeStyle = 'rgba(5,4,4,0.95)'
  ctx.lineWidth = 2.6
  for (let k = 0; k <= N; k++) {
    ctx.beginPath()
    ctx.moveTo(k * T, 0)
    ctx.lineTo(k * T, size)
    ctx.moveTo(0, k * T)
    ctx.lineTo(size, k * T)
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
