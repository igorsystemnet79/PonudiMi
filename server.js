const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET =
process.env.JWT_SECRET || "ponudimi-mvp-change-this-secret";

if (!process.env.DATABASE_URL) {
console.warn("WARNING: DATABASE_URL nije podešen.");
}

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: process.env.DATABASE_URL
? { rejectUnauthorized: false }
: false,
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

function signToken(user) {
return jwt.sign(
{
id: user.id,
email: user.email,
type: user.type,
},
JWT_SECRET,
{ expiresIn: "30d" }
);
}

function auth(req, res, next) {
const header = req.headers.authorization || "";

if (!header.startsWith("Bearer ")) {
return res.status(401).json({ error: "Potrebna je prijava." });
}

const token = header.substring(7);

try {
req.user = jwt.verify(token, JWT_SECRET);
next();
} catch (error) {
return res.status(401).json({ error: "Nevažeća ili istekla prijava." });
}
}

async function initDatabase() {
await pool.query(`     CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'individual',
      company_name TEXT,
      pib TEXT,
      package_name TEXT,
      package_expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

await pool.query(`     CREATE TABLE IF NOT EXISTS listings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT,
      price NUMERIC,
      description TEXT,
      image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

await pool.query(`     CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT,
      location TEXT,
      budget NUMERIC,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

await pool.query(`     CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

const demoPassword = await bcrypt.hash("PonudiMi123!", 10);

await pool.query(
`       INSERT INTO users
        (name, email, password_hash, type)
      VALUES
        ($1, $2, $3, 'individual')
      ON CONFLICT (email) DO NOTHING
    `,
["Demo Korisnik", "[demo@ponudimi.rs](mailto:demo@ponudimi.rs)", demoPassword]
);

const demoUser = await pool.query(
`SELECT id FROM users WHERE email = $1`,
["[demo@ponudimi.rs](mailto:demo@ponudimi.rs)"]
);

if (demoUser.rows.length) {
const userId = demoUser.rows[0].id;

```
const count = await pool.query(
  `SELECT COUNT(*)::int AS count FROM listings WHERE user_id = $1`,
  [userId]
);

if (count.rows[0].count === 0) {
  await pool.query(
    `
      INSERT INTO listings
        (user_id, title, category, location, price, description, image)
      VALUES
        ($1, 'Volkswagen Golf 7 1.6 TDI', 'Polovni automobili', 'Beograd', 8990, 'Odlično očuvan automobil.', ''),
        ($1, 'Stan 62 m²', 'Nekretnine', 'Novi Sad', 125000, 'Stan u mirnom delu grada.', ''),
        ($1, 'iPhone 15 Pro', 'Mobilni telefoni', 'Niš', 720, 'Telefon u odličnom stanju.', '')
    `,
    [userId]
  );
}
```

}

console.log("PostgreSQL baza je spremna.");
}

app.get("/api/health", async (req, res) => {
try {
await pool.query("SELECT 1");

```
res.json({
  ok: true,
  service: "PonudiMi",
  database: "connected",
});
```

} catch (error) {
console.error("Health check error:", error);

```
res.status(500).json({
  ok: false,
  service: "PonudiMi",
  database: "error",
});
```

}
});

app.get("/api/categories", (req, res) => {
res.json([
"Polovni automobili",
"Nekretnine",
"Mobilni telefoni",
"Tehnika",
"Usluge",
"Građevina",
"Poljoprivreda",
"Moda",
"Ostalo",
]);
});

app.get("/api/listings", async (req, res) => {
try {
const q = String(req.query.q || "").trim();
const category = String(req.query.category || "").trim();
const location = String(req.query.location || "").trim();

```
const conditions = [];
const values = [];

if (q) {
  values.push(`%${q}%`);
  conditions.push(
    `(title ILIKE $${values.length} OR description ILIKE $${values.length})`
  );
}

if (category) {
  values.push(category);
  conditions.push(`category = $${values.length}`);
}

if (location) {
  values.push(`%${location}%`);
  conditions.push(`location ILIKE $${values.length}`);
}

let sql = `
  SELECT
    id,
    title,
    category,
    location,
    price,
    description,
    image,
    created_at
  FROM listings
`;

if (conditions.length) {
  sql += ` WHERE ${conditions.join(" AND ")}`;
}

sql += ` ORDER BY created_at DESC LIMIT 100`;

const result = await pool.query(sql, values);

res.json(result.rows);
```

} catch (error) {
console.error("GET /api/listings error:", error);
res.status(500).json({ error: "Greška pri učitavanju oglasa." });
}
});

app.post("/api/auth/register", async (req, res) => {
try {
const {
name,
email,
password,
type = "individual",
companyName,
pib,
} = req.body;

```
if (!name || !email || !password) {
  return res.status(400).json({
    error: "Ime, email i lozinka su obavezni.",
  });
}

if (password.length < 6) {
  return res.status(400).json({
    error: "Lozinka mora imati najmanje 6 karaktera.",
  });
}

if (!["individual", "company"].includes(type)) {
  return res.status(400).json({
    error: "Nevažeći tip naloga.",
  });
}

if (type === "company" && !companyName) {
  return res.status(400).json({
    error: "Naziv firme je obavezan.",
  });
}

const normalizedEmail = String(email).trim().toLowerCase();

const existing = await pool.query(
  `SELECT id FROM users WHERE email = $1`,
  [normalizedEmail]
);

if (existing.rows.length) {
  return res.status(409).json({
    error: "Nalog sa ovim emailom već postoji.",
  });
}

const passwordHash = await bcrypt.hash(password, 10);

const result = await pool.query(
  `
    INSERT INTO users
      (
        name,
        email,
        password_hash,
        type,
        company_name,
        pib
      )
    VALUES
      ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      name,
      email,
      type,
      company_name,
      pib
  `,
  [
    name,
    normalizedEmail,
    passwordHash,
    type,
    companyName || null,
    pib || null,
  ]
);

const user = result.rows[0];
const token = signToken(user);

res.status(201).json({
  token,
  user,
});
```

} catch (error) {
console.error("REGISTER ERROR:", error);

```
res.status(500).json({
  error: "Registracija nije uspela.",
});
```

}
});

app.post("/api/auth/login", async (req, res) => {
try {
const { email, password } = req.body;

```
if (!email || !password) {
  return res.status(400).json({
    error: "Email i lozinka su obavezni.",
  });
}

const normalizedEmail = String(email).trim().toLowerCase();

const result = await pool.query(
  `
    SELECT
      id,
      name,
      email,
      password_hash,
      type,
      company_name,
      pib
    FROM users
    WHERE email = $1
  `,
  [normalizedEmail]
);

if (!result.rows.length) {
  return res.status(401).json({
    error: "Pogrešan email ili lozinka.",
  });
}

const user = result.rows[0];

const valid = await bcrypt.compare(password, user.password_hash);

if (!valid) {
  return res.status(401).json({
    error: "Pogrešan email ili lozinka.",
  });
}

delete user.password_hash;

const token = signToken(user);

res.json({
  token,
  user,
});
```

} catch (error) {
console.error("LOGIN ERROR:", error);

```
res.status(500).json({
  error: "Prijava nije uspela.",
});
```

}
});

app.get("/api/me", auth, async (req, res) => {
try {
const result = await pool.query(
`         SELECT
          id,
          name,
          email,
          type,
          company_name,
          pib,
          package_name,
          package_expires_at,
          created_at
        FROM users
        WHERE id = $1
      `,
[req.user.id]
);

```
if (!result.rows.length) {
  return res.status(404).json({
    error: "Korisnik nije pronađen.",
  });
}

res.json(result.rows[0]);
```

} catch (error) {
console.error("ME ERROR:", error);

```
res.status(500).json({
  error: "Greška pri učitavanju korisnika.",
});
```

}
});

app.post("/api/listings", auth, async (req, res) => {
try {
const {
title,
category,
location,
price,
description,
image,
} = req.body;

```
if (!title || !category || !location) {
  return res.status(400).json({
    error: "Naslov, kategorija i lokacija su obavezni.",
  });
}

const parsedPrice =
  price === undefined || price === null || price === ""
    ? null
    : Number(price);

const result = await pool.query(
  `
    INSERT INTO listings
      (
        user_id,
        title,
        category,
        location,
        price,
        description,
        image
      )
    VALUES
      ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `,
  [
    req.user.id,
    title,
    category,
    location,
    Number.isFinite(parsedPrice) ? parsedPrice : null,
    description || "",
    image || "",
  ]
);

res.status(201).json(result.rows[0]);
```

} catch (error) {
console.error("CREATE LISTING ERROR:", error);

```
res.status(500).json({
  error: "Oglas nije moguće objaviti.",
});
```

}
});

app.post("/api/requests", auth, async (req, res) => {
try {
const {
title,
category,
location,
budget,
description,
} = req.body;

```
if (!title) {
  return res.status(400).json({
    error: "Naslov zahteva je obavezan.",
  });
}

const parsedBudget =
  budget === undefined || budget === null || budget === ""
    ? null
    : Number(budget);

const result = await pool.query(
  `
    INSERT INTO requests
      (
        user_id,
        title,
        category,
        location,
        budget,
        description
      )
    VALUES
      ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `,
  [
    req.user.id,
    title,
    category || null,
    location || null,
    Number.isFinite(parsedBudget) ? parsedBudget : null,
    description || "",
  ]
);

res.status(201).json(result.rows[0]);
```

} catch (error) {
console.error("CREATE REQUEST ERROR:", error);

```
res.status(500).json({
  error: "Zahtev nije moguće sačuvati.",
});
```

}
});

app.post("/api/support/tickets", async (req, res) => {
try {
const {
name,
email,
subject,
message,
} = req.body;

```
if (!name || !email || !subject || !message) {
  return res.status(400).json({
    error: "Sva polja su obavezna.",
  });
}

await pool.query(
  `
    INSERT INTO support_tickets
      (
        name,
        email,
        subject,
        message
      )
    VALUES
      ($1, $2, $3, $4)
  `,
  [name, email, subject, message]
);

res.json({
  message: "Upit je uspešno poslat.",
});
```

} catch (error) {
console.error("SUPPORT TICKET ERROR:", error);

```
res.status(500).json({
  error: "Upit nije moguće poslati.",
});
```

}
});

app.post("/api/support/chat", async (req, res) => {
const message = String(req.body.message || "").trim().toLowerCase();

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
(message.includes("firma") ||
message.includes("pravno") ||
message.includes("preduze"))
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

res.json({ answer });
});

app.get("/*splat", (req, res) => {
res.sendFile(path.join(__dirname, "index.html"));
});

async function startServer() {
try {
await initDatabase();

```
app.listen(PORT, "0.0.0.0", () => {
  console.log(`PonudiMi server radi na portu ${PORT}`);
});
```

} catch (error) {
console.error("SERVER NIJE MOGAO DA SE POKRENE:", error);
process.exit(1);
}
}

startServer();
