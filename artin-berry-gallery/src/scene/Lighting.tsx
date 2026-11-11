import { Environment, Lightformer } from '@react-three/drei'

/**
 * Éclairage : une lumière d'ambiance diffuse (ciel blanc au zénith, rebond chaud du sol),
 * calculée une fois. Les nappes des projecteurs et les halos des gorges lumineuses sont peints
 * sur les murs (voir Architecture et Artworks) : aucune source dynamique à calculer à chaque image,
 * ce qui laisse toute la puissance de l'appareil à la netteté de l'affichage.
 */
export function Lighting() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={1.25}>
      <color attach="background" args={['#d4d2ce']} />
      <Lightformer form="rect" intensity={1.5} color="#ffffff" position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={[9, 24, 1]} />
      <Lightformer form="rect" intensity={1.3} color="#fff4e4" position={[0, 4, 24]} rotation-y={Math.PI} scale={[16, 7, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#f4f0e8" position={[0, -14, 0]} rotation-x={-Math.PI / 2} scale={[60, 60, 1]} />
    </Environment>
  )
}
