import { useTexture } from '@react-three/drei'
import { ARTWORKS, asset } from '../data/artworks'

export const MATERIAL_TEXTURES = [
  'textures/wall_nor.jpg',
  'textures/oak_diff.jpg',
  'textures/oak_nor.jpg',
  'textures/oak_rough.jpg',
  'textures/floor_diff.jpg',
  'textures/floor_nor.jpg',
  'textures/floor_rough.jpg',
].map(asset)

export const ARTWORK_PREVIEWS = ARTWORKS.map((a) => asset(a.imagePreview ?? a.image))
export const LOGO_TEXTURES = ['logo/artin-berry-logo-mask.png', 'logo/artin-berry-logo-shadow.png'].map(asset)

export function preloadSceneTextures() {
  useTexture.preload(MATERIAL_TEXTURES)
  useTexture.preload(LOGO_TEXTURES)
  useTexture.preload(ARTWORK_PREVIEWS)
}
