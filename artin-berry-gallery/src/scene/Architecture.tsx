import { MeshReflectorMaterial } from '@react-three/drei'
import { type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGallery } from '../store'
import { controller } from './controller'
import { type Box, FINS, GAL, HALL, PLINTH, SKYLIGHT, SUN_DIR, UPPER, WALLS } from './layout'
import type { Materials } from './materials'

/** Boîte dont les UV suivent les dimensions réelles (texture à l'échelle du monde). */
function boxGeometry(box: Box, uvScale = 0.5): THREE.BufferGeometry {
  const w = box.max[0] - box.min[0]
  const h = box.max[1] - box.min[1]
  const d = box.max[2] - box.min[2]
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const su = [d, d, w, w, w, w]
  const sv = [h, h, d, d, h, h]
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i
      uv.setXY(k, uv.getX(k) * su[f] * uvScale, uv.getY(k) * sv[f] * uvScale)
    }
  g.translate((box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2)
  return g
}
const merge = (boxes: Box[], uvScale = 0.5) => mergeGeometries(boxes.map((bx) => boxGeometry(bx, uvScale)))!

const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({
  min: [x0, y0, z0],
  max: [x1, y1, z1],
})

const stop = (e: ThreeEvent<Event>) => e.stopPropagation()

/** Murs, plafonds, puits de lumière : une seule géométrie fusionnée. */
function Shell({ mats }: { mats: Materials }) {
  const shell = useMemo(() => merge([...WALLS, ...UPPER]), [])
  const fins = useMemo(() => merge(FINS), [])
  const plinths = useMemo(
    () =>
      merge(
        WALLS.map((w) => {
          const thinX = w.max[0] - w.min[0] < w.max[2] - w.min[2]
          const i = 0.03
          return bx(
            w.min[0] + (thinX ? i : 0),
            w.max[0] - (thinX ? i : 0),
            0,
            PLINTH,
            w.min[2] + (thinX ? 0 : i),
            w.max[2] - (thinX ? 0 : i),
          )
        }),
      ),
    [],
  )
  return (
    <group>
      <mesh
        geometry={shell}
        material={mats.wall}
        castShadow
        receiveShadow
        onClick={stop}
        onPointerOver={stop}
        onPointerMove={stop}
      />
      <mesh geometry={fins} material={mats.wall} />
      <mesh geometry={plinths} material={mats.plinth} castShadow />
    </group>
  )
}

/** Sol en pierre calcaire adoucie, avec un reflet doux de l'architecture. */
function Floor({ mats }: { mats: Materials }) {
  const quality = useGallery((s) => s.quality)
  const ring = useRef<THREE.Mesh>(null!)
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const st = useGallery.getState()
    if (st.phase !== 'visiting' || st.selectedId || e.pointerType !== 'mouse') {
      ring.current.visible = false
      return
    }
    ring.current.visible = true
    ring.current.position.set(e.point.x, 0.012, e.point.z)
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return
    const st = useGallery.getState()
    if (st.phase !== 'visiting' || st.selectedId) return
    controller.walkTo(e.point.x, e.point.z)
  }
  const w = 16.8
  const d = 36.6
  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0, -8.1]}
        receiveShadow
        onClick={onClick}
        onPointerMove={onMove}
        onPointerOut={() => (ring.current.visible = false)}
      >
        <planeGeometry args={[w, d]} />
        {quality === 'low' ? (
          <meshStandardMaterial {...mats.floorMaps} roughness={0.75} normalScale={new THREE.Vector2(0.5, 0.5)} />
        ) : (
          <MeshReflectorMaterial
            {...mats.floorMaps}
            normalScale={new THREE.Vector2(0.45, 0.45)}
            resolution={quality === 'high' ? 1024 : 512}
            blur={[520, 180]}
            mixBlur={1}
            mixStrength={0.34}
            mixContrast={1}
            mirror={0.26}
            depthScale={0.6}
            minDepthThreshold={0.2}
            maxDepthThreshold={1.4}
            roughness={1}
            metalness={0}
            color="#ffffff"
          />
        )}
      </mesh>
      {/* repère discret : point d'arrivée du clic au sol */}
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false} renderOrder={5}>
        <ringGeometry args={[0.17, 0.2, 48]} />
        <meshBasicMaterial color="#1a1814" transparent opacity={0.38} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Verrière zénithale : diffuseur lumineux au-dessus des caissons. */
function Skylight() {
  const w = SKYLIGHT.x1 - SKYLIGHT.x0 + 0.4
  const d = SKYLIGHT.z1 - SKYLIGHT.z0 + 0.4
  return (
    <mesh rotation-x={Math.PI / 2} position={[0, SKYLIGHT.top, (SKYLIGHT.z0 + SKYLIGHT.z1) / 2]}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial color={[2.6, 2.55, 2.45]} toneMapped={false} />
    </mesh>
  )
}

