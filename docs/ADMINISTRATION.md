# Première version de l’administration

## Référence et périmètre

Le sujet officiel `VITE EST GOURMAND.pdf`, fourni hors du dépôt, a été lu le
17 novembre 2026. Les pages 4, 7, 8 et 9 décrivent les menus, les avis après
commande terminée, les droits employés et l’administration. La page 10 impose
une base relationnelle et une base non relationnelle, sans imposer MongoDB.
MongoDB est le choix technique déjà retenu pour ce projet.

## État actuel et niveaux de preuve — 17 novembre 2026

Le code a été sauvegardé dans le commit
`aa420cf12a0ab2da95dc150c13b379ab6af31348`, puis intégré par fast-forward dans
`develop` et `main`. Ces trois branches étaient synchronisées avant cette mise
à jour documentaire, effectuée sur `main`. Aucun nouveau commit documentaire
n'est compris dans cette référence.

| Niveau de preuve | État actuel |
| --- | --- |
| Fonctionnalité développée | Contrôle administrateur actif, consultation des commandes, création/consultation/désactivation des employés, modification des informations et du stock des menus, modération des avis ; périmètre détaillé ci-dessous |
| Test automatisé réussi | Dernière suite complète : 163 tests réussis, aucun échec, le 17 novembre 2026 ; bases PGlite et clients SQL simulés, sans modification de PostgreSQL local |
| Validation sur PostgreSQL local | 009, 010 et 011 appliqués, objets/droits contrôlés en lecture seule ; connexions client/employé/administrateur et parcours client confirmés par le porteur ; acceptation/refus validés localement |
| Validation encore à effectuer | Recette exhaustive de création/désactivation d'employé, édition des menus et modération des avis sur PostgreSQL local ; les tests automatisés ne suffisent pas à la déclarer faite |
| Déploiement public | Non réalisé ; aucune validation sur Neon, Render ou Atlas déclarée |

Les anciens comptes rendus décrivent l'état au moment de chaque développement.
Les mentions « préparé », « non appliqué », « aucun compte actif » ou « aucun
commit » dans ces archives ne remplacent pas cet état courant. Notamment,
`database/REGISTRATION_AUDIT.md` reste un audit daté du 16 novembre, et les
documents de parcours conservés peuvent contenir des instructions antérieures.
Le [README](../README.md) est le point d'entrée actualisé pour l'installation.

## Parcours disponibles

- Connexion habituelle sur `/connexion.html`. Le lien Administration n’apparaît
  que pour le rôle `administrateur`. La page `/administrateur.html` n’affiche
  les données qu’après contrôle de session et du rôle par le serveur.
- Consultation paginée des commandes (50 par page), filtre de statut et de
  client. Le détail et les décisions utilisent l’espace employé existant,
  également accessible aux administrateurs : aucune duplication du traitement
  de refus, de l’historique ou du calcul de stock.
- Consultation des employés actifs et désactivés, création d’un employé,
  désactivation avec confirmation. Ni création d’administrateur, ni changement
  de rôle, ni réactivation, ni suppression de compte dans ces API.
- Consultation et modification des menus existants : titre, description, thème,
  régime, minimum de personnes, prix du minimum en centimes, stock, conditions
  de commande et de conservation, délai de commande en heures.
- Consultation des avis par état de modération, validation ou refus des avis
  en attente uniquement. La décision conserve l’auteur et la date. Le rejeu
  d’une décision identique ne modifie pas cette trace ; une décision contraire
  sur un avis déjà modéré retourne 409. C’est une décision de cette première
  version, le sujet ne précisant pas la remodération.
- Le client peut déposer une note entière de 1 à 5 et un commentaire depuis une
  commande terminée dans Mes commandes. Un seul avis par commande ; le serveur
  vérifie aussi le propriétaire, son activation et son rôle. Le marqueur fictif
  est hérité de la commande, jamais fourni par le client.
