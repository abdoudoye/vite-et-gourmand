# Espace employé — traitement des commandes en attente

## État au 18 novembre 2026

**Développé :** consultation et décisions initiales décrites ci-dessous.
**Tests automatisés :** 163 réussis lors du dernier audit global, sans nouvelle
exécution pour cette documentation. **PostgreSQL local :** acceptation/refus
validés. **Production :** les connexions des trois rôles sont confirmées par le
porteur ; cela ne prouve pas une recette exhaustive des décisions sur Neon.
L'espace est disponible sur https://vite-et-gourmand-y9b8.onrender.com/employe.html.
Voir [déploiement](DEPLOIEMENT.md). Les e-mails réels sont désactivés.

## Périmètre et source

Le sujet officiel fourni hors dépôt décrit l'espace employé page 8 et les droits
administrateur page 9. Il prévoit le suivi « accepté », « en préparation »,
« en cours de livraison », « livré », « en attente du retour de matériel » si
nécessaire, puis « terminée ». Le refus d'une demande en attente utilise ici
`refusee`, **déjà présent dans le schéma existant**, comme `en_attente` et `annulee`.
Aucun statut n'est ajouté par cette mission.

Le périmètre prioritaire implémenté est la consultation et la décision initiale :

| État actuel | Action de cette interface | Résultat |
| --- | --- | --- |
| `en_attente` | Accepter | `accepte`, date d'acceptation, historique ; aucune variation de stock. |
| `en_attente` | Refuser après contact | `refusee`, motif et contact tracés, historique ; restitution d'une réservation. |
| `accepte` | Répéter l'acceptation | Même résultat, sans nouvel historique. |
| `refusee` | Répéter le refus valide | Même résultat, sans nouveau contact ni restitution. |
| Tout autre état | Accepter/refuser | Refus 409. Les transitions arbitraires ne sont pas disponibles. |

La suite du cycle attendu est `accepte → en_preparation → en_livraison → livre`,
puis `terminee` sans matériel, ou `attente_retour_materiel → terminee` après retour.
Ces transitions ne sont **pas encore exposées** par cette interface : le prêt,
les 10 jours ouvrés, la notification et les conditions de restitution devront être
traités ensemble avant de les proposer. L'annulation par le client reste réservée
à `en_attente` dans son espace et conserve le statut distinct `annulee`.

## Authentification et droits

`POST /api/auth/login` et `GET /api/auth/me` reconnaissent désormais les trois
rôles existants : `utilisateur`, `employe`, `administrateur`. Le mot de passe est
toujours vérifié par Argon2id, les erreurs de connexion restent génériques et
le rôle provient uniquement de la base. L'inscription publique continue d'imposer
`utilisateur` ; aucun compte employé ou administrateur n'est créé par ce parcours.

La session et le cookie sont réutilisés : HttpOnly, SameSite=Lax, Secure en
production et deux heures maximum. Ni mot de passe, ni hachage, ni identifiant
de session dans les réponses JSON ou le stockage JavaScript du navigateur.

Chaque route employé relit le compte, son activation et son rôle en base. Les
écritures revérifient ces droits dans la transaction. Sans session : 401 ; compte
client : 403 ; compte désactivé ou session expirée : 401. Les routes de commande
client conservent leurs propres restrictions au rôle `utilisateur`.

Le HTML `employe.html` est une coquille publique sans donnée métier. Ses données
ne sont obtenues qu'auprès des API protégées. La page affiche le refus d'accès
pour un client, et conduit à la connexion si la session n'est plus valide. La
connexion affiche le lien vers l'espace employé seulement pour le personnel.
Les contrôles ne reposent jamais uniquement sur ce lien ou sur le JavaScript.
Les données affichées sont effacées en quittant cette page ; un retour depuis
le cache de navigation force une nouvelle vérification de session.

## API

