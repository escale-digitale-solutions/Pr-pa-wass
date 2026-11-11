import { RoundedBox, useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { asset } from '../data/artworks'
import { BENCHES, DESK, HALL, OTTOMAN } from './layout'
import type { Materials } from './materials'
import { poolTexture, softRectTexture } from './textures'

/** Banc de musée : plateau de chêne massif sur piètement bronze. */
function Bench({ x, z, len, mats }: { x: number; z: number; len: number; mats: Materials }) {
  return (
    <group position={[x, 0, z]}>
      <RoundedBox args={[0.62, 0.075, len]} radius={0.014} smoothness={3} position={[0, 0.425, 0]} material={mats.oak} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.195, s * (len / 2 - 0.34)]} material={mats.bronze}>
          <boxGeometry args={[0.52, 0.39, 0.045]} />
        </mesh>
      ))}
      <mesh position={[0, 0.34, 0]} material={mats.bronze}>
        <boxGeometry args={[0.05, 0.05, len - 0.7]} />
      </mesh>
      {/* ombre de contact */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]} renderOrder={2}>
        <planeGeometry args={[1.5, len + 0.9]} />
        <meshBasicMaterial map={softShadow()} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

let shadowTex: THREE.Texture | null = null
function softShadow() {
  if (!shadowTex) shadowTex = softRectTexture(128, 256, 36, 32, 56, 192, 30)
  return shadowTex
}

/** Banquette ronde en cuir, sous l'oculus de la rotonde. */
function Ottoman({ mats }: { mats: Materials }) {
  const { body, shadow } = useMemo(() => {
    // profil tourné : flanc droit, arête supérieure arrondie
    const { r, h } = OTTOMAN
    const pts = [new THREE.Vector2(r - 0.04, 0.09), new THREE.Vector2(r, 0.11)]
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * (Math.PI / 2)
      pts.push(new THREE.Vector2(r - 0.05 + Math.cos(t) * 0.05, h - 0.05 + Math.sin(t) * 0.05))
    }
    pts.push(new THREE.Vector2(0, h))
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 64)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(0.55, 'rgba(0,0,0,0.75)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    return { body: new THREE.LatheGeometry(pts, 72), shadow: new THREE.CanvasTexture(c) }
  }, [])
  return (
    <group>
      <mesh geometry={body} material={mats.leather} />
      <mesh position-y={0.045} material={mats.bronze}>
        <cylinderGeometry args={[OTTOMAN.r - 0.07, OTTOMAN.r - 0.07, 0.09, 64]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.007} renderOrder={2}>
        <planeGeometry args={[OTTOMAN.r * 3, OTTOMAN.r * 3]} />
        <meshBasicMaterial map={shadow} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Banque d'accueil : monolithe de pierre posé sur un socle en retrait. */
function Desk({ mats }: { mats: Materials }) {
  return (
    <group position={[DESK.x, 0, DESK.z]}>
      <RoundedBox args={[DESK.w, DESK.h - 0.06, DESK.d]} radius={0.012} smoothness={3} position={[0, 0.06 + (DESK.h - 0.06) / 2, 0]} material={mats.stone} />
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
  const pool = useMemo(poolTexture, [])
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
      <mesh position={[x, y + 0.25, HALL.z0 + 0.002]} renderOrder={1}>
        <planeGeometry args={[4.4, 3.4]} />
        <meshBasicMaterial map={pool} color={[0.16, 0.14, 0.115]} blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
      </mesh>
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
      <Ottoman mats={mats} />
      <LogoWall />
    </group>
  )
}
