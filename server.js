const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET =
  process.env.JWT_SECRET || "ponudimi-mvp-change-this-secret";

const publicPath = path.join(__dirname, "public");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/*
  Sve što se nalazi u public folderu postaje dostupno u browseru:
  public/index.html                -> /
  public/styles.css                -> /styles.css
  public/app.js                    -> /app.js
  public/ponudimi-logo.jpeg        -> /ponudimi-logo.jpeg
  public/reference-homepage.jpeg   -> /reference-homepage.jpeg
*/
app.use(express.static(publicPath));

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      type: user.type
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Potrebna je prijava."
    });
  }

  const token = header.substring(7);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Nevažeća ili istekla prijava."
    });
  }
}

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
      const demoListings = [
        [
          userId,
          "Volkswagen Golf 7 1.6 TDI",
          "Polovni automobili",
          "Beograd",
          8990,
          "Odlično očuvan automobil.",
          ""
        ],
        [
          userId,
          "Stan 62 m2",
          "Nekretnine",
          "Novi Sad",
          125000,
          "Stan u mirnom delu grada.",
          ""
        ],
        [
          userId,
          "iPhone 15 Pro",
          "Mobilni telefoni",
          "Niš",
          720,
          "Telefon u odličnom stanju.",
          ""
        ]
      ];

      for (const listing of demoListings) {
        await pool.query(
          "INSERT INTO listings " +
            "(user_id, title, category, location, price, description, image) " +
            "VALUES ($1, $2, $3, $4, $5, $6, $7)",
          listing
        );
      }
    }
  }

  console.log("PostgreSQL baza je spremna.");
}

app.get("/api/health", async function(req, res) {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      service: "PonudiMi",
      database: "connected"
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      ok: false,
      service: "PonudiMi",
      database: "error"
    });
  }
});

app.get("/api/categories", function(req, res) {
  res.json([
    "Polovni automobili",
    "Nekretnine",
    "Mobilni telefoni",
    "Tehnika",
    "Usluge",
    "Građevina",
    "Poljoprivreda",
    "Moda",
    "Ostalo"
  ]);
});

app.get("/api/listings", async function(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    const category = String(req.query.category || "").trim();
    const location = String(req.query.location || "").trim();

    const conditions = [];
    const values = [];

    if (q) {
      values.push("%" + q + "%");

      conditions.push(
        "(title ILIKE $" +
          values.length +
          " OR description ILIKE $" +
          values.length +
          ")"
      );
    }

    if (category) {
      values.push(category);
      conditions.push("category = $" + values.length);
    }

    if (location) {
      values.push("%" + location + "%");
      conditions.push("location ILIKE $" + values.length);
    }

    let sql =
      "SELECT id, title, category, location, price, " +
      "description, image, created_at " +
      "FROM listings";

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY created_at DESC LIMIT 100";

    const result = await pool.query(sql, values);

    res.json(result.rows);
  } catch (error) {
    console.error("GET /api/listings error:", error);

    res.status(500).json({
      error: "Greška pri učitavanju oglasa."
    });
  }
});

app.post("/api/auth/register", async function(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const type = req.body.type || "individual";
    const companyName = String(req.body.companyName || "").trim();
    const pib = String(req.body.pib || "").trim();

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Ime, email i lozinka su obavezni."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Lozinka mora imati najmanje 6 karaktera."
      });
    }

    if (type !== "individual" && type !== "company") {
      return res.status(400).json({
        error: "Nevažeći tip naloga."
      });
    }

    if (type === "company" && !companyName) {
      return res.status(400).json({
        error: "Naziv firme je obavezan."
      });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: "Nalog sa ovim emailom već postoji."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users " +
        "(name, email, password_hash, type, company_name, pib) " +
        "VALUES ($1, $2, $3, $4, $5, $6) " +
        "RETURNING id, name, email, type, company_name, pib",
      [
        name,
        email,
        passwordHash,
        type,
        companyName || null,
        pib || null
      ]
    );

    const user = result.rows[0];
    const token = signToken(user);

    res.status(201).json({
      token: token,
      user: user
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      error: "Registracija nije uspela."
    });
  }
});

app.post("/api/auth/login", async function(req, res) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        error: "Email i lozinka su obavezni."
      });
    }

    const result = await pool.query(
      "SELECT id, name, email, password_hash, type, company_name, pib " +
        "FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Pogrešan email ili lozinka."
      });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({
        error: "Pogrešan email ili lozinka."
      });
    }

    delete user.password_hash;

    const token = signToken(user);

    res.json({
      token: token,
      user: user
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      error: "Prijava nije uspela."
    });
  }
});

