import { Environment, Lightformer } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { useGallery } from '../store'
import { HALL, ROT, SUN_DIR } from './layout'

RectAreaLightUniformsLib.init()

/**
 * Soleil : seule source projetant des ombres. Le cadre de la caméra d'ombre est
 * ajusté au volume du bâtiment pour que la galerie reste à l'abri du soleil direct.
 */
function Sun() {
  const quality = useGallery((s) => s.quality)
  const { position, target, cam } = useMemo(() => {
    const dir = new THREE.Vector3(...SUN_DIR).normalize()
    const center = new THREE.Vector3(0, 3, 0)
    const pos = center.clone().addScaledVector(dir, -70)
    const z = dir.clone().multiplyScalar(-1)
    const x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize()
    const y = new THREE.Vector3().crossVectors(z, x)
    const b = { l: Infinity, r: -Infinity, bt: Infinity, t: -Infinity, n: Infinity, f: -Infinity }
    for (const cx of [-15.5, 15.5])
      for (const cy of [-0.5, 9.2])
        for (const cz of [-15.5, 14]) {
          const v = new THREE.Vector3(cx, cy, cz).sub(pos)
          const px = v.dot(x)
          const py = v.dot(y)
          const pz = -v.dot(z)
          b.l = Math.min(b.l, px)
          b.r = Math.max(b.r, px)
          b.bt = Math.min(b.bt, py)
          b.t = Math.max(b.t, py)
          b.n = Math.min(b.n, pz)
          b.f = Math.max(b.f, pz)
        }
    const tgt = new THREE.Object3D()
    tgt.position.copy(center)
    return { position: pos, target: tgt, cam: b }
  }, [])
  const size = quality === 'low' ? 2048 : 4096
  return (
    <>
      <primitive object={target} />
      <directionalLight
        key={size}
        position={position}
        target={target}
        color="#fff0dc"
        intensity={4.6}
        castShadow
        shadow-mapSize={[size, size]}
        shadow-camera-left={cam.l}
        shadow-camera-right={cam.r}
        shadow-camera-bottom={cam.bt}
        shadow-camera-top={cam.t}
        shadow-camera-near={cam.n - 2}
        shadow-camera-far={cam.f + 2}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
        shadow-radius={quality === 'low' ? 2 : 3.5}
      />
    </>
  )
}

export function Lighting() {
  return (
    <>
      <Sun />
      {/* lumière zénithale de l'oculus de la rotonde */}
      <rectAreaLight width={5.2} height={5.2} intensity={2.3} color="#fff9f0" position={[0, ROT.h + 0.1, 0]} rotation-x={-Math.PI / 2} />
      {/* lumière du jour entrant par la façade vitrée du hall */}
      <rectAreaLight width={HALL.x1 - HALL.x0} height={HALL.h} intensity={0.9} color="#f4f8ff" position={[0, HALL.h / 2, HALL.z1 - 0.1]} />
      {/* lumière indirecte : ciel blanc au zénith, rebond chaud du sol */}
      <Environment resolution={256} frames={1} environmentIntensity={1}>
        <color attach="background" args={['#d3d0ca']} />
        <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={[9, 24, 1]} />
        <Lightformer form="rect" intensity={1.3} color="#fff4e4" position={[0, 4, 24]} rotation-y={Math.PI} scale={[16, 7, 1]} />
        <Lightformer form="rect" intensity={0.82} color="#f3e9d9" position={[0, -14, 0]} rotation-x={-Math.PI / 2} scale={[60, 60, 1]} />
      </Environment>
    </>
  )
}
