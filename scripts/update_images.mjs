import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const images = {
  'prod_espresso': 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=400&q=80',
  'prod_americano': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
  'prod_cappuccino': 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=400&q=80',
  'prod_latte': 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?auto=format&fit=crop&w=400&q=80',
  'prod_iced_caramel': 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
  'prod_orange_juice': 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=400&q=80',
  'prod_croissant': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=400&q=80',
  'prod_muffin': 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=400&q=80',
  'prod_brownie': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=400&q=80',
  'prod_cheesecake': 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=400&q=80',
  'prod_butifarra': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=400&q=80',
  'prod_triple': 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=400&q=80'
};

async function update() {
  for (const [id, url] of Object.entries(images)) {
    await pool.query('UPDATE products SET image_url = $1 WHERE id = $2', [url, id]);
  }
  await pool.query("UPDATE products SET image_url = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80' WHERE image_url IS NULL AND (name ILIKE '%coffee%' OR name ILIKE '%espresso%')");
  await pool.query("UPDATE products SET image_url = 'https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?auto=format&fit=crop&w=400&q=80' WHERE image_url IS NULL AND name ILIKE '%tarta%'");
  
  const res = await pool.query('SELECT id, name, image_url FROM products WHERE image_url IS NOT NULL');
  console.log('Successfully updated products with images. Total count:', res.rowCount);
  pool.end();
}

update().catch(err => {
  console.error(err);
  pool.end();
});
