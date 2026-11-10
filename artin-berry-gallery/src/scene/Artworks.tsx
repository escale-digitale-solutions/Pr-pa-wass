import { useTexture } from '@react-three/drei'
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ARTWORKS, type Artwork, POSES, asset, formatPrice } from '../data/artworks'
import { useGallery } from '../store'
import type { Materials } from './materials'

const FRAME_SPEC = {
  oak: { width: 0.045, depth: 0.055 },
  black: { width: 0.028, depth: 0.05 },
  champagne: { width: 0.034, depth: 0.06 },
  white: { width: 0.045, depth: 0.055 },
} as const

/** Éclairement apporté par le projecteur (1 = blanc de référence). */
const SPOT_LEVEL = 0.36
/** Panneau de verre posé à droite de l'œuvre (mètres). */
const PANEL = { w: 0.56, h: 0.85, y: 1.5 }
const BURST_MS = 1700

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

/** Ombre portée douce du cadre sur le mur. */
function makeShadowTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 384
  const ctx = c.getContext('2d')!
  ctx.filter = 'blur(14px)'
  ctx.fillStyle = '#000'
  ctx.fillRect(38, 44, 180, 300)
  return new THREE.CanvasTexture(c)
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y)
      y += lh
      line = word
    } else line = test
  }
  ctx.fillText(line, x, y)
  return y
}

/** Panneau de verre : artiste, titre, format, prix et bouton d'ajout au panier. */
function drawPanel(c: HTMLCanvasElement, a: Artwork, inCart: boolean) {
  const ctx = c.getContext('2d')!
  const W = c.width
  const H = c.height
  const x = 46
  ctx.clearRect(0, 0, W, H)
  ctx.beginPath()
  ctx.roundRect(5, 5, W - 10, H - 10, 36)
  ctx.fillStyle = 'rgba(22, 19, 16, 0.6)'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)'
  ctx.font = '500 21px "Jost", Arial, sans-serif'
  ctx.fillText('A R T I S T E', x, 82)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'italic 500 56px "Cormorant Garamond", Georgia, serif'
  let y = wrap(ctx, a.artist ?? '', x, 144, W - 2 * x, 56)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.fillRect(x, y + 28, W - 2 * x, 2)
  ctx.fillStyle = '#ffffff'
  ctx.font = '400 28px "Jost", Arial, sans-serif'
  y = wrap(ctx, a.title, x, y + 78, W - 2 * x, 36)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
  ctx.font = '300 25px "Jost", Arial, sans-serif'
  if (a.dimensions) ctx.fillText(`Format : ${a.dimensions}`, x, (y += 46))
  if (a.price != null) {
    ctx.fillStyle = '#ffffff'
    ctx.font = '500 70px "Cormorant Garamond", Georgia, serif'
    ctx.fillText(formatPrice(a.price), x, H - 190)
  }
  ctx.beginPath()
  ctx.roundRect(x - 6, H - 148, W - 2 * x + 12, 88, 44)
  if (inCart) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
  } else {
    ctx.fillStyle = '#f6e7cd'
    ctx.fill()
    ctx.fillStyle = '#1c1814'
  }
  ctx.font = '500 27px "Jost", Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(inCart ? 'Dans le panier  ✓' : 'Ajouter au panier', W / 2, H - 94)
  ctx.textAlign = 'left'
}

function usePanelTexture(a: Artwork, inCart: boolean) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 780
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
  useEffect(() => {
    let alive = true
    const paint = () => {
      if (!alive) return
      drawPanel(tex.image as HTMLCanvasElement, a, inCart)
      tex.needsUpdate = true
    }
    paint()
    Promise.all([document.fonts.load('italic 500 56px "Cormorant Garamond"'), document.fonts.load('500 27px "Jost"'), document.fonts.load('300 25px "Jost"')])
      .then(paint)
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [a, inCart, tex])
  return tex
}

/** Volutes de lumière autour du panneau lorsqu'une œuvre rejoint le panier. */
function CartBurst({ id }: { id: string }) {
  const ref = useRef<THREE.Points>(null!)
  const N = 120
  const { geo, seeds } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    const seeds = Array.from({ length: N }, (_, i) => ({ head: i % 2, lag: Math.random() ** 1.6, jit: Math.random() - 0.5, ph: Math.random() * 6.28 }))
    return { geo, seeds }
  }, [])
  useFrame(() => {
    const b = useGallery.getState().burst
    const t = b && b.id === id ? (performance.now() - b.at) / BURST_MS : 2
    const p = ref.current
    p.visible = t >= 0 && t <= 1
    if (!p.visible) return
    const pos = geo.attributes.position as THREE.BufferAttribute
    const ease = 1 - (1 - t) ** 3
    seeds.forEach((s, i) => {
      const ang = s.head * Math.PI + ease * 7.5 - s.lag * 2.4 + 0.6
      const r = 1.08 + s.jit * 0.16 * (0.4 + s.lag) + Math.sin(ang * 3 + s.ph) * 0.02
      pos.setXYZ(i, Math.cos(ang) * (PANEL.w / 2 + 0.1) * r, Math.sin(ang) * (PANEL.h / 2 + 0.1) * r + s.jit * 0.05, 0.02 + s.lag * 0.04)
    })
    pos.needsUpdate = true
    ;(p.material as THREE.PointsMaterial).opacity = Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.7
  })
  return (
    <points ref={ref} geometry={geo} visible={false} frustumCulled={false} renderOrder={8}>
      <pointsMaterial color={[3, 2.5, 1.7]} size={0.03} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  )
}

