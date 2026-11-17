# Audit avant inscription réelle — 16 novembre 2026

## Conclusion

**Techniquement oui**, l'inscription peut être testée avec les droits installés.
**Le moindre privilège n'est pas encore atteint** pour le périmètre actuel :
le profil général de `003_app_privileges.sql` anticipe les fonctionnalités futures.
Recommandation : autoriser et appliquer `004_registration_privileges.sql` avant
le premier test réel. Aucun blocage de schéma ou de séquence n'a été identifié.
Une autorisation explicite reste nécessaire avant ce changement de droits et
avant toute création de compte réel dans la base installée.

## Observations sur l'installation réelle

Audit effectué avec la configuration locale, sans afficher `.env`, ses secrets,
ni les données personnelles des utilisateurs. Chaque connexion d'audit a utilisé
`default_transaction_read_only=on`, une transaction `BEGIN READ ONLY`, terminée
par `ROLLBACK` ou par fermeture en cas d'erreur. Aucun INSERT, UPDATE, DELETE,
GRANT, REVOKE, nextval ou setval n'a été exécuté sur PostgreSQL installé.

- PostgreSQL **18.6**, connecté comme `vg_app`.
- Aucun superutilisateur, création de base/rôle, réplication ou contournement RLS.
- Aucune appartenance à un autre rôle ; aucun droit CREATE sur la base,
  `public` ou `vg`, ni TEMP sur la base.
- Tables et séquences du projet appartenant à `vg_owner` ; `vg_app` n'est pas propriétaire.
- `vg.users`, `vg.addresses`, `vg.email_outbox` : SELECT, INSERT et UPDATE présents.
- `vg.roles` : SELECT uniquement ; la ligne `utilisateur` est présente.
- Mais aussi des écritures sur catalogue, commandes, avis, horaires et jetons,
  dont des DELETE sur certaines tables d'association et les jetons : inutiles
  au catalogue public et à l'inscription actuellement développés.
- Aucun TRUNCATE, REFERENCES ou TRIGGER accordé à `vg_app` sur les tables observées.
- RLS désactivée ; aucun trigger utilisateur sur les trois tables d'inscription.
- Fonctions du schéma `vg` non exécutables directement par `vg_app`.

### Intégrité et identifiants

- `users_email_ci_idx` : index UNIQUE valide et prêt sur `lower(email)`.
  Il correspond exactement à `ON CONFLICT (lower(email)) DO NOTHING`.
- `addresses_default_idx` : unicité de l'adresse active par défaut par utilisateur.
- Clés primaires et clés étrangères présentes et validées : rôle, utilisateur
  de l'adresse et utilisateur de l'événement de bienvenue.
- `users.id`, `addresses.id`, `email_outbox.id` sont `GENERATED ALWAYS AS IDENTITY`.
  Séquences : `vg.users_id_seq`, `vg.addresses_id_seq`, `vg.email_outbox_id_seq`.
- USAGE et SELECT présents sur toutes les séquences ; UPDATE absent.
  La lecture de `last_value` et `is_called` a confirmé, sans afficher ces valeurs,
  que le prochain identifiant de chacune des trois séquences est supérieur au
  maximum de sa table. Aucun identifiant n'a été consommé par l'audit.
- Pas de création, réinitialisation ou synchronisation de séquence nécessaire.
  Les trous d'identifiants après un conflit ou un échec sont normaux : un ROLLBACK
  n'annule pas l'avancement d'une séquence. Ne pas tester un INSERT réel « juste
  pour voir » sous ROLLBACK si l'objectif est de ne rien changer.

## Analyse de POST /api/auth/register

`registration.js` impose le rôle métier `utilisateur`, normalise l'email,
valide le formulaire côté serveur et génère un hachage Argon2id salé.
Le rôle technique PostgreSQL reste `vg_app` : il est distinct du rôle métier.
Seul le hachage, jamais le mot de passe, passe comme paramètre SQL.

Le compte, l'adresse et la notification sont créés dans une seule instruction
avec des CTE d'écriture. Une erreur d'adresse ou d'outbox annule cette instruction.
L'index unique protège les inscriptions concurrentes ; un conflit ne crée ni
adresse ni email supplémentaire. L'inscription produit un compte actif hors
jeu de démonstration (`is_demo=false`), même si les coordonnées de test sont fictives.

La requête exacte a été planifiée par **EXPLAIN sans ANALYZE** sur la base réelle,
avec des paramètres fictifs : planification réussie, aucune exécution.
Cela ne prouve pas l'insertion réelle, mais confirme notamment la résolution des
objets, de l'index arbitre et des droits requis par le planificateur.

Le backend vérifie les attributs du compte technique avant chaque requête, mais
ne détecte pas les droits DML trop larges. Le profil proposé réduit ces droits.
Il ne remplace pas les autorisations métier : INSERT sur `role_code` permet
toujours à un détenteur du secret PostgreSQL de choisir un rôle existant.
La route publique fixe ce champ dans son SQL ; aucune isolation RLS ou fonction
SQL dédiée ne garantit ici le rôle client en cas de compromission du backend.

## Scripts préparés, non exécutés sur la base réelle

