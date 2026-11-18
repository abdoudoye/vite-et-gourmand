# Parcours de commande client

## État au 18 novembre 2026

**Développé :** devis, prix détaillé, confirmation transactionnelle, réservation,
modification et annulation avant acceptation. **Tests automatisés :** dernier
audit global de 163 tests réussis, non relancés pour cette documentation.
**PostgreSQL local :** parcours client et décisions employé validés.
**Production :** catalogue, commandes client et réservation du stock confirmés
par le porteur sur Render/Neon ; les scénarios exhaustifs restent à recetter.
Voir [déploiement](DEPLOIEMENT.md) et https://vite-et-gourmand-y9b8.onrender.com/.
Les e-mails sont désactivés ; l'inscription crée un client actif sans confirmation
par e-mail. Aucun envoi réel n'est nécessaire pour se connecter ou commander.

## Source et décisions

Le sujet officiel Studi fourni hors dépôt décrit les commandes page 7 et le
suivi pages 7–8. Les consignes du projet imposent la validation serveur, les
tarifs en centimes et l'absence de distances inventées.

**Décision explicitement validée par l'utilisateur pendant cette mission :**
le prix des personnes supplémentaires est un prorata du prix minimum :

1. `brut = arrondi_centime(prix_minimum × personnes / minimum)` ;
2. remise de 10 % du brut dès `personnes >= minimum + 5`, arrondie au centime ;
3. ajout de la livraison, qui ne bénéficie pas de cette remise.

Les opérations monétaires emploient des entiers/BigInt pour éviter les erreurs
binaires de décimales. Exemple **fictif** : 180 € pour 6 personnes, 11 personnes
=> 330 € brut − 33 € de remise = 297 €, avant livraison.
`ORDER_EXTRA_PRICING=prorata` est le défaut validé. `disabled` permet de bloquer
temporairement les quantités supérieures au minimum sans calcul alternatif.

## Pages et session

- Les fiches menus conservent le lien `commande.html?menu=ID`.
- `commande.html` obtient le contexte auprès de l'API protégée. Sans session
  client active, la navigation conduit à `connexion.html?next=...`.
- Seule une destination locale `commande.html?menu=ID` (avec éventuellement
  `&order=ID`) est autorisée. Les redirections externes, paramètres ajoutés,
  doublons et identifiants imprécis sont refusés.
- La sélection est conservée jusqu'à l'inscription, puis la connexion. Une fois
  connecté, le lien « Reprendre ma commande » retourne au menu choisi.
- Identité et téléphone proviennent du compte, l'adresse de la première adresse
  active en privilégiant l'adresse par défaut. Changer l'adresse de livraison
  ne modifie pas l'adresse enregistrée dans le compte.
- La page réutilise les styles accessibles et responsive de l'inscription ;
  champs labellisés, états de chargement, erreurs avec alerte, focus au devis,
  texte des données inséré via `textContent`.
- `mes-commandes.html` affiche les commandes du client, leur détail et leur
  historique par pages de 50. La modification et l'annulation sont proposées
  uniquement pour `en_attente`. Les refus sont aussi imposés côté serveur.

Les cookies et leur protection restent ceux de la connexion : HttpOnly,
SameSite=Lax, Secure en production ; aucun jeton d'authentification dans le
stockage JavaScript du navigateur. Toutes les routes POST de commandes utilisent
le contrôle CSRF existant (en-tête non simple, Origin et Fetch Metadata, sans CORS).

## Dates et conditions

Dates et heures sont interprétées en **Europe/Paris**, indépendamment du fuseau
de Windows. Les dates impossibles, les heures inexistantes au passage à l'heure
d'été et les heures ambiguës au passage à l'heure d'hiver sont refusées : le
client doit choisir un autre horaire. La livraison ne peut pas être après la date
de prestation. Elle doit être future et respecter `menus.notice_hours`.

Le contrôle du délai par rapport à la livraison, antérieure ou égale à la
prestation, est un choix technique conservateur. Un délai non configuré (`NULL`)
bloque le devis plutôt que supposer une valeur. Les autres conditions textuelles
de commande/conservation sont affichées et doivent être acceptées ; elles ne
sont pas interprétées arbitrairement par un analyseur de texte.

`ORDER_TERMS_VERSION=DEMO-conditions-v1` identifie les conditions pédagogiques.
Une version de vraies conditions contractuelles doit être configurée et publiée
avant exploitation commerciale. Sans version en production, le devis est bloqué.
Ce parcours n'est pas un audit juridique ou RGAA complet.

## Livraison fiable, sans distance simulée

La gratuité de livraison à Bordeaux nécessite `countryCode=FR`, la ville Bordeaux (normalisée) et
un code postal bordelais parmi 33000, 33100, 33200, 33300, 33800. Cette validation
de saisie ne vérifie pas l'existence réelle de la voie : une validation postale
ou géographique reste à intégrer avant exploitation commerciale.

