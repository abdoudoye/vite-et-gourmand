# Diagnostic UTF-8 et réparation appliquée — 11 novembre 2026

La réparation UTF-8 des **78 valeurs** a été appliquée avec succès le
**11 novembre 2026** sur la base locale PostgreSQL `vite_et_gourmand`, après une
sauvegarde préalable. Les accents ont ensuite été vérifiés visuellement dans le
catalogue sous Chrome. Les textes historiques des commandes n'ont pas été modifiés.

**Ne pas rejouer la réparation sur les données déjà corrigées. Ne pas rejouer
les scripts d'initialisation 001 ou 002 pour réparer les textes.**

## Cause et preuves

Avant la réparation, le diagnostic en lecture seule avait constaté :

- Fichiers HTML/CSS/JS/JSON/SQL du projet valides en UTF-8, sans corruption détectée.
- Les pages `menus.html` et `commande.html` déclarent déjà `meta charset="utf-8"`.
- Réponses HTML, CSS, JS et `/api/menus` : `charset=utf-8`, sans caractère de remplacement.
- PostgreSQL : `server_encoding=UTF8`, `client_encoding=UTF8`, compte `vg_app`.
- La réponse du catalogue est identique à une lecture PostgreSQL directe.
- Les textes stockés sont une interprétation Windows-1252 des octets UTF-8 des
  textes corrects : par exemple `VÃ©gÃ©tarien` pour `Végétarien`, `FÃªte` pour
  `Fête`, `Å’ufs` pour `Œufs`, et `â€™` pour l'apostrophe typographique.

La corruption était donc déjà enregistrée dans PostgreSQL. L'API et le frontend la
transmettaient sans conversion. Un import avec un mauvais `client_encoding` est la
cause probable ; la session d'import initiale n'est plus observable. Le fait que
la base soit UTF-8 n'empêche pas d'y stocker un texte déjà mal décodé.

L'ordre des allergènes diffère aussi du JSON local car l'API les trie ; ce n'est
pas une corruption et cet ordre n'est pas modifié.

## Périmètre appliqué

`catalogue-utf8-plan.json` contient chaque identifiant, colonne, valeur avant réparation
et valeur attendue, issus exclusivement des textes de démonstration reconnus :

| Table | Valeurs textuelles |
| --- | ---: |
| menus | 20 |
| menu_images | 36 |
| dishes | 8 |
| allergens | 3 |
| themes | 1 |
| diets | 2 |
| roles (libellé uniquement) | 1 |
| order_statuses (libellé uniquement) | 7 |
| Total | 78 |

Ce sont des valeurs de colonnes, pas 78 lignes distinctes. Chaque remplacement
correspond exactement à un texte connu des fichiers SQL/JSON corrects. Aucun
remplacement global ni conversion aveugle de toutes les colonnes n'a été effectué.

**Hors périmètre :** comptes, adresses, coordonnées clients, montants, stocks,
identifiants et relations, règles métier, commandes et leurs historiques. Deux
lignes de commande ont des textes historiques suspects ; ils ne sont pas corrigés
car ces valeurs sont protégées contre les modifications. Un motif courant de
commande et deux motifs d'historique sont également suspects et restent inchangés.
Leur correction nécessiterait
une analyse et une validation distinctes ; aucun déclencheur n'est désactivé ici.

## Garanties des scripts

- `010_catalogue_utf8_apply.sql` : remplacement des seules valeurs prévues.
- `011_catalogue_utf8_undo.sql` : restauration exacte des anciennes valeurs.
- Scripts entièrement ASCII avec chaînes Unicode `U&'...'` : leurs caractères
  accentués ne peuvent pas être mal lus depuis un terminal Windows-1252.
- Identifiant **et** valeur actuelle exacte obligatoires. Si une valeur manque,
  a déjà été corrigée ou a été modifiée, toute la transaction échoue.
- Vérification des tables/colonnes autorisées et du périmètre fictif ; les thèmes,
  régimes ou allergènes utilisés par des données non fictives sont refusés.
- Verrouillage temporaire des huit tables et des deux tables d'association pour éviter une modification concurrente,
  avec délai d'attente de 5 secondes. Les lectures ordinaires restent possibles.
- Table de travail temporaire supprimée automatiquement au COMMIT. Aucun objet
  permanent créé, aucun DROP de table métier, aucun changement de propriétaire.