| Fichier | Usage |
| --- | --- |
| `004_registration_privileges.sql` | Retire les droits sur tables, colonnes et séquences de `vg_app`, puis accorde seulement les lectures du catalogue et les colonnes nécessaires à l'inscription/notification. |
| `005_registration_privileges_undo.sql` | Restaure le profil de `003`, tel qu'observé durant l'audit ; réservé au retour arrière autorisé. |
| `006_verify_registration.sql` | Vérification après inscription : uniquement des booléens, aucun nom, adresse, téléphone, email, mot de passe ou hachage affiché. |

Les scripts `004` et `005` ont été appliqués **uniquement en PostgreSQL WASM
en mémoire** : inscription, conflit d'email et catalogue valides sous le profil
restreint, écritures hors périmètre et accès au hachage refusés, retour aux droits
précédents vérifié. La génération automatique des IDENTITY fonctionne sans
droits d'appel direct aux séquences. Les références officielles sont :
[INSERT et privilèges](https://www.postgresql.org/docs/18/sql-insert.html),
[colonnes IDENTITY](https://www.postgresql.org/docs/18/ddl-identity-columns.html).

Le profil restreint retire volontairement les droits des fonctionnalités encore
absentes (commandes, connexion/réinitialisation, gestion employés). Les futures
missions devront ajouter leurs droits ciblés après revue. Ne pas rejouer `003`
après `004`, cela rétablirait les droits larges. Aucune fonction de l'application
actuellement développée n'exige ces droits retirés.

## Commandes après autorisation

Depuis la racine du dépôt, dans PowerShell. Le chemin `psql.exe` ci-dessous a été
vérifié sur cette machine. L'option `-X` ignore le fichier de configuration psql,
et `ON_ERROR_STOP` interrompt le script à la première erreur. Le mot de passe
de migration est demandé à l'écran : ne pas l'inclure dans la commande ou Git.

Après autorisation de réduire les droits, utiliser le compte de migration,
jamais le compte web ni une modification de DB_USER dans `.env` :

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -h 127.0.0.1 -p 5432 -U vg_migrator -d vite_et_gourmand -W -v ON_ERROR_STOP=1 -f database/004_registration_privileges.sql
node backend/audit-registration.js
npm.cmd --prefix backend run check:db
```

La première commande modifie les privilèges et n'a PAS été exécutée.
Les deux suivantes sont en lecture seule. L'audit doit notamment se terminer par
`register_plan {"planned_without_execution":true}`. Après restriction, les
privilèges au niveau table peuvent être absents même si les droits par colonne
sont présents : consulter également `column_privileges` dans le résultat.
L'audit ne lit pas les coordonnées ni les hachages.

Après autorisation de créer le compte de test :

```powershell
$env:EMAIL_MODE = 'disabled'
node backend/server.js
```

Si un serveur occupe déjà le terminal ou le port 3000, ne pas en lancer un second
sur le même port. Redémarrer volontairement le serveur existant pour charger la
configuration. Utiliser un second terminal pour les vérifications HTTP.
Ouvrir http://127.0.0.1:3000/inscription.html ; saisir des coordonnées **fictives**,
l'email réservé `inscription.audit@example.test` et un mot de passe de test
conforme, dédié et non réutilisé. Au moment de l'audit cet email était disponible.
Saisir le mot de passe dans le navigateur, pas dans une commande historisée,
une capture d'écran ou un message. Ne pas enregistrer ce mot de passe dans le
gestionnaire du navigateur. Cliquer une fois sur « Créer mon compte ».

Attendu : HTTP `201`, compte créé et envoi d'email désactivé. La base sera
effectivement modifiée par cette étape : un compte, une adresse et un événement
de bienvenue. Aucun email réel n'est envoyé avec ce mode.

## Vérification sans données sensibles

Dans un second terminal, après la création autorisée :

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -h 127.0.0.1 -p 5432 -U vg_migrator -d vite_et_gourmand -W -v ON_ERROR_STOP=1 -f database/006_verify_registration.sql
```

Le compte de migration sert ici à lire les indicateurs que le compte web restreint
n'a pas à lire. Les neuf colonnes doivent valoir `t` en mode email désactivé :
compte unique, rôle client, actif, hors seed, format Argon2id, une adresse,
adresse principale, un événement de bienvenue, email en attente.
Le préfixe Argon2id seul ne démontre pas la qualité cryptographique : les tests
automatisés vérifient aussi le hachage et les sels avec la bibliothèque Argon2.

Ne pas afficher `SELECT * FROM vg.users` ni le hachage. Ne pas exporter la requête
POST ni son corps dans une capture réseau. Aucun nettoyage SQL automatique du
compte de test n'est fourni : une suppression ou désactivation demanderait une
autorisation distincte et une vérification des références.

Retour arrière éventuel, seulement après autorisation dédiée :

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -X -h 127.0.0.1 -p 5432 -U vg_migrator -d vite_et_gourmand -W -v ON_ERROR_STOP=1 -f database/005_registration_privileges_undo.sql
```

## Limites

Le compte `vg_migrator` et son secret n'ont pas été utilisés pendant l'audit :
leur connexion reste à vérifier au moment d'une application autorisée.
Les scripts doivent être réévalués si les objets ou les droits changent après cet
audit. SMTP réel, affichage navigateur et livraison de l'email ne sont pas validés
par cet audit SQL. Aucun commit, merge ou push n'a été effectué.
