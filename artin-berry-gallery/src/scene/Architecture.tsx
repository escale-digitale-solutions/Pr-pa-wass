import { MeshReflectorMaterial } from '@react-three/drei'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGallery } from '../store'
import { controller } from './controller'
import { type Box, HALL, PLINTH, ROOMS, ROT, SHELL_BOXES, SUN_DIR, WALLS, wallColorAt, wallSegments } from './layout'
import type { Materials } from './materials'
import { gradientTexture, marbleTexture } from './textures'

const WHITE = new THREE.Color('#f2efe9')
const WARM = new THREE.Color(1, 0.86, 0.66)
const NORMALS = [[1, 0], [-1, 0], [0, 0], [0, 0], [0, 1], [0, -1]]

/**
 * Boîte dont les UV suivent les dimensions réelles. Avec `tint`, chaque face verticale
 * prend la couleur de la salle qu'elle regarde.
 */
function boxGeometry(box: Box, uvScale = 0.5, tint = false, down?: THREE.Color): THREE.BufferGeometry {
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
    if (f === 3 && down) c = down
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

/** Petit assembleur de quadrilatères (halos de lumière, occlusion des pieds de mur). */
function quads() {
  const pos: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const idx: number[] = []
  return {
    add(p: number[][], uvs: number[][], c: THREE.Color) {
      const o = pos.length / 3
      for (let i = 0; i < 4; i++) {
        pos.push(...p[i])
        uv.push(...uvs[i])
        col.push(c.r, c.g, c.b)
      }
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3)
    },
    build() {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      g.setIndex(idx)
      return g
    },
  }
}

/**
 * Carré qui porte la rotonde, construit face par face : murs vers les salles (à leur couleur),
 * murs vers la rotonde, tableaux et linteaux des quatre portails. Chaque arête est partagée par
 * des faces aux sommets identiques : aucun interstice, aucune face cachée qui affleure.
 */