| Route | Usage |
| --- | --- |
| `GET /api/employee/orders` | Liste paginée par 50, sans coordonnées personnelles dans la projection de liste. |
| `GET /api/employee/orders/:id` | Détail nécessaire au traitement : client, livraison, montants, conditions, historique et contacts déclarés. |
| `POST /api/employee/orders/:id/decision` | Accepter ou refuser une demande en attente. |

La liste accepte `status`, `clientId` (identifiant du client) et `offset`. Tous
sont validés côté serveur ; les paramètres SQL sont séparés de la requête.
Les références, menus, dates, quantités, totaux et statuts sont repris des tables
existantes et de `order_totals`. Les totaux ne sont pas réécrits par cette API.

Les POST exigent `X-Requested-With: ViteGourmand` et le contrôle Origin/Fetch
Metadata existant ; aucun accès CORS n'est accordé. Le JSON est limité à 4 Ko.
Les objets renvoyés sont construits par projections explicites, sans `users.*`
et sans `password_hash`. Le détail est réservé au personnel : ses coordonnées
ne doivent pas être exportées, photographiées ou ajoutées aux journaux.

## Refus et contact préalable

Une acceptation transmet seulement `{ "status": "accepte" }`.
Un refus demande `status=refusee`, un motif de 1 à 500 caractères et
`contact={method,at}` : `method` vaut `telephone` ou `email`, `at` est une date
UTC ISO valide, passée ou présente. La page convertit l'heure locale saisie dans
le navigateur en UTC ; l'affichage des dates de commande/historique utilise Paris.

L'employé doit **effectuer le contact avant de le déclarer**. L'application ne
passe aucun appel et n'envoie aucun email à sa place. Cette trace est déclarative,
elle ne constitue pas une preuve automatisée de l'échange.

Le motif est conservé dans `orders.change_reason` et l'historique. Le mode,
l'heure, le motif et l'employé sont conservés dans `order_contacts`. L'action
`annulation` est réutilisée pour tracer le refus qui annule la demande, car le
schéma limite ce champ à `modification`/`annulation`. Le statut reste `refusee` et
`cancelled_at` n'est pas rempli comme s'il s'agissait d'une annulation client.
Aucune nouvelle valeur métier n'est introduite dans les contraintes SQL.

## Transaction, concurrence et stock

La décision est faite en transaction `READ COMMITTED` sur une seule connexion :

1. vérification des droits employés ;
2. verrou `SELECT ... FOR UPDATE` sur la commande ;
3. relecture de son statut après obtention du verrou ;
4. en cas de refus, insertion du contact et restitution d'une unité au menu ;
5. changement de statut, auteur et motif, puis historique via le trigger existant ;
6. COMMIT de l'ensemble, ou ROLLBACK sur erreur.

Une réservation correspond à une commande, pas au nombre de personnes. Les
actions client prennent elles aussi le verrou de cette commande. Si refus et
annulation se croisent, un seul changement gagne ; le second voit l'état terminal
et ne restitue rien. Même principe entre acceptation et annulation/refus.
Le rejeu du même résultat ne modifie ni l'auteur ni la date de la première décision.
Pour une répétition de refus, les champs obligatoires restent exigés, et la trace
du premier contact est conservée. Il n'existe pas de retour automatique vers
`en_attente` ou de possibilité de réaccepter un refus.

L'historique conserve date, état, auteur et raison grâce à `orders_changed_history`.
Le compte web ne reçoit aucun droit d'écriture directe dans cette table. Le détail
prend un verrou partagé court sur la commande pour éviter de mélanger un ancien
résumé avec l'historique d'une décision concurrente.

## SQL appliqué et limites de validation

`database/010_employee_privileges.sql` complète les profils 007/009 :

- UPDATE uniquement sur la colonne supplémentaire `orders.accepted_at` ;
- lecture des contacts de commande ;
- INSERT sur les colonnes nécessaires à leur traçabilité.

