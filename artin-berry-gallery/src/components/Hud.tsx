import { useEffect, useRef, useState } from 'react'
import { asset, byId } from '../data/artworks'
import { joystick, useGallery } from '../store'

/** Interface de visite : volontairement réduite à l'essentiel. */
export function Hud() {
  const phase = useGallery((s) => s.phase)
  const selectedId = useGallery((s) => s.selectedId)
  const nearId = useGallery((s) => s.nearId)
  const hoveredId = useGallery((s) => s.hoveredId)
  const hintShown = useGallery((s) => s.hintShown)
  const isTouch = useGallery((s) => s.isTouch)
  const { setMenu, setHelp, goHome, select } = useGallery.getState()
  const visiting = phase === 'visiting'
  const [fs, setFs] = useState(false)
  const canFs = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen

  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen().catch(() => {})
  }

  const captionArt = byId(hoveredId ?? nearId)
  const showCaption = visiting && !selectedId && !!captionArt
  const [hintVisible, setHintVisible] = useState(false)
  useEffect(() => {
    if (!visiting || hintShown) return setHintVisible(false)
    const a = window.setTimeout(() => setHintVisible(true), 1600)
    const b = window.setTimeout(() => useGallery.getState().dismissHint(), 14000)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [visiting, hintShown])

  return (
    <div className={`hud ${visiting ? 'is-shown' : ''} ${selectedId ? 'is-dimmed' : ''}`}>
      <header className="hud__top">
        <button className="hud__brand" onClick={goHome} aria-label="Artin Berry — retour à l'accueil" tabIndex={visiting ? 0 : -1}>
          <img src={asset('logo/artin-berry-logo-ink.png')} alt="Artin Berry" />
        </button>
        <nav className="hud__actions">
          <button className="text-btn" onClick={() => setMenu(true)} tabIndex={visiting ? 0 : -1}>
            Œuvres
          </button>
          <button className="icon-btn" onClick={() => setHelp(true)} aria-label="Aide aux commandes" title="Aide" tabIndex={visiting ? 0 : -1}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1" />
              <path d="M6.2 6.3a1.9 1.9 0 113 1.5c-.7.5-1.2.9-1.2 1.8" fill="none" stroke="currentColor" strokeWidth="1.1" />
              <circle cx="8" cy="11.7" r=".7" fill="currentColor" />
            </svg>
          </button>
          {canFs && (
            <button className="icon-btn" onClick={toggleFs} aria-label="Plein écran" title="Plein écran" tabIndex={visiting ? 0 : -1}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                {fs ? (
                  <path d="M6 1.5V6H1.5M10 1.5V6h4.5M6 14.5V10H1.5M10 14.5V10h4.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
                ) : (
                  <path d="M1.5 6V1.5H6M14.5 6V1.5H10M1.5 10v4.5H6M14.5 10v4.5H10" fill="none" stroke="currentColor" strokeWidth="1.1" />
                )}
              </svg>
            </button>
          )}
          <button className="icon-btn" onClick={goHome} aria-label="Retour à l'accueil" title="Accueil" tabIndex={visiting ? 0 : -1}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M2 7.5L8 2l6 5.5M3.8 6.5V14h8.4V6.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          </button>
        </nav>
      </header>

      <button
        className={`caption ${showCaption ? 'is-shown' : ''}`}
        onClick={() => captionArt && select(captionArt.id)}
        tabIndex={showCaption ? 0 : -1}
      >
        {captionArt && (
          <>
            <span className="caption__artist">{captionArt.artist}</span>
            <span className="caption__title">{captionArt.title}</span>
            <span className="caption__cta">Découvrir</span>
          </>
        )}
      </button>

      <p className={`hint ${hintVisible && !showCaption ? 'is-shown' : ''}`}>
        {isTouch
          ? 'Glissez pour regarder · Touchez le sol pour avancer · Touchez une œuvre'
          : 'Cliquez-glissez pour regarder · Cliquez au sol pour avancer · ZQSD ou flèches pour marcher'}
      </p>

      {isTouch && visiting && !selectedId && <Joystick />}
    </div>
  )
}

/** Manette tactile de déplacement. */
function Joystick() {
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = base.current!
    let id = -1
    const set = (x: number, y: number) => {
      joystick.x = x
      joystick.y = y
      if (knob.current) knob.current.style.transform = `translate(${x * 30}px, ${y * 30}px)`
    }
    const update = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
      let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
      const m = Math.hypot(x, y)
      if (m > 1) {
        x /= m
        y /= m
      }
      set(x, y)
    }
    const down = (e: PointerEvent) => {
      id = e.pointerId
      el.setPointerCapture(id)
      useGallery.getState().dismissHint()
      update(e)
    }
    const move = (e: PointerEvent) => e.pointerId === id && update(e)
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return
      id = -1
      set(0, 0)
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      set(0, 0)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [])
  return (
    <div className="joystick" ref={base} aria-label="Manette de déplacement">
      <span ref={knob} />
    </div>
  )
}
