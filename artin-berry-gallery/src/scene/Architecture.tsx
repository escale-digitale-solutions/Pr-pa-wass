import { MeshReflectorMaterial } from '@react-three/drei'
import { type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGallery } from '../store'
import { controller } from './controller'
import { type Box, HALL, PLINTH, ROOMS, ROT, SUN_DIR, UPPER, WALLS, wallColorAt } from './layout'
import type { Materials } from './materials'

const WHITE = new THREE.Color('#f2efe9')
const NORMALS = [[1, 0], [-1, 0], [0, 0], [0, 0], [0, 1], [0, -1]]

/**
 * Boîte dont les UV suivent les dimensions réelles. Avec `tint`, chaque face verticale
 * prend la couleur de la salle qu'elle regarde.
 */
function boxGeometry(box: Box, uvScale = 0.5, tint = false): THREE.BufferGeometry {
  const w = box.max[0] - box.min[0]
  const h = box.max[1] - box.min[1]
  const d = box.max[2] - box.min[2]
  const cx = (box.min[0] + box.max[0]) / 2
  const cz = (box.min[2] + box.max[2]) / 2
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const su = [d, d, w, w, w, w]
  const sv = [h, h, d, d, h, h]
  const col = new Float32Array(72)
  for (let f = 0; f < 6; f++) {
    let c = WHITE
    if (tint && f !== 2 && f !== 3) {
      const hex = wallColorAt(cx + NORMALS[f][0] * (w / 2 + 0.3), cz + NORMALS[f][1] * (d / 2 + 0.3))
      if (hex) c = new THREE.Color(hex)
    }
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i
      uv.setXY(k, uv.getX(k) * su[f] * uvScale, uv.getY(k) * sv[f] * uvScale)
      col.set([c.r, c.g, c.b], k * 3)
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.translate(cx, (box.min[1] + box.max[1]) / 2, cz)
  return g
}
const merge = (boxes: Box[], uvScale = 0.5, tint = false) => mergeGeometries(boxes.map((bx) => boxGeometry(bx, uvScale, tint)))!
const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({ min: [x0, y0, z0], max: [x1, y1, z1] })
const stop = (e: ThreeEvent<Event>) => e.stopPropagation()

/** Murs colorés, plafonds et joints creux : géométries fusionnées. */
function Shell({ mats }: { mats: Materials }) {
  const shell = useMemo(() => merge([...WALLS, ...UPPER], 0.5, true), [])
  const plinths = useMemo(
    () =>
      merge(
        WALLS.map((w) => {
          const thinX = w.max[0] - w.min[0] < w.max[2] - w.min[2]
          const i = 0.03
          return bx(w.min[0] + (thinX ? i : 0), w.max[0] - (thinX ? i : 0), 0, PLINTH, w.min[2] + (thinX ? 0 : i), w.max[2] - (thinX ? 0 : i))
        }),
      ),
    [],
  )
  return (
    <group>
      <mesh geometry={shell} material={mats.wall} castShadow receiveShadow onClick={stop} onPointerOver={stop} onPointerMove={stop} />
      <mesh geometry={plinths} material={mats.plinth} castShadow />
    </group>
  )
}

/** Rotonde : mur courbe, plafond annulaire, oculus lumineux et gorge de lumière. */
function Rotunda({ mats }: { mats: Materials }) {
  const { inner, flat } = useMemo(() => {
    const flat = mats.wall.clone()
    flat.vertexColors = false
    flat.color.set('#f2efe9')
    const inner = flat.clone()
    inner.side = THREE.BackSide
    return { inner, flat }
  }, [mats])
  const m = 0.27 // les arcs s'arrêtent dans l'épaisseur des portails
  return (
    <group>
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position-y={ROT.h / 2} material={inner} receiveShadow onClick={stop} onPointerOver={stop} onPointerMove={stop}>
          <cylinderGeometry args={[ROT.r, ROT.r, ROT.h, 28, 1, true, (k * Math.PI) / 2 + m, Math.PI / 2 - 2 * m]} />
        </mesh>
      ))}
      <mesh rotation-x={Math.PI / 2} position-y={ROT.h} material={flat}>
        <ringGeometry args={[3, 6.4, 72]} />
      </mesh>
      <mesh position-y={ROT.h + 0.16} material={inner}>
        <cylinderGeometry args={[3, 3, 0.32, 72, 1, true]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={ROT.h + 0.3}>
        <circleGeometry args={[3.02, 72]} />
        <meshBasicMaterial color={[2.7, 2.62, 2.5]} toneMapped={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={ROT.h - 0.12}>
        <torusGeometry args={[ROT.r - 0.07, 0.028, 8, 120]} />
        <meshBasicMaterial color={[3.4, 2.6, 1.7]} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Sol en marbre sombre poli, avec reflets de l'architecture et des œuvres. */
function Floor({ mats }: { mats: Materials }) {
  const quality = useGallery((s) => s.quality)
  const ring = useRef<THREE.Mesh>(null!)
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const st = useGallery.getState()
    ring.current.visible = st.phase === 'visiting' && !st.selectedId && e.pointerType === 'mouse'
    ring.current.position.set(e.point.x, 0.012, e.point.z)
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return
    const st = useGallery.getState()
    if (st.phase !== 'visiting' || st.selectedId) return
    controller.walkTo(e.point.x, e.point.z)
  }
  const tone = '#5e5955'
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -1.1]} receiveShadow onClick={onClick} onPointerMove={onMove} onPointerOut={() => (ring.current.visible = false)}>
        <planeGeometry args={[28.8, 26.6]} />
        {quality === 'low' ? (
          <meshStandardMaterial {...mats.floorMaps} color={tone} roughness={0.5} normalScale={new THREE.Vector2(0.3, 0.3)} />
        ) : (
          <MeshReflectorMaterial
            {...mats.floorMaps}
            normalScale={new THREE.Vector2(0.25, 0.25)}
            resolution={quality === 'high' ? 1024 : 512}
            blur={[260, 80]}
            mixBlur={0.85}
            mixStrength={3.4}
            mixContrast={1}
            mirror={0.62}
            depthScale={0.5}
            minDepthThreshold={0.2}
            maxDepthThreshold={1.4}
            roughness={0.7}
            metalness={0}
            color={tone}
          />
        )}
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false} renderOrder={5}>
        <ringGeometry args={[0.17, 0.2, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Façade vitrée du hall. */
function Facade({ mats }: { mats: Materials }) {
  const z = HALL.z1
  const frame = useMemo(() => {
    const boxes: Box[] = []
    const step = (HALL.x1 - HALL.x0) / 6
    for (let i = 0; i <= 6; i++) {
      const x = HALL.x0 + i * step
      boxes.push(bx(x - 0.035, x + 0.035, 0, HALL.h, z - 0.04, z + 0.14))
    }
    boxes.push(bx(HALL.x0, HALL.x1, HALL.h - 0.14, HALL.h, z - 0.04, z + 0.14))
    boxes.push(bx(HALL.x0, HALL.x1, 0, 0.07, z - 0.04, z + 0.14))
    boxes.push(bx(HALL.x0, HALL.x1, 3.02, 3.08, z - 0.02, z + 0.12))
    return merge(boxes, 1)
  }, [z])
  return (
    <group>
      <mesh geometry={frame} material={mats.bronze} castShadow />
      <mesh position={[0, HALL.h / 2, z + 0.05]}>
        <planeGeometry args={[HALL.x1 - HALL.x0, HALL.h]} />
        <meshPhysicalMaterial color="#e6eef0" transparent opacity={0.1} roughness={0.04} envMapIntensity={1.4} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Gorges lumineuses en haut des murs et rails de projecteurs. */
function CeilingDetails({ mats }: { mats: Materials }) {
  const coves = useMemo(
    () =>
      merge(
        ROOMS.flatMap((r) => {
          const y0 = r.h - 0.1
          const y1 = r.h - 0.06
          const i = 0.05
          const t = 0.035
          return [
            bx(r.x0 + i, r.x1 - i, y0, y1, r.z0 + i, r.z0 + i + t),
            bx(r.x0 + i, r.x1 - i, y0, y1, r.z1 - i - t, r.z1 - i),
            bx(r.x0 + i, r.x0 + i + t, y0, y1, r.z0 + i, r.z1 - i),
            bx(r.x1 - i - t, r.x1 - i, y0, y1, r.z0 + i, r.z1 - i),
          ]
        }),
      ),
    [],
  )
  const rails = useMemo(
    () =>
      merge(
        ROOMS.flatMap((r) => {
          const y0 = r.h - 0.045
          const i = r.id === 'hall' ? 2.4 : 2.2
          const t = 0.02
          if (r.id === 'hall') return [bx(r.x0 + 0.4, r.x1 - 0.4, y0, r.h, r.z0 + i - t, r.z0 + i + t)]
          return [
            bx(r.x0 + i, r.x1 - i, y0, r.h, r.z0 + i - t, r.z0 + i + t),
            bx(r.x0 + i, r.x1 - i, y0, r.h, r.z1 - i - t, r.z1 - i + t),
            bx(r.x0 + i - t, r.x0 + i + t, y0, r.h, r.z0 + i, r.z1 - i),
            bx(r.x1 - i - t, r.x1 - i + t, y0, r.h, r.z0 + i, r.z1 - i),
          ]
        }),
        1,
      ),
    [],
  )
  return (
    <group>
      <mesh geometry={coves}>
        <meshBasicMaterial color={[3.4, 2.6, 1.7]} toneMapped={false} />
      </mesh>
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
    vec3 col = mix(vec3(1.25, 1.24, 1.2), vec3(0.52, 0.72, 1.02), pow(h, 0.55));
    float s = max(dot(d, uSun), 0.0);
    col += vec3(1.0, 0.93, 0.8) * (pow(s, 900.0) * 30.0 + pow(s, 24.0) * 0.55);
    if (d.y < 0.0) col = vec3(0.86, 0.84, 0.8);
    gl_FragColor = vec4(col, 1.0);
  }
`

/** Extérieur : ciel, parvis minéral et mur de clôture. */
function Exterior({ mats }: { mats: Materials }) {
  const sun = useMemo(() => new THREE.Vector3(...SUN_DIR).normalize().multiplyScalar(-1), [])
  const court = useMemo(() => merge([bx(-24, 24, 0, 3.6, 30, 30.5), bx(-24.5, -24, 0, 3.6, 10, 30.5), bx(24, 24.5, 0, 3.6, 10, 30.5)]), [])
  return (
    <group>
      <mesh>
        <sphereGeometry args={[150, 32, 20]} />
        <shaderMaterial side={THREE.BackSide} depthWrite={false} vertexShader={skyVertex} fragmentShader={skyFragment} uniforms={{ uSun: { value: sun } }} toneMapped={false} />
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
      <Rotunda mats={mats} />
      <Floor mats={mats} />
      <Facade mats={mats} />
      <CeilingDetails mats={mats} />
      <Exterior mats={mats} />
    </group>
  )
}