Les autres lectures et mises à jour ciblées de statut/stock existent déjà dans
009. Aucun UPDATE `customer_*`, écriture sur les totaux, DELETE de commande,
droit DDL ou nouvelle séquence n'est ajouté. Les tables et statuts existants
sont conservés ; le script ne crée aucun compte et ne modifie aucune donnée.
Ces GRANT sont réexécutables, mais ne doivent pas servir à rejouer les scripts
d'initialisation. Ne pas rejouer 004 : il retirerait les droits ajoutés depuis.

L'isolation des utilisateurs finaux reste applicative : `vg_app` est un compte
technique partagé. Le profil SQL ne distingue pas une session client d'une session
employé et ne remplace pas les contrôles des routes ; aucune politique RLS n'est
présentée comme implémentée.

Le contrôle initial READ ONLY avait constaté l'absence des droits de 010 et de
comptes de personnel actifs. C'est un état historique : 010 a depuis été appliqué
sur PostgreSQL local et Neon. Les comptes de démonstration ont été provisionnés
séparément du seed ; leurs connexions en production sont confirmées.

## Recette métier après autorisation

Exemple historique pour une nouvelle base locale uniquement, après revue et
autorisation. Ne pas rejouer sur les bases déjà configurées :

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -h 127.0.0.1 -p 5432 -U vg_migrator -d vite_et_gourmand -W -v ON_ERROR_STOP=1 -f database/010_employee_privileges.sql
```

010 fait partie des huit scripts déjà appliqués sur Neon ; aucune migration
n'est requise pour se connecter. Le compte doit être actif, de rôle `employe`
ou `administrateur`, avec un hachage Argon2id valide. Les comptes du seed sont
inactifs et ne remplacent pas les comptes provisionnés pour le jury.

Pour une recette locale, démarrer Express sans migration et utiliser un second
terminal si nécessaire. En production, passer par `/connexion.html` puis le lien
employé. Garder `EMAIL_MODE=disabled`. La connexion crée une session SQL ; les
décisions modifient les données : une nouvelle recette nécessite une autorisation.
Les validations locales ne suffisent pas à déclarer tous ces essais réalisés sur Neon.

Préparer des commandes fictives via le parcours client autorisé afin qu'une
réservation ait bien été faite. Ne pas utiliser une commande déjà annulée/refusée
comme si elle était encore en attente. Tester :

1. refus d'accès anonyme/client, accès employé et administrateur ;
2. liste, filtres et pagination, détail et suivi au clavier et à 375 px ;
3. acceptation : stock inchangé et historique `en_attente → accepte` ;
4. refus après contact fictif clairement signalé comme test : stock +1 et un seul contact ;
5. double clic et deux onglets concurrents, puis refus/annulation en parallèle ;
6. impossibilité de modifier/annuler côté client après acceptation.

Ces essais écriront dans la base : ils doivent être autorisés. Le stock initial
doit être relevé avant le test ; la base ne dispose pas encore d'un journal des
mouvements de stock permettant de le reconstituer rétrospectivement.

## Tests automatisés et limites

```powershell
npm.cmd --prefix backend test
git diff --check
```

Les tests utilisent exclusivement des comptes et données fictifs dans PostgreSQL
WASM en mémoire, les scripts du projet, des sessions HTTP et des doublures DOM.
Ils couvrent les trois rôles, les accès refusés, la désactivation/changement de
rôle après connexion, les transitions, les rejeux, les décisions concurrentes,
la course avec les actions client, le stock, l'historique et le rollback d'un refus.
Les tests existants de catalogue, inscription, connexion et commandes sont inclus.

PGlite sérialise ses transactions : un test multi-connexions sur PostgreSQL réel
reste nécessaire après autorisation. Les tests DOM ne constituent pas une
vérification visuelle complète ni un audit RGAA. L'espace employé de cette étape
ne gère pas encore les menus/plats/horaires, la modération des avis, les autres
étapes de livraison, le matériel ou les statistiques administrateur.