- `GET /api/reviews` n’expose que les 20 derniers avis validés associés à une
  commande terminée, sans coordonnées client et avec `isDemo`. Le raccordement
  de ces avis à une véritable page d’accueil reste à faire ; l’accueil actuel
  du projet est encore le message Express de bienvenue.

## Sécurité et choix de fonctionnement

Les routes `/api/admin/*` relisent le rôle et l’activation du compte à chaque
requête. Une session absente, expirée ou désactivée reçoit 401, un client ou
employé actif reçoit 403. Les écritures relisent aussi le rôle dans la transaction
avec verrou partagé du compte administrateur. Les sessions existantes d’un
employé désactivé deviennent inutilisables à la requête protégée suivante :
l’authentification et les routes employés relisent déjà son activation.

La création utilise le validateur d’inscription pour les champs partagés, puis
Argon2id (mémoire 65 536 Kio, trois passes, parallélisme 1). Deux hachages maximum
sont exécutés simultanément dans ce service par processus. Les champs inconnus,
notamment les rôles et indicateurs d’activation imposés, sont refusés.
Le rôle est la constante SQL `employe`. Le prénom, nom et téléphone complètent
les exigences email/mot de passe du sujet pour respecter le schéma et le parcours
de connexion existants. Le mot de passe initial et sa confirmation sont effacés
de l’interface après tentative ; aucun stockage navigateur n’est utilisé.

Le compte, son créateur et la notification `nouvel_employe` sont insérés dans une
même transaction. Un email déjà utilisé produit un conflit 409, sans second
compte. Une panne lors de l’insertion de notification annule aussi la création.
L’envoi SMTP a lieu après validation de la transaction et ne contient aucun
mot de passe ni hachage. Une panne SMTP conserve le compte et la notification
en attente. Avec `EMAIL_MODE=disabled`, aucun email ne part. Le service réutilise
la configuration SMTP actuelle. Il n’existe pas encore de traitement automatique
des notifications en attente ni de garantie de livraison exactement une fois.
Ne pas recréer un compte après une interruption réseau : consulter la liste.

La désactivation cible uniquement `role_code='employe'` sous verrou. Le rejeu ne
change pas la date. Les administrateurs et clients ne peuvent être désactivés
par cette route. Aucun droit de création de rôle PostgreSQL n’est ajouté.

Chaque menu est accompagné d’une empreinte de ses valeurs. Sous verrou de ligne,
le serveur compare l’empreinte reçue aux données actuelles avant d’écrire : si
une commande, un refus ou une autre sauvegarde a changé le stock entre-temps,
la sauvegarde est rejetée (409) et nécessite un rechargement explicite. Les
instantanés de prix, minimum et conditions dans les commandes restent intacts.
Une correction administrative fixe un stock absolu ; elle n’annule aucune
commande. Aucun journal de mouvements de stock n’est ajouté dans cette version.

Bornes techniques de cette version : minimum de 1 à 10 000 personnes, stock de
0 à 1 000 000 commandes, prix de 0 à 100 000 000 centimes, délai de 0 à 8 760
heures, titre de 150 caractères, descriptions/conditions de 5 000 caractères,
avis de 2 000 caractères. Ces bornes ne sont pas des règles imposées par Studi.
Les références de thème et régime doivent exister. Le texte est affiché avec
`textContent` ; les balises et contrôles interdits sont rejetés côté serveur.
Les sauts de ligne sont autorisés dans descriptions, conditions et avis.

Les requêtes sont paramétrées et les mutations reprennent la protection CSRF
existante. Les réponses protégées portent `Cache-Control: no-store`. L’interface
efface les données protégées sur perte de droits et sortie de page, et recharge
si le navigateur restaure la page depuis son cache de navigation.

## SQL : développé, testé en mémoire et appliqué localement

