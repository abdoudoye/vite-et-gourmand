# Vite & Gourmand

La réparation UTF-8 des **78 valeurs** a été appliquée avec succès sur la base
locale PostgreSQL `vite_et_gourmand` le **11 novembre 2026**, après une sauvegarde
préalable. Les accents ont été vérifiés visuellement dans le catalogue sous Chrome.
**Ne pas rejouer la réparation sur les données déjà corrigées.** Les textes
historiques des commandes n'ont pas été modifiés. Compte rendu et procédure conservée :
[database/repairs/README.md](database/repairs/README.md).

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

Le catalogue utilise uniquement des données fictives : aucun prix ni menu ne
constitue une offre réelle. Depuis `feature/base-de-donnees`, elles sont lues dans
PostgreSQL via `GET /api/menus` ; le JSON local reste un jeu de référence pour les tests.
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
Le catalogue nécessite maintenant PostgreSQL et un `.env` local renseigné (voir
la configuration plus bas). `HOST` et `PORT` sont configurables ; leur valeur par
défaut est `127.0.0.1:3000`. Aucun repli silencieux vers le JSON n'est effectué.

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
- `frontend/data/menus.json` : référence fictive pour les tests, non chargée par les pages.
- `backend/server.js` : configuration et cycle de vie du serveur/pool.
- `backend/app.js` : routes API et fichiers publics de `frontend/`.
- `backend/database.js` : pool `pg`, contrôle du compte effectif, délais et erreurs masquées.
- `backend/menus-repository.js` : requête paramétrée du catalogue public.

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

`menus.js` et `commande.js` chargent tous deux `/api/menus`. Le format public
conserve les champs existants, avec `isDemo: true`. Les menus archivés ou non fictifs
sont exclus de cette API de démonstration ; aucune donnée de compte n'est exposée.

## Préparation PostgreSQL — branche feature/base-de-donnees

Le backend utilise maintenant le pilote `pg` et un pool PostgreSQL. L'installation
actuelle déclarée utilise PostgreSQL 18.6, la base `vite_et_gourmand` et le schéma
`vg`, avec les scripts `001`, `002`, `003` déjà appliqués. **Ne pas les relancer**
pour démarrer Express. L'authentification des clients reste à développer.
Les règles et relations sont détaillées dans [database/SCHEMA.md](database/SCHEMA.md).

Fichiers à examiner avant toute exécution :

1. `database/000_create_local_database.sql` : création manuelle d'une **nouvelle base
   locale dédiée** et de trois comptes techniques, sans mot de passe dans le SQL.
2. `database/001_schema.sql` : tables, relations, contraintes, index, historique
   automatique et vues. Transaction atomique, pas de suppression/remplacement.
3. `database/002_demo_data.sql` : six menus, galeries, plats/allergènes, deux comptes
   désactivés sans mot de passe, adresses, horaires et deux commandes **fictifs**.
4. `database/003_app_privileges.sql` : droits limités du compte applicatif.

### Avant d'appliquer les scripts

**Cette section décrit uniquement le provisionnement initial d'une autre base
vide nommée `vite_gourmand_demo`. Elle ne s'applique pas à la base existante
`vite_et_gourmand` : ne pas y exécuter le script `000`, ni rejouer les seeds.**

- Installer/vérifier PostgreSQL 16+ et le client `psql` ; ajouter son dossier `bin`
  au PATH PowerShell si nécessaire (`psql --version`). Rien n'est supposé installé.
- Examiner le schéma et les hypothèses, notamment la tarification supplémentaire,
  la distance, le stock, les horaires et le calendrier des jours ouvrés.
- Vérifier que `vite_gourmand_demo`, `vg_owner`, `vg_migrator` et `vg_app` n'existent
  pas déjà. Les scripts échouent volontairement si leurs objets existent ; ne pas
  supprimer une base pour les rejouer. Choisir une instance de démonstration dédiée.
- Sauvegarder toute instance contenant des données importantes avant une opération
  d'administration. Aucun de ces scripts ne doit être lancé contre une base de production.
