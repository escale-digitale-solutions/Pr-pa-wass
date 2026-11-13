# Espace professionnel — périmètre confirmé

Un compte distinct par professionnel, avec sa propre galerie. L'accès privé et la publication partagée exigent un service d'authentification, une base de données et un stockage d'images : GitHub Pages seul ne fournit pas ces fonctions.

## Parcours à réaliser

1. Connexion et déconnexion, récupération du mot de passe.
2. Tableau de bord limité aux galeries du professionnel connecté.
3. Ajout d'une œuvre : image, artiste, titre, description, année, dimensions, prix en euros, style de cadre, emplacement dans la galerie.
4. Modification, retrait de l'exposition et archivage sans effacer immédiatement le fichier source.
5. Aperçu privé puis publication explicite ; les visiteurs ne voient que la version publiée.
6. Import d'image avec limites de taille et génération de versions réduites, pour ne pas réintroduire de surcharge sur téléphone.

## Données et droits à implémenter

- `galleries` : propriétaire lié au compte authentifié, identifiant public, titre.
- `artworks` : galerie, métadonnées, prix en centimes entiers, image, cadre et emplacement. Données de brouillon privées.
- `publications` : version validée et publiée de la galerie ; lecture publique seule.
- Fichiers privés de travail dans le dossier de leur propriétaire ; seules les images nécessaires aux publications sont exposées publiquement.
- Autorisation contrôlée côté serveur pour toutes les lectures et écritures : le professionnel A ne peut pas lire ni modifier les brouillons de B, même en changeant un identifiant dans une requête.
- Aucun secret administrateur dans le navigateur ; ne pas utiliser un mot de passe JavaScript ou le stockage local comme protection.

## Configuration et vérifications en attente

Le 13 novembre 2026 : aucun projet Supabase existant. Organisation disponible « Florian » ; choix demandé avant création. Aucun compte, table ou fichier distant créé à ce stade.

Avant mise à disposition : tester avec deux comptes réels distincts, les accès anonymes, l'expiration de session, le dépôt d'images, les changements de prix et la publication depuis un second appareil. Cette note décrit le travail restant ; elle ne constitue pas un espace professionnel opérationnel.
