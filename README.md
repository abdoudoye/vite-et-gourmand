# Vite & Gourmand

La réparation UTF-8 des **78 valeurs** a été appliquée avec succès sur la base
locale PostgreSQL `vite_et_gourmand` le **11 novembre 2026**, après une sauvegarde
préalable. Les accents ont été vérifiés visuellement dans le catalogue sous Chrome.
**Ne pas rejouer la réparation sur les données déjà corrigées.** Les textes
historiques des commandes n'ont pas été modifiés. Compte rendu et procédure conservée :
[database/repairs/README.md](database/repairs/README.md).

Application web de commande de menus pour une entreprise
de traiteur située à Bordeaux.

## État actuel — 17 novembre 2026

Les états ci-dessous distinguent le code disponible, ses tests et son utilisation
locale. Une validation locale ne constitue pas une validation en production.

| Périmètre | Fonctionnalité développée | Test automatisé réussi | Validation sur PostgreSQL local | Déploiement public |
| --- | --- | --- | --- | --- |
| Catalogue, inscription et connexion | Catalogue dynamique, comptes et sessions avec contrôle des rôles | Inclus dans la suite de 163 tests réussis | Fonctionnement des comptes client, employé et administrateur confirmé par le porteur du projet | Non réalisé |
| Commandes client | Devis, calcul du prix, confirmation, réservation, modification et annulation avant acceptation | Calculs, transactions, stock et autorisations couverts | Parcours client fonctionnel confirmé ; pas de recette exhaustive affirmée | Non réalisé |
| Commandes employé | Consultation, filtres, acceptation et refus avec contact préalable | Autorisations, historique, rejeux et restitution unique couverts | Acceptation/refus vérifiés sur PostgreSQL installé ; statut et historique contrôlés en lecture seule | Non réalisé |
| Administration | Comptes employés, informations/stock des menus et modération des avis | Opérations sensibles et validations couvertes en mémoire | Connexion administrateur confirmée et droits de 011 contrôlés ; recette complète des opérations administrateur à effectuer | Non réalisé |
| E-mails | Envoi SMTP conditionnel et notifications en base | Transport simulé, succès et pannes couverts | Envoi/réception réels non validés | Non réalisé |
| Statistiques MongoDB | Non développées ; analyse disponible | Aucun test de statistiques MongoDB fonctionnelles | Aucun service MongoDB validé | Non réalisé |

Dernière suite complète exécutée : **163 tests réussis, aucun échec**, le
17 novembre 2026 (155 tests précédents et 8 tests de provisionnement administrateur).
Elle utilise des bases PGlite en mémoire et des clients simulés ; elle ne modifie
pas PostgreSQL local. Les comptes de démonstration locaux sont distincts des
comptes des tests. Aucun mot de passe de ces comptes locaux n'est publié ici.

Référence du code sauvegardé : `aa420cf12a0ab2da95dc150c13b379ab6af31348`.
Les branches `main`, `develop` et `feature/authentification` ont été synchronisées
sur ce commit par fast-forward avant cette mise à jour documentaire.

Limites actuelles : accueil provisoire, page de contact absente, réinitialisation
du mot de passe absente, modification de profil client absente, suivi de livraison
et de matériel incomplet, gestion complète des plats/horaires absente et e-mails
réels non validés. Les avis sont développés mais leur parcours complet reste limité
par l'absence de transition applicative jusqu'à `terminee`. Aucun déploiement public
n'a été réalisé. La cible gratuite validée est GitHub, Render Free, Neon Free et
MongoDB Atlas M0, avec GitHub Projects ; son provisionnement reste à réaliser.

## Technologies

Première version de l’espace administrateur : [périmètre, sécurité, tests et
état des validations SQL](docs/ADMINISTRATION.md). Page : `/administrateur.html`,
accessible avec la connexion existante pour un administrateur actif. Le script
`database/011_admin_privileges.sql` a été **appliqué sur PostgreSQL local**, comme
009 et 010 ; cela ne signifie pas qu'une base distante a été provisionnée.
Les statistiques MongoDB sont analysées dans ce document et restent à
implémenter ; aucun graphique simulé n’est présenté comme une fonctionnalité.

- HTML, CSS, JavaScript
- Node.js et Express
- PostgreSQL
- MongoDB (prévu, non encore intégré)

## Installation

Les sections suivantes décrivent l'exécution locale et distinguent la base déjà
installée d'une initialisation sur une autre base vide. Les procédures historiques
ne doivent pas être rejouées sur la base locale existante. La procédure de
déploiement public gratuit reste à préparer et à valider.

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

