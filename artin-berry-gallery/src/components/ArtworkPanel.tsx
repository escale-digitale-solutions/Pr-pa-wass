import { useEffect, useState } from 'react'
import { ARTWORKS, asset, byId, formatPrice } from '../data/artworks'
import { useGallery } from '../store'
import { CloseIcon } from './Help'

/** Fiche descriptive d'une œuvre. Les champs non renseignés ne sont pas affichés. */
export function ArtworkPanel() {
  const selectedId = useGallery((s) => s.selectedId)
  const { select, setLightbox, addToCart, setCart } = useGallery.getState()
  const qty = useGallery((s) => (selectedId ? (s.cart[selectedId] ?? 0) : 0))
  // on conserve la dernière œuvre affichée pendant l'animation de fermeture
  const [shownId, setShownId] = useState<string | null>(null)
  useEffect(() => {
    if (selectedId) setShownId(selectedId)
  }, [selectedId])
  const a = byId(selectedId ?? shownId)
  const open = !!selectedId
  const index = a ? ARTWORKS.findIndex((x) => x.id === a.id) : 0
  const go = (step: number) => select(ARTWORKS[(index + step + ARTWORKS.length) % ARTWORKS.length].id)

  const meta: [string, string | undefined][] = a
    ? [
        ['Artiste', a.artist],
        ['Année', a.year],
        ['Technique', a.technique],
        ['Dimensions', a.dimensions],
        ['Support', a.note],
        ['Prix', a.price != null ? formatPrice(a.price) : undefined],
        ['Salle', a.room],
      ]
    : []

  return (
    <aside className={`panel ${open ? 'is-open' : ''}`} aria-hidden={!open} role="dialog" aria-label="Fiche de l'œuvre">
      {a && (
        <div className="panel__scroll" key={a.id}>
          <div className="panel__head">
            <span className="eyebrow">
              {String(index + 1).padStart(2, '0')} / {String(ARTWORKS.length).padStart(2, '0')}
            </span>
            <button className="icon-btn" onClick={() => select(null)} aria-label="Fermer la fiche" tabIndex={open ? 0 : -1}>
              <CloseIcon />
            </button>
          </div>

          {a.artist && <p className="panel__artist">{a.artist}</p>}
          <h2 className="panel__title">{a.title}</h2>
          {a.year && <p className="panel__year">{a.year}</p>}

          <button className="panel__figure" onClick={() => setLightbox(true)} tabIndex={open ? 0 : -1} aria-label="Observer l'œuvre en grand">
            <img src={asset(a.image)} alt={`${a.title}${a.artist ? ` — ${a.artist}` : ''}`} />
            <span className="panel__zoom">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M1 5V1h4M13 5V1H9M1 9v4h4M13 9v4H9" fill="none" stroke="currentColor" strokeWidth="1.1" />
              </svg>
              Observer en grand
            </span>
          </button>

          {a.price != null && (
            <div className="panel__buy">
              <p className="panel__price">
                {formatPrice(a.price)}
                {a.dimensions && <small>Affiche {a.dimensions}</small>}
              </p>
              <button className="btn btn--primary" onClick={() => addToCart(a.id)} tabIndex={open ? 0 : -1}>
                Ajouter au panier
              </button>
              {qty > 0 && (
                <button className="text-btn" onClick={() => setCart(true)} tabIndex={open ? 0 : -1}>
                  {qty} dans le panier · Voir
                </button>
              )}
            </div>
          )}

          {a.description && <p className="panel__text">{a.description}</p>}

          <dl className="panel__meta">
            {meta
              .filter(([, v]) => !!v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>

          <div className="panel__nav">
            <button className="text-btn" onClick={() => go(-1)} tabIndex={open ? 0 : -1}>
              ← Précédente
            </button>
            <button className="text-btn" onClick={() => go(1)} tabIndex={open ? 0 : -1}>
              Suivante →
            </button>
          </div>
          <button className="btn btn--ghost panel__back" onClick={() => select(null)} tabIndex={open ? 0 : -1}>
            Poursuivre la visite
          </button>
        </div>
      )}
    </aside>
  )
}
