import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { Suspense, useEffect, useState } from 'react'
import { useGallery } from '../store'
import { Architecture } from './Architecture'
import { Artworks } from './Artworks'
import { Furniture } from './Furniture'
import { Lighting } from './Lighting'
import { useMaterials } from './materials'
import { Player } from './Player'

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

/** Post-traitement volontairement discret : occlusion ambiante, halo des sources, rendu des tons. */
function Effects() {
  const quality = useGallery((s) => s.quality)
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {quality !== 'low' ? (
        <N8AO
          aoRadius={0.9}
          distanceFalloff={0.7}
          intensity={2.1}
          aoSamples={quality === 'high' ? 16 : 10}
          denoiseSamples={quality === 'high' ? 8 : 4}
          denoiseRadius={10}
          halfRes={quality !== 'high'}
          color="#1c140c"
        />
      ) : (
        <></>
      )}
      <Bloom mipmapBlur luminanceThreshold={1.15} luminanceSmoothing={0.25} intensity={0.28} radius={0.72} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
      <Vignette offset={0.22} darkness={0.4} />
    </EffectComposer>
  )
}

export function Experience() {
  const quality = useGallery((s) => s.quality)
  const degrade = useGallery((s) => s.degrade)
  const maxDpr = quality === 'high' ? 1.75 : quality === 'medium' ? 1.35 : 1
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
      shadows="percentage"
      dpr={[1, maxDpr]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 58, near: 0.08, far: 320, position: [2.3, 1.62, 11.2] }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1
      }}
    >
      <color attach="background" args={['#e9e6e0']} />
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <Player />
      <Effects />
      {monitor && !locked && (
        <PerformanceMonitor ms={300} iterations={8} threshold={0.7} bounds={() => [32, 120]} onDecline={degrade} />
      )}
    </Canvas>
  )
}
