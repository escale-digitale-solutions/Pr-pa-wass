import { useTexture } from '@react-three/drei'
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ARTWORKS, type Artwork, POSES, asset } from '../data/artworks'
import { useGallery } from '../store'
import type { Materials } from './materials'

const FRAME_SPEC = {
  oak: { width: 0.045, depth: 0.055 },
  black: { width: 0.028, depth: 0.05 },
  champagne: { width: 0.034, depth: 0.06 },
  white: { width: 0.045, depth: 0.055 },
} as const

/** Éclairement apporté par le projecteur (1 = blanc de référence). */
const SPOT_LEVEL = 0.34

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
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bev,
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev,
    bevelSegments: 2,
    steps: 1,
  })
  g.translate(0, 0, bev)
  geoCache.set(key, g)
  return g
}

/** Ombre portée douce du cadre sur le mur (pré-calculée dans une texture). */
function makeShadowTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 384
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.filter = 'blur(14px)'
  ctx.fillStyle = 'rgba(0,0,0,1)'
  ctx.fillRect(38, 44, 180, 300)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeHotspotTexture() {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')!
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, 44, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = 'rgba(20,19,17,0.55)'
  ctx.stroke()
  ctx.strokeStyle = 'rgba(20,19,17,0.9)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(s / 2 - 15, s / 2)
  ctx.lineTo(s / 2 + 15, s / 2)
  ctx.moveTo(s / 2, s / 2 - 15)
  ctx.lineTo(s / 2, s / 2 + 15)
  ctx.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Cartel : petit carton imprimé posé à droite de l'œuvre. */
function drawLabel(canvas: HTMLCanvasElement, a: Artwork) {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width
  const H = canvas.height
  ctx.fillStyle = '#fbfaf7'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#1a1917'
  ctx.textBaseline = 'alphabetic'
  let y = 92
  if (a.artist) {
    ctx.font = '500 30px "Jost", "Helvetica Neue", Arial, sans-serif'
    const text = a.artist.toUpperCase().split('').join(' ')
    ctx.fillText(text, 48, y)
    y += 70
  }
  ctx.font = 'italic 500 52px "Cormorant Garamond", Georgia, serif'
  const words = a.title.split(' ')
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > W - 96 && line) {
      ctx.fillText(line, 48, y)
      y += 58
      line = word
    } else line = test
  }
  ctx.fillText(line, 48, y)
  if (a.year) {
    y += 60
    ctx.font = '400 30px "Jost", "Helvetica Neue", Arial, sans-serif'
    ctx.fillStyle = '#6f6a62'
    ctx.fillText(a.year, 48, y)
  }
}

function useLabelTexture(a: Artwork) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 400
    drawLabel(c, a)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [a])
  useEffect(() => {
    let alive = true
    Promise.all([
      document.fonts.load('italic 500 52px "Cormorant Garamond"'),
      document.fonts.load('500 30px "Jost"'),
      document.fonts.load('400 30px "Jost"'),
    ])
      .then(() => {
        if (!alive) return
        drawLabel(tex.image as HTMLCanvasElement, a)
        tex.needsUpdate = true
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [a, tex])
  return tex
}

interface Shared {
  shadow: THREE.Texture
  hotspot: THREE.Texture
  hotspotMaterials: THREE.MeshBasicMaterial[]
}

function ArtworkPiece({
  a,
  texture,
  mats,
  shared,
  index,
}: {
  a: Artwork
  texture: THREE.Texture
  mats: Materials
  shared: Shared
  index: number
}) {
  const pose = POSES[a.id]
  const spec = FRAME_SPEC[a.frame ?? 'oak']
  const { width: w, height: h } = a.display
  const frameGeo = useMemo(() => frameGeometry(w, h, spec.width, spec.depth), [w, h, spec])
  const frameMat =
    a.frame === 'black'
      ? mats.blackMetal
      : a.frame === 'champagne'
        ? mats.champagne
        : a.frame === 'white'
          ? mats.whiteFrame
          : mats.oakFrame
  const label = useLabelTexture(a)
  const gl = useThree((s) => s.gl)
  const hotspotMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: shared.hotspot,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    })
    shared.hotspotMaterials[index] = m
    return m
  }, [shared, index])

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

  const labelX = w / 2 + spec.width + 0.29
  const labelY = 1.24 - pose.y
  return (
    <group position={[pose.x, pose.y, pose.z]} rotation-y={pose.rotY}>
      {/* ombre douce derrière le cadre */}
      <mesh position={[0, -0.05, 0.003]} renderOrder={1}>
        <planeGeometry args={[(w + spec.width * 2) * 1.42, (h + spec.width * 2) * 1.28]} />
        <meshBasicMaterial map={shared.shadow} transparent opacity={0.3} depthWrite={false} toneMapped={false} color="#2a2118" />
      </mesh>
      <group onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
        <mesh geometry={frameGeo} material={frameMat} />
        <mesh position={[0, 0, spec.depth - 0.022]}>
          <planeGeometry args={[w + 0.01, h + 0.01]} />
          {/* pour moitié éclairée par la scène, pour moitié auto-lumineuse :
              l'œuvre réagit à la lumière sans que ses couleurs ne dérivent */}
          <meshStandardMaterial
            map={texture}
            color="#b9b9b9"
            emissive="#ffffff"
            emissiveMap={texture}
            emissiveIntensity={0.46}
            roughness={0.7}
            metalness={0}
          />
        </mesh>
        {/* fond du cadre, pour fermer la boîte */}
        <mesh position={[0, 0, (spec.depth - 0.024) / 2]}>
          <boxGeometry args={[w + 0.012, h + 0.012, spec.depth - 0.026]} />
          <meshStandardMaterial color="#1d1b19" roughness={0.9} />
        </mesh>
        {/* cartel */}
        <mesh position={[labelX, labelY, 0.004]}>
          <boxGeometry args={[0.28, 0.175, 0.006]} />
          <meshStandardMaterial map={label} color="#d6d2ca" roughness={0.85} />
        </mesh>
      </group>
      {/* repère d'interaction, visible à l'approche */}
      <mesh position={[labelX, labelY + 0.21, 0.012]} material={hotspotMat} renderOrder={6}>
        <planeGeometry args={[0.085, 0.085]} />
      </mesh>
    </group>
  )
}

