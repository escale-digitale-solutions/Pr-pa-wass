import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, lazy, useEffect, useState } from 'react'
import { useGallery } from '../store'
import { Architecture } from './Architecture'
import { Artworks } from './Artworks'
import { Furniture } from './Furniture'
import { Lighting } from './Lighting'
import { useMaterials } from './materials'
import { Player } from './Player'

// les effets d'ambiance ne sont téléchargés que par les appareils qui les affichent
const Effects = lazy(() => import('./Effects'))

function Ready() {
  const setReady = useGallery((s) => s.setReady)
  useEffect(() => {
    // laisse le temps à la première image (compilation des shaders) de s'afficher
    const id = window.setTimeout(setReady, 350)
    return () => window.clearTimeout(id)
  }, [setReady])
  return null
}

function Scene() {
  const mats = useMaterials()
  return (
    <>
      <Lighting />
      <Architecture mats={mats} />
      <Furniture mats={mats} />
      <Artworks mats={mats} />
      <Ready />
    </>
  )
}

/**
 * Netteté : l'image est calculée à la résolution de l'écran (jusqu'à 2,5 fois sa définition logique
 * sur téléphone), avec lissage matériel des contours. Aucune correction de tons : les œuvres
 * s'affichent avec leurs couleurs d'origine.
 */
export function Experience() {
  const quality = useGallery((s) => s.quality)
  const degrade = useGallery((s) => s.degrade)
  const isTouch = useGallery((s) => s.isTouch)
  // la netteté passe avant les effets : même au palier « Légère », un téléphone garde une image fine
  const saver = useGallery((s) => s.saver)
  const cap = saver ? (isTouch ? 1.5 : 1) : isTouch ? (quality === 'medium' ? 2.5 : 2) : quality === 'low' ? 1.5 : 2
  const dpr = Math.min(window.devicePixelRatio || 1, cap)
  // l'adaptation automatique ne démarre qu'une fois la scène chargée et stabilisée
  const ready = useGallery((s) => s.ready)
  const locked = useGallery((s) => s.qualityLocked)
  const [monitor, setMonitor] = useState(false)
  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => setMonitor(true), 4000)
    return () => window.clearTimeout(id)
  }, [ready])
  return (
    <Canvas
      className="gallery-canvas"
      fallback={<p className="no-webgl">Cet appareil ne peut pas afficher la visite en 3D. Essayez avec un navigateur récent.</p>}
      flat
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 58, near: 0.08, far: 320, position: [2.5, 1.62, 11.2] }}
    >
      <color attach="background" args={['#e9e6e0']} />
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <Player />
      {quality === 'high' && (
        <Suspense fallback={null}>
          <Effects />
        </Suspense>
      )}
      {monitor && !locked && <PerformanceMonitor ms={300} iterations={8} threshold={0.7} bounds={() => [30, 120]} onDecline={degrade} />}
    </Canvas>
  )
}