- Prévoir un compte PostgreSQL d'administration **uniquement pour le provisionnement**.
  Le compte applicatif sera `vg_app`, jamais `postgres`, `vg_owner` ou `vg_migrator`.

### Commandes à lancer manuellement, depuis la racine

Les commandes suivantes sont des instructions de préparation ; elles ne sont pas
exécutées automatiquement au démarrage ou pendant les tests. `-W` demande le mot de
passe sans l'écrire dans une commande. Si le serveur occupe le terminal, utiliser
un second terminal.

```powershell
psql --version
psql -h 127.0.0.1 -U postgres -d postgres -W -v ON_ERROR_STOP=1 -f database/000_create_local_database.sql
psql -h 127.0.0.1 -U postgres -d postgres -W
```

Dans cette session `psql`, définir des secrets locaux distincts (saisie masquée) :

```text
\password vg_migrator
\password vg_app
\q
```

`postgres` dans ces deux commandes désigne le compte d'installation ; remplacer son
nom par votre compte d'administration si différent. Il ne sera jamais utilisé par
Express. Le script `000` n'est pas atomique (`CREATE DATABASE` l'interdit) : en cas
d'échec partiel, examiner les objets créés avant de continuer, sans suppression automatique.

Puis, avec le compte dédié aux scripts :

```powershell
psql -h 127.0.0.1 -U vg_migrator -d vite_gourmand_demo -W -v ON_ERROR_STOP=1 -f database/001_schema.sql
psql -h 127.0.0.1 -U vg_migrator -d vite_gourmand_demo -W -v ON_ERROR_STOP=1 -f database/002_demo_data.sql
psql -h 127.0.0.1 -U vg_migrator -d vite_gourmand_demo -W -v ON_ERROR_STOP=1 -f database/003_app_privileges.sql
```

Contrôle manuel avec le compte limité, sans écriture :

```powershell
psql -h 127.0.0.1 -U vg_app -d vite_gourmand_demo -W -c "SELECT current_user, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user;"
psql -h 127.0.0.1 -U vg_app -d vite_gourmand_demo -W -c "SELECT count(*) AS menus_fictifs FROM vg.menus WHERE is_demo;"
psql -h 127.0.0.1 -U vg_app -d vite_gourmand_demo -W -c "SELECT * FROM vg.order_totals ORDER BY order_id;"
```

Résultats attendus : `vg_app`, trois droits d'administration à `false`, six menus,
totaux de démonstration 18 000 et 12 000 centimes, livraison Bordeaux à zéro.
Ces contrôles sur votre installation restent à réaliser manuellement.

### Variables d'environnement Express

```powershell
if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item .env.example .env
}
```

Ne copier que si `.env` n'existe pas déjà ; ne pas écraser une configuration locale.
Éditer ensuite `.env` localement. Le fichier est ignoré par Git et Express ne sert
que `frontend/`. Le modèle `.env.example` est versionnable et ne contient aucun secret.

| Variable | Valeur / comportement |
| --- | --- |
| `HOST` | Adresse d'écoute Express, défaut `127.0.0.1` ; définir explicitement pour un hébergement. |
| `PORT` | Port Express, défaut `3000`, entier entre 1 et 65535. |
| `DB_HOST`, `DB_PORT` | Hôte PostgreSQL et port, généralement `127.0.0.1` et `5432` en local. |
| `DB_NAME` | Base existante : `vite_et_gourmand`. |
| `DB_USER` | Seul `vg_app` est accepté, jamais `postgres`, `vg_owner` ou `vg_migrator`. |
| `DB_PASSWORD` | Secret local choisi avec `\password vg_app` ; jamais un mot de passe versionné. |
| `DB_SSL` | `false` pour une installation locale ; `true` vérifie le certificat serveur, sans désactivation de validation TLS. |

