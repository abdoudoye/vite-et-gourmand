"use strict";

// Une requête sans produit cartésien entre images, plats et allergènes.
const MENUS_SQL = `
SELECT m.id::text AS id, m.title, m.description,
       m.base_price_cents AS "basePriceCents", m.minimum_people AS "minimumPeople",
       m.stock_available AS stock, t.name AS theme, d.name AS diet, m.is_demo AS "isDemo",
       jsonb_build_object(
         'order', to_jsonb(string_to_array(m.order_conditions, E'\\n')),
         'storage', to_jsonb(string_to_array(m.storage_conditions, E'\\n'))
       ) AS conditions,
       COALESCE((SELECT jsonb_agg(jsonb_build_object(
           'src', im.path, 'alt', im.alt_text, 'caption', im.caption
         ) ORDER BY im.position, im.id)
         FROM vg.menu_images im WHERE im.menu_id = m.id), '[]'::jsonb) AS images,
       jsonb_build_object(
         'starters', COALESCE(course.items -> 'entree', '[]'::jsonb),
         'mains', COALESCE(course.items -> 'plat', '[]'::jsonb),
         'desserts', COALESCE(course.items -> 'dessert', '[]'::jsonb)
       ) AS dishes
FROM vg.menus m
JOIN vg.themes t ON t.id = m.theme_id
JOIN vg.diets d ON d.id = m.diet_id
LEFT JOIN LATERAL (
  SELECT jsonb_object_agg(grouped.category, grouped.entries) AS items
  FROM (
    SELECT dish.category, jsonb_agg(jsonb_build_object(
      'name', dish.name,
      'allergens', COALESCE((SELECT jsonb_agg(a.name ORDER BY a.name)
        FROM vg.dish_allergens da JOIN vg.allergens a ON a.id = da.allergen_id
        WHERE da.dish_id = dish.id), '[]'::jsonb)
    ) ORDER BY md.position, dish.id) AS entries
    FROM vg.menu_dishes md JOIN vg.dishes dish ON dish.id = md.dish_id
    WHERE md.menu_id = m.id AND dish.archived_at IS NULL
    GROUP BY dish.category
  ) grouped
) course ON true
WHERE m.archived_at IS NULL AND m.is_demo = $1
ORDER BY m.id`;

async function getMenus(database) {
  const { rows } = await database.query(MENUS_SQL, [true]);
  return rows.map((row) => {
    const id = Number(row.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("Identifiant non pris en charge.");
    return { ...row, id };
  });
}

module.exports = { getMenus, MENUS_SQL };