function squareShell(): THREE.BufferGeometry {
  const a = 6.4
  const i = 5.75
  const d = ROT.door
  const P = PLINTH
  const T = 7.3
  const H = ROT.doorH
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const col: number[] = []
  const idx: number[] = []
  let cs = 1
  let sn = 0
  const face = (p: number[][], c: THREE.Color) => {
    const q = p.map(([x, y, z]) => new THREE.Vector3(x * cs + z * sn, y, -x * sn + z * cs))
    const e1 = q[1].clone().sub(q[0])
    const e2 = q[3].clone().sub(q[0])
    const n = e1.clone().cross(e2).normalize()
    const o = pos.length / 3
    const lu = e1.length() * 0.5
    const lv = e2.length() * 0.5
    const uvs = [[0, 0], [lu, 0], [lu, lv], [0, lv]]
    q.forEach((v, k) => {
      pos.push(v.x, v.y, v.z)
      nor.push(n.x, n.y, n.z)
      uv.push(uvs[k][0], uvs[k][1])
      col.push(c.r, c.g, c.b)
    })
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3)
  }
  // pan vertical à z donné : tourné vers l'extérieur (salle) ou vers l'intérieur (rotonde)
  const pan = (x0: number, x1: number, y0: number, y1: number, z: number, outward: boolean, c: THREE.Color) =>
    face(outward ? [[x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z]] : [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], c)
  for (let k = 0; k < 4; k++) {
    cs = Math.round(Math.cos((k * Math.PI) / 2))
    sn = Math.round(Math.sin((k * Math.PI) / 2))
    const room = new THREE.Color(wallColorAt((-a - 0.3) * sn, (-a - 0.3) * cs) ?? '#f2efe9')
    for (const [z, out, c, e] of [[-a, true, room, a], [-i, false, WHITE, i]] as const) {
      pan(-e, -d, P, H, z, out, c)
      pan(d, e, P, H, z, out, c)
      pan(-e, -d, H, T, z, out, c)
      pan(-d, d, H, T, z, out, c)
      pan(d, e, H, T, z, out, c)
    }
    // tableaux du portail, sous-face du linteau, sous-face des murs au-dessus du joint creux
    face([[-d, P, -i], [-d, P, -a], [-d, H, -a], [-d, H, -i]], WHITE)
    face([[d, P, -a], [d, P, -i], [d, H, -i], [d, H, -a]], WHITE)
    face([[-d, H, -a], [d, H, -a], [d, H, -i], [-d, H, -i]], WHITE)
    face([[-a, P, -a], [-d, P, -a], [-d, P, -i], [-a, P, -i]], WHITE)
    face([[d, P, -a], [a, P, -a], [a, P, -i], [d, P, -i]], WHITE)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

/** Murs colorés, plafonds et joints creux : géométries fusionnées. */
function Shell({ mats }: { mats: Materials }) {
  const shell = useMemo(() => {
    // le hall est une antichambre sombre : son plafond prend la couleur de ses murs
    const hall = new THREE.Color(ROOMS.find((r) => r.id === 'hall')!.color)
    return mergeGeometries([squareShell(), ...SHELL_BOXES.map((b) => boxGeometry(b, 0.5, true, b.min[1] === HALL.h ? hall : undefined))])!
  }, [])
  const plinths = useMemo(
    () =>
      merge(
        WALLS.map((w) => {
          const dx = w.max[0] - w.min[0]
          const dz = w.max[2] - w.min[2]
          const i = 0.03
          const ix = dx <= dz + 0.05 ? i : 0
          const iz = dz <= dx + 0.05 ? i : 0
          return bx(w.min[0] + ix, w.max[0] - ix, 0, PLINTH, w.min[2] + iz, w.max[2] - iz)
        }),
      ),
    [],
  )
  return (
    <group>
      <mesh geometry={shell} material={mats.wall} onClick={stop} onPointerOver={stop} onPointerMove={stop} />
      <mesh geometry={plinths} material={mats.plinth} />
    </group>
  )
}

/**
 * Lumière « peinte » : halo chaud des gorges lumineuses sur le haut des murs et sur le plafond,
 * et légère occlusion au pied des murs. Calculé une fois, sans coût à l'affichage.
 */
function Trims() {
  const { glow, ceil, ao, gradUp } = useMemo(() => {
    const glow = quads()
    const ceil = quads()
    const ao = quads()
    const black = new THREE.Color(0, 0, 0)
    const e = 0.004
    for (const r of ROOMS) {
      const wallGlow = new THREE.Color(r.color).multiply(WARM).multiplyScalar(0.5)
      const ceilGlow = (r.id === 'hall' ? new THREE.Color(r.color) : WHITE.clone()).multiply(WARM).multiplyScalar(r.id === 'hall' ? 0.5 : 0.17)
      for (const s of wallSegments(r, false)) {
        // direction du mur : on retire `e` à chaque extrémité
        const len = Math.hypot(s.bx - s.ax, s.bz - s.az)
        const tx = ((s.bx - s.ax) / len) * e
        const tz = ((s.bz - s.az) / len) * e
        const ax = s.ax + s.nx * e + tx
        const az = s.az + s.nz * e + tz
        const bx2 = s.bx + s.nx * e - tx
        const bz2 = s.bz + s.nz * e - tz
        glow.add([[ax, r.h - 1.15, az], [bx2, r.h - 1.15, bz2], [bx2, r.h - 0.1, bz2], [ax, r.h - 0.1, az]], [[0, 0], [1, 0], [1, 1], [0, 1]], wallGlow)
        const d = 1
        const y = r.h - e
        ceil.add([[ax, y, az], [bx2, y, bz2], [bx2 + s.nx * d, y, bz2 + s.nz * d], [ax + s.nx * d, y, az + s.nz * d]], [[0, 1], [1, 1], [1, 0], [0, 0]], ceilGlow)
      }
      for (const s of wallSegments(r, true)) {
        const ax = s.ax + s.nx * e
        const az = s.az + s.nz * e
        const bx2 = s.bx + s.nx * e
        const bz2 = s.bz + s.nz * e
        ao.add([[ax, PLINTH, az], [bx2, PLINTH, bz2], [bx2, 0.62, bz2], [ax, 0.62, az]], [[0, 1], [1, 1], [1, 0], [0, 0]], black)
      }
    }
    return { glow: glow.build(), ceil: ceil.build(), ao: ao.build(), gradUp: gradientTexture(2.2) }
  }, [])
  return (
    <group>
      <mesh geometry={glow} renderOrder={1}>
        <meshBasicMaterial map={gradUp} vertexColors blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={ceil} renderOrder={1}>
        <meshBasicMaterial map={gradUp} vertexColors blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={ao} renderOrder={1}>
        <meshBasicMaterial color="#000000" alphaMap={gradUp} transparent opacity={0.17} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** Rotonde : mur courbe, plafond annulaire, oculus lumineux, gorge de lumière et cercle de laiton au sol. */
function Rotunda({ mats }: { mats: Materials }) {
  const { inner, flat, gradUp, gradDown, ceilGlow } = useMemo(() => {
    const flat = mats.wall.clone()
    flat.vertexColors = false
    flat.color.set('#f4f3f0')
    const inner = flat.clone()
    inner.side = THREE.BackSide
    // halo de la gorge sur le plafond : anneau dont le dégradé suit le rayon
    const ring = new THREE.RingGeometry(4.85, ROT.r - 0.03, 96, 1)
    const p = ring.attributes.position
    const uv = ring.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5, (Math.hypot(p.getX(i), p.getY(i)) - 4.85) / (ROT.r - 0.03 - 4.85))
    return { inner, flat, gradUp: gradientTexture(2.2), gradDown: gradientTexture(2.2, true), ceilGlow: ring }
  }, [mats])
  const m = 0.27 // les arcs s'arrêtent dans l'épaisseur des portails
  const arcs = [0, 1, 2, 3].map((k) => [(k * Math.PI) / 2 + m, Math.PI / 2 - 2 * m] as const)
  const glowColor = useMemo(() => new THREE.Color(1, 0.93, 0.82).multiplyScalar(0.2), [])
  return (
    <group>
      {arcs.map(([start, len], k) => (
        <group key={k}>
          <mesh position-y={ROT.h / 2} material={inner} onClick={stop} onPointerOver={stop} onPointerMove={stop}>
            <cylinderGeometry args={[ROT.r, ROT.r, ROT.h, 32, 1, true, start, len]} />
          </mesh>
          {/* occlusion douce au pied du mur courbe */}
          <mesh position-y={0.3} renderOrder={1}>
            <cylinderGeometry args={[ROT.r - 0.006, ROT.r - 0.006, 0.6, 32, 1, true, start, len]} />
            <meshBasicMaterial color="#000000" alphaMap={gradDown} transparent opacity={0.13} depthWrite={false} side={THREE.BackSide} />
          </mesh>
        </group>
      ))}
      <mesh rotation-x={Math.PI / 2} position-y={ROT.h} material={flat}>
        <ringGeometry args={[3, 6.4, 96]} />
      </mesh>
      <mesh position-y={ROT.h + 0.16} material={inner}>
        <cylinderGeometry args={[3, 3, 0.32, 96, 1, true]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={ROT.h + 0.3}>
        <circleGeometry args={[3.02, 96]} />
        <meshBasicMaterial color={[2.7, 2.62, 2.5]} toneMapped={false} />
      </mesh>
      {/* gorge lumineuse et son halo sur le mur et le plafond */}
      <mesh rotation-x={Math.PI / 2} position-y={ROT.h - 0.12}>
        <torusGeometry args={[ROT.r - 0.07, 0.028, 8, 160]} />
        <meshBasicMaterial color={[3.4, 2.6, 1.7]} toneMapped={false} />
      </mesh>
      <mesh position-y={ROT.h - 0.7} renderOrder={1}>
        <cylinderGeometry args={[ROT.r - 0.006, ROT.r - 0.006, 1.1, 96, 1, true]} />
        <meshBasicMaterial map={gradUp} color={glowColor} blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} side={THREE.BackSide} />
      </mesh>
      <mesh geometry={ceilGlow} rotation-x={Math.PI / 2} position-y={ROT.h - 0.005} renderOrder={1}>
        <meshBasicMaterial map={gradUp} color={glowColor} blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* cercle de laiton incrusté dans le marbre, à l'aplomb de l'oculus */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.003} material={mats.champagne} renderOrder={2}>
        <ringGeometry args={[2.96, 3, 128]} />
      </mesh>
    </group>
  )
}

/**
 * Le matériau réfléchissant de drei multiplie le reflet par la couleur du sol : sur un marbre noir,
 * seules les veines réfléchiraient. On ajoute donc le reflet par-dessus, dosé par l'angle de vue
 * (effet Fresnel) comme sur une pierre polie.
 */
function polishedStone(mat: THREE.Material | null) {
  const m = mat as (THREE.Material & { __polished?: boolean }) | null
  if (!m || m.__polished) return
  m.__polished = true
  const base = m.onBeforeCompile.bind(m)
  m.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer)
    shader.fragmentShader = shader.fragmentShader.replace(
      'diffuseColor.rgb = diffuseColor.rgb * ((1.0 - min(1.0, mirror)) + newMerge.rgb * mixStrength);',
      `float nvPolish = saturate(dot(normalize(vViewPosition), normal));
      totalEmissiveRadiance += newMerge.rgb * mixStrength * mix(0.08, 1.0, pow(1.0 - nvPolish, 3.2));`,
    )
  }
  m.customProgramCacheKey = () => 'polished-stone'
  m.needsUpdate = true
}

