const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ponudimi-mvp-change-this-secret';

if (!process.env.DATABASE_URL) {
console.error('ERROR: DATABASE_URL nije podešen.');
}

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: process.env.DATABASE_URL
? { rejectUnauthorized: false }
: false
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

function createToken(user) {
return jwt.sign(
{
id: user.id,
email: user.email,
type: user.type
},
JWT_SECRET,
{ expiresIn: '7d' }
);
}

function authRequired(req, res, next) {
try {
const header = req.headers.authorization || '';

```
if (!header.startsWith('Bearer ')) {
  return res.status(401).json({
    error: 'Potrebna je prijava.'
  });
}

const token = header.substring(7);
const decoded = jwt.verify(token, JWT_SECRET);

req.user = decoded;
next();
```

} catch (error) {
return res.status(401).json({
error: 'Nevažeća ili istekla prijava.'
});
}
}

async function initDatabase() {
if (!process.env.DATABASE_URL) {
console.warn('DATABASE_URL nije podešen. Server će se pokrenuti bez baze.');
return;
}

const createUsersTable =
'CREATE TABLE IF NOT EXISTS users (' +
'id SERIAL PRIMARY KEY, ' +
'name TEXT NOT NULL, ' +
'email TEXT UNIQUE NOT NULL, ' +
'password_hash TEXT NOT NULL, ' +
'type TEXT NOT NULL DEFAULT 'individual', ' +
'company_name TEXT, ' +
'pib TEXT, ' +
'package_name TEXT, ' +
'package_expires_at TIMESTAMP, ' +
'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' +
')';

const createListingsTable =
'CREATE TABLE IF NOT EXISTS listings (' +
'id SERIAL PRIMARY KEY, ' +
'user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, ' +
'title TEXT NOT NULL, ' +
'category TEXT, ' +
'location TEXT, ' +
'price NUMERIC, ' +
'description TEXT, ' +
'image TEXT, ' +
'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' +
')';

const createRequestsTable =
'CREATE TABLE IF NOT EXISTS requests (' +
'id SERIAL PRIMARY KEY, ' +
'user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, ' +
'title TEXT NOT NULL, ' +
'category TEXT, ' +
'location TEXT, ' +
'budget NUMERIC, ' +
'description TEXT, ' +
'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' +
')';

const createSupportTable =
'CREATE TABLE IF NOT EXISTS support_tickets (' +
'id SERIAL PRIMARY KEY, ' +
'user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, ' +
'name TEXT, ' +
'email TEXT NOT NULL, ' +
'subject TEXT NOT NULL, ' +
'message TEXT NOT NULL, ' +
'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' +
')';

await pool.query(createUsersTable);
await pool.query(createListingsTable);
await pool.query(createRequestsTable);
await pool.query(createSupportTable);

console.log('Database tabela je spremna.');

await seedDemoData();
}

async function seedDemoData() {
try {
const demoPassword = await bcrypt.hash('PonudiMi123!', 10);

```
const existingIndividual = await pool.query(
  'SELECT id FROM users WHERE email = $1',
  ['demo@ponudimi.rs']
);

if (existingIndividual.rows.length === 0) {
  await pool.query(
    'INSERT INTO users (name, email, password_hash, type) VALUES ($1, $2, $3, $4)',
    [
      'Demo Korisnik',
      'demo@ponudimi.rs',
      demoPassword,
      'individual'
    ]
  );
}

const existingCompany = await pool.query(
  'SELECT id FROM users WHERE email = $1',
  ['firma@ponudimi.rs']
);

if (existingCompany.rows.length === 0) {
  await pool.query(
    'INSERT INTO users (name, email, password_hash, type, company_name, pib, package_name) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      'Demo Firma',
      'firma@ponudimi.rs',
      demoPassword,
      'company',
      'PonudiMi Demo d.o.o.',
      '123456789',
      'Premium'
    ]
  );
}

const listingCount = await pool.query(
  'SELECT COUNT(*)::int AS count FROM listings'
);

if (listingCount.rows[0].count === 0) {
  const demoUser = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    ['firma@ponudimi.rs']
  );

  const userId = demoUser.rows[0]
    ? demoUser.rows[0].id
    : null;

  const demoImage = '/assets/hero-reference.png';

  await pool.query(
    'INSERT INTO listings (user_id, title, category, location, price, description, image) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      userId,
      'Polovni automobil - odlična ponuda',
      'Polovni automobili',
      'Beograd',
      5990,
      'Očuvan automobil, spreman za vožnju.',
      demoImage
    ]
  );

  await pool.query(
    'INSERT INTO listings (user_id, title, category, location, price, description, image) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      userId,
      'Stan u Novom Sadu',
      'Nekretnine',
      'Novi Sad',
      125000,
      'Moderan stan na dobroj lokaciji.',
      demoImage
    ]
  );

  await pool.query(
    'INSERT INTO listings (user_id, title, category, location, price, description, image) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      userId,
      'Mobilni telefon',
      'Mobilni telefoni',
      'Niš',
      350,
      'Telefon u odličnom stanju.',
      demoImage
    ]
  );

  await pool.query(
    'INSERT INTO listings (user_id, title, category, location, price, description, image) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      userId,
      'Alat za radionicu',
      'Građevina',
      'Kragujevac',
      280,
      'Komplet alata za radionicu.',
      demoImage
    ]
  );

  console.log('Demo oglasi su dodati.');
}
```

} catch (error) {
console.error(
'Greška pri dodavanju demo podataka:',
error.message
);
}
}