Le modèle contient les paramètres locaux et `DB_PASSWORD` vide. Renseigner ce
dernier uniquement dans l'éditeur local ; ne jamais le coller dans une commande,
une conversation ou un journal. Le modèle n'est pas une configuration prête à se
connecter tant que ce champ est vide. Si aucune variable DB n'est définie,
le serveur statique peut démarrer mais l'API répond 503. Si l'une est définie,
les champs hôte/base/utilisateur/mot de passe doivent tous être renseignés, sinon
le démarrage échoue avec le nom du champ manquant, sans afficher sa valeur.
Le port DB vaut 5432 et SSL vaut false si non précisés. Les variables déjà fournies
au processus priment sur `.env`. Le chargement du fichier utilise Node.js 26,
sans dépendance dotenv, et trouve `.env` à la racine même en lançant `npm --prefix backend start`.

Le pool crée les connexions à la demande, avec au plus 5 connexions, un délai de
connexion de 5 secondes et un délai SQL de 5 secondes. Avant chaque requête, le
serveur vérifie l'identité `vg_app`, l'absence de droits d'administration et de
création d'objets, ainsi que l'absence d'appartenance à `vg_owner`. Une connexion
non conforme est rejetée. Chaque client est libéré, ou retiré du pool après erreur.
Ctrl+C déclenche l'arrêt HTTP puis `pool.end()`.

Sans TLS, seules les adresses de boucle locale sont acceptées. Une base distante
exige `DB_SSL=true`, avec vérification du certificat ; ne pas désactiver cette
vérification. Les secrets, erreurs PostgreSQL brutes et requêtes ne sont pas journalisés.

### Démarrer avec la base existante

Depuis la racine, après avoir renseigné `.env` localement :

```powershell
npm.cmd --prefix backend ci
npm.cmd --prefix backend run check:db
npm.cmd --prefix backend start
```

`check:db` n'effectue que des lectures et ferme son pool. Résultat attendu :
« Connexion applicative vérifiée : 6 menus fictifs chargés. » En cas d'erreur,
vérifier localement le secret, le service PostgreSQL et les privilèges ; aucun
identifiant de connexion n'est inclus dans sa sortie. Aucun script SQL n'est
exécuté par `start`, `check:db` ou les endpoints HTTP.

Dans un second terminal :

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health/db
$menus = Invoke-RestMethod http://127.0.0.1:3000/api/menus
$menus.Count
```

Attendu : `status = ok` et 6 menus. Ouvrir ensuite
http://127.0.0.1:3000/menus.html et vérifier les filtres, la réinitialisation,
les fiches, les galeries, les allergènes, les conditions, Échap et la sélection
dans `commande.html?menu=ID`. Tester clavier et affichage mobile à 375 px.

| Endpoint | Succès | Indisponibilité |
| --- | --- | --- |
| `GET /api/health/db` | 200, `{"status":"ok"}` | 503, `{"status":"unavailable"}` |
| `GET /api/menus` | 200, tableau de menus fictifs | 503, message générique « Catalogue indisponible » |

La vérification DB confirme la connexion et le compte limité ; elle ne constitue
pas un contrôle exhaustif de toutes les tables. Le catalogue présente un message
d'erreur accessible si l'API échoue ; il ne masque pas la panne avec le JSON local.

### Tests sans serveur PostgreSQL

```powershell
npm.cmd --prefix backend ci
npm.cmd --prefix backend test
git diff --check
node backend/server.js
```

Les tests du catalogue restent inclus. `config.test.js` vérifie les ports, les champs
obligatoires, la priorité des variables, les comptes refusés et TLS. `api.test.js`
teste les endpoints HTTP, les pannes, la confidentialité et le cycle de vie du pool
avec des doublures ; aucun mot de passe réel n'est utilisé.
`database.test.js` exécute les scripts `001`, `002`, `003` dans un moteur PostgreSQL
WASM **en mémoire**, grâce à PGlite, dépendance de développement uniquement. Aucune
connexion réseau à PostgreSQL, aucun secret réel ni migration d'une base installée.
La requête de l'API est également exécutée dans ce moteur et son résultat est
validé avec les filtres et le contrat de données du frontend.
Le rôle/base interne du moteur est préparé pour reproduire la propriété de `vg_owner` ;
le script d'administration `000` reste à vérifier sur une véritable installation.
Les tests ne remplacent pas la validation des versions, de l'authentification,
du TLS et des droits sur votre futur serveur PostgreSQL.