/** Sol en marbre noir veiné, poli, avec reflets de l'architecture et des œuvres. */
function Floor() {
  const quality = useGallery((s) => s.quality)
  const gl = useThree((s) => s.gl)
  const marble = useMemo(() => {
    const t = marbleTexture(useGallery.getState().isTouch ? 512 : 2048)
    t.repeat.set(28.8 / 4.2, 26.6 / 4.2)
    t.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy())
    return t
  }, [gl])
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
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -1.1]} onClick={onClick} onPointerMove={onMove} onPointerOut={() => (ring.current.visible = false)}>
        <planeGeometry args={[28.8, 26.6]} />
        {quality === 'low' ? (
          <meshStandardMaterial map={marble} roughness={0.2} metalness={0} envMapIntensity={0.8} />
        ) : (
          <MeshReflectorMaterial
            ref={polishedStone}
            map={marble}
            resolution={1024}
            blur={[700, 300]}
            mixBlur={1}
            mixStrength={0.52}
            mixContrast={1}
            mirror={0}
            depthScale={0}
            roughness={1}
            metalness={0}
            color="#ffffff"
          />
        )}
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false} renderOrder={5}>
        <ringGeometry args={[0.17, 0.2, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** Tache de soleil au sol du hall : les vitrages de la façade projetés selon la direction du soleil. */
function SunPatch() {
  const tex = useMemo(() => {
    const PX = 100 // pixels par mètre ; la texture couvre x ∈ [-5, 5], z ∈ [5, 12]
    const c = document.createElement('canvas')
    c.width = 1000
    c.height = 700
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, c.width, c.height)
    const kx = SUN_DIR[0] / -SUN_DIR[1]
    const kz = SUN_DIR[2] / -SUN_DIR[1]
    const P = (x: number, y: number): [number, number] => [(x + kx * y + 5) * PX, (HALL.z1 + kz * y - 5) * PX]
    ctx.fillStyle = '#fff'
    ctx.shadowColor = '#fff'
    ctx.shadowBlur = 9
    const step = (HALL.x1 - HALL.x0) / 6
    for (let i = 0; i < 6; i++)
      for (const [y0, y1] of [[0.07, 3.02], [3.08, HALL.h - 0.14]]) {
        const x0 = HALL.x0 + i * step + 0.035
        const x1 = HALL.x0 + (i + 1) * step - 0.035
        ctx.beginPath()
        ;[P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)].forEach(([u, v], k) => (k ? ctx.lineTo(u, v) : ctx.moveTo(u, v)))
        ctx.closePath()
        ctx.fill()
      }
    // au nord du hall, le soleil ne passe que par le portail de la rotonde
    ctx.shadowBlur = 0
    ctx.fillStyle = '#000'
    const v = (HALL.z0 - 5) * PX
    ctx.fillRect(0, 0, (5 - ROT.door) * PX + 4, v)
    ctx.fillRect((5 + ROT.door) * PX - 4, 0, c.width, v)
    return new THREE.CanvasTexture(c)
  }, [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 8.5]} renderOrder={3}>
      <planeGeometry args={[10, 7]} />
      <meshBasicMaterial map={tex} color={[0.13, 0.11, 0.08]} blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
    </mesh>
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
      <mesh geometry={frame} material={mats.bronze} />
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
    vec3 col = mix(vec3(1.0, 0.99, 0.96), vec3(0.42, 0.62, 0.92), pow(h, 0.55));
    float s = max(dot(d, uSun), 0.0);
    col += vec3(1.0, 0.93, 0.8) * (pow(s, 900.0) * 30.0 + pow(s, 24.0) * 0.55);
    if (d.y < 0.0) col = vec3(0.86, 0.84, 0.8);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
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
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} material={mats.terrace}>
        <planeGeometry args={[130, 150]} />
      </mesh>
      <mesh geometry={court} material={mats.wall} />
    </group>
  )
}

export function Architecture({ mats }: { mats: Materials }) {
  return (
    <group>
      <Shell mats={mats} />
      <Trims />
      <Rotunda mats={mats} />
      <Floor />
      <SunPatch />
      <Facade mats={mats} />
      <CeilingDetails mats={mats} />
      <Exterior mats={mats} />
    </group>
  )
}
