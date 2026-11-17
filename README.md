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

Première version de l’espace administrateur : [périmètre, sécurité, tests et
script SQL à revoir](docs/ADMINISTRATION.md). Page : `/administrateur.html`,
accessible avec la connexion existante pour un administrateur actif. Le script
`database/011_admin_privileges.sql` est préparé mais **non exécuté sur PostgreSQL
réel**. Les statistiques MongoDB sont analysées dans ce document et restent à
implémenter ; aucun graphique simulé n’est présenté comme une fonctionnalité.

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
La route `/` conserve le message d'accueil initial. La connexion client est
disponible sur `/connexion.html` ; la page de contact reste à développer.
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
stockée. La page cible annonce qu'une connexion sera nécessaire. L'inscription et
la connexion et le parcours de commande client sont disponibles dans le code ;
les scripts SQL requis doivent être appliqués après autorisation (voir ci-dessous). Les filtres
restent inchangés à l'ouverture/fermeture des fiches dans le catalogue ; le lien de
retour depuis la page de commande ouvre le catalogue sans restaurer les filtres.

`menus.js` charge `/api/menus` ; le parcours de commande utilise le contexte
authentifié `/api/orders/checkout`. Le format public du catalogue
conserve les champs existants, avec `isDemo: true`. Les menus archivés ou non fictifs
sont exclus de cette API de démonstration ; aucune donnée de compte n'est exposée.

## Préparation PostgreSQL — branche feature/base-de-donnees

Le backend utilise maintenant le pilote `pg` et un pool PostgreSQL. L'installation
actuelle déclarée utilise PostgreSQL 18.6, la base `vite_et_gourmand` et le schéma
`vg`, avec les scripts `001`, `002`, `003` déjà appliqués. **Ne pas les relancer**
pour démarrer Express. La connexion client est décrite plus bas.
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

### Mission 7 — inscription des clients

