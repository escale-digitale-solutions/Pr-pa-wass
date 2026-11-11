import { ArtworkPanel } from './components/ArtworkPanel'
import { Cart } from './components/Cart'
import { Help } from './components/Help'
import { Hud } from './components/Hud'
import { Landing } from './components/Landing'
import { Lightbox } from './components/Lightbox'
import { Loader } from './components/Loader'
import { Menu } from './components/Menu'
import { Experience } from './scene/Experience'
import { useGallery } from './store'

export default function App() {
  const veil = useGallery((s) => s.veil)
  return (
    <div className="app">
      <Experience />
      <div className={`veil ${veil ? 'is-on' : ''}`} aria-hidden />
      <Hud />
      <Landing />
      <ArtworkPanel />
      <Menu />
      <Cart />
      <Help />
      <Lightbox />
      <Loader />
    </div>
  )
}