Vérification manuelle sur le jeu de démonstration initial (les prix et stocks
peuvent avoir changé après les essais locaux ou une édition administrateur) :

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
- « Commander » ouvre `commande.html?menu=ID` et conserve le choix pendant
  l'inscription/connexion. Cette sélection ne crée aucun compte ni commande et
  ne réserve aucun stock. L'inscription est une action distincte. « Calculer le
  prix » enregistre un devis temporaire sans réservation. Seul « Confirmer et
  réserver » crée la commande et décrémente le stock dans une transaction.
  Le bouton est désactivé pour un stock nul. Tester aussi `?menu=999` et `?menu=abc`.

### Organisation et décisions provisoires

- `frontend/menus.html` : structure sémantique, formulaire et annonces des résultats.
- `frontend/menus.css` : présentation responsive et focus clavier visible.
- `frontend/menus.js` : chargement, validation des filtres et affichage avec `textContent`.
- `frontend/menu-filters.js` : fonction de filtrage testable indépendamment de la page.
- `frontend/menu-details.js` : validation des menus et construction accessible des fiches.
- `frontend/images/` : trois illustrations SVG locales, légendées et avec textes
  alternatifs, communes aux six menus. Elles ne représentent pas leurs recettes.
- `frontend/commande.html`, `commande.js` et `order-checkout.js` : sélection,
  contexte client authentifié, devis détaillé et confirmation de la commande.
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
pas d'une règle explicitement donnée par Studi. Le formulaire de commande calcule
le prix côté serveur : le catalogue seul affiche le prix associé au minimum.

Pour `n` personnes et un minimum `m`, la règle de projet approuvée est
`brut = arrondi_centime(prix_minimum × n / m)`. La remise de 10 % s'applique au
brut si `n >= m + 5`, puis la livraison est ajoutée sans remise. Le minimum est
obligatoire. Exemple fictif : 180 € pour 6 personnes, 11 personnes donnent
330 € brut, 33 € de remise et 297 € avant livraison. Le prorata est un choix
validé du projet ; le seuil de remise est une exigence du sujet.

La livraison à Bordeaux est gratuite selon la ville et les codes postaux
contrôlés par le serveur. Hors Bordeaux : `5 € + 0,59 € × kilomètres`, arrondi
au centime, uniquement avec une distance sourcée, vérifiée et non expirée
enregistrée dans `vg.delivery_distances`. Sans cette donnée, le devis est bloqué.
Le navigateur ne fournit pas de kilométrage ; aucun trajet réel n'est inventé.
Les calculs sont développés et testés automatiquement ; une livraison hors
Bordeaux fondée sur une distance réelle reste à valider, sans prétendre avoir
réalisé cette validation locale ou publique.

Les fiches comprennent entrées, plats, desserts, allergènes, conditions et stock.
Toutes ces données sont fictives. Le délai de 72 heures est un exemple de condition,
pas une exigence Studi. Les précautions de conservation sont des exemples à faire
valider pour chaque recette avant une utilisation réelle. Le stock est le nombre de
commandes encore possibles pour ce menu, conformément à l'exemple du sujet page 4 ;
ce n'est pas un nombre de personnes ou de portions. Une confirmation réserve
une unité, quel que soit le nombre de personnes. L'annulation client avant
acceptation ou le refus employé restitue une unité une seule fois. Les écritures
de stock et de commande sont transactionnelles, avec contrôle de concurrence et
rejeu sans double réservation/restitution. Une modification client garde la
réservation ; une acceptation ne modifie pas le stock. Il n'existe pas de stock
par date ni de journal des mouvements permettant de reconstruire exactement
un stock passé. Le refus et l'historique ont été vérifiés localement ; les tests
en mémoire ne remplacent pas une recette de concurrence PostgreSQL multi-connexions.
Les allergènes appartiennent à chaque objet plat ; une liste vide affiche « aucun
déclaré dans cet exemple fictif », sans garantie sanitaire réelle.
Le plat « Salade de tomates au basilic » est partagé par deux menus. Les tests couvrent
les filtres, la galerie, les allergènes par plat, les conditions, la sélection du menu,
les erreurs et le rendu/interactions dans un document en mémoire ;
les interactions clavier et l'affichage responsive restent à vérifier dans un navigateur.

Le bouton « Commander » est un lien de navigation présenté comme un bouton. L'URL
conserve uniquement l'identifiant public du menu ; aucune donnée personnelle n'est
stockée dans cette URL. Sans session client, la page redirige vers la connexion
en conservant le menu. L'inscription, la connexion et le parcours de commande
client sont développés et fonctionnent localement selon les validations consignées.
Sur une nouvelle base, les scripts requis doivent être appliqués après autorisation ;
ils ne sont pas à rejouer sur la base locale déjà configurée. Les filtres
restent inchangés à l'ouverture/fermeture des fiches dans le catalogue ; le lien de
retour depuis la page de commande ouvre le catalogue sans restaurer les filtres.

