import { useTexture } from '@react-three/drei'
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { ARTWORKS, type Artwork, POSES, asset, formatPrice } from '../data/artworks'
import { useGallery } from '../store'
import { ARTWORK_PREVIEWS } from './assets'
import { TABLET, wallColorAt } from './layout'
import type { Materials } from './materials'
import { frameInnerShadowTexture, poolTexture, rrect, softRectTexture } from './textures'

const FRAME_SPEC = {
  oak: { width: 0.045, depth: 0.055 },
  black: { width: 0.028, depth: 0.05 },
  champagne: { width: 0.034, depth: 0.06 },
  white: { width: 0.045, depth: 0.055 },
} as const

const PANEL = TABLET
/** Dessin de la tablette : repère logique de 480 × 982, doublé pour l'œuvre la plus proche. */
const PW = 480
const PH = 982
const BUTTON = { x: 48, y: 690, w: 384, h: 82 }
/** Zone tactile du bouton, en fraction de la hauteur depuis le haut (plus généreuse que le bouton). */
const BUTTON_ZONE = [0.64, 0.83]
const BURST_MS = 2300
/** Distance sous laquelle l'œuvre passe en pleine résolution. */
const HIRES_DISTANCE = 4.8

const DEBUG = new URLSearchParams(window.location.search).has('debug')

const geoCache = new Map<string, THREE.BufferGeometry>()

/** Cadre : profil rectangulaire extrudé avec arêtes légèrement adoucies. */
function frameGeometry(w: number, h: number, fw: number, depth: number) {
  const key = `${w}|${h}|${fw}|${depth}`
  const cached = geoCache.get(key)
  if (cached) return cached
  const bev = 0.004
  const ow = w / 2 + fw - bev
  const oh = h / 2 + fw - bev
  const iw = w / 2 + bev
  const ih = h / 2 + bev
  const shape = new THREE.Shape()
  shape.moveTo(-ow, -oh)
  shape.lineTo(ow, -oh)
  shape.lineTo(ow, oh)
  shape.lineTo(-ow, oh)
  shape.closePath()
  const hole = new THREE.Path()
  hole.moveTo(-iw, -ih)
  hole.lineTo(-iw, ih)
  hole.lineTo(iw, ih)
  hole.lineTo(iw, -ih)
  hole.closePath()
  shape.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, steps: 1 })
  g.translate(0, 0, bev)
  geoCache.set(key, g)
  return g
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 3) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  lines.push(line)
  lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(i === maxLines - 1 && lines.length > maxLines ? `${l}…` : l, x, y + i * lh))
  return y + (Math.min(lines.length, maxLines) - 1) * lh
}

/**
 * Tablette de verre : verre dépoli translucide, reflets diagonaux, liseré clair,
 * puis artiste, titre, année, dimensions, prix et bouton d'ajout au panier.
 */
