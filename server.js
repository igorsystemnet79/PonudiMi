const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET =
process.env.JWT_SECRET || "ponudimi-mvp-change-this-secret";

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const pool = process.env.DATABASE_URL
? new Pool({
connectionString: process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false }
})
: null;

function requireDatabase() {
if (!pool) {
throw new Error("DATABASE_URL nije podešen.");
}

return pool;
}

function createToken(user) {
return jwt.sign(
{
id: user.id,
email: user.email,
type: user.type
},
JWT_SECRET,
{
expiresIn: "7d"
}
);
}

function getUserFromRequest(req) {
const header = req.headers.authorization || "";

if (!header.startsWith("Bearer ")) {
return null;
}

const token = header.substring(7);

try {
return jwt.verify(token, JWT_SECRET);
} catch (error) {
return null;
}
}

function authRequired(req, res, next) {
const user = getUserFromRequest(req);

if (!user) {
return res.status(401).json({
error: "Potrebna je prijava."
});
}

req.user = user;
next();
}

async function initDatabase() {
const db = requireDatabase();

const createUsersTable =
"CREATE TABLE IF NOT EXISTS users (" +
"id SERIAL PRIMARY KEY, " +
"name TEXT NOT NULL, " +
"email TEXT UNIQUE NOT NULL, " +
"password_hash TEXT NOT NULL, " +
"type TEXT NOT NULL DEFAULT 'individual', " +
"company_name TEXT, " +
"pib TEXT, " +
"created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()" +
")";

const createListingsTable =
"CREATE TABLE IF NOT EXISTS listings (" +
"id SERIAL PRIMARY KEY, " +
"user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, " +
"title TEXT NOT NULL, " +
"category TEXT NOT NULL, " +
"location TEXT NOT NULL, " +
"price NUMERIC, " +
"description TEXT, " +
"image TEXT, " +
"created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()" +
")";

const createRequestsTable =
"CREATE TABLE IF NOT EXISTS requests (" +
"id SERIAL PRIMARY KEY, " +
"user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, " +
"title TEXT NOT NULL, " +
"category TEXT, " +
"location TEXT, " +
"budget NUMERIC, " +
"description TEXT, " +
"created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()" +
")";

const createTicketsTable =
"CREATE TABLE IF NOT EXISTS support_tickets (" +
"id SERIAL PRIMARY KEY, " +
"user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, " +
"name TEXT NOT NULL, " +
"email TEXT NOT NULL, " +
"subject TEXT NOT NULL, " +
"message TEXT NOT NULL, " +
"created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()" +
")";

await db.query(createUsersTable);
await db.query(createListingsTable);
await db.query(createRequestsTable);
await db.query(createTicketsTable);

const userResult = await db.query(
"SELECT id FROM users WHERE email = $1 LIMIT 1",
["[demo@ponudimi.rs](mailto:demo@ponudimi.rs)"]
);

let demoUserId;

if (userResult.rows.length === 0) {
const passwordHash = await bcrypt.hash("PonudiMi123!", 10);

```
const inserted = await db.query(
  "INSERT INTO users " +
  "(name, email, password_hash, type, company_name, pib) " +
  "VALUES ($1, $2, $3, $4, $5, $6) " +
  "RETURNING id",
  [
    "Demo korisnik",
    "demo@ponudimi.rs",
    passwordHash,
    "individual",
    null,
    null
  ]
);

demoUserId = inserted.rows[0].id;
```

} else {
demoUserId = userResult.rows[0].id;
}

const listingCount = await db.query(
"SELECT COUNT(*)::int AS count FROM listings"
);

if (listingCount.rows[0].count === 0) {
const demoImage = "/assets/hero-reference.png";

```
await db.query(
  "INSERT INTO listings " +
  "(user_id, title, category, location, price, description, image) " +
  "VALUES " +
  "($1, $2, $3, $4, $5, $6, $7), " +
  "($1, $8, $9, $10, $11, $12, $7), " +
  "($1, $13, $14, $15, $16, $17, $7)",
  [
    demoUserId,
    "Peugeot 308 1.6 HDI",
    "Polovni automobili",
    "Beograd",
    5900,
    "Očuvan automobil, redovno održavan.",
    demoImage,
    "Stan u Novom Sadu",
    "Nekretnine",
    "Novi Sad",
    145000,
    "Moderan stan na dobroj lokaciji.",
    "Samsung Galaxy telefon",
    "Mobilni telefoni",
    "Niš",
    450,
    "Telefon u odličnom stanju."
  ]
);
```

}

console.log("PostgreSQL baza je spremna.");
}

