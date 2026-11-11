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
Le sujet Studi et la copie à rendre sont absents de `docs/` à ce stade ;
les détails devront être confirmés avec ces documents.

Depuis la racine du dépôt, dans PowerShell :

```powershell
npm.cmd --prefix backend ci
node backend/server.js
```

Ouvrir http://localhost:3000/menus.html. Le port 3000 doit être libre.
La route `/` conserve le message d'accueil initial. Les pages de connexion,
contact et les fiches détaillées ne sont pas encore développées.
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

### Organisation et décisions provisoires

- `frontend/menus.html` : structure sémantique, formulaire et annonces des résultats.
- `frontend/menus.css` : présentation responsive et focus clavier visible.
- `frontend/menus.js` : chargement, validation des filtres et affichage avec `textContent`.
- `frontend/menu-filters.js` : fonction de filtrage testable indépendamment de la page.
- `frontend/data/menus.json` : source de démonstration, identifiants stables,
  prix entiers en centimes et minimum de personnes.
- `backend/server.js` : Express sert uniquement le dossier public `frontend/`.

Les prix filtrés sont les prix totaux associés au minimum de personnes,
avec bornes inclusives. Le prix maximum et la fourchette se cumulent.
Le nombre de personnes saisi représente la taille du groupe : un menu est
retenu si son minimum est inférieur ou égal à ce nombre. Ce choix d'interface
reste à confirmer avec le sujet. Aucun calcul pour les personnes supplémentaires
ou la livraison n'est implémenté.

Pour PostgreSQL, remplacer le chargement JSON dans `loadMenus()` par un appel
à une API Express renvoyant les mêmes champs. Le backend devra alors utiliser
des requêtes SQL paramétrées et valider ses entrées. Aucun secret de connexion
ne doit être placé dans les fichiers frontend.