`database/011_admin_privileges.sql` complète les profils 004, 007, 009 et 010.
Il a été revu, corrigé pour limiter les lectures aux colonnes utiles, puis
**appliqué sur PostgreSQL local**, selon la confirmation du porteur du projet.
Les droits effectifs ont été vérifiés en lecture seule. Toute application sur
une nouvelle base exige une revue et une autorisation distinctes, avec le compte
de migration capable de prendre le rôle `vg_owner`.
Il ne crée ni utilisateur ni donnée et n’est jamais lancé au démarrage Express.

Il accorde les lectures de profil nécessaires, l’insertion des marqueurs de
démonstration et du créateur des employés, les mises à jour ciblées d’activation,
les colonnes de menu éditables et les droits nécessaires aux avis. Le droit de
stock existe déjà dans 009. Aucun `DELETE`, droit d’administration PostgreSQL,
accès direct aux séquences ou écriture d’historique de commande n’est ajouté.

Les rôles métier partagent `vg_app` : les restrictions administrateur sont
assurées par Express, pas par RLS. L’ajout de droits SQL est une extension réelle
du périmètre du compte applicatif, à revoir avant chaque nouvelle installation.
Sur une base neuve dépourvue de ces droits, les routes concernées peuvent répondre
503. Les tests appliquent le script exclusivement dans une base PGlite jetable
en mémoire ; cela est distinct de son application locale autorisée par le porteur.
009 et 010 sont également appliqués localement. Ne rejouer ni ces scripts ni
les seeds pour simplement démarrer Express. Les connexions locales utilisent
actuellement les sessions mémoire ; la table de 008 était absente au dernier
audit. La persistance des sessions PostgreSQL reste à valider sur une installation
qui utilise effectivement ce mode.

## Statistiques et MongoDB : analyse avant implémentation

Exigences officielles page 9 : nombre de commandes par menu, comparaison par
graphique dont les données viennent d’une base non relationnelle, chiffre
d’affaires filtrable par menu et durée. Le sujet ne précise pas les statuts
comptabilisés, le traitement des annulations, ni si la livraison fait partie du
chiffre d’affaires. Aucun chiffre n’est inventé dans cette version.

Le dépôt ne fournit actuellement ni client MongoDB, ni connexion, ni projection
des commandes vers MongoDB. Le tableau de bord signale explicitement cette
indisponibilité. Il ne calcule pas de statistiques de substitution en PostgreSQL.

Proposition pour l’étape suivante, à valider avant développement :

1. Une collection MongoDB `order_statistics`, avec un document par commande,
   index unique sur l’identifiant PostgreSQL. Conserver seulement identifiant,
   menu et titre historique, dates, statut, montants en centimes et version de
   projection ; aucune identité ni coordonnée client.
2. Alimenter la projection par une file d’événements durable en PostgreSQL,
   écrite avec la commande dans la même transaction. Un traitement asynchrone
   effectue des upserts idempotents dans MongoDB. Prévoir reprises, contrôles de
   version, rattrapage initial et détection de désynchronisation.
3. Définir avec l’utilisateur les statuts et la date de référence des comptages,
   la politique des commandes annulées/refusées et la définition du CA (part
   menu seule ou livraison comprise). Séparer les données fictives des réelles.
4. Ajouter agrégations MongoDB filtrées, graphique accessible avec tableau des
   valeurs, états vide/erreur et date de fraîcheur de la projection. Tester les
   doublons, événements désordonnés et pannes des deux bases avant exploitation.

Cette proposition est un choix d’architecture documenté, pas une fonctionnalité
déjà réalisée. Aucune dépendance MongoDB ou variable de connexion inactive n’a
été ajoutée prématurément.

## Vérification et suites