app.get('/api/health', async (req, res) => {
try {
if (!process.env.DATABASE_URL) {
return res.json({
ok: true,
database: false,
message: 'Server radi, ali DATABASE_URL nije podešen.'
});
}

```
await pool.query('SELECT 1');

res.json({
  ok: true,
  database: true
});
```

} catch (error) {
res.status(500).json({
ok: false,
database: false,
error: error.message
});
}
});

app.get('/api/categories', (req, res) => {
res.json([
'Polovni automobili',
'Nekretnine',
'Mobilni telefoni',
'Tehnika',
'Usluge',
'Građevina',
'Poljoprivreda',
'Moda',
'Ostalo'
]);
});

app.get('/api/listings', async (req, res) => {
try {
if (!process.env.DATABASE_URL) {
return res.json([]);
}

```
const q = String(req.query.q || '').trim();
const category = String(req.query.category || '').trim();
const location = String(req.query.location || '').trim();

let sql =
  'SELECT id, title, category, location, price, description, image, created_at ' +
  'FROM listings WHERE 1=1';

const params = [];

if (q) {
  params.push('%' + q + '%');

  sql +=
    ' AND (title ILIKE $' +
    params.length +
    ' OR description ILIKE $' +
    params.length +
    ')';
}

if (category) {
  params.push(category);

  sql +=
    ' AND category = $' +
    params.length;
}

if (location) {
  params.push('%' + location + '%');

  sql +=
    ' AND location ILIKE $' +
    params.length;
}

sql += ' ORDER BY created_at DESC LIMIT 100';

const result = await pool.query(sql, params);

res.json(result.rows);
```

} catch (error) {
console.error(
'Greška pri pretrazi oglasa:',
error
);

```
res.status(500).json({
  error: 'Greška pri učitavanju oglasa.'
});
```

}
});

app.post('/api/auth/register', async (req, res) => {
try {
if (!process.env.DATABASE_URL) {
return res.status(503).json({
error: 'Baza podataka trenutno nije povezana.'
});
}

```
const {
  name,
  email,
  password,
  type,
  companyName,
  pib
} = req.body;

if (!name || !email || !password) {
  return res.status(400).json({
    error: 'Ime, email i lozinka su obavezni.'
  });
}

const normalizedEmail = String(email)
  .trim()
  .toLowerCase();

if (password.length < 6) {
  return res.status(400).json({
    error: 'Lozinka mora imati najmanje 6 karaktera.'
  });
}

const accountType =
  type === 'company'
    ? 'company'
    : 'individual';

if (accountType === 'company' && !companyName) {
  return res.status(400).json({
    error: 'Naziv firme je obavezan.'
  });
}

const existing = await pool.query(
  'SELECT id FROM users WHERE email = $1',
  [normalizedEmail]
);

if (existing.rows.length > 0) {
  return res.status(409).json({
    error: 'Korisnik sa ovim emailom već postoji.'
  });
}

const passwordHash =
  await bcrypt.hash(password, 10);

const result = await pool.query(
  'INSERT INTO users (name, email, password_hash, type, company_name, pib) ' +
  'VALUES ($1, $2, $3, $4, $5, $6) ' +
  'RETURNING id, name, email, type, company_name, pib',
  [
    name,
    normalizedEmail,
    passwordHash,
    accountType,
    accountType === 'company'
      ? companyName
      : null,
    accountType === 'company'
      ? (pib || null)
      : null
  ]
);

const user = result.rows[0];
const token = createToken(user);

res.status(201).json({
  message: 'Registracija je uspešna.',
  token,
  user
});
```

} catch (error) {
console.error(
'Greška pri registraciji:',
error
);

```
res.status(500).json({
  error: 'Greška pri registraciji.'
});
```

}
});

