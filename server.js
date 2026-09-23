async function initDatabase() {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS users (" +
    "id SERIAL PRIMARY KEY, " +
    "name TEXT NOT NULL, " +
    "email TEXT UNIQUE NOT NULL, " +
    "password_hash TEXT NOT NULL, " +
    "type TEXT NOT NULL DEFAULT 'individual', " +
    "company_name TEXT, " +
    "pib TEXT, " +
    "package_name TEXT, " +
    "package_expires_at TIMESTAMP, " +
    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
    ")"
  );

  await pool.query(
    "CREATE TABLE IF NOT EXISTS listings (" +
    "id SERIAL PRIMARY KEY, " +
    "user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, " +
    "title TEXT NOT NULL, " +
    "category TEXT NOT NULL, " +
    "location TEXT, " +
    "price NUMERIC, " +
    "description TEXT, " +
    "image TEXT, " +
    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
    ")"
  );

  await pool.query(
    "CREATE TABLE IF NOT EXISTS requests (" +
    "id SERIAL PRIMARY KEY, " +
    "user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, " +
    "title TEXT NOT NULL, " +
    "category TEXT, " +
    "location TEXT, " +
    "budget NUMERIC, " +
    "description TEXT, " +
    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
    ")"
  );

  await pool.query(
    "CREATE TABLE IF NOT EXISTS support_tickets (" +
    "id SERIAL PRIMARY KEY, " +
    "name TEXT NOT NULL, " +
    "email TEXT NOT NULL, " +
    "subject TEXT NOT NULL, " +
    "message TEXT NOT NULL, " +
    "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
    ")"
  );

  const demoPassword = await bcrypt.hash("PonudiMi123!", 10);

  await pool.query(
    "INSERT INTO users " +
    "(name, email, password_hash, type) " +
    "VALUES ($1, $2, $3, 'individual') " +
    "ON CONFLICT (email) DO NOTHING",
    [
      "Demo Korisnik",
      "demo@ponudimi.rs",
      demoPassword
    ]
  );

  const demoUser = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    ["demo@ponudimi.rs"]
  );

  if (demoUser.rows.length > 0) {
    const userId = demoUser.rows[0].id;

    const countResult = await pool.query(
      "SELECT COUNT(*)::int AS count FROM listings WHERE user_id = $1",
      [userId]
    );

    if (countResult.rows[0].count === 0) {
      await pool.query(
        "INSERT INTO listings (user_id, title, category, location, price, description, image) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          userId,
          "Volkswagen Golf 7 1.6 TDI",
          "Polovni automobili",
          "Beograd",
          8990,
          "Odlično očuvan automobil.",
          ""
        ]
      );

      await pool.query(
        "INSERT INTO listings (user_id, title, category, location, price, description, image) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          userId,
          "Stan 62 m2",
          "Nekretnine",
          "Novi Sad",
          125000,
          "Stan u mirnom delu grada.",
          ""
        ]
      );

      await pool.query(
        "INSERT INTO listings (user_id, title, category, location, price, description, image) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          userId,
          "iPhone 15 Pro",
          "Mobilni telefoni",
          "Niš",
          720,
          "Telefon u odličnom stanju.",
          ""
        ]
      );
    }
  }

  console.log("PostgreSQL baza je spremna.");
}