app.get("/api/me", auth, async function(req, res) {
  try {
    const result = await pool.query(
      "SELECT id, name, email, type, company_name, pib, " +
        "package_name, package_expires_at, created_at " +
        "FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Korisnik nije pronađen."
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("ME ERROR:", error);

    res.status(500).json({
      error: "Greška pri učitavanju korisnika."
    });
  }
});

app.post("/api/listings", auth, async function(req, res) {
  try {
    const title = String(req.body.title || "").trim();
    const category = String(req.body.category || "").trim();
    const location = String(req.body.location || "").trim();
    const price = req.body.price;
    const description = String(req.body.description || "").trim();
    const image = String(req.body.image || "").trim();

    if (!title || !category || !location) {
      return res.status(400).json({
        error: "Naslov, kategorija i lokacija su obavezni."
      });
    }

    const parsedPrice =
      price === undefined || price === null || price === ""
        ? null
        : Number(price);

    if (parsedPrice !== null && !Number.isFinite(parsedPrice)) {
      return res.status(400).json({
        error: "Cena mora biti ispravan broj."
      });
    }

    const result = await pool.query(
      "INSERT INTO listings " +
        "(user_id, title, category, location, price, description, image) " +
        "VALUES ($1, $2, $3, $4, $5, $6, $7) " +
        "RETURNING *",
      [
        req.user.id,
        title,
        category,
        location,
        parsedPrice,
        description,
        image
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("CREATE LISTING ERROR:", error);

    res.status(500).json({
      error: "Oglas nije moguće objaviti."
    });
  }
});

app.post("/api/requests", auth, async function(req, res) {
  try {
    const title = String(req.body.title || "").trim();
    const category = String(req.body.category || "").trim();
    const location = String(req.body.location || "").trim();
    const budget = req.body.budget;
    const description = String(req.body.description || "").trim();

    if (!title) {
      return res.status(400).json({
        error: "Naslov zahteva je obavezan."
      });
    }

    const parsedBudget =
      budget === undefined || budget === null || budget === ""
        ? null
        : Number(budget);

    if (parsedBudget !== null && !Number.isFinite(parsedBudget)) {
      return res.status(400).json({
        error: "Budžet mora biti ispravan broj."
      });
    }

    const result = await pool.query(
      "INSERT INTO requests " +
        "(user_id, title, category, location, budget, description) " +
        "VALUES ($1, $2, $3, $4, $5, $6) " +
        "RETURNING *",
      [
        req.user.id,
        title,
        category || null,
        location || null,
        parsedBudget,
        description
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("CREATE REQUEST ERROR:", error);

    res.status(500).json({
      error: "Zahtev nije moguće sačuvati."
    });
  }
});

app.post("/api/support/tickets", async function(req, res) {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const subject = String(req.body.subject || "").trim();
    const message = String(req.body.message || "").trim();

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: "Sva polja su obavezna."
      });
    }

    await pool.query(
      "INSERT INTO support_tickets " +
        "(name, email, subject, message) " +
        "VALUES ($1, $2, $3, $4)",
      [name, email, subject, message]
    );

    res.json({
      message: "Upit je uspešno poslat."
    });
  } catch (error) {
    console.error("SUPPORT TICKET ERROR:", error);

    res.status(500).json({
      error: "Upit nije moguće poslati."
    });
  }
});

app.post("/api/support/chat", function(req, res) {
  const message = String(req.body.message || "")
    .trim()
    .toLowerCase();

  let answer =
    "Mogu da pomognem oko registracije, prijave, oglasa, zahteva i paketa za firme.";

  if (
    message.includes("registr") &&
    (message.includes("fizi") || message.includes("lice"))
  ) {
    answer =
      "Za registraciju fizičkog lica izaberite Registracija, zatim Fizičko lice i popunite ime, email i lozinku.";
  } else if (
    message.includes("registr") &&
    (
      message.includes("firma") ||
      message.includes("pravno") ||
      message.includes("preduze")
    )
  ) {
    answer =
      "Za registraciju firme izaberite Registracija, zatim Pravno lice. Unose se podaci firme, uključujući naziv firme i PIB.";
  } else if (
    message.includes("prijav") ||
    message.includes("login") ||
    message.includes("ulog")
  ) {
    answer =
      "Za prijavu izaberite Prijava i unesite email i lozinku koje ste koristili prilikom registracije.";
  } else if (
    message.includes("oglas") ||
    message.includes("objav")
  ) {
    answer =
      "Za objavljivanje oglasa potrebno je da budete prijavljeni. Izaberite Objavi oglas, popunite podatke i pošaljite oglas.";
  } else if (
    message.includes("zahtev") ||
    message.includes("traž")
  ) {
    answer =
      "Postavljanje zahteva omogućava vam da navedete šta tražite, kategoriju, lokaciju, budžet i opis.";
  } else if (
    message.includes("paket") ||
    message.includes("cena") ||
    message.includes("10") ||
    message.includes("20") ||
    message.includes("50") ||
    message.includes("100")
  ) {
    answer =
      "Paketi za firme su: 10 € mesečno, 20 € za 3 meseca, 50 € za 6 meseci i Premium 100 € za 12 meseci.";
  } else if (
    message.includes("komis") ||
    message.includes("proviz")
  ) {
    answer =
      "PonudiMi platforma predviđa 5% provizije po realizovanoj transakciji.";
  } else if (
    message.includes("ćao") ||
    message.includes("zdravo") ||
    message.includes("pozdrav")
  ) {
    answer =
      "Zdravo! Kako mogu da pomognem oko PonudiMi platforme?";
  }

  res.json({
    answer: answer
  });
});

/*
  Ova ruta mora biti posle API ruta i express.static.
  Sve nepoznate browser putanje vraćaju public/index.html.
*/
app.get("/*splat", function(req, res) {
  res.sendFile(path.join(publicPath, "index.html"));
});

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, "0.0.0.0", function() {
      console.log("PonudiMi server radi na portu " + PORT);
    });
  } catch (error) {
    console.error("SERVER NIJE MOGAO DA SE POKRENE:", error);
    process.exit(1);
  }
}

startServer();
