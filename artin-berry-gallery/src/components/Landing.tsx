import { ARTWORKS, asset } from '../data/artworks'
import { useGallery } from '../store'

/** Écran d'accueil : la scène 3D reste visible derrière la plaque de présentation. */
export function Landing() {
  const phase = useGallery((s) => s.phase)
  const ready = useGallery((s) => s.ready)
  const enter = useGallery((s) => s.enter)
  const shown = phase === 'landing' && ready
  return (
    <section className={`landing ${shown ? 'is-shown' : ''}`} aria-hidden={!shown}>
      <div className="landing__plate">
        <img className="landing__logo" src={asset('logo/artin-berry-logo-ink.png')} alt="Artin Berry" />
        <span className="landing__rule" />
        <p className="eyebrow">Galerie d'art virtuelle</p>
        <h1 className="landing__title">
          Une visite libre,
          <br />
          dans la lumière.
        </h1>
        <p className="landing__text">
          Parcourez le hall et la grande galerie, approchez-vous des œuvres et ouvrez leur fiche. {ARTWORKS.length} affiches
          d'art y sont présentées, de Klee à Matisse, Monet et Van Gogh.
        </p>
        <button className="btn btn--primary" onClick={enter} tabIndex={shown ? 0 : -1}>
          <span>Entrer dans la galerie</span>
          <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden>
            <path d="M0 5h16M12 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <p className="landing__foot">Visite 3D en temps réel · {ARTWORKS.length} œuvres · Hall & grande galerie</p>
      </div>
    </section>
  )
}