function drawPanel(c: HTMLCanvasElement, a: Artwork, inCart: boolean) {
  const ctx = c.getContext('2d')!
  const k = c.width / PW
  ctx.setTransform(k, 0, 0, k, 0, 0)
  ctx.clearRect(0, 0, PW, PH)
  const sans = '"Jost", "Helvetica Neue", Arial, sans-serif'

  // verre
  rrect(ctx, 5, 5, PW - 10, PH - 10, 34)
  const glass = ctx.createLinearGradient(0, 0, 0, PH)
  glass.addColorStop(0, 'rgba(255,255,255,0.3)')
  glass.addColorStop(0.45, 'rgba(255,255,255,0.17)')
  glass.addColorStop(1, 'rgba(255,255,255,0.24)')
  ctx.fillStyle = glass
  ctx.fill()
  ctx.save()
  ctx.clip()
  for (const [pos, half, alpha] of [
    [0.16, 120, 0.22],
    [0.55, 70, 0.09],
    [0.9, 150, 0.14],
  ]) {
    ctx.save()
    ctx.translate(PW / 2, PH * pos)
    ctx.rotate(-0.52)
    const g = ctx.createLinearGradient(0, -half, 0, half)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, `rgba(255,255,255,${alpha})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(-PW * 1.5, -half, PW * 3, half * 2)
    ctx.restore()
  }
  ctx.restore()
  rrect(ctx, 5, 5, PW - 10, PH - 10, 34)
  ctx.lineWidth = 2.6
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.stroke()
  rrect(ctx, 11, 11, PW - 22, PH - 22, 29)
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.stroke()

  // texte
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = 5
  ctx.shadowOffsetY = 1
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `400 28px ${sans}`
  ctx.fillText('Artiste :', PW / 2, 124)
  ctx.font = 'italic 700 68px "Cormorant Garamond", Georgia, serif'
  let y = wrap(ctx, a.artist ?? '', PW / 2, 196, PW - 70, 66, 2)
  ctx.textAlign = 'left'
  ctx.font = `400 31px ${sans}`
  y = Math.max(y + 100, 350)
  y = wrap(ctx, `Titre : ${a.title}`, 52, y, PW - 104, 41, 3)
  if (a.year) ctx.fillText(`Année : ${a.year}`, 52, (y += 45))
  if (a.dimensions) ctx.fillText(`Dimensions : ${a.dimensions}`, 52, (y += 45))
  if (a.price != null) {
    ctx.font = `500 74px ${sans}`
    ctx.fillText(formatPrice(a.price), 50, BUTTON.y - 30)
  }

  // bouton
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 4
  rrect(ctx, BUTTON.x, BUTTON.y, BUTTON.w, BUTTON.h, BUTTON.h / 2)
  ctx.fillStyle = inCart ? '#f4dfb4' : '#ffffff'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.fillStyle = '#1a1714'
  ctx.strokeStyle = '#1a1714'
  ctx.font = `500 23px ${sans}`
  const spaced = ctx as unknown as { letterSpacing: string }
  spaced.letterSpacing = '2px'
  ctx.textAlign = 'center'
  const label = inCart ? 'DANS LE PANIER' : 'AJOUTER AU PANIER'
  const cx = BUTTON.x + BUTTON.w / 2 - 20
  const cy = BUTTON.y + BUTTON.h / 2
  ctx.fillText(label, cx, cy + 8)
  const ix = cx + ctx.measureText(label).width / 2 + (inCart ? 24 : 30)
  spaced.letterSpacing = '0px'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (inCart) {
    ctx.moveTo(ix - 9, cy)
    ctx.lineTo(ix - 3, cy + 7)
    ctx.lineTo(ix + 9, cy - 7)
    ctx.stroke()
  } else {
    ctx.moveTo(ix - 14, cy - 10)
    ctx.lineTo(ix - 9, cy - 10)
    ctx.lineTo(ix - 5, cy + 4)
    ctx.lineTo(ix + 9, cy + 4)
    ctx.lineTo(ix + 12, cy - 5)
    ctx.lineTo(ix - 8, cy - 5)
    ctx.stroke()
    for (const dx of [-3, 7]) {
      ctx.beginPath()
      ctx.arc(ix + dx, cy + 10, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.textAlign = 'left'
}

function usePanelTexture(a: Artwork, inCart: boolean, hi: boolean) {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null)
  useEffect(() => {
    let alive = true
    // une texture par résolution : on ne redimensionne jamais une texture déjà envoyée à la carte graphique
    const c = document.createElement('canvas')
    const k = hi && !useGallery.getState().isTouch ? 2 : 1
    c.width = PW * k
    c.height = PH * k
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    const paint = () => {
      if (!alive) return
      drawPanel(c, a, inCart)
      t.needsUpdate = true
    }
    paint()
    setTex(t)
    Promise.all([
      document.fonts.load('italic 700 68px "Cormorant Garamond"'),
      document.fonts.load('400 31px "Jost"'),
      document.fonts.load('500 74px "Jost"'),
    ])
      .then(paint)
      .catch(() => {})
    return () => {
      alive = false
      window.setTimeout(() => t.dispose(), 600)
    }
  }, [a, inCart, hi])
  return tex
}

/** Image détaillée chargée à l'approche, sans suspendre la scène ; libérée au départ. */
function useArtworkTexture(path: string | undefined, active: boolean) {
  const gl = useThree((s) => s.gl)
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!active || !path) return
    let alive = true
    let loaded: THREE.Texture | null = null
    const timer = window.setTimeout(() => {
      const img = new Image()
      img.decoding = 'async'
      img.src = asset(path)
      img
        .decode()
        .then(() => {
          if (!alive) return
          const t = new THREE.Texture(img)
          t.colorSpace = THREE.SRGBColorSpace
          t.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy())
          t.needsUpdate = true
          loaded = t
          setTex(t)
        })
        .catch(() => {})
    }, 200)
    return () => {
      alive = false
      window.clearTimeout(timer)
      setTex(null)
      const old = loaded
      if (old) window.setTimeout(() => old.dispose(), 800)
    }
  }, [path, active, gl])
  return tex
}

const sparkVertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / -mv.z;
  }
`
const sparkFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float core = smoothstep(0.5, 0.0, length(p));
    core = core * core * core;
    float rays = max(0.0, 1.0 - abs(p.x) * 26.0) * max(0.0, 1.0 - abs(p.y) * 2.2)
               + max(0.0, 1.0 - abs(p.y) * 26.0) * max(0.0, 1.0 - abs(p.x) * 2.2);
    float a = (core * 1.5 + rays * 0.9) * vAlpha;
    gl_FragColor = vec4(vec3(1.0, 0.95, 0.84) * a, 1.0);
  }
`

/**
 * Ajout au panier : deux anneaux de lumière s'enroulent autour de la tablette, l'un vers le haut,
 * l'autre vers le bas, suivis d'une traîne d'étincelles.
 */
function CartBurst({ id, panel }: { id: string; panel: THREE.Texture | null }) {
  const group = useRef<THREE.Group>(null!)
  const flash = useRef<THREE.MeshBasicMaterial>(null!)
  const SEG = 56
  const SPARKS = 84
  const { ribbons, sparks, sparkMat, seeds, v } = useMemo(() => {
    // ruban à 5 rangées : bords éteints, halo, cœur lumineux
    const ribbons = [0, 1].map(() => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 15), 3))
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 15), 3))
      const idx: number[] = []
      for (let i = 0; i < SEG; i++)
        for (let r = 0; r < 4; r++) {
          const a = i * 5 + r
          idx.push(a, a + 1, a + 5, a + 1, a + 6, a + 5)
        }
      g.setIndex(idx)
      return g
    })
    const sparks = new THREE.BufferGeometry()
    sparks.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3))
    sparks.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(SPARKS), 1))
    sparks.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(SPARKS), 1))
    const sparkMat = new THREE.ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      uniforms: { uScale: { value: 800 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    // les deux premières étincelles marquent la tête de chaque anneau ; les autres forment la traîne
    const seeds = Array.from({ length: SPARKS }, (_, i) => {
      const head = i < 2
      return {
        ring: i % 2,
        lag: head ? 0 : 0.05 + Math.random() * 0.95,
        jx: head ? 0 : (Math.random() - 0.5) * 0.09,
        jy: head ? 0 : (Math.random() - 0.5) * 0.11,
        jz: head ? 0.004 : Math.random() * 0.05,
        size: head ? 0.13 : 0.018 + Math.random() ** 2 * 0.06,
        ph: Math.random() * 6.28,
        sp: head ? 5 : 14 + Math.random() * 22,
      }
    })
    return { ribbons, sparks, sparkMat, seeds, v: new THREE.Vector3() }
  }, [])

  // point de l'anneau k à l'angle th (repère de la tablette)
  const ringPoint = (k: number, th: number, lift: number) => {
    const dir = k === 0 ? 1 : -1
    return v.set(Math.cos(th) * (PANEL.w / 2 + 0.13), dir * (lift * (PANEL.h / 2 - 0.07) + Math.sin(th) * 0.085), 0.05 + Math.sin(th) * 0.11)
  }

  useFrame((state) => {
    const b = useGallery.getState().burst
    let t = b && b.id === id ? (performance.now() - b.at) / BURST_MS : 2
    // mise au point (?debug) : fige l'animation à un instant donné pour la contrôler
    if (DEBUG) {
      const w = window as unknown as { __abBurst?: { id: string; t: number } }
      if (w.__abBurst?.id === id) t = w.__abBurst.t
    }
    const g = group.current
    g.visible = t >= 0 && t <= 1
    if (!g.visible) return
    const cam = state.camera as THREE.PerspectiveCamera
    sparkMat.uniforms.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2))
    const env = Math.sin(Math.PI * Math.min(1, t * 1.02)) ** 0.55
    // le verre s'illumine brièvement au départ de l'animation
    if (flash.current) flash.current.opacity = Math.max(0, 1 - t * 2.6) ** 1.5 * 0.55 + env * 0.1
    const lift = 1 - (1 - Math.min(1, t * 1.5)) ** 3
    const turn = (1 - (1 - t) ** 2.2) * Math.PI * 2 * 2.1
    const tail = Math.PI * 1.45
    for (let k = 0; k < 2; k++) {
      const dir = k === 0 ? 1 : -1
      const head = (k === 0 ? -2.3 : 0.8) + dir * turn
      const pos = ribbons[k].attributes.position as THREE.BufferAttribute
      const col = ribbons[k].attributes.color as THREE.BufferAttribute
      for (let i = 0; i <= SEG; i++) {
        const f = i / SEG
        const th = head - dir * f * tail
        ringPoint(k, th, lift)
        // tête effilée comme une comète, traîne qui s'amincit
        const tip = Math.min(1, f / 0.06)
        const halo = 0.02 * tip * (1 - f * 0.6)
        const core = 0.0036 * tip * (1 - f * 0.5)
        // derrière le verre, le ruban est atténué
        const depth = Math.sin(th) < 0 ? 0.42 : 1
        const bright = (1 - f) ** 1.5 * Math.sqrt(tip) * env * depth * 1.6
        const o = i * 5
        const offs = [halo, core, 0, -core, -halo]
        const lum = [0, 0.13, 1, 0.13, 0]
        for (let r = 0; r < 5; r++) {
          pos.setXYZ(o + r, v.x, v.y + offs[r], v.z)
          const c = bright * lum[r]
          col.setXYZ(o + r, c, c * 0.93, c * 0.78)
        }
      }
      pos.needsUpdate = true
      col.needsUpdate = true
    }
    const sp = sparks.attributes.position as THREE.BufferAttribute
    const ss = sparks.attributes.aSize as THREE.BufferAttribute
    const sa = sparks.attributes.aAlpha as THREE.BufferAttribute
    const time = performance.now() / 1000
    seeds.forEach((s, i) => {
      const dir = s.ring === 0 ? 1 : -1
      const head = (s.ring === 0 ? -2.3 : 0.8) + dir * turn
      ringPoint(s.ring, head - dir * s.lag * tail * 1.15, lift)
      const drift = t * t * 0.1
      sp.setXYZ(i, v.x + s.jx * (1 + t * 2), v.y + s.jy + dir * drift * s.lag, v.z + s.jz)
      const tw = 0.55 + 0.45 * Math.sin(time * s.sp + s.ph)
      ss.setX(i, s.size * (0.6 + tw * 0.7))
      sa.setX(i, env * tw * (1 - s.lag * 0.45))
    })
    sp.needsUpdate = true
    ss.needsUpdate = true
    sa.needsUpdate = true
  })

  return (
    <group ref={group} visible={false}>
      {panel && (
        <mesh position-z={0.001} renderOrder={8}>
          <planeGeometry args={[PANEL.w, PANEL.h]} />
          <meshBasicMaterial ref={flash} map={panel} blending={THREE.AdditiveBlending} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {ribbons.map((g, k) => (
        <mesh key={k} geometry={g} frustumCulled={false} renderOrder={9}>
          <meshBasicMaterial vertexColors blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <points geometry={sparks} material={sparkMat} frustumCulled={false} renderOrder={10} />
    </group>
  )
}

interface Shared {
  frameShadow: THREE.Texture
  panelShadow: THREE.Texture
  innerShadow: THREE.Texture
  pool: THREE.Texture
  standoff: THREE.BufferGeometry
}

function ArtworkPiece({ a, texture, mats, shared, hi, detail }: { a: Artwork; texture: THREE.Texture; mats: Materials; shared: Shared; hi: boolean; detail: boolean }) {
  const pose = POSES[a.id]
  const spec = FRAME_SPEC[a.frame ?? 'oak']
  const { width: w, height: h } = a.display
  const frameGeo = useMemo(() => frameGeometry(w, h, spec.width, spec.depth), [w, h, spec])
  const frameMat = a.frame === 'black' ? mats.blackMetal : a.frame === 'champagne' ? mats.champagne : a.frame === 'white' ? mats.whiteFrame : mats.oakFrame
  const inCart = useGallery((s) => !!s.cart[a.id])
  const panel = usePanelTexture(a, inCart, hi)
  const gl = useThree((s) => s.gl)
  const detailed = useArtworkTexture(a.imagePreview ? a.image : undefined, detail)
  const original = useArtworkTexture(a.imageFull, hi && !useGallery.getState().isTouch && gl.capabilities.maxTextureSize >= 4096)
  // la nappe du projecteur éclaire le mur : elle prend donc sa couleur
  const poolColor = useMemo(() => new THREE.Color(wallColorAt(pose.x + pose.nx * 0.3, pose.z + pose.nz * 0.3) ?? '#f2efe9').multiplyScalar(0.58), [pose])

  const active = () => {
    const st = useGallery.getState()
    return st.phase === 'visiting' && !st.selectedId
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (!active()) return
    useGallery.getState().setHovered(a.id)
    gl.domElement.style.cursor = 'pointer'
  }
  const onOut = () => {
    if (useGallery.getState().hoveredId === a.id) useGallery.getState().setHovered(null)
    gl.domElement.style.cursor = ''
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || !active()) return
    gl.domElement.style.cursor = ''
    useGallery.getState().select(a.id)
  }
  // sur la tablette : le bouton ajoute au panier, le reste ouvre la fiche
  const onPanel = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || !active()) return
    const fromTop = 1 - (e.uv?.y ?? 0)
    if (fromTop > BUTTON_ZONE[0] && fromTop < BUTTON_ZONE[1]) useGallery.getState().addToCart(a.id)
    else useGallery.getState().select(a.id)
  }

  const panelX = w / 2 + spec.width + PANEL.gap + PANEL.w / 2
  const panelY = -h / 2 + PANEL.h / 2
  const pins = [-1, 1].flatMap((sx) => [-1, 1].map((sy) => [sx * (PANEL.w / 2 - 0.05), sy * (PANEL.h / 2 - 0.05)] as const))
  return (
    <group position={[pose.x, pose.y, pose.z]} rotation-y={pose.rotY}>
      {/* nappe de lumière du projecteur sur le mur */}
      <mesh position={[0, 0.7, 0.002]} renderOrder={1}>
        <planeGeometry args={[3.3, 3.05]} />
        <meshBasicMaterial map={shared.pool} color={poolColor} blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* ombre portée du cadre */}
      <mesh position={[0, -0.05, 0.004]} renderOrder={2}>
        <planeGeometry args={[(w + spec.width * 2) * 1.42, (h + spec.width * 2) * 1.28]} />
        <meshBasicMaterial map={shared.frameShadow} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
      </mesh>
      <group onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <mesh geometry={frameGeo} material={frameMat} />
        {/* l'image est affichée telle quelle, sans éclairage ni retouche : couleurs et netteté d'origine */}
        <mesh position={[0, 0, spec.depth - 0.022]}>
          <planeGeometry args={[w + 0.01, h + 0.01]} />
          <meshBasicMaterial map={original ?? detailed ?? texture} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, spec.depth - 0.021]} renderOrder={3}>
          <planeGeometry args={[w + 0.01, h + 0.01]} />
          <meshBasicMaterial map={shared.innerShadow} transparent depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, (spec.depth - 0.024) / 2]}>
          <boxGeometry args={[w + 0.012, h + 0.012, spec.depth - 0.026]} />
          <meshStandardMaterial color="#1d1b19" roughness={0.9} />
        </mesh>
      </group>
      {/* tablette de verre sur entretoises */}
      <group position={[panelX, panelY, 0]}>
        <mesh position={[0.012, -0.03, 0.005]} renderOrder={2}>
          <planeGeometry args={[PANEL.w * 1.28, PANEL.h * 1.16]} />
          <meshBasicMaterial map={shared.panelShadow} transparent opacity={0.3} depthWrite={false} toneMapped={false} />
        </mesh>
        {pins.map(([px, py], i) => (
          <mesh key={i} geometry={shared.standoff} material={mats.chrome} position={[px, py, 0]} rotation-x={Math.PI / 2} />
        ))}
        <group position-z={PANEL.z}>
          {panel && (
            <mesh onClick={onPanel} onPointerOver={onOver} onPointerOut={onOut} renderOrder={7}>
              <planeGeometry args={[PANEL.w, PANEL.h]} />
              <meshBasicMaterial map={panel} transparent depthWrite={false} toneMapped={false} />
            </mesh>
          )}
          <CartBurst id={a.id} panel={panel} />
        </group>
      </group>
    </group>
  )
}

/** Projecteur sur rail orienté vers l'œuvre (sa lumière est peinte sur le mur). */
function ArtSpot({ a, mats }: { a: Artwork; mats: Materials }) {
  const pose = POSES[a.id]
  const dist = 2.2
  const pos = useMemo(() => new THREE.Vector3(pose.x + pose.nx * dist, pose.ceiling - 0.2, pose.z + pose.nz * dist), [pose])
  const head = useRef<THREE.Group>(null!)
  useEffect(() => {
    head.current.lookAt(pose.x, pose.y, pose.z)
  }, [pose])
  return (
    <>
      <mesh position={[pos.x, pose.ceiling - 0.075, pos.z]} material={mats.blackMetal}>
        <boxGeometry args={[0.03, 0.07, 0.03]} />
      </mesh>
      <group ref={head} position={pos}>
        <mesh rotation-x={Math.PI / 2} material={mats.blackMetal}>
          <cylinderGeometry args={[0.042, 0.042, 0.17, 20]} />
        </mesh>
        <mesh position={[0, 0, 0.086]}>
          <circleGeometry args={[0.034, 20]} />
          <meshBasicMaterial color={[4, 3.6, 3]} toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}

export function Artworks({ mats }: { mats: Materials }) {
  const gl = useThree((s) => s.gl)
  const textures = useTexture(ARTWORK_PREVIEWS)
  useMemo(() => {
    const aniso = Math.min(16, gl.capabilities.getMaxAnisotropy())
    for (const t of textures) {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = aniso
      t.needsUpdate = true
    }
  }, [textures, gl])
  const shared = useMemo<Shared>(() => {
    const standoff = new THREE.CylinderGeometry(0.012, 0.012, PANEL.z + 0.012, 20)
    standoff.translate(0, (PANEL.z + 0.012) / 2, 0)
    return {
      frameShadow: softRectTexture(256, 384, 44, 50, 168, 288, 34),
      panelShadow: softRectTexture(128, 256, 22, 24, 84, 208, 26, 12),
      innerShadow: frameInnerShadowTexture(),
      pool: poolTexture(),
      standoff,
    }
  }, [])

  // œuvre la plus proche (ou celle dont la fiche est ouverte) : elle passe en pleine résolution
  const [hiId, setHiId] = useState<string | null>(null)
  const [detailIds, setDetailIds] = useState<string[]>([])
  const timer = useRef(0)
  useFrame((state, dt) => {
    timer.current -= dt
    if (timer.current > 0) return
    timer.current = 0.25
    const st = useGallery.getState()
    const cam = state.camera.position
    const nearby = st.phase === 'visiting'
      ? ARTWORKS.filter((a) => {
          const p = POSES[a.id]
          return a.id === st.selectedId || Math.hypot(cam.x - p.x, cam.z - p.z) < 8
        }).map((a) => a.id)
      : []
    setDetailIds((prev) => prev.length === nearby.length && prev.every((id, i) => id === nearby[i]) ? prev : nearby)
    let best: string | null = st.selectedId
    if (!best && st.phase === 'visiting') {
      let bestD = HIRES_DISTANCE
      for (const a of ARTWORKS) {
        const p = POSES[a.id]
        const dx = cam.x - p.x
        const dz = cam.z - p.z
        if (dx * p.nx + dz * p.nz < 0.3) continue
        const d = Math.hypot(dx, dz)
        if (d < bestD) {
          bestD = d
          best = a.id
        }
      }
    }
    if (best !== hiId) setHiId(best)
  })

  return (
    <group>
      {ARTWORKS.map((a, i) => (
        <group key={a.id}>
          <ArtworkPiece a={a} texture={textures[i]} mats={mats} shared={shared} hi={hiId === a.id} detail={detailIds.includes(a.id)} />
          <ArtSpot a={a} mats={mats} />
        </group>
      ))}
    </group>
  )
}