/** Projecteur sur rail orienté vers l'œuvre. */
function ArtSpot({ a, mats }: { a: Artwork; mats: Materials }) {
  const pose = POSES[a.id]
  const dist = 2.7 // recul du rail par rapport au mur
  const y = pose.ceiling - 0.2
  const pos = useMemo(() => new THREE.Vector3(pose.x + pose.nx * dist, y, pose.z + pose.nz * dist), [pose, dist, y])
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
  const angle = Math.atan((half * 1.18) / d)
  // intensité (candela) calculée pour un éclairement constant sur l'œuvre,
  // quelle que soit la hauteur sous plafond
  const cosInc = dist / d
  const intensity = (SPOT_LEVEL * Math.PI * d * d) / cosInc
  return (
    <>
      <primitive object={target} />
      <spotLight
        position={pos}
        target={target}
        color="#fff1df"
        intensity={intensity}
        angle={angle}
        penumbra={0.85}
        distance={16}
        decay={2}
      />
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
  const camera = useThree((s) => s.camera)
  const textures = useTexture(ARTWORKS.map((a) => asset(a.image)))
  useMemo(() => {
    const aniso = Math.min(16, gl.capabilities.getMaxAnisotropy())
    for (const t of textures) {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = aniso
      t.needsUpdate = true
    }
  }, [textures, gl])
  const shared = useMemo<Shared>(
    () => ({ shadow: makeShadowTexture(), hotspot: makeHotspotTexture(), hotspotMaterials: [] }),
    [],
  )
  // les repères apparaissent en douceur lorsque le visiteur s'approche
  useFrame((state, dt) => {
    const st = useGallery.getState()
    const show = st.phase === 'visiting' && !st.selectedId
    const pulse = 0.82 + Math.sin(state.clock.elapsedTime * 2.2) * 0.18
    ARTWORKS.forEach((a, i) => {
      const m = shared.hotspotMaterials[i]
      if (!m) return
      const p = POSES[a.id]
      const dx = camera.position.x - p.x
      const dz = camera.position.z - p.z
      const d = Math.hypot(dx, dz)
      const front = dx * p.nx + dz * p.nz > 0.4
      const target = show && front && d < 8.5 ? THREE.MathUtils.clamp((8.5 - d) / 3, 0, 1) * pulse : 0
      m.opacity += (target - m.opacity) * Math.min(1, dt * 5)
    })
  })
  return (
    <group>
      {ARTWORKS.map((a, i) => (
        <group key={a.id}>
          <ArtworkPiece a={a} texture={textures[i]} mats={mats} shared={shared} index={i} />
          <ArtSpot a={a} mats={mats} />
        </group>
      ))}
    </group>
  )
}
