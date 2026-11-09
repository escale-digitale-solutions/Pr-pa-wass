import { useGallery } from '../store'

/** Aide aux commandes. */
export function Help() {
  const open = useGallery((s) => s.helpOpen)
  const setHelp = useGallery((s) => s.setHelp)
  const isTouch = useGallery((s) => s.isTouch)
  return (
    <div className={`overlay ${open ? 'is-open' : ''}`} aria-hidden={!open} onClick={() => setHelp(false)}>
      <div className="help" role="dialog" aria-label="Commandes de visite" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn help__close" onClick={() => setHelp(false)} aria-label="Fermer" tabIndex={open ? 0 : -1}>
          <CloseIcon />
        </button>
        <p className="eyebrow">Commandes</p>
        <h2 className="help__title">Visiter la galerie</h2>
        <div className="help__grid">
          <div>
            <h3>Regarder</h3>
            <p>{isTouch ? 'Faites glisser un doigt sur l’écran, ou utilisez la manette en bas à droite, en même temps que celle de déplacement.' : 'Cliquez-glissez avec la souris. Les flèches ← → font pivoter le regard.'}</p>
          </div>
          <div>
            <h3>Se déplacer</h3>
            <p>
              {isTouch
                ? 'Touchez le sol pour vous y rendre, ou utilisez la manette en bas à gauche.'
                : 'Cliquez sur le sol pour vous y rendre, ou marchez avec ZQSD, WASD ou les flèches ↑ ↓. Maj pour accélérer, molette pour avancer.'}
            </p>
          </div>
          <div>
            <h3>Découvrir</h3>
            <p>
              {isTouch ? 'Touchez une œuvre' : 'Cliquez sur une œuvre'} pour ouvrir sa fiche, puis « Observer en grand » pour la voir en détail.
              {isTouch ? '' : ' Échap referme la fiche.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M2 2l12 12M14 2L2 14" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}