/** Façade vitrée du hall : montants bronze, traverse et grand vitrage. */
function Facade({ mats }: { mats: Materials }) {
  const frame = useMemo(() => {
    const boxes: Box[] = []
    const z0 = 9.96
    const z1 = 10.14
    for (let i = 0; i <= 8; i++) {
      const x = HALL.x0 + i * 1.75
      boxes.push(bx(x - 0.035, x + 0.035, 0, HALL.h, z0, z1))
    }
    boxes.push(bx(HALL.x0, HALL.x1, HALL.h - 0.14, HALL.h, z0, z1))
    boxes.push(bx(HALL.x0, HALL.x1, 0, 0.07, z0, z1))
    boxes.push(bx(HALL.x0, HALL.x1, 3.05, 3.11, z0 + 0.02, z1 - 0.02))
    return merge(boxes, 1)
  }, [])
  const handles = useMemo(() => {
    const boxes: Box[] = []
    for (const x of [-0.16, 0.16]) boxes.push(bx(x - 0.014, x + 0.014, 0.75, 1.75, 9.9, 9.928))
    return merge(boxes, 1)
  }, [])
  return (
    <group>
      <mesh geometry={frame} material={mats.bronze} castShadow />
      <mesh geometry={handles} material={mats.champagne} />
      <mesh position={[0, HALL.h / 2, 10.05]}>
        <planeGeometry args={[HALL.x1 - HALL.x0, HALL.h]} />
        <meshPhysicalMaterial
          color="#e6eef0"
          transparent
          opacity={0.1}
          roughness={0.04}
          metalness={0}
          envMapIntensity={1.4}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/** Spots encastrés du hall et rails d'éclairage de la galerie. */
function CeilingDetails({ mats }: { mats: Materials }) {
  const { discs, trims } = useMemo(() => {
    const ds: THREE.BufferGeometry[] = []
    const ts: THREE.BufferGeometry[] = []
    for (const x of [-4.6, -1.55, 1.55, 4.6])
      for (const z of [5.1, 7.7]) {
        const dsc = new THREE.CircleGeometry(0.045, 24)
        dsc.rotateX(Math.PI / 2)
        dsc.translate(x, HALL.h - 0.004, z)
        ds.push(dsc)
        const tr = new THREE.RingGeometry(0.045, 0.075, 32)
        tr.rotateX(Math.PI / 2)
        tr.translate(x, HALL.h - 0.003, z)
        ts.push(tr)
      }
    return { discs: mergeGeometries(ds)!, trims: mergeGeometries(ts)! }
  }, [])
  const rails = useMemo(
    () =>
      merge(
        [
          bx(-5.32, -5.28, GAL.h - 0.045, GAL.h, -25.2, -1.2),
          bx(5.28, 5.32, GAL.h - 0.045, GAL.h, -25.2, -1.2),
          bx(-5.3, 5.3, GAL.h - 0.045, GAL.h, -23.32, -23.28),
          bx(-6.4, 6.4, HALL.h - 0.045, HALL.h, 2.98, 3.02),
        ],
        1,
      ),
    [],
  )
  return (
    <group>
      <mesh geometry={discs}>
        <meshBasicMaterial color={[3, 2.8, 2.5]} toneMapped={false} />
      </mesh>
      <mesh geometry={trims} material={mats.blackMetal} />
      <mesh geometry={rails} material={mats.blackMetal} />
    </group>
  )
}

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const skyFragment = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uSun;
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, 0.0, 1.0);
    vec3 horizon = vec3(1.25, 1.24, 1.2);
    vec3 zenith = vec3(0.52, 0.72, 1.02);
    vec3 col = mix(horizon, zenith, pow(h, 0.55));
    float s = max(dot(d, uSun), 0.0);
    col += vec3(1.0, 0.93, 0.8) * (pow(s, 900.0) * 30.0 + pow(s, 24.0) * 0.55);
    if (d.y < 0.0) col = vec3(0.86, 0.84, 0.8);
    gl_FragColor = vec4(col, 1.0);
  }
`

/** Extérieur : ciel, parvis minéral et mur de clôture de la cour. */
function Exterior({ mats }: { mats: Materials }) {
  const sun = useMemo(() => new THREE.Vector3(...SUN_DIR).normalize().multiplyScalar(-1), [])
  const court = useMemo(
    () => merge([bx(-24, 24, 0, 3.6, 27, 27.5), bx(-24.5, -24, 0, 3.6, 8, 27.5), bx(24, 24.5, 0, 3.6, 8, 27.5)], 0.5),
    [],
  )
  return (
    <group>
      <mesh>
        <sphereGeometry args={[150, 32, 20]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          vertexShader={skyVertex}
          fragmentShader={skyFragment}
          uniforms={{ uSun: { value: sun } }}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} receiveShadow material={mats.terrace}>
        <planeGeometry args={[130, 150]} />
      </mesh>
      <mesh geometry={court} material={mats.wall} castShadow receiveShadow />
    </group>
  )
}

export function Architecture({ mats }: { mats: Materials }) {
  return (
    <group>
      <Shell mats={mats} />
      <Floor mats={mats} />
      <Skylight />
      <Facade mats={mats} />
      <CeilingDetails mats={mats} />
      <Exterior mats={mats} />
    </group>
  )
}