`menus.js` charge `/api/menus` ; le parcours de commande utilise le contexte
authentifié `/api/orders/checkout`. Le format public du catalogue
conserve les champs existants, avec `isDemo: true`. Les menus archivés ou non fictifs
sont exclus de cette API de démonstration ; aucune donnée de compte n'est exposée.

## PostgreSQL local et procédures d'initialisation

Le backend utilise maintenant le pilote `pg` et un pool PostgreSQL. L'installation
actuelle déclarée utilise PostgreSQL 18.6, la base `vite_et_gourmand` et le schéma
`vg`. Les scripts initiaux `001`, `002`, `003` ont été appliqués, puis les droits
ont été restreints et complétés. **009, 010 et 011 ont été appliqués sur PostgreSQL
local**, selon les confirmations du porteur du projet ; leurs objets et droits
ont ensuite été contrôlés en lecture seule. Les droits de connexion correspondant
à 007 sont également présents. Aucun registre automatique ne garantit l'historique
exact des exécutions : les contrôles portent sur l'état effectif de la base.
La table de sessions de 008 était absente au dernier audit local ; les sessions
utilisent actuellement la mémoire. **Ne rejouer ni les seeds ni les migrations
déjà appliquées pour démarrer Express.** Ne pas rejouer 003 après le profil
restreint : cela rétablirait des droits larges. La connexion est décrite plus bas.
Les règles et relations sont détaillées dans [database/SCHEMA.md](database/SCHEMA.md).

Fichiers à examiner avant toute exécution :

1. `database/000_create_local_database.sql` : création manuelle d'une **nouvelle base
   locale dédiée** et de trois comptes techniques, sans mot de passe dans le SQL.
2. `database/001_schema.sql` : tables, relations, contraintes, index, historique
   automatique et vues. Transaction atomique, pas de suppression/remplacement.
3. `database/002_demo_data.sql` : six menus, galeries, plats/allergènes, deux comptes
   désactivés sans mot de passe, adresses, horaires et deux commandes **fictifs**.
4. `database/003_app_privileges.sql` : profil initial historique, plus large que
   le profil actuel ; ses durcissements doivent être distingués de ses GRANT.
5. `004`, `007`, `009`, `010`, `011` : profil restreint et compléments pour les
   fonctionnalités actuelles ; `008` est nécessaire aux sessions PostgreSQL.
   `005` est un retour arrière, pas une étape d'installation normale.

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

Puis, avec le compte dédié aux scripts, sur cette base neuve seulement :

```powershell
psql -h 127.0.0.1 -U vg_migrator -d vite_gourmand_demo -W -v ON_ERROR_STOP=1 -f database/001_schema.sql
psql -h 127.0.0.1 -U vg_migrator -d vite_gourmand_demo -W -v ON_ERROR_STOP=1 -f database/002_demo_data.sql
psql -h 127.0.0.1 -U vg_migrator -d vite_gourmand_demo -W -v ON_ERROR_STOP=1 -f database/003_app_privileges.sql
psql -h 127.0.0.1 -U vg_migrator -d vite_gourmand_demo -W -v ON_ERROR_STOP=1 -f database/004_registration_privileges.sql
psql -h 127.0.0.1 -U vg_migrator -d vite_gourmand_demo -W -v ON_ERROR_STOP=1 -f database/007_login_privileges.sql
psql -h 127.0.0.1 -U vg_migrator -d vite_gourmand_demo -W -v ON_ERROR_STOP=1 -f database/009_order_checkout.sql
psql -h 127.0.0.1 -U vg_migrator -d vite_gourmand_demo -W -v ON_ERROR_STOP=1 -f database/010_employee_privileges.sql
psql -h 127.0.0.1 -U vg_migrator -d vite_gourmand_demo -W -v ON_ERROR_STOP=1 -f database/011_admin_privileges.sql
```

Ajouter 008 seulement si `SESSION_STORE=postgres`. Cette procédure concerne une
nouvelle instance locale ; elle n'est pas un bootstrap Neon validé et ne crée
aucun compte applicatif connecté par défaut. Les scripts de provisionnement
fictifs actuels exigent la base `vite_et_gourmand` : ne pas les lancer tels quels
sur `vite_gourmand_demo`. Toute opération d'initialisation reste manuelle et autorisée.

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
identifiant de connexion n'est inclus dans sa sortie. Aucun script de migration
n'est exécuté par `start`, `check:db` ou les endpoints HTTP. Les endpoints métier
exécutent leurs requêtes SQL de lecture/écriture après les contrôles prévus.

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