Avant le premier essai sur la base installée, consulter
[l'audit PostgreSQL et la procédure autorisée](database/REGISTRATION_AUDIT.md).
L'audit en lecture seule a confirmé les objets nécessaires, mais constaté des
droits DML plus larges que le périmètre actuel. Les scripts de réduction `004`
et de retour arrière `005` sont préparés et testés en mémoire, sans application
sur la base installée. Le script `006` vérifie ensuite le compte par des booléens
sans afficher les coordonnées ou le hachage.

Page : http://127.0.0.1:3000/inscription.html (également liée depuis le catalogue).
La connexion est décrite dans la section suivante ; la réinitialisation reste à développer.

`POST /api/auth/register` accepte uniquement du JSON, limité à 16 Ko :
`firstName`, `lastName`, `email`, `phone`, `street`, `additionalLine` (facultatif),
`postalCode`, `city`, `countryCode`, `password`, `passwordConfirmation`.
L'adresse est découpée selon les colonnes existantes de `vg.addresses`.
Le code pays utilise deux lettres, par exemple `FR`.

Le serveur vérifie les types, les champs obligatoires, les longueurs, le format
email, le téléphone (7 à 15 chiffres), le code postal et la confirmation.
Les noms et adresses acceptent les accents et apostrophes ; les balises et
caractères de contrôle sont refusés. Les emails sont nettoyés aux extrémités
et convertis en minuscules. Le mot de passe n'est ni nettoyé ni normalisé.
La règle Studi demandée est appliquée : au moins 10 caractères avec majuscule,
minuscule, chiffre et caractère spécial. La limite de 128 caractères est un
choix technique de protection des ressources.

Le hachage utilise **Argon2id**, sel aléatoire généré par la bibliothèque,
64 Mio de mémoire, 3 passes, parallélisme 1 ([documentation node-argon2](https://github.com/ranisalt/node-argon2)).
Seul le hash entre dans la requête SQL. Aucun mot de passe ou hash ne figure
dans les réponses HTTP, les emails ou les journaux applicatifs.
Le serveur impose `role_code='utilisateur'`, `is_active=true` et laisse
`is_demo=false` : les paramètres fournis par un visiteur ne permettent pas
de choisir son rôle. Aucun administrateur n'est créé par cette route.

Une seule instruction SQL paramétrée insère le compte, l'adresse principale
et l'événement `bienvenue` dans `vg.email_outbox`. L'index existant
`users_email_ci_idx` et `ON CONFLICT` empêchent aussi les doublons simultanés.
Une erreur d'adresse ou d'outbox annule toute l'instruction. Aucune migration
ni extension de privilèges n'est nécessaire d'après `001_schema.sql` et
`003_app_privileges.sql`, vérifiés en mémoire sous le rôle `vg_app`.
Les privilèges réellement installés restent à confirmer sur votre instance.
**Aucun script SQL ni test d'inscription n'a été exécuté sur la base réelle.**

Réponses : `201` compte créé, `400` validation/JSON invalide, `409` inscription
impossible avec ces informations (email déjà utilisé), `413` corps trop gros,
`415` format incorrect, `429` trop de tentatives, `503` service indisponible.
Les erreurs techniques ne divulguent ni SQL ni secrets. Le statut `409` permet
cependant de déduire qu'un email est utilisé ; la protection contre l'énumération
complète demanderait un parcours de confirmation par email, hors de cette étape.

Protection locale : 10 demandes par adresse IP et par fenêtre de 15 minutes,
au plus 2 traitements de création simultanés par processus, table des compteurs
bornée. Express ne fait pas confiance aux en-têtes de proxy. Un déploiement sur
plusieurs processus nécessitera un limiteur partagé et une configuration du proxy
adaptée. Servir impérativement le formulaire et l'API en HTTPS en production.

#### Email de bienvenue

`EMAIL_MODE=disabled` par défaut : aucun transport SMTP n'est créé, aucun email
réel n'est envoyé, même si des paramètres SMTP existent. L'événement reste en
attente dans `email_outbox`. Pour activer volontairement l'envoi, configurer
`EMAIL_MODE=smtp` et **tous** les paramètres `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` dans le `.env` local.
`SMTP_FROM` est une adresse simple, sans nom d'affichage. Utiliser `SMTP_SECURE=true`
pour TLS immédiat (habituellement port 465), `false` pour STARTTLS (habituellement
587). TLS est obligatoire et les certificats sont vérifiés. Voir la
[documentation Nodemailer](https://nodemailer.com/smtp/).

L'email contient un texte de bienvenue sans mot de passe. Si le serveur SMTP
l'accepte, l'événement est marqué `envoye` ; cela ne garantit pas sa réception
en boîte mail. Si SMTP échoue, le compte reste créé et l'événement en attente.
La réponse expose `welcomeEmail` : `disabled`, `sent` ou `pending`.
Il n'existe pas encore de worker de reprise des événements en attente, ni de
relecture automatique de ceux créés en mode désactivé. Une reprise ultérieure
devra gérer les doublons possibles si SMTP accepte l'email mais que la mise à
jour SQL échoue. Aucun envoi SMTP réel n'a été vérifié à cette étape.

#### Vérification sans modifier PostgreSQL réel

```powershell
npm.cmd --prefix backend ci
npm.cmd --prefix backend test
git diff --check
```

Les tests `registration.test.js` utilisent exclusivement PostgreSQL WASM en
mémoire avec les scripts et privilèges existants. Ils couvrent inscription,
validation, doublons simultanés, rôle imposé, vérification Argon2id et sels,
injections SQL, atomicité, erreurs HTTP, limitation et emails avec doublures.
`registration-ui.test.js` vérifie les états du formulaire avec une doublure DOM :
double envoi, erreurs associées aux champs, focus, réseau et effacement des mots
de passe. Ces tests ne remplacent pas une vérification visuelle dans un navigateur.

Pour vérifier l'affichage, lancer `node backend/server.js`, puis ouvrir
`/inscription.html`. Tester à 375 px et sur ordinateur, parcourir avec Tab,
vérifier les labels, le focus et les messages d'erreur. **Ne pas soumettre une
inscription valide sur la base réelle sans autorisation** : l'endpoint crée
réellement le compte une fois la base configurée. Le catalogue reste accessible.
L'énoncé officiel et la copie à rendre sont absents du dépôt ; les exigences de
cette étape proviennent de la mission fournie. L'information RGPD affichée devra
être complétée avec le responsable, les durées de conservation et les modalités
d'exercice des droits avant production ; aucun audit RGAA/RGPD complet n'est affirmé.

### Mission 7 — connexion et sessions

Ouvrir http://127.0.0.1:3000/connexion.html. La page reprend les styles de
l'inscription, vérifie la session au chargement et propose la déconnexion.
Les champs ont des labels et des attributs autocomplete ; les messages utilisent
des régions accessibles et le mot de passe est effacé après chaque tentative.
Les noms affichés passent par `textContent`, jamais par une insertion HTML.
La vérification visuelle sur navigateur et mobile reste à effectuer.

| Endpoint | Résultat |
| --- | --- |
| `POST /api/auth/login` | JSON `{email,password}` ; 200 et profil public si le compte client/employé/administrateur est actif et le mot de passe correct. |
| `GET /api/auth/me` | 200 et profil public de la session, ou 401 sans session valide. |
| `POST /api/auth/logout` | 204, destruction de la session côté serveur et expiration du cookie. |

Le profil contient seulement `id` (chaîne), `firstName`, `lastName`, `email`, `role`.
Aucun mot de passe, hachage, identifiant de session ou jeton n'est envoyé dans le
JSON. Les trois réponses ne sont pas mises en cache. Le client reçoit uniquement
un cookie HttpOnly contenant un identifiant aléatoire signé ; ni `localStorage`
ni `sessionStorage` ne sont utilisés. L'email est nettoyé et passé en minuscules
comme à l'inscription, puis recherché avec une requête SQL paramétrée.
Le mot de passe n'est pas normalisé ni nettoyé ; il est vérifié avec
`argon2.verify` et le hachage Argon2id créé à l'inscription.

Email inconnu, mauvais mot de passe, utilisateur inactif/désactivé, compte sans
hash Argon2id valide ou rôle inconnu produisent la même réponse
401 : « Email ou mot de passe incorrect. » Une vérification Argon2id factice
est effectuée quand le hachage est absent, sans créer de compte. Cette mesure
réduit les différences de temps sans prétendre rendre le système parfaitement
constant en temps. Les messages techniques restent génériques (503).
La réinitialisation reste à développer. La connexion employé/administrateur
réutilise maintenant ce même mécanisme et ne permet pas de choisir son rôle.

#### Durée et sécurité

La session est renouvelée après une connexion réussie (prévention de fixation),
expirée après **2 heures au maximum**, sans prolongation à chaque consultation.
Le store conserve les métadonnées du cookie, l'identifiant utilisateur et la date
de connexion ; pas de coordonnées ni de hachage de mot de passe. Sa clé est le
digest SHA-256 de l'identifiant de session. `me` relit l'utilisateur actif en base :
une désactivation ou un changement de rôle invalide la session lors de cet accès.
La déconnexion détruit l'entrée du store : rejouer l'ancien cookie ne suffit pas
à retrouver la session. Un échec du store ne confirme pas la connexion.
Les futures actions protégées devront réutiliser un contrôle serveur du compte
et de ses droits ; le parcours de commande décrit ci-dessous utilise désormais ces contrôles.

Le cookie a `HttpOnly`, `SameSite=Lax`, `Path=/`, sans `Domain`.
En production, il a aussi `Secure` et le nom `__Host-vg.sid` ; en développement
HTTP local, il s'appelle `vg.sid`. La gestion du cookie et de la signature repose
sur [express-session](https://github.com/expressjs/session).
Ne pas activer de journalisation détaillée des cookies ou des corps de requêtes
sur le proxy ; ils contiennent des informations sensibles.

Les POST login/logout exigent l'en-tête `X-Requested-With: ViteGourmand`.
La page l'ajoute automatiquement. Les origines étrangères, les requêtes indiquées
cross-site et les formulaires simples sont refusés (403). Aucun accès CORS n'est
accordé. En production, `APP_ORIGIN` définit l'origine HTTPS autorisée exacte.
Ne pas ajouter une politique CORS permissive sans revoir cette protection CSRF.
Le limiteur de connexion accepte au plus 10 demandes par IP et 15 minutes avec
deux vérifications coûteuses simultanées par processus. Il faudra un limiteur
partagé si plusieurs processus sont déployés. Le store local est borné à 1000
sessions ; il refuse une nouvelle session s'il est plein plutôt que grossir
sans limite.

#### Configuration

En local, le défaut est `SESSION_STORE=memory` : aucune table de sessions n'est
nécessaire et les sessions disparaissent au redémarrage. Sans SESSION_SECRET,
un secret aléatoire est généré pour ce démarrage. Les comptes, eux, sont toujours
lus dans PostgreSQL : aucune connexion fictive n'est simulée par l'application.

En production, la configuration refuse le stockage mémoire et exige :

```dotenv
NODE_ENV=production
SESSION_STORE=postgres
SESSION_SECRET=secret_aleatoire_a_renseigner_hors_git_au_moins_32_caracteres
APP_ORIGIN=https://votre-domaine.example
TRUST_PROXY_HOPS=0
```

La valeur de secret ci-dessus décrit le format, **elle ne doit pas être utilisée**.
Générer et conserver un secret dédié dans votre gestionnaire de secrets.
Le store PostgreSQL réutilise le connecteur `database.js` et son compte `vg_app`
contrôlé avant chaque requête. Il n'utilise pas de compte administrateur.
`SESSION_STORE=postgres` est également disponible en local pour un test autorisé.
Une table absente produit une erreur générique ; aucun CREATE TABLE n'est lancé
automatiquement. Les sessions expirées ne sont plus acceptées ; leur suppression
physique doit être planifiée par l'exploitation sur `expires_at` (voir script 008).

Mettre `TRUST_PROXY_HOPS=1` seulement derrière un unique proxy HTTPS maîtrisé,
qui remplace les en-têtes de transfert, avec Node inaccessible directement.
Sinon garder 0 et fournir TLS directement à Express via l'infrastructure retenue.
Les POST d'authentification en production refusent une requête vue comme HTTP.
Le cookie Secure nécessite HTTPS pour être reçu puis renvoyé par le navigateur.

#### SQL préparé — aucune exécution sur PostgreSQL réel

`database/007_login_privileges.sql` ajoute uniquement SELECT sur les colonnes
nécessaires à login/me. Il est nécessaire si le profil restreint 004 est installé ;
le profil large 003 donne déjà cette lecture. Il ne donne aucun UPDATE sur users.
`database/008_web_sessions.sql` crée une table de sessions dédiée, son index
d'expiration et les droits SELECT/INSERT/UPDATE/DELETE ciblés. Il ne nécessite
aucune séquence et n'altère ni `users`, ni `roles`, ni `addresses`.
Les scripts sont uniquement préparés et testés en mémoire. Aucun compte réel,
aucune donnée, aucun privilège ni schéma PostgreSQL réel n'a été modifié pour
développer cette connexion. Ne pas rejouer 004 après ces compléments : il retire
les droits ajoutés pour cette mission.

Commandes à utiliser **uniquement après autorisation explicite** :

```powershell
# Si le profil restreint 004 est installe :
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -h 127.0.0.1 -p 5432 -U vg_migrator -d vite_et_gourmand -W -v ON_ERROR_STOP=1 -f database/007_login_privileges.sql
# Seulement pour SESSION_STORE=postgres :
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -h 127.0.0.1 -p 5432 -U vg_migrator -d vite_et_gourmand -W -v ON_ERROR_STOP=1 -f database/008_web_sessions.sql
```

#### Tests sans PostgreSQL réel

```powershell
npm.cmd --prefix backend ci
npm.cmd --prefix backend test
git diff --check
```

`auth.test.js` teste les endpoints HTTP, Argon2id, les refus génériques, les
cookies, la rotation, la falsification, l'expiration, la désactivation après
connexion, CSRF, la déconnexion, les pannes et la configuration de production.
`auth-sql.test.js` active seulement un compte du seed dans une base PGlite en
mémoire, y applique 004/007/008 et vérifie login/me/logout, la persistance entre
deux applications et les droits limités. `auth-ui.test.js` teste l'interface
avec une doublure DOM. Aucun de ces tests ne se connecte à la base installée.
Le contrôle manuel éventuel utilise un compte client existant et autorisé, sans
afficher son mot de passe, son hachage ou ses cookies dans un terminal/capture.

### Parcours de commande client

Le parcours `menus.html` → `commande.html?menu=ID` exige un client actif, conserve
le menu pendant l'inscription/connexion et préremplit les coordonnées et l'adresse.
Le devis côté serveur précède la confirmation, vérifie les délais du menu, le stock
et le tarif. Le prorata des personnes supplémentaires a été **explicitement validé
par l'utilisateur** ; la remise de 10 % s'applique dès minimum + 5 personnes.

Les commandes, lignes, réservations, événements email et reçus d'idempotence sont
enregistrés dans une transaction unique. `mes-commandes.html` liste les commandes,
leurs prix et leur suivi ; modification sans changement de menu et annulation sont
possibles avant acceptation. L'email local reste préparé en attente, sans envoi.

**Avant un test sur PostgreSQL installé : autorisation requise.** Le script
`database/009_order_checkout.sql` est préparé, testé uniquement en mémoire et non
appliqué. Il ajoute les devis, reçus d'idempotence, distances validées et droits
ciblés. Hors Bordeaux, la commande reste bloquée tant qu'une distance routière
fiable pour l'adresse n'a pas été vérifiée et enregistrée par un opérateur autorisé.
Aucune distance n'est inventée, aucun kilométrage transmis par le navigateur n'est accepté.

La [documentation du parcours et des étapes manuelles](docs/COMMANDES.md) détaille
les décisions, limites, droits SQL, commandes d'application après autorisation et
tests. Les menus et prestations restent fictifs ; la validation écrira réellement
dans la base configurée. Aucun essai d'écriture n'a été fait sur la base installée.

### Espace employé — commandes en attente

Après connexion avec un compte `employe` ou `administrateur` actif et autorisé,
ouvrir `/employe.html` depuis le lien du compte. L'interface affiche les commandes,
leurs prix/statuts, les filtres par statut ou identifiant client, le détail et
l'historique. Les données sensibles du détail sont obtenues seulement après
autorisation serveur, revérifiée en base à chaque action.

Cette étape expose uniquement `en_attente → accepte` ou `en_attente → refusee`,
en réutilisant les statuts existants. Le refus exige un motif et un contact
préalable déclaré (téléphone/email et date). Son enregistrement, la restitution
d'une unité de stock et le changement de statut sont atomiques. Le verrou de
commande empêche une double restitution ou une décision contraire concurrente.
Les opérations client restent bloquées après acceptation.

Le script complémentaire `database/010_employee_privileges.sql` est **préparé,
non appliqué à PostgreSQL installé**. Il ajoute UPDATE `accepted_at` et les droits
ciblés de traçabilité des contacts, sans nouveau statut ni compte. Le contrôle
en lecture seule a constaté qu'aucun compte employé/administrateur actif n'est
actuellement disponible : sa création/activation nécessitera un accord distinct.
Les comptes des tests existent exclusivement dans une base en mémoire.

Voir [les règles, tests et étapes manuelles de l'espace employé](docs/ESPACE_EMPLOYE.md).
Les autres étapes de suivi, la gestion du matériel, des menus et des avis restent
hors du périmètre prioritaire de cette interface.