app.post('/api/auth/login', async (req, res) => {
try {
if (!process.env.DATABASE_URL) {
return res.status(503).json({
error: 'Baza podataka trenutno nije povezana.'
});
}

```
const {
  email,
  password
} = req.body;

if (!email || !password) {
  return res.status(400).json({
    error: 'Email i lozinka su obavezni.'
  });
}

const normalizedEmail = String(email)
  .trim()
  .toLowerCase();

const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [normalizedEmail]
);

if (result.rows.length === 0) {
  return res.status(401).json({
    error: 'Pogrešan email ili lozinka.'
  });
}

const user = result.rows[0];

const validPassword =
  await bcrypt.compare(
    password,
    user.password_hash
  );

if (!validPassword) {
  return res.status(401).json({
    error: 'Pogrešan email ili lozinka.'
  });
}

const token = createToken(user);

res.json({
  message: 'Uspešna prijava.',
  token,
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    type: user.type,
    company_name: user.company_name,
    pib: user.pib
  }
});
```

} catch (error) {
console.error(
'Greška pri prijavi:',
error
);

```
res.status(500).json({
  error: 'Greška pri prijavi.'
});
```

}
});

app.get('/api/me', authRequired, async (req, res) => {
try {
if (!process.env.DATABASE_URL) {
return res.status(503).json({
error: 'Baza podataka trenutno nije povezana.'
});
}

```
const result = await pool.query(
  'SELECT id, name, email, type, company_name, pib, package_name, package_expires_at, created_at ' +
  'FROM users WHERE id = $1',
  [req.user.id]
);

if (result.rows.length === 0) {
  return res.status(404).json({
    error: 'Korisnik nije pronađen.'
  });
}

res.json(result.rows[0]);
```

} catch (error) {
console.error(
'Greška pri učitavanju korisnika:',
error
);

```
res.status(500).json({
  error: 'Greška pri učitavanju korisnika.'
});
```

}
});

app.post('/api/listings', authRequired, async (req, res) => {
try {
if (!process.env.DATABASE_URL) {
return res.status(503).json({
error: 'Baza podataka trenutno nije povezana.'
});
}

```
const {
  title,
  category,
  location,
  price,
  description
} = req.body;

if (!title || !category || !location) {
  return res.status(400).json({
    error: 'Naslov, kategorija i lokacija su obavezni.'
  });
}

const result = await pool.query(
  'INSERT INTO listings (user_id, title, category, location, price, description, image) ' +
  'VALUES ($1, $2, $3, $4, $5, $6, $7) ' +
  'RETURNING *',
  [
    req.user.id,
    title,
    category,
    location,
    price ? Number(price) : null,
    description || '',
    '/assets/hero-reference.png'
  ]
);

res.status(201).json({
  message: 'Oglas je uspešno objavljen.',
  listing: result.rows[0]
});
```

} catch (error) {
console.error(
'Greška pri objavljivanju oglasa:',
error
);

```
res.status(500).json({
  error: 'Greška pri objavljivanju oglasa.'
});
```

}
});

app.post('/api/requests', authRequired, async (req, res) => {
try {
if (!process.env.DATABASE_URL) {
return res.status(503).json({
error: 'Baza podataka trenutno nije povezana.'
});
}

```
const {
  title,
  category,
  location,
  budget,
  description
} = req.body;

if (!title) {
  return res.status(400).json({
    error: 'Naslov zahteva je obavezan.'
  });
}

const result = await pool.query(
  'INSERT INTO requests (user_id, title, category, location, budget, description) ' +
  'VALUES ($1, $2, $3, $4, $5, $6) ' +
  'RETURNING *',
  [
    req.user.id,
    title,
    category || null,
    location || null,
    budget ? Number(budget) : null,
    description || ''
  ]
);

res.status(201).json({
  message: 'Zahtev je uspešno sačuvan.',
  request: result.rows[0]
});
```

} catch (error) {
console.error(
'Greška pri čuvanju zahteva:',
error
);

```
res.status(500).json({
  error: 'Greška pri čuvanju zahteva.'
});
```

}
});

