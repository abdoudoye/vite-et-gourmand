-- REVIEW AND VALIDATE BEFORE MANUAL EXECUTION. No automatic application.
-- Target: existing vite_et_gourmand, demo/reference text only; no personal data.
-- UNDO: restores only the exact original values recorded in the plan.
-- Any changed/missing row or unexpected value aborts the entire transaction.
BEGIN;
SET LOCAL client_encoding = 'UTF8';
SET LOCAL standard_conforming_strings = on;
SET LOCAL ROLE vg_owner;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE vg.menus, vg.menu_images, vg.dishes, vg.allergens, vg.themes, vg.diets, vg.roles, vg.order_statuses, vg.menu_dishes, vg.dish_allergens IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE catalogue_utf8_changes (
 table_name text NOT NULL, row_key text NOT NULL, column_name text NOT NULL,
 old_value text NOT NULL, new_value text NOT NULL,
 PRIMARY KEY(table_name, row_key, column_name)
) ON COMMIT DROP;
INSERT INTO catalogue_utf8_changes VALUES
 (U&'menus', U&'1', U&'description', U&'Une proposition ensoleill\00e9e autour des l\00e9gumes et des herbes du Sud.', U&'Une proposition ensoleill\00c3\00a9e autour des l\00c3\00a9gumes et des herbes du Sud.'),
 (U&'menus', U&'1', U&'order_conditions', U&'Exemple fictif : demande au moins 72 heures avant la prestation.\000aRespecter le nombre minimum de personnes indiqu\00e9.\000aPrix pour le minimum de personnes, hors livraison ; tarif des personnes suppl\00e9mentaires \00e0 d\00e9finir.\000aD\00e9monstration : aucune r\00e9servation ni commande r\00e9elle.', U&'Exemple fictif : demande au moins 72 heures avant la prestation.\000aRespecter le nombre minimum de personnes indiqu\00c3\00a9.\000aPrix pour le minimum de personnes, hors livraison ; tarif des personnes suppl\00c3\00a9mentaires \00c3\00a0 d\00c3\00a9finir.\000aD\00c3\00a9monstration : aucune r\00c3\00a9servation ni commande r\00c3\00a9elle.'),
 (U&'menus', U&'1', U&'storage_conditions', U&'Exemple fictif : conserver au r\00e9frig\00e9rateur apr\00e8s r\00e9ception.\000aLes temp\00e9ratures, dur\00e9es de conservation et consignes de r\00e9chauffage doivent \00eatre d\00e9finies par le traiteur pour chaque recette avant toute vente r\00e9elle.', U&'Exemple fictif : conserver au r\00c3\00a9frig\00c3\00a9rateur apr\00c3\00a8s r\00c3\00a9ception.\000aLes temp\00c3\00a9ratures, dur\00c3\00a9es de conservation et consignes de r\00c3\00a9chauffage doivent \00c3\00aatre d\00c3\00a9finies par le traiteur pour chaque recette avant toute vente r\00c3\00a9elle.'),
 (U&'menus', U&'2', U&'description', U&'Un assortiment v\00e9g\00e9tal color\00e9 pour une table g\00e9n\00e9reuse.', U&'Un assortiment v\00c3\00a9g\00c3\00a9tal color\00c3\00a9 pour une table g\00c3\00a9n\00c3\00a9reuse.'),
 (U&'menus', U&'2', U&'order_conditions', U&'Exemple fictif : demande au moins 72 heures avant la prestation.\000aRespecter le nombre minimum de personnes indiqu\00e9.\000aPrix pour le minimum de personnes, hors livraison ; tarif des personnes suppl\00e9mentaires \00e0 d\00e9finir.\000aD\00e9monstration : aucune r\00e9servation ni commande r\00e9elle.', U&'Exemple fictif : demande au moins 72 heures avant la prestation.\000aRespecter le nombre minimum de personnes indiqu\00c3\00a9.\000aPrix pour le minimum de personnes, hors livraison ; tarif des personnes suppl\00c3\00a9mentaires \00c3\00a0 d\00c3\00a9finir.\000aD\00c3\00a9monstration : aucune r\00c3\00a9servation ni commande r\00c3\00a9elle.'),
 (U&'menus', U&'2', U&'storage_conditions', U&'Exemple fictif : conserver au r\00e9frig\00e9rateur apr\00e8s r\00e9ception.\000aLes temp\00e9ratures, dur\00e9es de conservation et consignes de r\00e9chauffage doivent \00eatre d\00e9finies par le traiteur pour chaque recette avant toute vente r\00e9elle.', U&'Exemple fictif : conserver au r\00c3\00a9frig\00c3\00a9rateur apr\00c3\00a8s r\00c3\00a9ception.\000aLes temp\00c3\00a9ratures, dur\00c3\00a9es de conservation et consignes de r\00c3\00a9chauffage doivent \00c3\00aatre d\00c3\00a9finies par le traiteur pour chaque recette avant toute vente r\00c3\00a9elle.'),
 (U&'menus', U&'3', U&'title', U&'La Grande R\00e9ception', U&'La Grande R\00c3\00a9ception'),
 (U&'menus', U&'3', U&'order_conditions', U&'Exemple fictif : demande au moins 72 heures avant la prestation.\000aRespecter le nombre minimum de personnes indiqu\00e9.\000aPrix pour le minimum de personnes, hors livraison ; tarif des personnes suppl\00e9mentaires \00e0 d\00e9finir.\000aD\00e9monstration : aucune r\00e9servation ni commande r\00e9elle.', U&'Exemple fictif : demande au moins 72 heures avant la prestation.\000aRespecter le nombre minimum de personnes indiqu\00c3\00a9.\000aPrix pour le minimum de personnes, hors livraison ; tarif des personnes suppl\00c3\00a9mentaires \00c3\00a0 d\00c3\00a9finir.\000aD\00c3\00a9monstration : aucune r\00c3\00a9servation ni commande r\00c3\00a9elle.'),
 (U&'menus', U&'3', U&'storage_conditions', U&'Exemple fictif : conserver au r\00e9frig\00e9rateur apr\00e8s r\00e9ception.\000aLes temp\00e9ratures, dur\00e9es de conservation et consignes de r\00e9chauffage doivent \00eatre d\00e9finies par le traiteur pour chaque recette avant toute vente r\00e9elle.', U&'Exemple fictif : conserver au r\00c3\00a9frig\00c3\00a9rateur apr\00c3\00a8s r\00c3\00a9ception.\000aLes temp\00c3\00a9ratures, dur\00c3\00a9es de conservation et consignes de r\00c3\00a9chauffage doivent \00c3\00aatre d\00c3\00a9finies par le traiteur pour chaque recette avant toute vente r\00c3\00a9elle.'),
 (U&'menus', U&'4', U&'description', U&'Des associations douces et \00e9pic\00e9es pour un repas \00e0 partager.', U&'Des associations douces et \00c3\00a9pic\00c3\00a9es pour un repas \00c3\00a0 partager.'),
 (U&'menus', U&'4', U&'order_conditions', U&'Exemple fictif : demande au moins 72 heures avant la prestation.\000aRespecter le nombre minimum de personnes indiqu\00e9.\000aPrix pour le minimum de personnes, hors livraison ; tarif des personnes suppl\00e9mentaires \00e0 d\00e9finir.\000aD\00e9monstration : aucune r\00e9servation ni commande r\00e9elle.', U&'Exemple fictif : demande au moins 72 heures avant la prestation.\000aRespecter le nombre minimum de personnes indiqu\00c3\00a9.\000aPrix pour le minimum de personnes, hors livraison ; tarif des personnes suppl\00c3\00a9mentaires \00c3\00a0 d\00c3\00a9finir.\000aD\00c3\00a9monstration : aucune r\00c3\00a9servation ni commande r\00c3\00a9elle.'),
 (U&'menus', U&'4', U&'storage_conditions', U&'Exemple fictif : conserver au r\00e9frig\00e9rateur apr\00e8s r\00e9ception.\000aLes temp\00e9ratures, dur\00e9es de conservation et consignes de r\00e9chauffage doivent \00eatre d\00e9finies par le traiteur pour chaque recette avant toute vente r\00e9elle.', U&'Exemple fictif : conserver au r\00c3\00a9frig\00c3\00a9rateur apr\00c3\00a8s r\00c3\00a9ception.\000aLes temp\00c3\00a9ratures, dur\00c3\00a9es de conservation et consignes de r\00c3\00a9chauffage doivent \00c3\00aatre d\00c3\00a9finies par le traiteur pour chaque recette avant toute vente r\00c3\00a9elle.'),
 (U&'menus', U&'5', U&'title', U&'Le Banquet v\00e9g\00e9tal', U&'Le Banquet v\00c3\00a9g\00c3\00a9tal'),
 (U&'menus', U&'5', U&'description', U&'Une table de f\00eate imagin\00e9e autour des saveurs v\00e9g\00e9tales.', U&'Une table de f\00c3\00aate imagin\00c3\00a9e autour des saveurs v\00c3\00a9g\00c3\00a9tales.'),
 (U&'menus', U&'5', U&'order_conditions', U&'Exemple fictif : demande au moins 72 heures avant la prestation.\000aRespecter le nombre minimum de personnes indiqu\00e9.\000aPrix pour le minimum de personnes, hors livraison ; tarif des personnes suppl\00e9mentaires \00e0 d\00e9finir.\000aD\00e9monstration : aucune r\00e9servation ni commande r\00e9elle.', U&'Exemple fictif : demande au moins 72 heures avant la prestation.\000aRespecter le nombre minimum de personnes indiqu\00c3\00a9.\000aPrix pour le minimum de personnes, hors livraison ; tarif des personnes suppl\00c3\00a9mentaires \00c3\00a0 d\00c3\00a9finir.\000aD\00c3\00a9monstration : aucune r\00c3\00a9servation ni commande r\00c3\00a9elle.'),
 (U&'menus', U&'5', U&'storage_conditions', U&'Exemple fictif : conserver au r\00e9frig\00e9rateur apr\00e8s r\00e9ception.\000aLes temp\00e9ratures, dur\00e9es de conservation et consignes de r\00e9chauffage doivent \00eatre d\00e9finies par le traiteur pour chaque recette avant toute vente r\00e9elle.', U&'Exemple fictif : conserver au r\00c3\00a9frig\00c3\00a9rateur apr\00c3\00a8s r\00c3\00a9ception.\000aLes temp\00c3\00a9ratures, dur\00c3\00a9es de conservation et consignes de r\00c3\00a9chauffage doivent \00c3\00aatre d\00c3\00a9finies par le traiteur pour chaque recette avant toute vente r\00c3\00a9elle.'),
 (U&'menus', U&'6', U&'title', U&'Le D\00e9jeuner champ\00eatre', U&'Le D\00c3\00a9jeuner champ\00c3\00aatre'),
 (U&'menus', U&'6', U&'description', U&'Une pause conviviale inspir\00e9e des repas \00e0 la campagne.', U&'Une pause conviviale inspir\00c3\00a9e des repas \00c3\00a0 la campagne.'),
 (U&'menus', U&'6', U&'order_conditions', U&'Exemple fictif : demande au moins 72 heures avant la prestation.\000aRespecter le nombre minimum de personnes indiqu\00e9.\000aPrix pour le minimum de personnes, hors livraison ; tarif des personnes suppl\00e9mentaires \00e0 d\00e9finir.\000aD\00e9monstration : aucune r\00e9servation ni commande r\00e9elle.', U&'Exemple fictif : demande au moins 72 heures avant la prestation.\000aRespecter le nombre minimum de personnes indiqu\00c3\00a9.\000aPrix pour le minimum de personnes, hors livraison ; tarif des personnes suppl\00c3\00a9mentaires \00c3\00a0 d\00c3\00a9finir.\000aD\00c3\00a9monstration : aucune r\00c3\00a9servation ni commande r\00c3\00a9elle.'),
 (U&'menus', U&'6', U&'storage_conditions', U&'Exemple fictif : conserver au r\00e9frig\00e9rateur apr\00e8s r\00e9ception.\000aLes temp\00e9ratures, dur\00e9es de conservation et consignes de r\00e9chauffage doivent \00eatre d\00e9finies par le traiteur pour chaque recette avant toute vente r\00e9elle.', U&'Exemple fictif : conserver au r\00c3\00a9frig\00c3\00a9rateur apr\00c3\00a8s r\00c3\00a9ception.\000aLes temp\00c3\00a9ratures, dur\00c3\00a9es de conservation et consignes de r\00c3\00a9chauffage doivent \00c3\00aatre d\00c3\00a9finies par le traiteur pour chaque recette avant toute vente r\00c3\00a9elle.'),
 (U&'menu_images', U&'1', U&'alt_text', U&'Illustration fictive d\2019une salade dans une assiette.', U&'Illustration fictive d\00e2\20ac\2122une salade dans une assiette.'),
 (U&'menu_images', U&'1', U&'caption', U&'Entr\00e9e \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Entr\00c3\00a9e \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'10', U&'alt_text', U&'Illustration fictive d\2019une salade dans une assiette.', U&'Illustration fictive d\00e2\20ac\2122une salade dans une assiette.'),
 (U&'menu_images', U&'10', U&'caption', U&'Entr\00e9e \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Entr\00c3\00a9e \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'11', U&'alt_text', U&'Illustration fictive d\2019une assiette de l\00e9gumes.', U&'Illustration fictive d\00e2\20ac\2122une assiette de l\00c3\00a9gumes.'),
 (U&'menu_images', U&'11', U&'caption', U&'Plat \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Plat \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'12', U&'alt_text', U&'Illustration fictive d\2019une part de tarte.', U&'Illustration fictive d\00e2\20ac\2122une part de tarte.'),
 (U&'menu_images', U&'12', U&'caption', U&'Dessert \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Dessert \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'13', U&'alt_text', U&'Illustration fictive d\2019une salade dans une assiette.', U&'Illustration fictive d\00e2\20ac\2122une salade dans une assiette.'),
 (U&'menu_images', U&'13', U&'caption', U&'Entr\00e9e \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Entr\00c3\00a9e \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'14', U&'alt_text', U&'Illustration fictive d\2019une assiette de l\00e9gumes.', U&'Illustration fictive d\00e2\20ac\2122une assiette de l\00c3\00a9gumes.'),
 (U&'menu_images', U&'14', U&'caption', U&'Plat \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Plat \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'15', U&'alt_text', U&'Illustration fictive d\2019une part de tarte.', U&'Illustration fictive d\00e2\20ac\2122une part de tarte.'),
 (U&'menu_images', U&'15', U&'caption', U&'Dessert \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Dessert \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'16', U&'alt_text', U&'Illustration fictive d\2019une salade dans une assiette.', U&'Illustration fictive d\00e2\20ac\2122une salade dans une assiette.'),
 (U&'menu_images', U&'16', U&'caption', U&'Entr\00e9e \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Entr\00c3\00a9e \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'17', U&'alt_text', U&'Illustration fictive d\2019une assiette de l\00e9gumes.', U&'Illustration fictive d\00e2\20ac\2122une assiette de l\00c3\00a9gumes.'),
 (U&'menu_images', U&'17', U&'caption', U&'Plat \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Plat \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'18', U&'alt_text', U&'Illustration fictive d\2019une part de tarte.', U&'Illustration fictive d\00e2\20ac\2122une part de tarte.'),
 (U&'menu_images', U&'18', U&'caption', U&'Dessert \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Dessert \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'2', U&'alt_text', U&'Illustration fictive d\2019une assiette de l\00e9gumes.', U&'Illustration fictive d\00e2\20ac\2122une assiette de l\00c3\00a9gumes.'),
 (U&'menu_images', U&'2', U&'caption', U&'Plat \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Plat \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'3', U&'alt_text', U&'Illustration fictive d\2019une part de tarte.', U&'Illustration fictive d\00e2\20ac\2122une part de tarte.'),
 (U&'menu_images', U&'3', U&'caption', U&'Dessert \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Dessert \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'4', U&'alt_text', U&'Illustration fictive d\2019une salade dans une assiette.', U&'Illustration fictive d\00e2\20ac\2122une salade dans une assiette.'),
 (U&'menu_images', U&'4', U&'caption', U&'Entr\00e9e \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Entr\00c3\00a9e \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'5', U&'alt_text', U&'Illustration fictive d\2019une assiette de l\00e9gumes.', U&'Illustration fictive d\00e2\20ac\2122une assiette de l\00c3\00a9gumes.'),
 (U&'menu_images', U&'5', U&'caption', U&'Plat \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Plat \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'6', U&'alt_text', U&'Illustration fictive d\2019une part de tarte.', U&'Illustration fictive d\00e2\20ac\2122une part de tarte.'),
 (U&'menu_images', U&'6', U&'caption', U&'Dessert \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Dessert \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'7', U&'alt_text', U&'Illustration fictive d\2019une salade dans une assiette.', U&'Illustration fictive d\00e2\20ac\2122une salade dans une assiette.'),
 (U&'menu_images', U&'7', U&'caption', U&'Entr\00e9e \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Entr\00c3\00a9e \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'8', U&'alt_text', U&'Illustration fictive d\2019une assiette de l\00e9gumes.', U&'Illustration fictive d\00e2\20ac\2122une assiette de l\00c3\00a9gumes.'),
 (U&'menu_images', U&'8', U&'caption', U&'Plat \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Plat \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'menu_images', U&'9', U&'alt_text', U&'Illustration fictive d\2019une part de tarte.', U&'Illustration fictive d\00e2\20ac\2122une part de tarte.'),
 (U&'menu_images', U&'9', U&'caption', U&'Dessert \2014 visuel de d\00e9monstration g\00e9n\00e9rique.', U&'Dessert \00e2\20ac\201d visuel de d\00c3\00a9monstration g\00c3\00a9n\00c3\00a9rique.'),
 (U&'dishes', U&'10', U&'name', U&'Salade de concombre au s\00e9same', U&'Salade de concombre au s\00c3\00a9same'),
 (U&'dishes', U&'14', U&'name', U&'Couscous de l\00e9gumes et pois chiches', U&'Couscous de l\00c3\00a9gumes et pois chiches'),
 (U&'dishes', U&'15', U&'name', U&'Salade d\2019agrumes', U&'Salade d\00e2\20ac\2122agrumes'),
 (U&'dishes', U&'16', U&'name', U&'Quiche aux l\00e9gumes', U&'Quiche aux l\00c3\00a9gumes'),
 (U&'dishes', U&'2', U&'name', U&'Gratin de l\00e9gumes et feta', U&'Gratin de l\00c3\00a9gumes et feta'),
 (U&'dishes', U&'5', U&'name', U&'Lentilles et l\00e9gumes r\00f4tis', U&'Lentilles et l\00c3\00a9gumes r\00c3\00b4tis'),
 (U&'dishes', U&'7', U&'name', U&'Saumon fum\00e9 et cr\00e8me citronn\00e9e', U&'Saumon fum\00c3\00a9 et cr\00c3\00a8me citronn\00c3\00a9e'),
 (U&'dishes', U&'8', U&'name', U&'Poulet r\00f4ti, pommes de terre', U&'Poulet r\00c3\00b4ti, pommes de terre'),
 (U&'allergens', U&'2', U&'name', U&'Gluten (bl\00e9)', U&'Gluten (bl\00c3\00a9)'),
 (U&'allergens', U&'3', U&'name', U&'\0152ufs', U&'\00c5\2019ufs'),
 (U&'allergens', U&'6', U&'name', U&'S\00e9same', U&'S\00c3\00a9same'),
 (U&'themes', U&'3', U&'name', U&'F\00eate', U&'F\00c3\00aate'),
 (U&'diets', U&'1', U&'name', U&'V\00e9g\00e9tarien', U&'V\00c3\00a9g\00c3\00a9tarien'),
 (U&'diets', U&'2', U&'name', U&'V\00e9g\00e9talien', U&'V\00c3\00a9g\00c3\00a9talien'),
 (U&'roles', U&'employe', U&'label', U&'Employ\00e9', U&'Employ\00c3\00a9'),
 (U&'order_statuses', U&'accepte', U&'label', U&'Accept\00e9', U&'Accept\00c3\00a9'),
 (U&'order_statuses', U&'annulee', U&'label', U&'Annul\00e9e', U&'Annul\00c3\00a9e'),
 (U&'order_statuses', U&'attente_retour_materiel', U&'label', U&'En attente du retour de mat\00e9riel', U&'En attente du retour de mat\00c3\00a9riel'),
 (U&'order_statuses', U&'en_preparation', U&'label', U&'En pr\00e9paration', U&'En pr\00c3\00a9paration'),
 (U&'order_statuses', U&'livre', U&'label', U&'Livr\00e9', U&'Livr\00c3\00a9'),
 (U&'order_statuses', U&'refusee', U&'label', U&'Refus\00e9e', U&'Refus\00c3\00a9e'),
 (U&'order_statuses', U&'terminee', U&'label', U&'Termin\00e9e', U&'Termin\00c3\00a9e');
DO $repair$
DECLARE item record; key_column text; scope text; affected integer; total integer := 0;
BEGIN
 IF current_setting('server_encoding') <> 'UTF8' THEN RAISE EXCEPTION 'UTF8 database required'; END IF;
 FOR item IN SELECT * FROM catalogue_utf8_changes ORDER BY table_name,row_key,column_name LOOP
  IF NOT ((item.table_name='menus' AND item.column_name IN ('title','description','order_conditions','storage_conditions'))
    OR (item.table_name='menu_images' AND item.column_name IN ('alt_text','caption'))
    OR (item.table_name IN ('dishes','allergens','themes','diets') AND item.column_name='name')
    OR (item.table_name IN ('roles','order_statuses') AND item.column_name='label')) THEN
   RAISE EXCEPTION 'Target outside text allowlist';
  END IF;
  key_column := CASE WHEN item.table_name IN ('roles','order_statuses') THEN 'code' ELSE 'id' END;
  scope := CASE item.table_name
   WHEN 'menus' THEN ' AND t.is_demo=true'
   WHEN 'menu_images' THEN ' AND t.is_demo=true AND EXISTS (SELECT 1 FROM vg.menus m WHERE m.id=t.menu_id AND m.is_demo=true)'
   WHEN 'dishes' THEN ' AND t.is_demo=true AND NOT EXISTS (SELECT 1 FROM vg.menu_dishes md JOIN vg.menus m ON m.id=md.menu_id WHERE md.dish_id=t.id AND NOT m.is_demo)'
   WHEN 'themes' THEN ' AND EXISTS (SELECT 1 FROM vg.menus m WHERE m.theme_id=t.id AND m.is_demo) AND NOT EXISTS (SELECT 1 FROM vg.menus m WHERE m.theme_id=t.id AND NOT m.is_demo)'
   WHEN 'diets' THEN ' AND EXISTS (SELECT 1 FROM vg.menus m WHERE m.diet_id=t.id AND m.is_demo) AND NOT EXISTS (SELECT 1 FROM vg.menus m WHERE m.diet_id=t.id AND NOT m.is_demo)'
   WHEN 'allergens' THEN ' AND EXISTS (SELECT 1 FROM vg.dish_allergens da JOIN vg.dishes d ON d.id=da.dish_id WHERE da.allergen_id=t.id AND d.is_demo) AND NOT EXISTS (SELECT 1 FROM vg.dish_allergens da JOIN vg.dishes d ON d.id=da.dish_id LEFT JOIN vg.menu_dishes md ON md.dish_id=d.id LEFT JOIN vg.menus m ON m.id=md.menu_id WHERE da.allergen_id=t.id AND (NOT d.is_demo OR NOT m.is_demo))'
   ELSE '' END;
  EXECUTE format('UPDATE vg.%I AS t SET %I=$1 WHERE t.%I::text=$2 AND t.%I=$3%s', item.table_name,item.column_name,key_column,item.column_name,scope)
   USING item.new_value,item.row_key,item.old_value;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Unexpected value or scope for %.% key %; transaction aborted',item.table_name,item.column_name,item.row_key; END IF;
  total := total + affected;
 END LOOP;
 RAISE NOTICE 'UTF8 text fields processed: %',total;
END;
$repair$;
COMMIT;