Le [compte rendu PostgreSQL du 16 novembre](database/REGISTRATION_AUDIT.md) décrit
l'état historique avant restriction des droits et développement des parcours.
Ses constats « non appliqué » ne décrivent pas l'état local actuel présenté en
tête de ce README. Le profil restreint et ses compléments sont maintenant utilisés
localement ; ne pas réappliquer automatiquement 004 ou son retour arrière 005.
Le script 006 fournit des contrôles en lecture seule, sans coordonnées ni hachage.

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
ni extension de privilèges n'est effectuée par cette route. Les permissions
requises sont couvertes par le profil restreint actuel. Les tests automatisés
vérifient les écritures dans une base en mémoire. Le compte client et le parcours
local sont fonctionnels selon le porteur du projet ; cela ne constitue ni une
nouvelle validation de chaque cas d'inscription sur PostgreSQL local, ni un
déploiement public.

Réponses : `201` compte créé, `400` validation/JSON invalide, `409` inscription
impossible avec ces informations (email déjà utilisé), `413` corps trop gros,
`415` format incorrect, `429` trop de tentatives, `503` service indisponible.
Les erreurs techniques ne divulguent ni SQL ni secrets. Le statut `409` permet
cependant de déduire qu'un email est utilisé ; la protection contre l'énumération
complète demanderait un parcours de confirmation par email, hors de cette étape.

Protection locale : 10 demandes par adresse IP et par fenêtre de 15 minutes,
au plus 2 traitements de création simultanés par processus, table des compteurs
bornée. Par défaut, Express ne fait pas confiance aux en-têtes de proxy ;
`TRUST_PROXY_HOPS` permet une configuration explicite. Un déploiement sur
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
L'énoncé officiel a été fourni hors dépôt et consulté ; la copie à rendre reste
à fournir. L'information RGPD affichée devra
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

#### SQL de connexion et de sessions : état local et nouvelle installation

`database/007_login_privileges.sql` ajoute uniquement SELECT sur les colonnes
nécessaires à login/me. Il est nécessaire si le profil restreint 004 est installé ;
le profil large 003 donne déjà cette lecture. Il ne donne aucun UPDATE sur users.
`database/008_web_sessions.sql` crée une table de sessions dédiée, son index
d'expiration et les droits SELECT/INSERT/UPDATE/DELETE ciblés. Il ne nécessite
aucune séquence et n'altère ni `users`, ni `roles`, ni `addresses`.
Les tests appliquent ces scripts uniquement en mémoire. Sur PostgreSQL local,
les droits de connexion de 007 sont présents et les trois rôles applicatifs
peuvent se connecter, selon les validations actuelles. La table 008 était absente
au dernier audit ; la persistance des sessions PostgreSQL est testée en mémoire,
mais n'est pas déclarée validée localement ou publiquement. Ne pas rejouer 004
après les compléments : il retire les droits ajoutés.

Exemples pour une installation nécessitant encore ces scripts, **uniquement
après contrôle de l'état effectif et autorisation explicite**. Ne pas rejouer
007 sur la base locale existante pour suivre ce guide :

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

Le script `database/009_order_checkout.sql` est **appliqué sur PostgreSQL local**.
Il ajoute les devis, reçus d'idempotence, distances vérifiées et droits
ciblés. Hors Bordeaux, la commande reste bloquée tant qu'une distance routière
fiable pour l'adresse n'a pas été vérifiée et enregistrée par un opérateur autorisé.
Aucune distance n'est inventée, aucun kilométrage transmis par le navigateur n'est accepté.

La [documentation du parcours et des étapes manuelles](docs/COMMANDES.md) détaille
les décisions, limites, droits SQL, commandes d'application après autorisation et
tests. Les menus et prestations restent fictifs ; une confirmation écrit
réellement dans la base configurée. Le parcours client a été confirmé fonctionnel
localement ; les nouveaux essais d'écriture exigent une autorisation distincte.
Les tests automatisés restent isolés et aucun déploiement public n'a été réalisé.

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

Le script complémentaire `database/010_employee_privileges.sql` est **appliqué
sur PostgreSQL local**. Il ajoute UPDATE `accepted_at` et les droits ciblés de
traçabilité des contacts, sans nouveau statut ni compte. Des comptes fictifs
employé et administrateur actifs existent désormais localement ; leurs connexions
ont été confirmées par le porteur du projet. L'acceptation et le refus ont été
validés sur PostgreSQL local. Le contrôle d'une commande refusée a confirmé son
historique `en_attente → refusee` et le stock courant ; sans relevés antérieurs
ni journal de mouvements, il ne prouve pas rétrospectivement chaque variation
de stock. Les comptes des tests automatisés sont distincts et restent en mémoire.

Voir [les règles, tests et étapes manuelles de l'espace employé](docs/ESPACE_EMPLOYE.md).
Les autres étapes de suivi, la gestion du matériel, des menus et des avis restent
incomplètes dans cette interface. L'administration développe déjà la modification
des informations/du stock des menus et la modération des avis, testées en mémoire.
La connexion administrateur et l'application locale de 011 sont confirmées ;
cela ne prouve pas une recette locale exhaustive de ces opérations.
