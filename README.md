# Vite & Gourmand

Application web de commande de menus pour une entreprise
de traiteur située à Bordeaux.

## Fonctionnalités prévues

- Consultation et filtrage des menus
- Inscription et connexion des clients
- Commande de menus en ligne
- Suivi des commandes
- Gestion des menus et des avis
- Administration et statistiques

## Technologies

- HTML, CSS, JavaScript
- Node.js et Express
- PostgreSQL
- MongoDB

## Installation

Les instructions d'installation seront complétées
au fur et à mesure du développement.

## Catalogue de démonstration

Sur la branche `feature/catalogue-menus`, le catalogue utilise uniquement des
données fictives : aucun prix ni menu ne constitue une offre réelle.
Les pages 4 à 6 du sujet officiel fourni ont été consultées pour le catalogue.
Le PDF reste hors du dépôt et la copie à rendre reste à fournir.

Depuis la racine du dépôt, dans PowerShell :

```powershell
npm.cmd --prefix backend ci
node backend/server.js
```

Ouvrir http://localhost:3000/menus.html. Le port 3000 doit être libre.
La route `/` conserve le message d'accueil initial. Les pages de connexion
et de contact ne sont pas encore développées.
Aucune base de données ni variable d'environnement n'est nécessaire ici.

Dans un **second terminal**, pendant que le serveur tourne :

```powershell
npm.cmd --prefix backend test
```

Vérification manuelle :

- Sans filtre : six exemples fictifs.
- Prix maximum 180 € : trois menus ; fourchette 180–240 € seule : trois menus.
- Thème Nature + régime Végétarien + groupe de 6 : Le Déjeuner champêtre.
- Thème Fête + régime Végétarien : message d'absence de résultat.
- Fourchette inversée ou nombre de personnes négatif : erreur accessible.
- Réinitialiser : champs vidés, six menus affichés sans rechargement.
- Parcourir au clavier avec Tab et tester une largeur mobile de 375 px.
- Sur chaque carte, « Voir le détail » affiche la fiche sans effacer les filtres.
  « Retour au catalogue » ou Échap depuis la fiche la ferme et replace le focus
  sur son bouton. Vérifier les six fiches, dont L'Escale gourmande en stock épuisé.
- Vérifier les trois illustrations légendées, les allergènes sous chaque plat et
  l'encadré des conditions de commande et de conservation.
- « Commander » ouvre `commande.html?menu=ID` : le bon nom et l'identifiant sont
  affichés, même après rechargement. Aucun compte ni aucune commande n'est créé.
  Le bouton est désactivé pour un stock nul. Tester aussi `?menu=999` et `?menu=abc`.

### Organisation et décisions provisoires

- `frontend/menus.html` : structure sémantique, formulaire et annonces des résultats.
- `frontend/menus.css` : présentation responsive et focus clavier visible.
- `frontend/menus.js` : chargement, validation des filtres et affichage avec `textContent`.
- `frontend/menu-filters.js` : fonction de filtrage testable indépendamment de la page.
- `frontend/menu-details.js` : validation des menus et construction accessible des fiches.
- `frontend/images/` : trois illustrations SVG locales, légendées et avec textes
  alternatifs, communes aux six menus. Elles ne représentent pas leurs recettes.
- `frontend/commande.html` et `commande.js` : étape explicite de démonstration avant
  connexion, validation de l'identifiant et affichage du menu sélectionné.
- `frontend/data/menus.json` : source de démonstration, identifiants stables,
  prix entiers en centimes et minimum de personnes.
- `backend/server.js` : Express sert uniquement le dossier public `frontend/`.

Les prix filtrés sont les prix totaux associés au minimum de personnes,
avec bornes inclusives. Le prix maximum et la fourchette se cumulent.
Le nombre de personnes saisi représente la taille du groupe : un menu est
retenu si son minimum est inférieur ou égal à ce nombre (exemple : groupe de 6,
menus de minimum 4 ou 6 retenus, minimum 8 exclu). Le sujet impose ce filtre sans
préciser le sens de comparaison : il s'agit de notre interprétation d'interface,
pas d'une règle explicitement donnée par Studi. Aucun calcul pour les personnes supplémentaires
ou la livraison n'est implémenté.

Les fiches comprennent entrées, plats, desserts, allergènes, conditions et stock.
Toutes ces données sont fictives. Le délai de 72 heures est un exemple de condition,
pas une exigence Studi. Les précautions de conservation sont des exemples à faire
valider pour chaque recette avant une utilisation réelle. Le stock est le nombre de
commandes encore possibles pour ce menu, conformément à l'exemple du sujet page 4 ;
ce n'est pas un nombre de personnes ou de portions. Il est fictif et statique : aucune
réservation, décrémentation ni gestion par date n'est implémentée.
Les allergènes appartiennent à chaque objet plat ; une liste vide affiche « aucun
déclaré dans cet exemple fictif », sans garantie sanitaire réelle.
Le plat « Salade de tomates au basilic » est partagé par deux menus. Les tests couvrent
les filtres, la galerie, les allergènes par plat, les conditions, la sélection du menu,
les erreurs et le rendu/interactions dans un document en mémoire ;
les interactions clavier et l'affichage responsive restent à vérifier dans un navigateur.

Le bouton « Commander » est un lien de navigation présenté comme un bouton. L'URL
conserve uniquement l'identifiant public du menu ; aucune donnée personnelle n'est
stockée. La page cible annonce qu'une connexion sera nécessaire. L'authentification,
l'inscription, le véritable formulaire de commande, les contrôles serveur et les
e-mails restent à développer ; aucune session connectée n'est simulée. Les filtres
restent inchangés à l'ouverture/fermeture des fiches dans le catalogue ; le lien de
retour depuis la page de commande ouvre le catalogue sans restaurer les filtres.

Pour PostgreSQL, remplacer le chargement JSON dans `loadMenus()` par un appel
à une API Express renvoyant les mêmes champs. Le backend devra alors utiliser
des requêtes SQL paramétrées et valider ses entrées. Aucun secret de connexion
ne doit être placé dans les fichiers frontend.