app.post('/api/support/tickets', async (req, res) => {
try {
if (!process.env.DATABASE_URL) {
return res.status(503).json({
error: 'Baza podataka trenutno nije povezana.'
});
}

```
const {
  name,
  email,
  subject,
  message
} = req.body;

if (!email || !subject || !message) {
  return res.status(400).json({
    error: 'Email, naslov i poruka su obavezni.'
  });
}

await pool.query(
  'INSERT INTO support_tickets (user_id, name, email, subject, message) ' +
  'VALUES ($1, $2, $3, $4, $5)',
  [
    null,
    name || '',
    email,
    subject,
    message
  ]
);

res.json({
  message:
    'Upit je uspešno poslat. Hvala što ste nam se obratili.'
});
```

} catch (error) {
console.error(
'Greška pri slanju upita:',
error
);

```
res.status(500).json({
  error: 'Greška pri slanju upita.'
});
```

}
});

app.post('/api/support/chat', async (req, res) => {
const message =
String(req.body.message || '')
.toLowerCase()
.trim();

let answer =
'Mogu da pomognem oko registracije, prijave, oglasa, zahteva i paketa za firme.';

if (
message.includes('registr') &&
(
message.includes('fizi') ||
message.includes('lice')
)
) {
answer =
'Za registraciju fizičkog lica izaberite Registracija, zatim Fizičko lice i unesite tražene podatke.';
} else if (
message.includes('registr') &&
(
message.includes('firm') ||
message.includes('prav') ||
message.includes('kompan')
)
) {
answer =
'Za registraciju firme izaberite Registracija, zatim Pravno lice. Potrebno je uneti podatke o firmi, uključujući naziv firme.';
} else if (
message.includes('prijav') ||
message.includes('login')
) {
answer =
'Kliknite na Prijava u gornjem meniju i unesite email i lozinku koje ste koristili prilikom registracije.';
} else if (
message.includes('oglas') &&
(
message.includes('objav') ||
message.includes('postav')
)
) {
answer =
'Za objavljivanje oglasa potrebno je da budete prijavljeni. Nakon prijave izaberite Objavi oglas.';
} else if (
message.includes('zahtev') ||
message.includes('traž') ||
message.includes('traz')
) {
answer =
'Zahtev možete postaviti nakon prijave. Izaberite Postavi zahtev i unesite šta tražite, kategoriju, lokaciju i budžet.';
} else if (
message.includes('paket') ||
message.includes('cen') ||
message.includes('10 €') ||
message.includes('10 eur')
) {
answer =
'Paketi za pravna lica uključuju mesečni, tromesečni, šestomesečni i Premium godišnji paket. Detalji paketa prikazuju se prilikom registracije firme.';
} else if (
message.includes('lozink') ||
message.includes('password')
) {
answer =
'Ako ste zaboravili lozinku, trenutno je potrebno da kontaktirate podršku putem opcije Pošalji upit.';
}

res.json({
answer
});
});

app.use((err, req, res, next) => {
console.error(
'Server error:',
err
);

res.status(500).json({
error: 'Greška na serveru.'
});
});

app.get('/*splat', (req, res) => {
res.sendFile(
path.join(__dirname, 'index.html')
);
});

async function startServer() {
try {
await initDatabase();

```
app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      'PonudiMi server radi na portu ' +
      PORT
    );
  }
);
```

} catch (error) {
console.error(
'Greška pri pokretanju servera:',
error
);

```
process.exit(1);
```

}
}

startServer();

````

**Još jednom najvažnije:** u GitHub `server.js` ne smeš staviti liniju ` ```javascript ` na početak niti ` ``` ` na kraj. Prva linija mora biti:

`const express = require('express');`

Kada Commit-uješ, Render treba da povuče novi commit automatski. Pošalji mi sledeći Render log nakon `npm start`.
````