function ArtworkPiece({ a, texture, mats, shadow }: { a: Artwork; texture: THREE.Texture; mats: Materials; shadow: THREE.Texture }) {
  const pose = POSES[a.id]
  const spec = FRAME_SPEC[a.frame ?? 'oak']
  const { width: w, height: h } = a.display
  const frameGeo = useMemo(() => frameGeometry(w, h, spec.width, spec.depth), [w, h, spec])
  const frameMat = a.frame === 'black' ? mats.blackMetal : a.frame === 'champagne' ? mats.champagne : a.frame === 'white' ? mats.whiteFrame : mats.oakFrame
  const inCart = useGallery((s) => !!s.cart[a.id])
  const panel = usePanelTexture(a, inCart)
  const gl = useThree((s) => s.gl)

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
  const onPanel = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || !active()) return
    useGallery.getState().addToCart(a.id)
  }

  const panelX = w / 2 + spec.width + 0.48
  const panelY = PANEL.y - pose.y
  return (
    <group position={[pose.x, pose.y, pose.z]} rotation-y={pose.rotY}>
      <mesh position={[0, -0.05, 0.003]} renderOrder={1}>
        <planeGeometry args={[(w + spec.width * 2) * 1.42, (h + spec.width * 2) * 1.28]} />
        <meshBasicMaterial map={shadow} transparent opacity={0.36} depthWrite={false} toneMapped={false} color="#0d0906" />
      </mesh>
      <group onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <mesh geometry={frameGeo} material={frameMat} />
        <mesh position={[0, 0, spec.depth - 0.022]}>
          <planeGeometry args={[w + 0.01, h + 0.01]} />
          {/* pour moitié éclairée par la scène, pour moitié auto-lumineuse :
              l'œuvre réagit à la lumière sans que ses couleurs ne dérivent */}
          <meshStandardMaterial map={texture} color="#b9b9b9" emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.46} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, (spec.depth - 0.024) / 2]}>
          <boxGeometry args={[w + 0.012, h + 0.012, spec.depth - 0.026]} />
          <meshStandardMaterial color="#1d1b19" roughness={0.9} />
        </mesh>
      </group>
      {/* panneau de verre : un clic ajoute l'œuvre au panier */}
      <group position={[panelX, panelY, 0.03]}>
        <mesh onClick={onPanel} onPointerOver={onOver} onPointerOut={onOut} renderOrder={7}>
          <planeGeometry args={[PANEL.w, PANEL.h]} />
          <meshBasicMaterial map={panel} transparent depthWrite={false} toneMapped={false} />
        </mesh>
        <CartBurst id={a.id} />
      </group>
    </group>
  )
}

/** Projecteur sur rail orienté vers l'œuvre. */
function ArtSpot({ a, mats }: { a: Artwork; mats: Materials }) {
  const pose = POSES[a.id]
  const dist = 2.2 // recul du rail par rapport au mur
  const y = pose.ceiling - 0.2
  const pos = useMemo(() => new THREE.Vector3(pose.x + pose.nx * dist, y, pose.z + pose.nz * dist), [pose, y])
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(pose.x, pose.y - 0.05, pose.z)
    return o
  }, [pose])
  const head = useRef<THREE.Group>(null!)
  useEffect(() => {
    head.current.lookAt(target.position)
  }, [target])
  const d = pos.distanceTo(target.position)
  const half = Math.hypot(a.display.width, a.display.height) / 2
  const angle = Math.atan((half * 1.3) / d)
  // intensité (candela) calculée pour un éclairement constant sur l'œuvre
  const intensity = (SPOT_LEVEL * Math.PI * d * d) / (dist / d)
  return (
    <>
      <primitive object={target} />
      <spotLight position={pos} target={target} color="#fff1df" intensity={intensity} angle={angle} penumbra={0.85} distance={14} decay={2} />
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
  const textures = useTexture(ARTWORKS.map((a) => asset(a.image)))
  useMemo(() => {
    const aniso = Math.min(16, gl.capabilities.getMaxAnisotropy())
    for (const t of textures) {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = aniso
      t.needsUpdate = true
    }
  }, [textures, gl])
  const shadow = useMemo(makeShadowTexture, [])
  return (
    <group>
      {ARTWORKS.map((a, i) => (
        <group key={a.id}>
          <ArtworkPiece a={a} texture={textures[i]} mats={mats} shadow={shadow} />
          <ArtSpot a={a} mats={mats} />
        </group>
      ))}
    </group>
  )
}
