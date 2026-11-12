import { useEffect, useState } from 'react'
import { ARTWORKS, asset } from '../data/artworks'
import { useGallery } from '../store'
import { CloseIcon } from './Help'

/** Menu : index des œuvres exposées et retour à l'accueil. */
export function Menu() {
  const open = useGallery((s) => s.menuOpen)
  const [hasOpened, setHasOpened] = useState(false)
  useEffect(() => {
    if (open) setHasOpened(true)
  }, [open])
  const quality = useGallery((s) => s.quality)
  const { setMenu, select, goHome, setHelp, setQuality } = useGallery.getState()
  const rooms = Array.from(new Set(ARTWORKS.map((a) => a.room ?? 'Galerie')))
  return (
    <div className={`overlay overlay--side ${open ? 'is-open' : ''}`} aria-hidden={!open} onClick={() => setMenu(false)}>
      <aside className="menu" role="dialog" aria-label="Œuvres exposées" onClick={(e) => e.stopPropagation()}>
        <div className="panel__head">
          <span className="eyebrow">Œuvres exposées</span>
          <button className="icon-btn" onClick={() => setMenu(false)} aria-label="Fermer le menu" tabIndex={open ? 0 : -1}>
            <CloseIcon />
          </button>
        </div>
        <div className="menu__scroll">
          {rooms.map((room) => (
            <section key={room}>
              <h3 className="menu__room">{room}</h3>
              <ul className="menu__list">
                {ARTWORKS.filter((a) => (a.room ?? 'Galerie') === room).map((a) => (
                  <li key={a.id}>
                    <button onClick={() => select(a.id)} tabIndex={open ? 0 : -1}>
                      <img src={open || hasOpened ? asset(a.imagePreview ?? a.image) : undefined} crossOrigin="anonymous" alt="" loading="lazy" />
                      <span>
                        <em>{a.title}</em>
                        <small>
                          {[a.artist, a.year].filter(Boolean).join(' · ')}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="menu__quality">
          <span className="eyebrow">Qualité du rendu</span>
          <div role="group" aria-label="Qualité du rendu">
            {(
              [
                ['high', 'Haute'],
                ['medium', 'Équilibrée'],
                ['low', 'Légère'],
              ] as const
            ).map(([q, label]) => (
              <button key={q} className={quality === q ? 'is-active' : ''} onClick={() => setQuality(q)} tabIndex={open ? 0 : -1}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="menu__foot">
          <button className="text-btn" onClick={() => setHelp(true)} tabIndex={open ? 0 : -1}>
            Aide aux commandes
          </button>
          <button className="text-btn" onClick={goHome} tabIndex={open ? 0 : -1}>
            Retour à l'accueil
          </button>
        </div>
      </aside>
    </div>
  )
}