- Le retour arrière refuse lui aussi d'écraser une modification intervenue après
  la réparation. Garder le plan avec les scripts ; il conserve les valeurs originales.

## Procédure manuelle conservée pour référence

La réparation locale est terminée. Les commandes ci-dessous sont conservées pour
documenter l'intervention ; elles ne doivent pas être relancées sur les données
déjà corrigées. Toute nouvelle intervention ou tout retour arrière nécessite une
analyse et une validation distinctes.

1. Examiner le plan et sauvegarder la base avant intervention.
2. Vérifier que la connexion cible bien `vite_et_gourmand` et conserver une fenêtre
   d'intervention sans écritures concurrentes.
3. **Après validation seulement**, depuis la racine dans PowerShell :

```powershell
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$env:PGCLIENTENCODING = 'UTF8'
& $psql -X -h 127.0.0.1 -p 5432 -U vg_migrator -d vite_et_gourmand -W -v ON_ERROR_STOP=1 -c 'SELECT current_database(), current_user;'
```

Attendu : base `vite_et_gourmand`, utilisateur `vg_migrator`. Le mot de passe est
saisi uniquement à l'invite masquée. Ne jamais le placer dans une commande ou un journal.

```powershell
& $psql -X -h 127.0.0.1 -p 5432 -U vg_migrator -d vite_et_gourmand -W -v ON_ERROR_STOP=1 -f database/repairs/010_catalogue_utf8_apply.sql
if ($LASTEXITCODE -ne 0) { throw 'Réparation annulée : analyser la différence avant de continuer.' }
```

Le script prend temporairement `vg_owner`. Attendu : notice de **78 valeurs**,
puis `COMMIT`. Une erreur entraîne l'annulation du script à la fermeture de sa
connexion ; ne pas retirer les gardes ni forcer une valeur qui a changé.

4. Recharger `/api/menus`, puis le catalogue. Aucun redémarrage Express n'est
   nécessaire pour une correction de données (l'API n'a pas de cache).
5. Si un retour arrière est validé séparément :

```powershell
& $psql -X -h 127.0.0.1 -p 5432 -U vg_migrator -d vite_et_gourmand -W -v ON_ERROR_STOP=1 -f database/repairs/011_catalogue_utf8_undo.sql
if ($LASTEXITCODE -ne 0) { throw 'Retour arrière annulé : analyser avant de continuer.' }
```

Ce retour arrière restitue volontairement les anciennes chaînes corrompues.
Ne pas exécuter réparation puis retour arrière comme une procédure normale.

## Prévention et contrôles Chrome

Les fichiers d'initialisation `001` et `002` fixent maintenant explicitement
`SET LOCAL client_encoding = 'UTF8'` avant les valeurs françaises. Cette protection
concerne les futures initialisations via `psql -f`, pas les données déjà importées.
Conserver les fichiers en UTF-8 et définir aussi `PGCLIENTENCODING=UTF8` avant
d'ouvrir psql ; vérifier `SHOW client_encoding;` dans la session d'import.

Dans Chrome, après correction validée :

1. Ouvrir les outils développeur (F12), onglet Réseau, puis recharger avec Ctrl+F5.
2. Vérifier les réponses 200 et `Content-Type` avec `charset=utf-8` pour la page,
   les scripts, le CSS et `/api/menus`.
3. Dans la réponse API, vérifier `Végétarien`, `Végétalien`, `Fête`,
   `Le Déjeuner champêtre`, `Œufs` et `Sésame`.
4. Dans les fiches, vérifier « Entrée — visuel de démonstration générique », les
   apostrophes typographiques et « réfrigérateur après réception ».
5. Vérifier les filtres combinés, la remise à zéro, les prix inchangés, le focus
   clavier, Échap et le passage vers la page de commande.

Les tests automatisés utilisent uniquement un PostgreSQL WASM en mémoire :

```powershell
npm.cmd --prefix backend test
git diff --check
```

Ils contrôlent les octets UTF-8 et les en-têtes HTTP, les caractères français,
la réparation, son refus sur une base déjà correcte, le retour arrière exact et
l'absence de changements sur les autres données.

Références : [encodage du client PostgreSQL](https://www.postgresql.org/docs/18/multibyte.html),
[chaînes Unicode SQL](https://www.postgresql.org/docs/18/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS-UESCAPE).
