import { useProgress } from '@react-three/drei'
import { asset } from '../data/artworks'
import { useGallery } from '../store'

/** Écran de chargement : logo et filet de progression. */
export function Loader() {
  const ready = useGallery((s) => s.ready)
  const { progress } = useProgress()
  return (
    <div className={`loader ${ready ? 'is-done' : ''}`} aria-hidden={ready}>
      <img className="loader__logo" src={asset('logo/artin-berry-logo-ink.png')} alt="Artin Berry" />
      <div className="loader__bar">
        <span style={{ transform: `scaleX(${ready ? 1 : Math.max(0.04, progress / 100)})` }} />
      </div>
      <p className="loader__text">Préparation de la galerie</p>
    </div>
  )
}
