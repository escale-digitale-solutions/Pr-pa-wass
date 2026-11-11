# ARTIN BERRY — Galerie d'art virtuelle 3D

Prototype V1 : une galerie d'art contemporaine navigable dans le navigateur.
Plan « La Rotonde » : hall vitré, rotonde sous oculus et trois salles de couleur (terracotta, bleu nuit, ocre) sur un sol de marbre sombre. 12 affiches d'art encadrées et éclairées, avec fiche descriptive, visionneuse plein écran, tablette de verre (artiste, titre, année, dimensions, prix, bouton d'ajout au panier) et panier.

## Lancer le projet

Prérequis : Node.js 20 ou plus récent.

```bash
cd artin-berry-gallery
npm install
npm run dev        # http://localhost:5173
```

Version de production :

```bash
npm run build      # génère le dossier dist/
npm run preview    # http://localhost:4173
```

Le dossier `dist/` est un site statique : il se dépose tel quel sur Netlify, Vercel, GitHub Pages ou tout hébergement web (les chemins sont relatifs, un sous-dossier fonctionne).

## Commandes de visite

| Action | Ordinateur | Mobile / tablette |
| --- | --- | --- |
| Regarder | cliquer-glisser, flèches ← → | glisser un doigt |
| Se déplacer | clic au sol, ZQSD / WASD, flèches ↑ ↓, molette, Maj pour accélérer | toucher le sol, manette en bas à gauche |
| Ouvrir une fiche | clic sur l'œuvre, ou Entrée quand la légende s'affiche | toucher l'œuvre |
| Fermer | Échap ou bouton × | bouton × |

Le menu « Œuvres » liste les pièces exposées (la caméra s'y rend toute seule) et permet de choisir la qualité du rendu : Haute (effets d'ambiance, par défaut sur ordinateur), Équilibrée (par défaut sur téléphone et tablette) ou Légère (sans reflets au sol). Sans choix manuel, la qualité baisse automatiquement si l'appareil peine ; la netteté de l'image, elle, est conservée.

## Modifier ou ajouter une œuvre

Tout se passe dans `src/data/artworks.json`, sans toucher au code.

```jsonc
{
  "id": "klee-senecio",
  "title": "Senecio",
  "artist": "Paul Klee",          // facultatif
  "year": "1922",                 // facultatif
  "technique": "",                // facultatif : vide = non affiché
  "dimensions": "",               // facultatif : vide = non affiché
  "note": "Affiche d'art",        // facultatif
  "description": "…",             // facultatif
  "image": "artworks/tex/klee-senecio.jpg",       // texture de la scène 3D
  "imageFull": "artworks/full/klee-senecio.jpg",  // original, pour la visionneuse
  "room": "Grande galerie",
  "placement": { "wall": "galerie-ouest", "position": -8.9, "height": 1.62 },
  "display": { "width": 1.2, "height": 1.8 },     // taille affichée, en mètres
  "frame": "oak"                  // oak | black | champagne | white
}
```

- `placement.wall` : `terra-ouest`, `terra-nord`, `terra-sud`, `nuit-nord`, `nuit-ouest`, `nuit-est`, `ocre-est`, `ocre-nord` ou `ocre-sud` (définis dans `src/scene/layout.ts`).
- `price` : prix en euros, affiché sur la tablette de verre, la fiche et le panier.
- `placement.position` : position le long du mur, en mètres ; `height` : hauteur du centre de l'œuvre.
- `display` doit respecter le rapport largeur / hauteur de l'image pour éviter toute déformation.
- Le cadre, le cartel, le projecteur et la fiche sont générés automatiquement.