Pour une autre adresse, l'API recherche une entrée **non expirée** dans
`vg.delivery_distances`. Sa clé est le SHA-256 d'une représentation normalisée
de la voie, du complément, du code postal, de la ville et du pays. La distance
est associée à une référence de source, un vérificateur et une date de validité.
Le compte `vg_app` peut seulement lire cette table.

Un opérateur autorisé doit vérifier un itinéraire routier à partir du point de
départ réel du traiteur, archiver la source consultée et la méthode (notamment
aller simple ou trajet réellement facturé), vérifier l'adresse et inscrire cette
distance avec le compte de migration **après autorisation distincte**. Le choix
du point de départ et de la convention de trajet n'est pas inventé par le code.
Il n'existe pas encore d'interface employé pour cette alimentation.

Si aucune entrée fiable n'existe : réponse 422 et commande bloquée pour cette
adresse. Les champs `distanceKm`, `distanceSource` ou `totalCents` envoyés par
le navigateur sont ignorés. Aucune requête n'est faite vers un service externe
avec les coordonnées du client et aucune distance de démonstration n'est insérée
par la migration. Les distances des tests sont explicitement fictives et restent
dans PostgreSQL WASM en mémoire.

Tarif : `500 + arrondi(distance_en_millièmes_de_km × 59 / 1000)` centimes.
La distance et la source sont enregistrées dans la commande. Si elles changent
entre devis et confirmation et modifient son calcul, un nouveau devis est demandé.

## Devis, confirmation et stock

Un devis stocké côté serveur est valable **15 minutes**. Il comprend la saisie
validée, le calcul et une empreinte du tarif/conditions du menu ; il est attaché
au client connecté. Son UUID n'est pas un moyen d'authentification.
Le calcul et l'empreinte sont indépendants de l'ordre des clés JSON (PostgreSQL
jsonb peut les réordonner). Le devis ne réserve aucun stock.

La confirmation fournit seulement l'UUID du devis et une clé d'idempotence UUID.
En transaction `READ COMMITTED` explicitement choisie sur **une même connexion**
PostgreSQL, le backend :

1. sérialise les opérations du même client avec un verrou transactionnel ;
2. vérifie à nouveau le client et recherche un reçu d'idempotence existant ;
3. vérifie la propriété et l'expiration du devis ;
4. verrouille le menu avec `FOR UPDATE`, recalcule et compare le devis ;
5. décrémente le stock conditionnellement à `stock_available > 0` ;
6. insère la commande, sa ligne, la notification et le reçu d'idempotence ;
7. valide avec COMMIT, ou annule l'ensemble avec ROLLBACK.

Une unité de stock correspond à **une commande**, pas à une personne. Les triggers
existants copient les données du menu et produisent l'historique initial daté.
Le statut initial est `en_attente`. Les montants source sont persistés dans
`orders`/`order_items` ; le net et le total utilisent les colonnes calculées et
la vue `order_totals` existantes, sans total redondant modifiable.

Le même devis confirmé avec la même clé restitue sa commande sans nouvelle
réservation ni notification. Le même devis avec une autre clé est refusé (409),
comme la réutilisation d'une clé pour un autre devis. Une nouvelle paire
devis/clé peut créer une nouvelle commande. Ces vérifications sont faites après
le verrou transactionnel du client ; les contraintes uniques complètent cette
sérialisation. Les UUID sont comparés sous leur forme canonique en minuscules.
Les clés restent attachées à leur client. En cas de coupure réseau,
la page conserve sa clé pour réessayer ; après rechargement, consulter Mes commandes
avant de repartir sur un nouveau devis. Deux nouveaux devis constituent deux
intentions distinctes : aucune déduction arbitraire par similitude d'adresse.

Une modification avant acceptation garde le menu et ses valeurs de référence
historiques ; la quantité et les données de livraison sont recalculées avec un
nouveau devis. Le stock déjà réservé ne change pas. Un devis de modification
devenu obsolète après une autre modification est refusé. L'annulation exige un
motif, produit le statut `annulee` et restitue une unité de stock une seule fois.
L'acceptation par un employé bloque les deux actions, y compris si la page client
était déjà ouverte avant ce changement.

Les comptes SQL techniques sont partagés par le backend : les clauses
`user_id=$1` imposent l'isolation dans toutes les lectures/actions. Le profil SQL
ne remplace pas cette autorisation applicative et n'implémente pas RLS.

## Confirmation par email

L'événement `confirmation_commande` entre dans `email_outbox` dans la même
transaction, sans mot de passe ni jeton. Un texte de confirmation est préparé
par `order-email.js`. Avec `EMAIL_MODE=disabled` (défaut local), aucun transport
SMTP n'est créé : l'événement reste `en_attente`. Ce mode est aussi celui de
la production ; aucun e-mail réel ne part et cela ne bloque pas la commande.

