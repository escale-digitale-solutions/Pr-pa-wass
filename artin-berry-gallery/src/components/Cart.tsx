import { ARTWORKS, asset, formatPrice } from '../data/artworks'
import { useGallery } from '../store'
import { CloseIcon } from './Help'

/** Panier. Le paiement en ligne sera branché dans une prochaine étape. */
export function Cart() {
  const open = useGallery((s) => s.cartOpen)
  const cart = useGallery((s) => s.cart)
  const { setCart, setQty, clearCart } = useGallery.getState()
  const lines = ARTWORKS.filter((a) => cart[a.id] > 0)
  const total = lines.reduce((sum, a) => sum + (a.price ?? 0) * cart[a.id], 0)
  const tab = open ? 0 : -1
  return (
    <div className={`overlay overlay--side ${open ? 'is-open' : ''}`} aria-hidden={!open} onClick={() => setCart(false)}>
      <aside className="menu cart" role="dialog" aria-label="Panier" onClick={(e) => e.stopPropagation()}>
        <div className="panel__head">
          <span className="eyebrow">Votre panier</span>
          <button className="icon-btn" onClick={() => setCart(false)} aria-label="Fermer le panier" tabIndex={tab}>
            <CloseIcon />
          </button>
        </div>
        <div className="menu__scroll">
          {lines.length === 0 ? (
            <p className="cart__empty">Votre panier est vide. Dans la galerie, utilisez le bouton « Ajouter au panier » de la tablette de verre placée à côté de chaque œuvre.</p>
          ) : (
            <ul className="menu__list cart__list">
              {lines.map((a) => (
                <li key={a.id}>
                  <img src={asset(a.imagePreview ?? a.image)} alt="" />
                  <span className="cart__info">
                    <em>{a.title}</em>
                    <small>{[a.artist, a.dimensions].filter(Boolean).join(' · ')}</small>
                    <span className="cart__qty">
                      <button onClick={() => setQty(a.id, cart[a.id] - 1)} aria-label="Retirer un exemplaire" tabIndex={tab}>−</button>
                      <b>{cart[a.id]}</b>
                      <button onClick={() => setQty(a.id, cart[a.id] + 1)} aria-label="Ajouter un exemplaire" tabIndex={tab}>+</button>
                    </span>
                  </span>
                  <span className="cart__price">{formatPrice((a.price ?? 0) * cart[a.id])}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {lines.length > 0 && (
          <div className="cart__foot">
            <p className="cart__total">
              <span>Total</span>
              <b>{formatPrice(total)}</b>
            </p>
            <button className="btn btn--primary" disabled tabIndex={-1}>
              Paiement bientôt disponible
            </button>
            <button className="text-btn" onClick={clearCart} tabIndex={tab}>
              Vider le panier
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
