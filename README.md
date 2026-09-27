# PonudiMi MVP v1

PonudiMi je kupoprodajna platforma za oglase, zahteve i usluge. Projekat koristi Node.js, Express i PostgreSQL.

## Lokalno pokretanje

1. Instaliraj zavisnosti: `npm install`
2. Podesi `DATABASE_URL` i `JWT_SECRET`.
3. Pokreni proveru sintakse: `npm run check`
4. Pokreni server: `npm start`

## Render

- Build Command: `npm install`
- Start Command: `npm start`
- `NODE_ENV=production`
- `DATABASE_URL` treba da bude Render PostgreSQL Internal Database URL.
- `JWT_SECRET` mora biti duga, nasumična tajna vrednost.

Health endpoint: `GET /api/health`

## API

- `GET /api/categories` — kategorije
- `GET /api/listings` — pretraga oglasa
- `GET /api/requests?limit=5` — najnoviji javni zahtevi
- `POST /api/auth/register` — registracija
- `POST /api/auth/login` — prijava
- `POST /api/listings` — objava oglasa
- `POST /api/requests` — objava zahteva
- `POST /api/support/tickets` — podrška

## Struktura

- `server.js` — Express server, API i baza
- `public/index.html` — početna strana
- `public/styles.css` — deljeni stilovi
- `public/app.js` — modalni tokovi i dinamički sadržaj
- `public/kategorije.html` — direktorijum kategorija
