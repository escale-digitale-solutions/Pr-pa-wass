import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { ARTWORKS, POSES, byId } from '../data/artworks'
import { joystick, lookStick, useGallery } from '../store'
import { controller } from './controller'
import { EYE } from './layout'
import { type P2, PLAYER_R, findPath, pathLength, resolve } from './nav'

interface Travel {
  pts: P2[]
  yaw?: number
  pitch?: number
  speed: number
  cur: number
  faceTravel: boolean
  userCancellable: boolean
  onDone?: () => void
}

const START = { x: 0, z: 8.7, yaw: 0, pitch: 0.04 }
const LANDING = { x: 3.9, z: 9.0, yaw: 0.5, pitch: 0.075 }
const LANDING_NARROW = { x: 0, z: 9.2, yaw: 0, pitch: 0.07 }

const damp = THREE.MathUtils.damp
const clamp = THREE.MathUtils.clamp
/** angle équivalent à `a`, le plus proche de `ref` */
const near = (a: number, ref: number) => a + Math.round((ref - a) / (Math.PI * 2)) * Math.PI * 2

/** Zone de l'écran laissée libre par la fiche descriptive. */
function freeArea() {
  const W = window.innerWidth
  const H = window.innerHeight
  if (W >= 860) {
    const panel = Math.min(500, W * 0.4)
    return { w: W - panel, h: H, offX: panel / 2, offY: 0 }
  }
  const sheet = H * 0.5
  return { w: W, h: H - sheet, offX: 0, offY: sheet / 2 }
}

/**
 * Contrôleur de visite à la première personne :
 * regard à la souris / au doigt, ZQSD-WASD-flèches, clic au sol, collisions,
 * et déplacements de caméra automatiques vers les œuvres.
 */