Pour préparer de nouvelles images (copie de l'original + texture 1024 px) : placer les fichiers dans `public/artworks/full`, puis créer la version réduite dans `public/artworks/tex` — le script `scripts/prepare_assets.py` montre la marche à suivre (Python + Pillow).

## Organisation

```
artin-berry-gallery/
├── public/
│   ├── logo/        logo officiel (original) + versions détourées dérivées
│   ├── artworks/    full/ = originaux · tex/ = textures de la scène
│   └── textures/    pierre du sol, enduit des murs, chêne
├── scripts/         préparation des images
└── src/
    ├── data/        artworks.json (contenu) + types
    ├── scene/       architecture, lumière, œuvres, mobilier, déplacement
    ├── components/  accueil, interface, fiche, visionneuse, menu, aide
    ├── styles/      ui.css
    └── store.ts     état de la visite
```

Fichiers clés de la scène :

- `layout.ts` : plan du bâtiment (dimensions, murs, verrière, mobilier, collisions).
- `Architecture.tsx` : murs, rotonde, sol en marbre et lumière « peinte » (halos des gorges lumineuses, tache de soleil du hall).
- `Lighting.tsx` : lumière d'ambiance diffuse, calculée une fois.
- `textures.ts` : marbre veiné, ombres et nappes de lumière, dessinés au chargement.
- `Artworks.tsx` : cadres, tablettes de verre, projecteurs, animation d'ajout au panier, interactions.
- `Player.tsx` + `nav.ts` : déplacement, collisions, recherche de chemin, mouvements de caméra.

## Choix techniques

- React 19, Vite, Three.js, React Three Fiber, Drei, postprocessing.
- **Netteté** : l'image est calculée à la définition de l'écran (jusqu'à 2,5 fois la définition logique sur téléphone, 2 fois sur ordinateur) avec lissage matériel des contours.
- **Lumière peinte** : aucune source lumineuse n'est calculée à chaque image. Les nappes des projecteurs, les halos des gorges lumineuses, les ombres portées et la tache de soleil sont peints sur les surfaces ; seule une lumière d'ambiance diffuse est calculée, une fois. La puissance de l'appareil va à la netteté.
- **Sol** : marbre noir veiné dessiné au chargement (aucun fichier image), poli, avec le reflet de l'architecture et des œuvres.
- En qualité Haute s'ajoutent l'occlusion ambiante (N8AO) et le halo des sources lumineuses.
- **Œuvres** : affichées telles quelles, sans éclairage ni correction de tons, donc avec leurs couleurs d'origine. L'œuvre la plus proche du visiteur passe automatiquement sur le fichier original en pleine résolution ; les autres utilisent une version de 1024 px. Les fichiers originaux ne sont jamais retouchés.
- Aucun serveur, aucune base de données, aucune dépendance en ligne à l'exécution.

## Panier

Le bouton « Ajouter au panier » de la tablette de verre (ou celui de la fiche) ajoute l'œuvre au panier : deux anneaux de lumière et une traîne d'étincelles s'enroulent autour de la tablette. Un clic ailleurs sur la tablette ouvre la fiche. Le panier est conservé dans le navigateur du visiteur. Le paiement en ligne (Stripe) n'est pas encore branché : le bouton de paiement est désactivé.

## Limites connues de cette V1

- Les patios végétaux du plan ne sont pas modélisés, et la rotonde n'accueille pas encore d'œuvres (3 emplacements restent libres pour atteindre 15).
- Les affiches sont montrées agrandies (1,30 × 1,95 m) pour la lisibilité ; le format vendu indiqué est 50 × 70 cm.

- La lumière est peinte et non simulée : le rendu est soigné, mais ce n'est pas un rendu photoréaliste hors-ligne (pas d'ombres portées dynamiques, pas de rebonds de lumière calculés).
- Le logo fourni mesure 447 px de large. Il est utilisé tel quel ; sur le mur du hall, ses contours restent légèrement doux de très près. Un fichier vectoriel (SVG) donnerait un résultat parfaitement net.
- Technique et dimensions des œuvres ne sont pas renseignées (non communiquées) : les champs existent et s'affichent dès qu'ils sont remplis. Les descriptions sont des descriptions visuelles, à relire et compléter.
- La fluidité a été vérifiée fonctionnellement, pas mesurée sur une gamme d'appareils : à tester sur les machines de démonstration.

## Crédits

- Textures de sol, d'enduit et de chêne : [Poly Haven](https://polyhaven.com) (licence CC0).
- Polices : Cormorant Garamond et Jost (licence SIL Open Font).

## Publication sur GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` publie la galerie à chaque mise à jour de `main` :
**https://escale-digitale-solutions.github.io/Pr-pa-wass/**

Activation (une seule fois) : dans le dépôt GitHub, *Settings → Pages → Build and deployment → Source : GitHub Actions*. Le workflow peut aussi être relancé à la main depuis l'onglet *Actions*.
