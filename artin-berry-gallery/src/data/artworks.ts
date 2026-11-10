import raw from './artworks.json'
import { MOUNT_WALLS } from '../scene/layout'

export type FrameStyle = 'oak' | 'black' | 'champagne' | 'white'

export interface Artwork {
  id: string
  title: string
  artist?: string
  year?: string
  technique?: string
  dimensions?: string
  note?: string
  /** prix de vente en euros */
  price?: number
  description?: string
  /** texture utilisée dans la scène 3D */
  image: string
  /** fichier original, affiché dans la visionneuse plein écran */
  imageFull?: string
  room?: string
  placement: { wall: string; position: number; height: number }
  display: { width: number; height: number }
  frame?: FrameStyle
}

export const ARTWORKS = raw as Artwork[]

export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`

export interface ArtworkPose {
  /** centre de l'œuvre, sur le mur */
  x: number
  y: number
  z: number
  /** normale du mur (vers la salle) */
  nx: number
  nz: number
  rotY: number
  ceiling: number
}

export function poseOf(a: Artwork): ArtworkPose {
  const wall = MOUNT_WALLS[a.placement.wall]
  if (!wall) throw new Error(`Mur d'accrochage inconnu : ${a.placement.wall}`)
  const [nx, nz] = wall.normal
  const x = wall.axis === 'z' ? wall.plane : a.placement.position
  const z = wall.axis === 'z' ? a.placement.position : wall.plane
  return { x, y: a.placement.height, z, nx, nz, rotY: Math.atan2(nx, nz), ceiling: wall.ceiling }
}

export const POSES: Record<string, ArtworkPose> = Object.fromEntries(ARTWORKS.map((a) => [a.id, poseOf(a)]))

export const byId = (id: string | null) => ARTWORKS.find((a) => a.id === id) ?? null

export const formatPrice = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v)
