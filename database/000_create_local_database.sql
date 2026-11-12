-- MANUEL UNIQUEMENT, sur une instance locale et des noms encore inexistants.
-- Exécuter avec un compte d'administration PostgreSQL, jamais avec le serveur web.
-- Aucun mot de passe dans ce fichier. Pas de DROP ni de remplacement d'objets.
CREATE ROLE vg_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE vg_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE vg_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT vg_owner TO vg_migrator;
CREATE DATABASE vite_gourmand_demo OWNER vg_owner;
REVOKE ALL ON DATABASE vite_gourmand_demo FROM PUBLIC;
GRANT CONNECT ON DATABASE vite_gourmand_demo TO vg_migrator, vg_app;
-- Puis définir les mots de passe avec \password dans psql (voir README).
