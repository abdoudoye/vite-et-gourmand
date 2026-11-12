-- Données intégralement FICTIVES. Base de démonstration vide uniquement.
-- Comptes désactivés, sans mot de passe : aucune connexion possible.
BEGIN;
SET LOCAL client_encoding = 'UTF8';
SET LOCAL ROLE vg_owner;
SET LOCAL search_path = vg, pg_catalog;
INSERT INTO themes(name) VALUES ('Convivial');
INSERT INTO themes(name) VALUES ('Nature');
INSERT INTO themes(name) VALUES ('Fête');
INSERT INTO themes(name) VALUES ('Voyage');
INSERT INTO diets(name) VALUES ('Végétarien');
INSERT INTO diets(name) VALUES ('Végétalien');
INSERT INTO diets(name) VALUES ('Classique');
INSERT INTO menus(title,description,theme_id,diet_id,minimum_people,base_price_cents,stock_available,order_conditions,storage_conditions,notice_hours,is_demo) SELECT 'Table du Sud','Une proposition ensoleillée autour des légumes et des herbes du Sud.',t.id,d.id,6,18000,8,'Exemple fictif : demande au moins 72 heures avant la prestation.
Respecter le nombre minimum de personnes indiqué.
Prix pour le minimum de personnes, hors livraison ; tarif des personnes supplémentaires à définir.
Démonstration : aucune réservation ni commande réelle.','Exemple fictif : conserver au réfrigérateur après réception.
Les températures, durées de conservation et consignes de réchauffage doivent être définies par le traiteur pour chaque recette avant toute vente réelle.',72,true FROM themes t CROSS JOIN diets d WHERE t.name='Convivial' AND d.name='Végétarien';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/entree-demo.svg','Illustration fictive d’une salade dans une assiette.','Entrée — visuel de démonstration générique.',0,true FROM menus WHERE title='Table du Sud';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/menu-demo.svg','Illustration fictive d’une assiette de légumes.','Plat — visuel de démonstration générique.',1,true FROM menus WHERE title='Table du Sud';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/dessert-demo.svg','Illustration fictive d’une part de tarte.','Dessert — visuel de démonstration générique.',2,true FROM menus WHERE title='Table du Sud';
INSERT INTO menus(title,description,theme_id,diet_id,minimum_people,base_price_cents,stock_available,order_conditions,storage_conditions,notice_hours,is_demo) SELECT 'Le Jardin de saison','Un assortiment végétal coloré pour une table généreuse.',t.id,d.id,4,12000,5,'Exemple fictif : demande au moins 72 heures avant la prestation.
Respecter le nombre minimum de personnes indiqué.
Prix pour le minimum de personnes, hors livraison ; tarif des personnes supplémentaires à définir.
Démonstration : aucune réservation ni commande réelle.','Exemple fictif : conserver au réfrigérateur après réception.
Les températures, durées de conservation et consignes de réchauffage doivent être définies par le traiteur pour chaque recette avant toute vente réelle.',72,true FROM themes t CROSS JOIN diets d WHERE t.name='Nature' AND d.name='Végétalien';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/entree-demo.svg','Illustration fictive d’une salade dans une assiette.','Entrée — visuel de démonstration générique.',0,true FROM menus WHERE title='Le Jardin de saison';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/menu-demo.svg','Illustration fictive d’une assiette de légumes.','Plat — visuel de démonstration générique.',1,true FROM menus WHERE title='Le Jardin de saison';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/dessert-demo.svg','Illustration fictive d’une part de tarte.','Dessert — visuel de démonstration générique.',2,true FROM menus WHERE title='Le Jardin de saison';
INSERT INTO menus(title,description,theme_id,diet_id,minimum_people,base_price_cents,stock_available,order_conditions,storage_conditions,notice_hours,is_demo) SELECT 'La Grande Réception','Une inspiration festive pour les grandes occasions.',t.id,d.id,12,48000,3,'Exemple fictif : demande au moins 72 heures avant la prestation.
Respecter le nombre minimum de personnes indiqué.
Prix pour le minimum de personnes, hors livraison ; tarif des personnes supplémentaires à définir.
Démonstration : aucune réservation ni commande réelle.','Exemple fictif : conserver au réfrigérateur après réception.
Les températures, durées de conservation et consignes de réchauffage doivent être définies par le traiteur pour chaque recette avant toute vente réelle.',72,true FROM themes t CROSS JOIN diets d WHERE t.name='Fête' AND d.name='Classique';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/entree-demo.svg','Illustration fictive d’une salade dans une assiette.','Entrée — visuel de démonstration générique.',0,true FROM menus WHERE title='La Grande Réception';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/menu-demo.svg','Illustration fictive d’une assiette de légumes.','Plat — visuel de démonstration générique.',1,true FROM menus WHERE title='La Grande Réception';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/dessert-demo.svg','Illustration fictive d’une part de tarte.','Dessert — visuel de démonstration générique.',2,true FROM menus WHERE title='La Grande Réception';
INSERT INTO menus(title,description,theme_id,diet_id,minimum_people,base_price_cents,stock_available,order_conditions,storage_conditions,notice_hours,is_demo) SELECT 'L''Escale gourmande','Des associations douces et épicées pour un repas à partager.',t.id,d.id,8,24000,0,'Exemple fictif : demande au moins 72 heures avant la prestation.
Respecter le nombre minimum de personnes indiqué.
Prix pour le minimum de personnes, hors livraison ; tarif des personnes supplémentaires à définir.
Démonstration : aucune réservation ni commande réelle.','Exemple fictif : conserver au réfrigérateur après réception.
Les températures, durées de conservation et consignes de réchauffage doivent être définies par le traiteur pour chaque recette avant toute vente réelle.',72,true FROM themes t CROSS JOIN diets d WHERE t.name='Voyage' AND d.name='Classique';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/entree-demo.svg','Illustration fictive d’une salade dans une assiette.','Entrée — visuel de démonstration générique.',0,true FROM menus WHERE title='L''Escale gourmande';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/menu-demo.svg','Illustration fictive d’une assiette de légumes.','Plat — visuel de démonstration générique.',1,true FROM menus WHERE title='L''Escale gourmande';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/dessert-demo.svg','Illustration fictive d’une part de tarte.','Dessert — visuel de démonstration générique.',2,true FROM menus WHERE title='L''Escale gourmande';
INSERT INTO menus(title,description,theme_id,diet_id,minimum_people,base_price_cents,stock_available,order_conditions,storage_conditions,notice_hours,is_demo) SELECT 'Le Banquet végétal','Une table de fête imaginée autour des saveurs végétales.',t.id,d.id,10,36000,4,'Exemple fictif : demande au moins 72 heures avant la prestation.
Respecter le nombre minimum de personnes indiqué.
Prix pour le minimum de personnes, hors livraison ; tarif des personnes supplémentaires à définir.
Démonstration : aucune réservation ni commande réelle.','Exemple fictif : conserver au réfrigérateur après réception.
Les températures, durées de conservation et consignes de réchauffage doivent être définies par le traiteur pour chaque recette avant toute vente réelle.',72,true FROM themes t CROSS JOIN diets d WHERE t.name='Fête' AND d.name='Végétalien';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/entree-demo.svg','Illustration fictive d’une salade dans une assiette.','Entrée — visuel de démonstration générique.',0,true FROM menus WHERE title='Le Banquet végétal';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/menu-demo.svg','Illustration fictive d’une assiette de légumes.','Plat — visuel de démonstration générique.',1,true FROM menus WHERE title='Le Banquet végétal';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/dessert-demo.svg','Illustration fictive d’une part de tarte.','Dessert — visuel de démonstration générique.',2,true FROM menus WHERE title='Le Banquet végétal';
INSERT INTO menus(title,description,theme_id,diet_id,minimum_people,base_price_cents,stock_available,order_conditions,storage_conditions,notice_hours,is_demo) SELECT 'Le Déjeuner champêtre','Une pause conviviale inspirée des repas à la campagne.',t.id,d.id,6,18000,6,'Exemple fictif : demande au moins 72 heures avant la prestation.
Respecter le nombre minimum de personnes indiqué.
Prix pour le minimum de personnes, hors livraison ; tarif des personnes supplémentaires à définir.
Démonstration : aucune réservation ni commande réelle.','Exemple fictif : conserver au réfrigérateur après réception.
Les températures, durées de conservation et consignes de réchauffage doivent être définies par le traiteur pour chaque recette avant toute vente réelle.',72,true FROM themes t CROSS JOIN diets d WHERE t.name='Nature' AND d.name='Végétarien';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/entree-demo.svg','Illustration fictive d’une salade dans une assiette.','Entrée — visuel de démonstration générique.',0,true FROM menus WHERE title='Le Déjeuner champêtre';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/menu-demo.svg','Illustration fictive d’une assiette de légumes.','Plat — visuel de démonstration générique.',1,true FROM menus WHERE title='Le Déjeuner champêtre';
INSERT INTO menu_images(menu_id,path,alt_text,caption,position,is_demo) SELECT id,'images/dessert-demo.svg','Illustration fictive d’une part de tarte.','Dessert — visuel de démonstration générique.',2,true FROM menus WHERE title='Le Déjeuner champêtre';
INSERT INTO allergens(name) VALUES ('Lait');
INSERT INTO allergens(name) VALUES ('Gluten (blé)');
INSERT INTO allergens(name) VALUES ('Œufs');
INSERT INTO allergens(name) VALUES ('Moutarde');
INSERT INTO allergens(name) VALUES ('Poisson');
INSERT INTO allergens(name) VALUES ('Sésame');
INSERT INTO dishes(name,category,is_demo) VALUES ('Salade de tomates au basilic','entree',true);
INSERT INTO dishes(name,category,is_demo) VALUES ('Gratin de légumes et feta','plat',true);
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Gratin de légumes et feta' AND d.category='plat' AND a.name='Lait';
INSERT INTO dishes(name,category,is_demo) VALUES ('Tarte aux abricots','dessert',true);
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Tarte aux abricots' AND d.category='dessert' AND a.name='Gluten (blé)';
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Tarte aux abricots' AND d.category='dessert' AND a.name='Œufs';
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Tarte aux abricots' AND d.category='dessert' AND a.name='Lait';
INSERT INTO dishes(name,category,is_demo) VALUES ('Salade de carottes au citron','entree',true);
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Salade de carottes au citron' AND d.category='entree' AND a.name='Moutarde';
INSERT INTO dishes(name,category,is_demo) VALUES ('Lentilles et légumes rôtis','plat',true);
INSERT INTO dishes(name,category,is_demo) VALUES ('Compote de pommes','dessert',true);
INSERT INTO dishes(name,category,is_demo) VALUES ('Saumon fumé et crème citronnée','entree',true);
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Saumon fumé et crème citronnée' AND d.category='entree' AND a.name='Poisson';
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Saumon fumé et crème citronnée' AND d.category='entree' AND a.name='Lait';
INSERT INTO dishes(name,category,is_demo) VALUES ('Poulet rôti, pommes de terre','plat',true);
INSERT INTO dishes(name,category,is_demo) VALUES ('Entremets au chocolat','dessert',true);
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Entremets au chocolat' AND d.category='dessert' AND a.name='Lait';
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Entremets au chocolat' AND d.category='dessert' AND a.name='Œufs';
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Entremets au chocolat' AND d.category='dessert' AND a.name='Gluten (blé)';
INSERT INTO dishes(name,category,is_demo) VALUES ('Salade de concombre au sésame','entree',true);
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Salade de concombre au sésame' AND d.category='entree' AND a.name='Sésame';
INSERT INTO dishes(name,category,is_demo) VALUES ('Poulet au curry et riz','plat',true);
INSERT INTO dishes(name,category,is_demo) VALUES ('Riz au lait de coco','dessert',true);
INSERT INTO dishes(name,category,is_demo) VALUES ('Houmous et pain pita','entree',true);
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Houmous et pain pita' AND d.category='entree' AND a.name='Sésame';
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Houmous et pain pita' AND d.category='entree' AND a.name='Gluten (blé)';
INSERT INTO dishes(name,category,is_demo) VALUES ('Couscous de légumes et pois chiches','plat',true);
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Couscous de légumes et pois chiches' AND d.category='plat' AND a.name='Gluten (blé)';
INSERT INTO dishes(name,category,is_demo) VALUES ('Salade d’agrumes','dessert',true);
INSERT INTO dishes(name,category,is_demo) VALUES ('Quiche aux légumes','plat',true);
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Quiche aux légumes' AND d.category='plat' AND a.name='Lait';
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Quiche aux légumes' AND d.category='plat' AND a.name='Œufs';
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Quiche aux légumes' AND d.category='plat' AND a.name='Gluten (blé)';
INSERT INTO dishes(name,category,is_demo) VALUES ('Tarte aux pommes','dessert',true);
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Tarte aux pommes' AND d.category='dessert' AND a.name='Gluten (blé)';
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Tarte aux pommes' AND d.category='dessert' AND a.name='Œufs';
INSERT INTO dish_allergens(dish_id,allergen_id) SELECT d.id,a.id FROM dishes d CROSS JOIN allergens a WHERE d.name='Tarte aux pommes' AND d.category='dessert' AND a.name='Lait';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='Table du Sud' AND d.name='Salade de tomates au basilic' AND d.category='entree';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='Table du Sud' AND d.name='Gratin de légumes et feta' AND d.category='plat';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='Table du Sud' AND d.name='Tarte aux abricots' AND d.category='dessert';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='Le Jardin de saison' AND d.name='Salade de carottes au citron' AND d.category='entree';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='Le Jardin de saison' AND d.name='Lentilles et légumes rôtis' AND d.category='plat';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='Le Jardin de saison' AND d.name='Compote de pommes' AND d.category='dessert';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='La Grande Réception' AND d.name='Saumon fumé et crème citronnée' AND d.category='entree';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='La Grande Réception' AND d.name='Poulet rôti, pommes de terre' AND d.category='plat';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='La Grande Réception' AND d.name='Entremets au chocolat' AND d.category='dessert';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='L''Escale gourmande' AND d.name='Salade de concombre au sésame' AND d.category='entree';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='L''Escale gourmande' AND d.name='Poulet au curry et riz' AND d.category='plat';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='L''Escale gourmande' AND d.name='Riz au lait de coco' AND d.category='dessert';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='Le Banquet végétal' AND d.name='Houmous et pain pita' AND d.category='entree';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='Le Banquet végétal' AND d.name='Couscous de légumes et pois chiches' AND d.category='plat';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='Le Banquet végétal' AND d.name='Salade d’agrumes' AND d.category='dessert';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='Le Déjeuner champêtre' AND d.name='Salade de tomates au basilic' AND d.category='entree';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='Le Déjeuner champêtre' AND d.name='Quiche aux légumes' AND d.category='plat';
INSERT INTO menu_dishes(menu_id,dish_id,position) SELECT m.id,d.id,0 FROM menus m CROSS JOIN dishes d WHERE m.title='Le Déjeuner champêtre' AND d.name='Tarte aux pommes' AND d.category='dessert';
INSERT INTO users(role_code,first_name,last_name,email,phone,is_demo) VALUES ('utilisateur','Camille','Fictif','client.demo@example.test','TELEPHONE-FICTIF',true),('employe','Alex','Fictif','employe.demo@example.test','TELEPHONE-FICTIF',true);
INSERT INTO addresses(user_id,street,postal_code,city,is_default) SELECT id,'1 rue imaginaire (adresse fictive)','33000','Bordeaux',true FROM users WHERE email='client.demo@example.test';
INSERT INTO orders(reference,user_id,address_id,customer_first_name,customer_last_name,customer_email,customer_phone,delivery_street,delivery_postal_code,delivery_city,service_date,delivery_at,delivery_in_bordeaux,delivery_fee_cents,changed_by_user_id,change_reason,terms_version,terms_accepted_at,is_demo) SELECT 'DEMO-001',u.id,a.id,u.first_name,u.last_name,u.email,u.phone,a.street,a.postal_code,a.city,'2030-06-15','2030-06-15 10:00:00+02',true,0,u.id,'Création fictive de démonstration','DEMO-CGV-v1',now(),true FROM users u JOIN addresses a ON a.user_id=u.id WHERE u.email='client.demo@example.test';
INSERT INTO order_items(order_id,menu_id,people_count,gross_amount_cents,pricing_policy,discount_percent,discount_cents) SELECT o.id,m.id,m.minimum_people,m.base_price_cents,'DEMO : minimum uniquement, aucun tarif supplémentaire supposé',0,0 FROM orders o CROSS JOIN menus m WHERE o.reference='DEMO-001' AND m.title='Table du Sud';
INSERT INTO orders(reference,user_id,address_id,customer_first_name,customer_last_name,customer_email,customer_phone,delivery_street,delivery_postal_code,delivery_city,service_date,delivery_at,delivery_in_bordeaux,delivery_fee_cents,changed_by_user_id,change_reason,terms_version,terms_accepted_at,is_demo) SELECT 'DEMO-002',u.id,a.id,u.first_name,u.last_name,u.email,u.phone,a.street,a.postal_code,a.city,'2030-06-15','2030-06-15 10:00:00+02',true,0,u.id,'Création fictive de démonstration','DEMO-CGV-v1',now(),true FROM users u JOIN addresses a ON a.user_id=u.id WHERE u.email='client.demo@example.test';
INSERT INTO order_items(order_id,menu_id,people_count,gross_amount_cents,pricing_policy,discount_percent,discount_cents) SELECT o.id,m.id,m.minimum_people,m.base_price_cents,'DEMO : minimum uniquement, aucun tarif supplémentaire supposé',0,0 FROM orders o CROSS JOIN menus m WHERE o.reference='DEMO-002' AND m.title='Le Jardin de saison';
UPDATE orders SET status_code='accepte',accepted_at=now(),changed_by_user_id=(SELECT id FROM users WHERE email='employe.demo@example.test'),change_reason='Acceptation fictive pour tester le suivi' WHERE reference='DEMO-002';
INSERT INTO opening_hours(weekday,opens_at,closes_at,is_closed,is_demo) SELECT n,'09:00'::time,'18:00'::time,false,true FROM generate_series(1,6) n;
INSERT INTO opening_hours(weekday,is_closed,is_demo) VALUES (7,true,true);
COMMIT;
