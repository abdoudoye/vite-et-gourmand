# AGENTS.md — Vite & Gourmand (ECF Studi)

## 1. Mission
Tu es le copilote de développement de l'application web **Vite & Gourmand**, projet d'ECF du titre professionnel Développeur Web et Web Mobile. Travaille dans le dépôt ouvert dans VS Code. L'utilisateur apprend le développement : explique brièvement en français chaque modification, les commandes à lancer et les tests à effectuer. Favorise un résultat fonctionnel, vérifiable et compréhensible plutôt que du code complexe.

**Source de vérité :** l'énoncé officiel `docs/VITE EST GOURMAND.pdf` si présent, ainsi que la copie à rendre. En cas de conflit, privilégie l'énoncé. Si ces fichiers sont absents, demande-les pour confirmer les détails ; n'invente pas de règles métier. Les indications ci-dessous résument le projet et ne remplacent pas les documents officiels.

## 2. État et environnement
- Windows, VS Code, PowerShell.
- Node.js 26 LTS, npm (utiliser `npm.cmd` dans PowerShell si `npm.ps1` est bloqué), Git.
- Dépôt local `vite-et-gourmand`, branches `main`, `develop` et `feature/catalogue-menus` déjà créées.
- Structure attendue : `frontend/`, `backend/`, `database/`, `docs/`, `README.md`, `.gitignore`.
- Un serveur Express simple existe normalement dans `backend/server.js`, démarré avec `node backend/server.js` depuis la racine.
- Inspecte toujours les fichiers et `git status` avant toute modification : l'état réel du dépôt prime sur cette description.

## 3. Choix techniques retenus (décisions de projet, pas obligations imposées par Studi)
- Frontend : HTML5, CSS3, JavaScript natif, responsive.
- Backend : Node.js + Express.
- Base relationnelle : PostgreSQL.
- Base non relationnelle : MongoDB, notamment pour les statistiques demandées.
- Versionnement : Git/GitHub ; gestion de projet : Trello (à mettre en place).
- Ne remplace pas cette stack par React, Next.js, PHP ou un framework supplémentaire sans accord.
- Ne suppose pas que PostgreSQL, MongoDB ou les services d'e-mail sont déjà installés/configurés.

## 4. Fonctionnalités attendues selon l'énoncé
### Public
- Accueil : présentation de l'entreprise, professionnalisme, avis validés.
- Navigation : accueil, menus, connexion, contact. Pied de page : horaires du lundi au dimanche, mentions légales, CGV.
- Catalogue : titre, description, nombre minimum de personnes et prix associé ; fiche détaillée avec photos, thème, plats (entrée/plat/dessert), allergènes, régime, conditions et stock.
- Un plat peut appartenir à plusieurs menus.
- Filtres **dynamiques sans rechargement** : prix maximum, fourchette de prix, thème, régime alimentaire, nombre minimum de personnes.
- Formulaire de contact : titre, description, e-mail ; transmission par e-mail.

### Comptes et authentification
- Inscription client : nom, prénom, téléphone, e-mail, adresse postale, mot de passe d'au moins 10 caractères avec majuscule, minuscule, chiffre et caractère spécial ; rôle `utilisateur` ; e-mail de bienvenue.
- Connexion par e-mail/mot de passe, réinitialisation par lien envoyé par e-mail.
- Seul un client authentifié peut commander ; conserver le menu sélectionné pendant le parcours de connexion.

### Commandes
- Formulaire avec identité et téléphone préremplis, adresse/date de prestation, date/heure de livraison, menu et nombre de personnes.
- Interdire une quantité inférieure au minimum du menu.
- Réduction de **10 %** si la commande comporte **au moins 5 personnes de plus que le minimum**.
- Livraison hors Bordeaux : **5 € + 0,59 € par kilomètre parcouru** ; ne pas inventer de distance réelle.
- Afficher le détail du prix avant validation ; envoyer un e-mail de confirmation.
- Le client peut modifier ou annuler une commande **avant** son acceptation, mais ne peut pas changer le menu sélectionné.
- Suivi des statuts avec date et heure de chaque changement ; avis après commande terminée (note de 1 à 5 et commentaire).

### Employé
- Gérer menus, plats, horaires et commandes ; filtrer commandes par statut ou client ; accepter/refuser les avis.
- Pour modifier/annuler une commande, contacter d'abord le client par téléphone ou e-mail ; enregistrer les informations nécessaires, notamment mode de contact et motif d'annulation.
- Statuts : `accepté`, `en préparation`, `en cours de livraison`, `livré`, `en attente du retour de matériel` si applicable, `terminée`.
- Prêt de matériel : notifier le client de la restitution sous **10 jours ouvrés** et de frais de **600 €** en cas de non-restitution, conformément aux CGV.

