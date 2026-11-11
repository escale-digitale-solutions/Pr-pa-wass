import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { asset } from '../data/artworks'

export interface Materials {
  wall: THREE.MeshStandardMaterial
  plinth: THREE.MeshStandardMaterial
  bronze: THREE.MeshStandardMaterial
  blackMetal: THREE.MeshStandardMaterial
  champagne: THREE.MeshStandardMaterial
  chrome: THREE.MeshStandardMaterial
  leather: THREE.MeshStandardMaterial
  oak: THREE.MeshStandardMaterial
  oakFrame: THREE.MeshStandardMaterial
  whiteFrame: THREE.MeshStandardMaterial
  stone: THREE.MeshStandardMaterial
  terrace: THREE.MeshStandardMaterial
}

const TEX = [
  'textures/wall_nor.jpg',
  'textures/oak_diff.jpg',
  'textures/oak_nor.jpg',
  'textures/oak_rough.jpg',
  'textures/floor_diff.jpg',
  'textures/floor_nor.jpg',
  'textures/floor_rough.jpg',
].map(asset)

function tile(t: THREE.Texture, rx: number, ry: number, srgb = false, aniso = 8) {
  const c = t.clone()
  c.wrapS = c.wrapT = THREE.RepeatWrapping
  c.repeat.set(rx, ry)
  c.anisotropy = aniso
  c.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  c.needsUpdate = true
  return c
}

/** Matériaux PBR partagés par toute la scène. */
export function useMaterials(): Materials {
  const gl = useThree((s) => s.gl)
  const [wallNor, oakDiff, oakNor, oakRough, floorDiff, floorNor, floorRough] = useTexture(TEX)
  return useMemo(() => {
    const aniso = Math.min(16, gl.capabilities.getMaxAnisotropy())
    const wall = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true, // couleur de chaque salle portée par la géométrie
      roughness: 0.93,
      metalness: 0,
      normalMap: tile(wallNor, 1, 1, false, 4),
      normalScale: new THREE.Vector2(0.28, 0.28),
    })
    // les deux faces projettent une ombre : aucune fuite de soleil aux jonctions mur / plafond
    wall.shadowSide = THREE.DoubleSide
    const plinth = new THREE.MeshStandardMaterial({ color: '#4a4640', roughness: 0.9 })
    plinth.shadowSide = THREE.DoubleSide
    const bronze = new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.42, metalness: 0.75 })
    const blackMetal = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.5, metalness: 0.55 })
    const champagne = new THREE.MeshStandardMaterial({ color: '#bfa980', roughness: 0.34, metalness: 0.9 })
    const oak = new THREE.MeshStandardMaterial({
      map: tile(oakDiff, 1, 2.2, true, aniso),
      normalMap: tile(oakNor, 1, 2.2),
      roughnessMap: tile(oakRough, 1, 2.2),
      roughness: 0.85,
      color: '#e9dcc8',
    })
    const oakFrame = new THREE.MeshStandardMaterial({
      map: tile(oakDiff, 0.6, 0.6, true, aniso),
      normalMap: tile(oakNor, 0.6, 0.6),
      roughness: 0.62,
      color: '#ead9c0',
    })
    const whiteFrame = new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.55 })
    const stone = new THREE.MeshStandardMaterial({
      map: tile(floorDiff, 0.9, 0.45, true, aniso),
      normalMap: tile(floorNor, 0.9, 0.45),
      roughnessMap: tile(floorRough, 0.9, 0.45),
      roughness: 0.9,
      color: '#f6f1e8',
    })
    const terrace = new THREE.MeshStandardMaterial({
      map: tile(floorDiff, 26, 30, true, aniso),
      roughness: 0.95,
      color: '#d9d4ca',
    })
    const chrome = new THREE.MeshStandardMaterial({ color: '#8e8c88', roughness: 0.32, metalness: 1 })
    const leather = new THREE.MeshStandardMaterial({ color: '#7a4a2e', roughness: 0.58, metalness: 0 })
    return { wall, plinth, bronze, blackMetal, champagne, chrome, leather, oak, oakFrame, whiteFrame, stone, terrace }
  }, [gl, wallNor, oakDiff, oakNor, oakRough, floorDiff, floorNor, floorRough])
}
