# Préparer l’administrateur fictif, sans le créer

Compte exclusivement prévu pour les essais pédagogiques : `admin.test@example.test`,
prénom `Admin`, nom `Fictif`, rôle applicatif `administrateur`, actif et fictif.
Le schéma exige un téléphone : `0600000000` est une valeur de démonstration sans
destinataire réel, reprise du provisionnement employé. Aucune adresse n’est créée.

## Vérifications effectuées en lecture seule le 17 novembre 2026

La base configurée `vite_et_gourmand` fonctionne sous PostgreSQL 18.6. Au moment
du contrôle, aucun email égal à celui prévu, sans distinction de casse, n’existe.
Le code exact `administrateur` existe dans `vg.roles`. L’index unique sur
`lower(email)`, les colonnes, identités automatiques, valeurs par défaut et
contraintes examinées sont compatibles avec l’insertion prévue.

Les nouveaux droits de 011 sont présents. Le rôle PostgreSQL existant
`vg_migrator` peut se connecter à cette base et prendre le rôle propriétaire
`vg_owner`, lequel peut lire et insérer les utilisateurs. Cela a été vérifié dans
les catalogues avec `vg_app`, sans lire de hachage ni de secret. L’authentification
effective de `vg_migrator` reste à vérifier par l’utilisateur avec son mot de passe.
Aucun droit supplémentaire n’est nécessaire pour cette procédure hors application.

## Diagnostic à lancer d’abord

Depuis la racine du dépôt, dans un second terminal si le serveur occupe le premier :

```powershell
powershell.exe -NoProfile -File .\backend\check-demo-admin.ps1
```

Le lanceur demande trois saisies masquées : mot de passe envisagé pour Admin
Fictif, confirmation, puis mot de passe PostgreSQL de `vg_migrator`. Aucun secret
n’est à inscrire dans la commande, dans `.env`, dans un fichier JSON ou dans
l’historique du terminal. Le mot de passe de migration n’est pas celui de
`vg_app`. La configuration de connexion (hôte/base/TLS) provient du `.env` existant.
Le lanceur peut être exécuté depuis un autre dossier en donnant son chemin absolu.

Le lanceur transmet le JSON en entrée standard UTF-8 à :

```powershell
node .\backend\provision-demo-admin.js --check-only
```

Ne pas lancer cette deuxième commande seule sans entrée standard : elle attend
le JSON. Préférer le lanceur pour éviter d’afficher ou de conserver les secrets.

En cas de succès, le diagnostic JSON contient :

```json
{"etape":"diagnostic","resultat":"verification_sans_ecriture_ok","role_applicatif":"administrateur"}
```

Le code de sortie est 0 en cas de succès, 1 sinon. Les erreurs indiquent une
étape, éventuellement un code SQLSTATE et un motif public, jamais le mot de passe,
son hachage, le SQL brut ou les détails de connexion. Un compte existant est
signalé par `disponibilite_compte` / `compte_deja_existant`, sans modification.

## Garanties et mode de création préparé

`backend/provision-demo-admin.js` réutilise `passwordRules`, `safeFailure` et les
types des colonnes communes de `backend/provision-demo-employee.js`, ainsi que
le validateur d’inscription existant. Le script employé reste inchangé.
Les mots de passe exigent 10 à 128 caractères avec majuscule, minuscule, chiffre
et caractère spécial. Le hachage utilise Argon2id, 65 536 Kio, trois passes,
parallélisme 1, y compris au diagnostic pour vérifier le fonctionnement du moteur.
Le hachage n’est pas conservé en mode diagnostic.

Sans option, le comportement est celui de `--check-only`. Ce mode impose
`default_transaction_read_only=on`, `BEGIN READ ONLY`, vérifie le mode effectif,
effectue uniquement des lectures et termine par `ROLLBACK`. `SET LOCAL ROLE`
change temporairement le rôle de la connexion : il ne crée ni rôle ni privilège.

`--create` est pris en charge par le script Node, mais n’est **jamais transmis
par le lanceur de diagnostic** et n’a pas été exécuté sur PostgreSQL. Après une
autorisation distincte, il devra être appelé avec le même transport sécurisé,
après un diagnostic réussi. Il effectue les mêmes contrôles puis une seule
insertion dans une transaction, sans mise à jour ni suppression, et sans aucun
`CREATE ROLE`, `GRANT` ou `REVOKE`. L’email, le rôle et l’identité sont fixes et
ne peuvent pas être remplacés par le JSON. L’index unique protège contre deux
créations simultanées. Une erreur annule la transaction ; si la connexion est
perdue pendant COMMIT, vérifier d’abord l’existence du compte avant toute reprise.
Ne jamais rejouer automatiquement la création après une réponse interrompue.

Il n’y a pas de notification `nouvel_employe` pour cet administrateur : ce type
d’événement est réservé aux employés et aucune notification administrateur n’est
prévue par le schéma. Aucun email n’est envoyé par cette procédure.

## Tests sans écriture PostgreSQL

```powershell
node --test backend/provision-demo-admin.test.js backend/provision-demo-employee.test.js
git diff --check
```

Les clients SQL des tests dédiés sont entièrement simulés, y compris en mode
`--create` : aucune base ni compte n’est créé. Le calcul Argon2id est réellement
vérifié en mémoire. La validation réelle complète avec les secrets de
l’utilisateur n’est pas annoncée comme effectuée.