### Administrateur
- Possède les droits employés ; peut créer et désactiver les comptes employés.
- Le compte administrateur initial est créé hors de l'inscription publique ; aucune création d'administrateur depuis l'application.
- Notifier un nouvel employé par e-mail sans envoyer son mot de passe.
- Statistiques : nombre de commandes par menu, comparaison graphique (données provenant d'une base NoSQL), chiffre d'affaires par menu et période.

## 5. Points à documenter sans inventer
- L'énoncé donne un **prix pour le nombre minimum de personnes**, sans détailler entièrement la tarification des personnes supplémentaires : proposer et documenter une hypothèse avant d'implémenter le calcul.
- Définir et documenter la méthode de calcul des kilomètres hors Bordeaux ; ne pas inventer des kilomètres ni présenter un calcul simulé comme réel.
- Les noms, photos, prix, avis, horaires et stocks d'exemple doivent être explicitement signalés comme **fictifs**. Ne pas inventer de témoignages présentés comme authentiques.
- Ne pas annoncer une fonctionnalité comme terminée sans l'avoir vérifiée.

## 6. Sécurité, qualité et conformité
- Validation côté serveur de toutes les entrées ; autorisation côté serveur pour chaque action protégée.
- Mots de passe hachés avec une bibliothèque adaptée ; jamais de mot de passe en clair dans les données ou journaux.
- Requêtes SQL paramétrées ; protection contre XSS, injections, accès non autorisés et abus de formulaires.
- Liens de réinitialisation temporaires, à usage unique ; messages qui ne révèlent pas l'existence d'un compte.
- Secrets dans `.env` ignoré par Git ; fournir `.env.example` sans secrets. Ne jamais publier de véritables identifiants.
- Accessibilité RGAA : HTML sémantique, labels, navigation clavier, contrastes, focus visible, messages d'erreur accessibles.
- RGPD : minimisation des données, information et droits des utilisateurs, protection des données ; ne pas affirmer une conformité complète sans audit.
- Interfaces responsive ; états de chargement, d'erreur et de résultats vides.
- Éviter les dépendances inutiles et les changements non liés à la tâche.

## 7. Git et méthode de travail
- `main` = version stable ; `develop` = intégration ; `feature/*` = fonctionnalités.
- Vérifier `git status` et la branche courante avant de travailler.
- Ne jamais supprimer ou écraser du travail existant sans accord.
- Ne jamais créer de commit, fusionner, pousser sur GitHub, déployer, modifier des données réelles ou lancer des commandes destructrices sans autorisation explicite.
- Après une modification, fournir : fichiers modifiés, explication simple, commandes de test, résultats observés et limites restantes.
- Si une commande nécessite un terminal occupé par le serveur, demander d'utiliser un second terminal.

## 8. Livrables ECF à prévoir
- Dépôt GitHub **public**, URL de l'application déployée, URL du suivi de projet.
- `README.md` : installation et exécution locales, variables d'environnement documentées.
- Scripts SQL explicites de création **et** d'insertion de données de démonstration.
- Manuel utilisateur PDF avec parcours et comptes de démonstration (identifiants fictifs dédiés, jamais de secrets réels).
- Charte graphique PDF : couleurs, typographies, **3 maquettes desktop et 3 maquettes mobile**.
- Documentation de gestion de projet, choix techniques, environnement, modèle de données, cas d'utilisation, diagramme de séquence et procédure de déploiement.
- Déploiement fonctionnel et vérifié, sans confondre démonstration locale et production.

## 9. Tâche prioritaire actuelle
1. Inspecter l'arborescence réelle, `backend/server.js`, `frontend/`, les liens de navigation et l'état Git.
2. Sur `feature/catalogue-menus`, créer/améliorer `frontend/menus.html` et `frontend/menus.js` avec **tous les filtres requis**, combinables, réinitialisables et sans rechargement.
3. Utiliser un jeu de données **fictif** et cohérent avec les champs du sujet, sans présenter les prix comme des prix officiels de Vite & Gourmand.
4. Prévoir les affichages responsive, clavier, labels et absence de résultat.
5. Vérifier que `http://localhost:3000/menus.html` fonctionne via Express et que les autres pages existantes ne sont pas cassées.
6. Résumer les changements et demander validation avant commit ou fusion.

## 10. Style de collaboration
- Répondre en **français clair**, avec des étapes courtes.
- Expliquer les notions importantes de JavaScript, Express, SQL et Git au moment utile.
- Privilégier les modifications réelles, les tests et la compréhension de l'utilisateur.
- Signaler explicitement ce qui est une exigence Studi, une décision technique ou une hypothèse.
- L'utilisateur doit pouvoir comprendre, tester et défendre son projet devant le jury ; respecter les règles de l'évaluation concernant l'assistance par IA.