Avec SMTP explicitement configuré, l'envoi est tenté **après COMMIT**, puis
l'événement est marqué `envoye` si le serveur SMTP l'accepte. Un échec laisse
la commande créée et l'événement en attente ; il ne doit pas conduire le client
à recréer la commande. Le rejeu d'une confirmation n'envoie pas un second email.
Un worker de reprise reste à développer, avec gestion des doublons en cas de
réponse SMTP acceptée suivie d'un échec de mise à jour SQL.

## SQL et étapes manuelles

Le contrôle READ ONLY initial précédait 009. Depuis, `order_quotes`,
`order_receipts` et `delivery_distances` existent sur PostgreSQL local et Neon.
Sur Neon, les huit scripts 001, 002, 004, 007, 008, 009, 010 et 011 ont été
appliqués avec COMMIT et contrôle indépendant. Ne pas rejouer ces migrations.

`database/009_order_checkout.sql` crée ces trois tables et leurs index, puis ajoute
les lectures et écritures ciblées nécessaires au profil restreint. Il réutilise
les tables/contraintes existantes et ne crée pas de séquence. Il n'ajoute aucun
compte, commande ou distance. L'application ne l'exécute jamais automatiquement.
Le script suppose le schéma 001 et les droits de base de 004/007 installés ;
008 est nécessaire au stockage PostgreSQL des sessions, utilisé sur Render.
Sa table est présente sur Neon ; le mode mémoire est une option locale.

**Référence pour une nouvelle base locale seulement**, après revue et
autorisation ; ne pas exécuter sur les bases déjà configurées :

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -h 127.0.0.1 -p 5432 -U vg_migrator -d vite_et_gourmand -W -v ON_ERROR_STOP=1 -f database/009_order_checkout.sql
```

Ne pas rejouer le profil 004 ensuite : il retirerait les nouveaux droits.
Ne pas appliquer 009 deux fois : les créations ne remplacent pas les objets.
Avant toute application, faire la sauvegarde prévue pour l'environnement cible.
L'entretien des devis expirés inutilisés devra préserver ceux référencés par
les reçus ; les durées de conservation des adresses/devis relèvent de la politique
RGPD à préciser. Aucun effacement automatique n'est exécuté.

Pour une base locale déjà configurée, démarrer le serveur sans migration (Ctrl+C dans son
terminal, puis commande ci-dessous) ; utiliser un second terminal pour les autres
commandes. Ne pas lancer un second serveur sur le même port.

```powershell
$env:SESSION_STORE = 'memory'
$env:EMAIL_MODE = 'disabled'
node backend/server.js
```

Avec un compte client actif autorisé, ouvrir http://127.0.0.1:3000/menus.html,
choisir une fiche puis Commander, vérifier la conservation du menu à la connexion,
les coordonnées, le délai, le prix détaillé et la liste des commandes. Une validation
sur ce serveur **écrira réellement dans PostgreSQL** : elle nécessite l'autorisation
de créer une commande. Les données du catalogue restent explicitement fictives.
Tester hors Bordeaux seulement après validation et alimentation autorisées d'une
distance sourcée. Ne jamais utiliser une distance de test comme distance réelle.

## Tests et limites de vérification

```powershell
npm.cmd --prefix backend test
git diff --check
```

Les tests de règles couvrent prorata, minimum, remise, centimes, délais, heures
Paris et distances. Les tests HTTP/PostgreSQL utilisent une base PGlite jetable
et les scripts réels sous `vg_app`, avec transactions. Ils vérifient accès,
stock, doubles confirmations, total SQL/historique, annulations répétées,
modifications, prix changé, devis expiré, rollback après panne de notification et
SMTP simulé. Les tests UI emploient une doublure DOM pour vérifier le parcours,
les erreurs et l'invalidation d'un devis après modification du formulaire.

La réservation dès `en_attente` a été vérifiée en production. L'acceptation
employé ne décrémente pas à nouveau. L'API catalogue utilise `no-store`, mais une
page déjà ouverte conserve les données chargées tant qu'elle n'est pas rechargée.
Les commandes du seed ne sont pas passées par la réservation applicative. Sans
journal de mouvements, un stock antérieur non relevé ne peut pas être reconstitué.

PGlite sérialise ses transactions sur sa connexion interne : les tests de requêtes
concurrentes ne remplacent pas un test multi-connexions sur PostgreSQL installé.
Ce dernier, l'affichage réel à 375 px et au clavier, la source de distances et un
envoi SMTP réel restent des vérifications manuelles après autorisation appropriée.
L'[espace employé](ESPACE_EMPLOYE.md) traite désormais l'acceptation et le refus
des demandes en attente. Le cycle de livraison et de retour de matériel jusqu'à `terminee` reste
incomplet. Le dépôt d'avis est développé mais exige une commande terminée ;
l'ensemble de l'ECF n'est pas déclaré terminé.
