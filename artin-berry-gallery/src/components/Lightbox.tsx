import { useEffect, useRef } from 'react'
import { asset, byId } from '../data/artworks'
import { useGallery } from '../store'
import { CloseIcon } from './Help'

/** Visionneuse plein écran : image originale, zoom à la molette / au pincement, déplacement au glisser. */
export function Lightbox() {
  const open = useGallery((s) => s.lightbox)
  const selectedId = useGallery((s) => s.selectedId)
  const setLightbox = useGallery((s) => s.setLightbox)
  const a = byId(selectedId)
  const stage = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const view = useRef({ scale: 1, x: 0, y: 0 })

  const apply = () => {
    const v = view.current
    const el = img.current
    const st = stage.current
    if (!el || !st) return
    const maxX = Math.max(0, (el.offsetWidth * v.scale - st.clientWidth) / 2 + 40)
    const maxY = Math.max(0, (el.offsetHeight * v.scale - st.clientHeight) / 2 + 40)
    v.x = Math.min(maxX, Math.max(-maxX, v.x))
    v.y = Math.min(maxY, Math.max(-maxY, v.y))
    el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale})`
    st.style.cursor = v.scale > 1.01 ? 'grab' : 'zoom-in'
  }
  const zoomBy = (factor: number, cx = 0, cy = 0) => {
    const v = view.current
    const next = Math.min(6, Math.max(1, v.scale * factor))
    const k = next / v.scale
    v.x = cx - (cx - v.x) * k
    v.y = cy - (cy - v.y) * k
    v.scale = next
    if (next === 1) v.x = v.y = 0
    apply()
  }

  useEffect(() => {
    view.current = { scale: 1, x: 0, y: 0 }
    apply()
  }, [open, selectedId])

  useEffect(() => {
    const st = stage.current
    if (!st || !open) return
    const pts = new Map<number, { x: number; y: number }>()
    let moved = 0
    let pinch = 0
    const centre = (e: { clientX: number; clientY: number }) => {
      const r = st.getBoundingClientRect()
      return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2] as const
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const [cx, cy] = centre(e)
      zoomBy(Math.exp(-e.deltaY * 0.0016), cx, cy)
    }
    const down = (e: PointerEvent) => {
      st.setPointerCapture(e.pointerId)
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      moved = 0
      if (pts.size === 2) {
        const [p, q] = [...pts.values()]
        pinch = Math.hypot(p.x - q.x, p.y - q.y)
      }
    }
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId)
      if (!prev) return
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      moved += Math.abs(dx) + Math.abs(dy)
      if (pts.size === 2) {
        const [p, q] = [...pts.values()]
        const dist = Math.hypot(p.x - q.x, p.y - q.y)
        if (pinch > 0) zoomBy(dist / pinch)
        pinch = dist
      } else if (view.current.scale > 1.01) {
        view.current.x += dx
        view.current.y += dy
        apply()
      }
    }
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return
      pts.delete(e.pointerId)
      pinch = 0
      if (moved < 6 && pts.size === 0 && e.target === img.current) {
        const [cx, cy] = centre(e)
        if (view.current.scale > 1.01) zoomBy(0) // retour à la vue d'ensemble
        else zoomBy(2.6, cx, cy)
      }
    }
    st.addEventListener('wheel', wheel, { passive: false })
    st.addEventListener('pointerdown', down)
    st.addEventListener('pointermove', move)
    st.addEventListener('pointerup', up)
    st.addEventListener('pointercancel', up)
    return () => {
      st.removeEventListener('wheel', wheel)
      st.removeEventListener('pointerdown', down)
      st.removeEventListener('pointermove', move)
      st.removeEventListener('pointerup', up)
      st.removeEventListener('pointercancel', up)
    }
  }, [open])

  return (
    <div className={`lightbox ${open ? 'is-open' : ''}`} aria-hidden={!open} role="dialog" aria-label="Œuvre en grand format">
      {a && open && (
        <>
          <div className="lightbox__stage" ref={stage}>
            <img ref={img} src={asset(useGallery.getState().isTouch ? a.image : a.imageFull ?? a.image)} alt={a.title} draggable={false} onLoad={apply} />
          </div>
          <div className="lightbox__bar">
            <p>
              <em>{a.title}</em>
              {a.artist ? ` — ${a.artist}` : ''}
              {a.year ? `, ${a.year}` : ''}
            </p>
            <div className="lightbox__tools">
              <button className="icon-btn icon-btn--light" onClick={() => zoomBy(1 / 1.5)} aria-label="Réduire">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <path d="M3 8h10" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              </button>
              <button className="icon-btn icon-btn--light" onClick={() => zoomBy(1.5)} aria-label="Agrandir">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <path d="M3 8h10M8 3v10" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              </button>
              <button className="icon-btn icon-btn--light" onClick={() => setLightbox(false)} aria-label="Fermer">
                <CloseIcon />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
