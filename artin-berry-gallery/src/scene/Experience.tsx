import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useGallery } from '../store'
import { Architecture } from './Architecture'
import { Artworks } from './Artworks'
import { Furniture } from './Furniture'
import { Lighting } from './Lighting'
import { useMaterials } from './materials'
import { Player } from './Player'
import { preloadSceneTextures } from './assets'

const Effects = lazy(() => import('./Effects'))
// Démarre les trois groupes ensemble, avant les suspensions des composants.
preloadSceneTextures()

function GraphicsGuard() {
  const gl = useThree(s => s.gl)
  useEffect(() => {
    const fail = (event: Event) => { event.preventDefault(); window.dispatchEvent(new Event('gallery-render-failed')) }
    gl.domElement.addEventListener('webglcontextlost', fail)
    return () => gl.domElement.removeEventListener('webglcontextlost', fail)
  }, [gl])
  return null
}
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
 * Définition limitée pour contenir la charge graphique sur les téléphones. Aucune correction de tons : les œuvres
 * s'affichent avec leurs couleurs d'origine.
 */
export function Experience() {
  const quality = useGallery((s) => s.quality)
  const degrade = useGallery((s) => s.degrade)
  const isTouch = useGallery((s) => s.isTouch)
  // Profil mobile conservateur, indépendant du paramètre de qualité de l’URL.
  const cap = isTouch ? 1 : quality === 'low' ? 1 : 1.5
  const dpr = Math.min(window.devicePixelRatio || 1, cap)
  // l'adaptation automatique ne démarre qu'une fois la scène chargée et stabilisée
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
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
      flat
      fallback={<p>La visite 3D est indisponible. Utilisez le bouton Retour au catalogue.</p>}
      frameloop={visible ? 'always' : 'never'}
      dpr={dpr}
      gl={{ antialias: !isTouch, powerPreference: isTouch ? 'low-power' : 'default', stencil: false }}
      camera={{ fov: 58, near: 0.08, far: 320, position: [2.5, 1.62, 11.2] }}
    >
      <color attach="background" args={['#e9e6e0']} />
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <Player />
      <GraphicsGuard />
      {ready && quality === 'high' && (
        <Suspense fallback={null}>
          <Effects />
        </Suspense>
      )}
      {monitor && !locked && <PerformanceMonitor ms={300} iterations={8} threshold={0.7} bounds={() => [30, 120]} onDecline={degrade} />}
    </Canvas>
  )
}
