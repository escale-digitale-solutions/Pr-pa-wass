import { RoundedBox, useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { asset } from '../data/artworks'
import { BENCHES, DESK, HALL } from './layout'
import type { Materials } from './materials'

/** Banc de musée : plateau de chêne massif sur piètement bronze. */
function Bench({ x, z, len, mats }: { x: number; z: number; len: number; mats: Materials }) {
  return (
    <group position={[x, 0, z]}>
      <RoundedBox args={[0.62, 0.075, len]} radius={0.014} smoothness={3} position={[0, 0.425, 0]} castShadow receiveShadow material={mats.oak} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.195, s * (len / 2 - 0.34)]} material={mats.bronze} castShadow>
          <boxGeometry args={[0.52, 0.39, 0.045]} />
        </mesh>
      ))}
      <mesh position={[0, 0.34, 0]} material={mats.bronze}>
        <boxGeometry args={[0.05, 0.05, len - 0.7]} />
      </mesh>
      {/* ombre de contact */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]} renderOrder={2}>
        <planeGeometry args={[1.5, len + 0.9]} />
        <meshBasicMaterial map={softShadow()} transparent opacity={0.34} depthWrite={false} toneMapped={false} color="#221b14" />
      </mesh>
    </group>
  )
}

let shadowTex: THREE.Texture | null = null
function softShadow() {
  if (shadowTex) return shadowTex
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.filter = 'blur(13px)'
  ctx.fillStyle = '#000'
  ctx.fillRect(38, 34, 52, 188)
  shadowTex = new THREE.CanvasTexture(c)
  return shadowTex
}

/** Banque d'accueil : monolithe de pierre posé sur un socle en retrait. */
function Desk({ mats }: { mats: Materials }) {
  return (
    <group position={[DESK.x, 0, DESK.z]}>
      <RoundedBox args={[DESK.w, DESK.h - 0.06, DESK.d]} radius={0.012} smoothness={3} position={[0, 0.06 + (DESK.h - 0.06) / 2, 0]} castShadow receiveShadow material={mats.stone} />
      <mesh position={[0, 0.03, 0]} material={mats.plinth}>
        <boxGeometry args={[DESK.w - 0.08, 0.06, DESK.d - 0.08]} />
      </mesh>
      <mesh position={[0, DESK.h + 0.002, 0]} material={mats.bronze}>
        <boxGeometry args={[DESK.w - 0.5, 0.004, 0.012]} />
      </mesh>
    </group>
  )
}

/** Logo officiel Artin Berry appliqué sur le mur du hall, éclairé par un projecteur. */
function LogoWall() {
  const [mask, shadow] = useTexture([asset('logo/artin-berry-logo-mask.png'), asset('logo/artin-berry-logo-shadow.png')])
  useMemo(() => {
    for (const t of [mask, shadow]) {
      t.anisotropy = 16
      t.colorSpace = THREE.NoColorSpace
      t.needsUpdate = true
    }
  }, [mask, shadow])
  const img = mask.image as HTMLImageElement
  const width = 2.7
  const height = (width * img.height) / img.width
  const x = -3.25
  const y = 2.45
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.set(x, y - 0.15, HALL.z0)
    return o
  }, [])
  return (
    <group>
      <mesh position={[x, y - 0.012, HALL.z0 + 0.004]} renderOrder={2}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#1c1611" alphaMap={shadow} transparent opacity={0.32} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[x, y, HALL.z0 + 0.008]} renderOrder={3}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#efe7da" alphaMap={mask} transparent roughness={0.5} metalness={0.2} depthWrite={false} />
      </mesh>
      <primitive object={target} />
      <spotLight position={[x, HALL.h - 0.2, HALL.z0 + 2.4]} target={target} color="#fff1df" intensity={26} angle={0.5} penumbra={0.9} distance={14} decay={2} />
    </group>
  )
}

export function Furniture({ mats }: { mats: Materials }) {
  return (
    <group>
      {BENCHES.map((bn, i) => (
        <Bench key={i} {...bn} mats={mats} />
      ))}
      <Desk mats={mats} />
      <LogoWall />
    </group>
  )
}
