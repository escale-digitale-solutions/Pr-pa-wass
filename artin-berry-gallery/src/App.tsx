import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { ARTWORKS, asset, formatPrice } from './data/artworks'
import { useGallery } from './store'
import { Cart } from './components/Cart'

const ImmersiveApp = lazy(() => import('./ImmersiveApp'))
class RenderBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

export default function App() {
  const [immersive, setImmersive] = useState(false)
  const [failure, setFailure] = useState(false)
  const cart = useGallery((s) => s.cart)
  const leave = () => {
    setImmersive(false)
    useGallery.getState().goHome()
    useGallery.setState({ ready: false, cartOpen: false })
  }
  const fail = () => { leave(); setFailure(true) }
  useEffect(() => {
    const onFailure = () => { setImmersive(false); setFailure(true); useGallery.setState({ ready: false, cartOpen: false }) }
    window.addEventListener('gallery-render-failed', onFailure)
    return () => window.removeEventListener('gallery-render-failed', onFailure)
  }, [])
  if (immersive) return <>
    <RenderBoundary onFailure={fail}>
      <Suspense fallback={<div className="catalogue"><p role="status">Préparation de la visite 3D…</p></div>}><ImmersiveApp /></Suspense>
    </RenderBoundary>
    <button className="catalogue-return" onClick={leave}>Retour au catalogue</button>
  </>
  return <main className="catalogue">
    <header>
      <img width="200" src={asset('logo/artin-berry-logo-ink.png')} alt="Artin Berry" />
      <button className="btn btn--ghost" onClick={() => useGallery.getState().setCart(true)}>Panier ({Object.values(cart).reduce((a, b) => a + b, 0)})</button>
    </header>
    <h1>Les œuvres, à votre rythme.</h1>
    <p>Parcourez la collection ou explorez les salles en trois dimensions.</p>
    {failure && <p role="alert">La visite 3D a été interrompue. Vous pouvez continuer à découvrir les œuvres dans ce catalogue.</p>}
    <button className="btn btn--primary" onClick={() => { setFailure(false); useGallery.setState({ ready: false, phase: 'landing', cartOpen: false }); setImmersive(true) }}>Visiter en 3D</button>
    <div className="catalogue-grid">{ARTWORKS.map(a => <article key={a.id}>
      <img src={asset(a.imagePreview ?? a.image)} alt={a.title} width="512" height="768" loading="lazy" decoding="async" />
      <p>{a.artist}</p><h2>{a.title}</h2>
      <details><summary>Description et détails</summary><p>{a.description}</p><p>{[a.year, a.dimensions, a.technique].filter(Boolean).join(' · ')}</p></details>
      {a.price != null && <><p>{formatPrice(a.price)}</p><button className="btn btn--ghost" onClick={() => useGallery.getState().addToCart(a.id)}>Ajouter au panier{cart[a.id] ? ` (${cart[a.id]})` : ''}</button></>}
    </article>)}</div>
    <Cart />
  </main>
}