export function Player() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const s = useRef({
    x: LANDING.x,
    z: LANDING.z,
    yaw: LANDING.yaw,
    pitch: LANDING.pitch,
    yawT: LANDING.yaw,
    pitchT: LANDING.pitch,
    vx: 0,
    vz: 0,
    wheel: 0,
    keys: new Set<string>(),
    dragging: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
    travel: null as Travel | null,
    offX: 0,
    offY: 0,
    offXT: 0,
    offYT: 0,
    lookRate: 16,
    nearTimer: 0,
    t: 0,
  }).current

  // champ de vision : plus large sur les écrans verticaux
  useEffect(() => {
    camera.fov = size.width / size.height < 0.8 ? 74 : size.width / size.height < 1.2 ? 66 : 58
    camera.updateProjectionMatrix()
  }, [camera, size])

  useEffect(() => {
    const locked = () => {
      const st = useGallery.getState()
      return st.phase !== 'visiting' || !!st.selectedId || st.menuOpen || st.helpOpen
    }

    const startTravel = (goal: P2, opts: Partial<Travel> = {}) => {
      const path = findPath({ x: s.x, z: s.z }, goal)
      if (!path) return null
      const len = pathLength({ x: s.x, z: s.z }, path)
      s.travel = {
        pts: path,
        speed: clamp(len * 0.85, 2.4, 6.5),
        cur: 0,
        faceTravel: path.length > 1,
        userCancellable: true,
        ...opts,
      }
      return len
    }

    // outil de mise au point (?debug) : place la caméra pour des captures de contrôle
    if (new URLSearchParams(window.location.search).has('debug')) {
      ;(window as unknown as Record<string, unknown>).__ab = {
        pose: (x: number, z: number, yaw = 0, pitch = 0) => {
          s.travel = null
          s.x = x
          s.z = z
          s.yaw = s.yawT = yaw
          s.pitch = s.pitchT = pitch
        },
        state: s,
      }
    }

    controller.walkTo = (x, z) => {
      if (locked()) return
      startTravel({ x, z })
    }

    const focus = (id: string) => {
      const a = byId(id)
      if (!a) return
      const p = POSES[id]
      const area = freeArea()
      const W = window.innerWidth
      const H = window.innerHeight
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const fit = 0.78
      const dV = a.display.height / (2 * tan * fit * (area.h / H))
      const dH = a.display.width / (2 * tan * camera.aspect * fit * (area.w / W))
      const d = clamp(Math.max(dV, dH, 1.9), 1.9, 7)
      const goal = { x: p.x + p.nx * d, z: p.z + p.nz * d }
      resolve(goal, PLAYER_R + 0.02)
      const yaw = Math.atan2(p.nx, p.nz)
      const pitch = Math.atan2(p.y - EYE, d)
      s.offXT = area.offX
      s.offYT = area.offY
      const path = findPath({ x: s.x, z: s.z }, goal)
      const len = path ? pathLength({ x: s.x, z: s.z }, path) : Infinity
      if (path && len < 24) {
        s.travel = {
          pts: path,
          yaw,
          pitch,
          speed: clamp(len * 0.85, 2.2, 6.5),
          cur: 0,
          faceTravel: path.length > 1,
          userCancellable: false,
        }
        s.lookRate = 3.2
      } else {
        // trajet trop long : transition en fondu
        const st = useGallery.getState()
        st.setVeil(true)
        window.setTimeout(() => {
          s.travel = null
          s.x = goal.x
          s.z = goal.z
          s.yaw = s.yawT = near(yaw, 0)
          s.pitch = s.pitchT = pitch
          s.offX = s.offXT
          s.offY = s.offYT
          useGallery.getState().setVeil(false)
        }, 450)
      }
    }

    const unsub = useGallery.subscribe((st, prev) => {
      if (st.selectedId && st.selectedId !== prev.selectedId) focus(st.selectedId)
      if (!st.selectedId && prev.selectedId) {
        s.offXT = 0
        s.offYT = 0
        s.pitchT = clamp(s.pitchT, -0.2, 0.2)
        s.lookRate = 5
      }
      if (st.phase !== prev.phase) {
        s.keys.clear()
        if (st.phase === 'visiting') {
          s.travel = {
            pts: [{ x: START.x, z: START.z }],
            yaw: START.yaw,
            pitch: START.pitch,
            speed: 1.7,
            cur: 0,
            faceTravel: false,
            userCancellable: false,
          }
          s.lookRate = 2
          s.offXT = 0
          s.offYT = 0
        } else {
          st.setVeil(true)
          window.setTimeout(() => {
            s.travel = null
            const pose = window.innerWidth >= 860 ? LANDING : LANDING_NARROW
            s.x = pose.x
            s.z = pose.z
            s.yaw = s.yawT = pose.yaw
            s.pitch = s.pitchT = pose.pitch
            useGallery.getState().setVeil(false)
          }, 450)
        }
      }
    })

    // --- clavier ---
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const st = useGallery.getState()
      if (e.code === 'Escape') {
        if (st.lightbox) st.setLightbox(false)
        else if (st.selectedId) st.select(null)
        else if (st.menuOpen) st.setMenu(false)
        else if (st.helpOpen) st.setHelp(false)
        return
      }
      if (locked()) return
      if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') && st.nearId) {
        e.preventDefault()
        st.select(st.nearId)
        return
      }
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
      s.keys.add(e.code)
      if (!st.hintShown && /^(Key[WASD]|Arrow)/.test(e.code)) st.dismissHint()
    }
    const onKeyUp = (e: KeyboardEvent) => s.keys.delete(e.code)
    const onBlur = () => {
      s.keys.clear()
      s.dragging = false
    }

    // --- regard : cliquer-glisser (souris) ou glisser (tactile) ---
    const el = gl.domElement
    const onDown = (e: PointerEvent) => {
      if (locked() || s.dragging) return
      s.dragging = true
      s.pointerId = e.pointerId
      s.lastX = e.clientX
      s.lastY = e.clientY
    }
    const onMove = (e: PointerEvent) => {
      if (!s.dragging || e.pointerId !== s.pointerId) return
      const dx = e.clientX - s.lastX
      const dy = e.clientY - s.lastY
      s.lastX = e.clientX
      s.lastY = e.clientY
      const k = (e.pointerType === 'touch' ? 0.0046 : 0.0031) * (camera.fov / 58)
      // le regard suit le geste : glisser vers la droite = regarder à droite, vers le haut = regarder en haut
      s.yawT -= dx * k
      s.pitchT = clamp(s.pitchT - dy * k, -1.05, 1.05)
      s.lookRate = 16
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        el.style.cursor = 'grabbing'
        const st = useGallery.getState()
        if (!st.hintShown) st.dismissHint()
      }
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== s.pointerId) return
      s.dragging = false
      if (el.style.cursor === 'grabbing') el.style.cursor = ''
    }
    const onWheel = (e: WheelEvent) => {
      if (locked()) return
      s.wheel = clamp(s.wheel - e.deltaY * 0.004, -3.2, 3.2)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      unsub()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [camera, gl, s])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const st = useGallery.getState()
    s.t += dt
    const visiting = st.phase === 'visiting'
    const locked = !visiting || !!st.selectedId || st.menuOpen || st.helpOpen

    if (!visiting && !st.veil) {
      // écran d'accueil : lent mouvement de caméra dans le hall
      // écran large : vue oblique sur le mur-logo et le portail ; écran étroit : vue dans l'axe
      const pose = state.size.width >= 860 ? LANDING : LANDING_NARROW
      const tx = pose.x + Math.sin(s.t * 0.11) * 0.45
      const tz = pose.z - (1 - Math.cos(s.t * 0.08)) * 0.4
      s.x = damp(s.x, tx, 1.2, dt)
      s.z = damp(s.z, tz, 1.2, dt)
      s.yawT = pose.yaw + Math.sin(s.t * 0.11) * 0.035
      s.pitchT = pose.pitch
      s.lookRate = 1.5
      const W = state.size.width
      if (W >= 860) {
        s.offXT = -(Math.min(480, W * 0.42) + 28) / 2
        s.offYT = 0
      } else {
        s.offXT = 0
        s.offYT = state.size.height * 0.2
      }
    }

    const tr = s.travel
    if (tr) {
      const k = s.keys
      const moving = k.has('KeyW') || k.has('KeyS') || k.has('KeyA') || k.has('KeyD') || k.has('ArrowUp') || k.has('ArrowDown')
      if (tr.userCancellable && (moving || Math.abs(joystick.x) + Math.abs(joystick.y) > 0.15)) {
        s.travel = null
      } else {
        const target = tr.pts[0]
        const dx = target.x - s.x
        const dz = target.z - s.z
        const dist = Math.hypot(dx, dz)
        let remaining = dist
        for (let i = 0; i < tr.pts.length - 1; i++)
          remaining += Math.hypot(tr.pts[i + 1].x - tr.pts[i].x, tr.pts[i + 1].z - tr.pts[i].z)
        const desired = Math.min(tr.speed, 0.25 + remaining * 1.7)
        tr.cur = damp(tr.cur, desired, desired > tr.cur ? 3.2 : 9, dt)
        const step = Math.min(dist, tr.cur * dt)
        if (dist > 1e-5) {
          s.x += (dx / dist) * step
          s.z += (dz / dist) * step
        }
        const last = tr.pts.length <= 1
        if (tr.yaw !== undefined && (last || !tr.faceTravel)) s.yawT = near(tr.yaw, s.yawT)
        else if (tr.faceTravel && dist > 0.4) {
          s.yawT = near(Math.atan2(-dx, -dz), s.yawT)
          s.lookRate = 3
        }
        if (tr.pitch !== undefined && last) s.pitchT = tr.pitch
        else if (tr.faceTravel) s.pitchT = damp(s.pitchT, 0, 2, dt)
        if (dist - step < 0.03) {
          tr.pts.shift()
          if (!tr.pts.length) {
            s.travel = null
            tr.onDone?.()
          }
        }
      }
    } else if (!locked) {
      const k = s.keys
      let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0)
      let r = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0)
      f += -joystick.y
      r += joystick.x
      const turn = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0)
      if (turn) {
        s.yawT += turn * 1.45 * dt
        s.lookRate = 10
      }
      // manette du regard : utilisable en même temps que la manette de déplacement
      if (Math.abs(lookStick.x) + Math.abs(lookStick.y) > 0.05) {
        const ease = (v: number) => Math.sign(v) * v * v
        s.yawT -= ease(lookStick.x) * 2.1 * dt
        s.pitchT = clamp(s.pitchT - ease(lookStick.y) * 1.3 * dt, -1.05, 1.05)
        s.lookRate = 12
      }
      const mag = Math.hypot(f, r)
      if (mag > 1) {
        f /= mag
        r /= mag
      }
      const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? 4.4 : 2.5
      const sin = Math.sin(s.yaw)
      const cos = Math.cos(s.yaw)
      const fwd = f * speed + s.wheel
      const tvx = -sin * fwd + cos * r * speed
      const tvz = -cos * fwd - sin * r * speed
      s.vx = damp(s.vx, tvx, 9, dt)
      s.vz = damp(s.vz, tvz, 9, dt)
      s.wheel = damp(s.wheel, 0, 4.5, dt)
      if (Math.abs(s.vx) + Math.abs(s.vz) > 1e-4) {
        const p = { x: s.x + s.vx * dt, z: s.z + s.vz * dt }
        resolve(p)
        s.x = p.x
        s.z = p.z
      }
    } else {
      s.vx = s.vz = s.wheel = 0
    }

    s.yaw = damp(s.yaw, s.yawT, s.lookRate, dt)
    s.pitch = damp(s.pitch, s.pitchT, Math.min(s.lookRate, 12), dt)
    camera.position.set(s.x, EYE, s.z)
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ')

    // recentrage de l'image dans la zone laissée libre par la fiche
    s.offX = damp(s.offX, s.offXT, 3.4, dt)
    s.offY = damp(s.offY, s.offYT, 3.4, dt)
    if (Math.abs(s.offX) > 0.5 || Math.abs(s.offY) > 0.5) {
      const W = state.size.width
      const H = state.size.height
      camera.setViewOffset(W, H, s.offX, s.offY, W, H)
    } else if (camera.view) {
      camera.clearViewOffset()
    }

    // œuvre la plus proche dans l'axe du regard (légende + touche Entrée)
    s.nearTimer -= dt
    if (s.nearTimer <= 0) {
      s.nearTimer = 0.18
      let best: string | null = null
      if (visiting && !st.selectedId) {
        const fx = -Math.sin(s.yaw)
        const fz = -Math.cos(s.yaw)
        let bestScore = 0
        for (const a of ARTWORKS) {
          const p = POSES[a.id]
          const dx = p.x - s.x
          const dz = p.z - s.z
          const d = Math.hypot(dx, dz)
          if (d > 5.2 || d < 0.2) continue
          if (-(dx * p.nx + dz * p.nz) < 0.5) continue
          const dot = (dx * fx + dz * fz) / d
          if (dot < 0.8) continue
          const score = dot - d * 0.03
          if (score > bestScore) {
            bestScore = score
            best = a.id
          }
        }
      }
      st.setNear(best)
    }
  })

  return null
}