app.get("/api/health", async (req, res) => {
try {
if (!pool) {
return res.status(500).json({
ok: false,
database: false,
error: "DATABASE_URL nije podešen."
});
}

```
await pool.query("SELECT 1");

res.json({
  ok: true,
  database: true
});
```

} catch (error) {
console.error("Health check greška:", error);

```
res.status(500).json({
  ok: false,
  database: false,
  error: "Baza nije dostupna."
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
"Ostalo"
]);
});

app.get("/api/listings", async (req, res) => {
try {
const db = requireDatabase();

```
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
  "SELECT id, title, category, location, price, description, image, created_at " +
  "FROM listings";

if (conditions.length) {
  sql += " WHERE " + conditions.join(" AND ");
}

sql += " ORDER BY created_at DESC LIMIT 100";

const result = await db.query(sql, values);

res.json(result.rows);
```

} catch (error) {
console.error("Greška pri pretrazi oglasa:", error);

```
res.status(500).json({
  error: "Greška pri učitavanju oglasa."
});
```

}
});

app.post("/api/auth/register", async (req, res) => {
try {
const db = requireDatabase();

```
const name = String(req.body.name || "").trim();

const email = String(req.body.email || "")
  .trim()
  .toLowerCase();

const password = String(req.body.password || "");

const type =
  req.body.type === "company"
    ? "company"
    : "individual";

const companyName = String(
  req.body.companyName || ""
).trim();

const pib = String(
  req.body.pib || ""
).trim();

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

if (type === "company" && !companyName) {
  return res.status(400).json({
    error: "Naziv firme je obavezan."
  });
}

const existing = await db.query(
  "SELECT id FROM users WHERE email = $1 LIMIT 1",
  [email]
);

if (existing.rows.length) {
  return res.status(409).json({
    error: "Korisnik sa tim emailom već postoji."
  });
}

const passwordHash = await bcrypt.hash(password, 10);

const result = await db.query(
  "INSERT INTO users " +
  "(name, email, password_hash, type, company_name, pib) " +
  "VALUES ($1, $2, $3, $4, $5, $6) " +
  "RETURNING id, name, email, type, company_name, pib",
  [
    name,
    email,
    passwordHash,
    type,
    type === "company" ? companyName : null,
    type === "company" ? pib || null : null
  ]
);

const user = result.rows[0];

res.status(201).json({
  message: "Registracija je uspešna.",
  token: createToken(user),
  user
});
```

} catch (error) {
console.error("Greška pri registraciji:", error);

```
res.status(500).json({
  error: "Greška pri registraciji."
});
```

}
});

app.post("/api/auth/login", async (req, res) => {
try {
const db = requireDatabase();

```
const email = String(req.body.email || "")
  .trim()
  .toLowerCase();

const password = String(req.body.password || "");

if (!email || !password) {
  return res.status(400).json({
    error: "Email i lozinka su obavezni."
  });
}

const result = await db.query(
  "SELECT id, name, email, password_hash, type, company_name, pib " +
  "FROM users WHERE email = $1 LIMIT 1",
  [email]
);

if (!result.rows.length) {
  return res.status(401).json({
    error: "Pogrešan email ili lozinka."
  });
}

const user = result.rows[0];

const validPassword = await bcrypt.compare(
  password,
  user.password_hash
);

if (!validPassword) {
  return res.status(401).json({
    error: "Pogrešan email ili lozinka."
  });
}

delete user.password_hash;

res.json({
  message: "Uspešna prijava.",
  token: createToken(user),
  user
});
```

} catch (error) {
console.error("Greška pri prijavi:", error);

```
res.status(500).json({
  error: "Greška pri prijavi."
});
```

}
});

app.get("/api/me", authRequired, async (req, res) => {
try {
const db = requireDatabase();

```
const result = await db.query(
  "SELECT id, name, email, type, company_name, pib, created_at " +
  "FROM users WHERE id = $1 LIMIT 1",
  [req.user.id]
);

if (!result.rows.length) {
  return res.status(404).json({
    error: "Korisnik nije pronađen."
  });
}

res.json(result.rows[0]);
```

} catch (error) {
console.error(
"Greška pri učitavanju korisnika:",
error
);

```
res.status(500).json({
  error: "Greška pri učitavanju profila."
});
```

}
});

app.post("/api/listings", authRequired, async (req, res) => {
try {
const db = requireDatabase();

```
const title = String(
  req.body.title || ""
).trim();

const category = String(
  req.body.category || ""
).trim();

const location = String(
  req.body.location || ""
).trim();

const description = String(
  req.body.description || ""
).trim();

const image =
  String(req.body.image || "").trim() ||
  "/assets/hero-reference.png";

const priceRaw = String(
  req.body.price || ""
).trim();

const price = priceRaw
  ? Number(priceRaw)
  : null;

if (!title || !category || !location) {
  return res.status(400).json({
    error: "Naslov, kategorija i lokacija su obavezni."
  });
}

if (
  priceRaw &&
  (!Number.isFinite(price) || price < 0)
) {
  return res.status(400).json({
    error: "Cena nije ispravna."
  });
}

const result = await db.query(
  "INSERT INTO listings " +
  "(user_id, title, category, location, price, description, image) " +
  "VALUES ($1, $2, $3, $4, $5, $6, $7) " +
  "RETURNING id, title, category, location, price, description, image, created_at",
  [
    req.user.id,
    title,
    category,
    location,
    price,
    description,
    image
  ]
);

res.status(201).json({
  message: "Oglas je objavljen.",
  listing: result.rows[0]
});
```

} catch (error) {
console.error(
"Greška pri objavljivanju oglasa:",
error
);

```
res.status(500).json({
  error: "Greška pri objavljivanju oglasa."
});
```

}
});

app.post("/api/requests", authRequired, async (req, res) => {
try {
const db = requireDatabase();

```
const title = String(
  req.body.title || ""
).trim();

const category = String(
  req.body.category || ""
).trim();

const location = String(
  req.body.location || ""
).trim();

const description = String(
  req.body.description || ""
).trim();

const budgetRaw = String(
  req.body.budget || ""
).trim();

const budget = budgetRaw
  ? Number(budgetRaw)
  : null;

if (!title) {
  return res.status(400).json({
    error: "Naslov zahteva je obavezan."
  });
}

if (
  budgetRaw &&
  (!Number.isFinite(budget) || budget < 0)
) {
  return res.status(400).json({
    error: "Budžet nije ispravan."
  });
}

const result = await db.query(
  "INSERT INTO requests " +
  "(user_id, title, category, location, budget, description) " +
  "VALUES ($1, $2, $3, $4, $5, $6) " +
  "RETURNING id, title, category, location, budget, description, created_at",
  [
    req.user.id,
    title,
    category || null,
    location || null,
    budget,
    description
  ]
);

res.status(201).json({
  message: "Zahtev je sačuvan.",
  request: result.rows[0]
});
```

} catch (error) {
console.error(
"Greška pri čuvanju zahteva:",
error
);

```
res.status(500).json({
  error: "Greška pri čuvanju zahteva."
});
```

}
});

app.post("/api/support/tickets", async (req, res) => {
try {
const db = requireDatabase();

```
const name = String(
  req.body.name || ""
).trim();

const email = String(
  req.body.email || ""
)
  .trim()
  .toLowerCase();

const subject = String(
  req.body.subject || ""
).trim();

const message = String(
  req.body.message || ""
).trim();

if (
  !name ||
  !email ||
  !subject ||
  !message
) {
  return res.status(400).json({
    error: "Sva polja su obavezna."
  });
}

const user = getUserFromRequest(req);

await db.query(
  "INSERT INTO support_tickets " +
  "(user_id, name, email, subject, message) " +
  "VALUES ($1, $2, $3, $4, $5)",
  [
    user ? user.id : null,
    name,
    email,
    subject,
    message
  ]
);

res.status(201).json({
  message: "Upit je uspešno poslat."
});
```

} catch (error) {
console.error(
"Greška pri slanju upita:",
error
);

```
res.status(500).json({
  error: "Greška pri slanju upita."
});
```

}
});

app.post("/api/support/chat", async (req, res) => {
const message = String(
req.body.message || ""
)
.trim()
.toLowerCase();

let answer =
"Mogu da pomognem oko registracije, prijave, oglasa, zahteva i korišćenja PonudiMi platforme.";

if (
message.includes("registr") ||
message.includes("nalog")
) {
answer =
"Za registraciju kliknite na dugme „Registracija“. Možete izabrati fizičko lice ili pravno lice i zatim popuniti tražene podatke.";
} else if (
message.includes("prijav") ||
message.includes("login") ||
message.includes("lozink")
) {
answer =
"Za prijavu kliknite na „Prijava“ i unesite email adresu i lozinku koju ste koristili prilikom registracije.";
} else if (
message.includes("oglas") ||
message.includes("ponud")
) {
answer =
"Nakon prijave možete koristiti opciju „Objavi oglas“ i uneti naslov, kategoriju, lokaciju, cenu i opis.";
} else if (
message.includes("zahtev") ||
message.includes("tražim")
) {
answer =
"Opcija „Postavi zahtev“ omogućava vam da navedete šta tražite, kategoriju, lokaciju, budžet i dodatni opis.";
} else if (
message.includes("paket") ||
message.includes("firma") ||
message.includes("pravno")
) {
answer =
"Pravna lica imaju posebne pakete za korišćenje platforme. Detalji paketa dostupni su prilikom registracije pravnog lica.";
} else if (
message.includes("proviz") ||
message.includes("5%")
) {
answer =
"PonudiMi platforma ima proviziju od 5% po realizovanoj transakciji.";
}

res.json({
answer
});
});

app.use(express.static(__dirname));

app.get("/*splat", (req, res) => {
res.sendFile(
path.join(__dirname, "index.html")
);
});

async function startServer() {
try {
if (!pool) {
console.error(
"GREŠKA: DATABASE_URL nije podešen u Render Environment Variables."
);

```
  process.exit(1);
}

await initDatabase();

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "PonudiMi server radi na portu " +
      PORT
    );
  }
);
```

} catch (error) {
console.error(
"SERVER NIJE MOGAO DA SE POKRENE:",
error
);

```
process.exit(1);
```

}
}

startServer();