**Compte rendu initial :** la première suite comprenait 155 tests réussis.
**Validation automatisée actuelle :** 163 tests ont réussi, sans échec, le
17 novembre 2026 avec `npm.cmd --prefix backend test`, après ajout des 8 tests
du provisionnement administrateur. `git diff --check` et le contrôle de l'index
ont également réussi lors de la sauvegarde Git. Ces résultats sont ceux des
exécutions déjà consignées ; cette mise à jour documentaire ne relance pas de
test ni d'écriture PostgreSQL.

**Validation locale distincte :** les comptes fictifs client, employé et
administrateur fonctionnent désormais sur PostgreSQL installé, selon le porteur
du projet. Les décisions d'acceptation/refus ont été validées sur cette base.
Le contrôle en lecture seule d'une commande refusée a confirmé l'historique et
le stock courant, sans prouver un stock antérieur non journalisé. Aucun résultat
de ces essais locaux n'est assimilé à un déploiement public.

Depuis la racine dans un second terminal si le serveur occupe déjà le premier :

```powershell
npm.cmd --prefix backend test
git diff --check
```

Tests dédiés : `backend/admin.test.js` et `backend/admin-ui.test.js`. Ils utilisent
des comptes fictifs et des schémas en mémoire : autorisations sur chaque route,
Argon2id, rôles imposés, doublons d’email, rollback, SMTP simulé, désactivation et
sessions existantes, validation des menus, stock devenu obsolète, instantanés de
commandes, propriétaire et état d’une commande pour un avis, notes, modération,
publication filtrée, CSRF, états d’interface et doubles soumissions.

La vérification des pages dans un vrai navigateur à 375 px et sur ordinateur,
au clavier, reste nécessaire. Les tests DOM ne prouvent pas la qualité visuelle
ni la conformité RGAA. PGlite sérialise les transactions : les tests de concurrence
entre connexions PostgreSQL réelles restent également à autoriser et effectuer,
au-delà des décisions locales déjà validées.

Pour une vérification fonctionnelle ultérieure, redémarrer Express avec
`node backend/server.js`, sans réappliquer 011 sur la base locale déjà configurée.
Utiliser un administrateur de démonstration provisionné hors de l’application,
dans une base dédiée. Aucune procédure de création d’un administrateur réel
n’est exécutée ou exposée ici. Tester avec SMTP désactivé pour ne pas envoyer
de messages réels.

Limites actuelles, malgré le code et les tests réussis : pas de gestion de galerie,
d’association de plats/allergènes, de création/suppression de menus ou de modification des horaires ;
pas de modération dans l’interface employé ; pas de notification à la terminaison
d’une commande ; pas de nouvelles transitions de livraison/matériel. Ces éléments
du sujet, la réinitialisation du mot de passe, l’accueil et les statistiques
MongoDB restent à compléter. Les e-mails réels ne sont pas validés et aucun
déploiement public n'a été réalisé. La cible gratuite GitHub + Render Free +
Neon Free + Atlas M0 a été validée comme architecture, sans provisionnement ni
adaptateur d'e-mail HTTPS déjà réalisé. La copie officielle à rendre reste
aussi à fournir.

## Fichiers concernés par cette étape

- Nouveaux services : `backend/admin.js`, `backend/reviews.js`.
- Routes et notification réutilisées : `backend/app.js`, `backend/welcome-email.js`.
- Nouvelle interface : `frontend/administrateur.html`, `frontend/administrateur.js`,
  `frontend/administrateur.css` ; les styles communs existants sont réutilisés.
- Raccordement des parcours existants : `frontend/connexion.html`,
  `frontend/connexion.js`, `frontend/mes-commandes.js`.
- Tests : nouveaux `backend/admin.test.js`, `backend/admin-ui.test.js` et extension
  de `backend/auth-ui.test.js` pour le lien réservé à l’administrateur.
- SQL développé, testé en mémoire et appliqué localement : `database/011_admin_privileges.sql`.
- Documentation : ce fichier et `README.md`.

Les autres modifications déjà présentes dans le répertoire de travail avant
cette étape sont conservées.
