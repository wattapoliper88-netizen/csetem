# Biztonságos Chat Alkalmazás (Admin–User 1:1)

Full-stack real-time chat app, ahol a felhasználók regisztrálnak email + username + verification kóddal, majd 1:1-ben tudnak beszélgetni az adminnal WebSocket-en keresztül.

## Tech Stack

**Backend:**
- NestJS + TypeScript
- Prisma ORM + PostgreSQL
- JWT auth (access + refresh token, httpOnly cookie)
- Socket.IO (WebSocket)
- Rate limiting (ThrottlerModule)
- Bcrypt password hashing
- Class-validator input validation
- Mock email service (SMTP-re cserélhető)

**Frontend:**
- React + TypeScript (Vite)
- React Query (szerver állapot)
- React Router v6
- Tailwind CSS
- Socket.IO client
- Axios

**Adatbázis:**
- PostgreSQL (Docker konténerben)

---

## Gyors Indítás

### 1. Backend

```powershell
cd backend

# .env létrehozása
copy .env.example .env

# Függőségek telepítése
npm install

# Prisma client generálás + migráció
npx prisma generate
npx prisma migrate dev --name init

# Dev szerver indítás
npm run start:dev
```

Backend elérhető: `http://localhost:3000`

### 2. Frontend

```powershell
cd frontend

# Függőségek telepítése
npm install

# Dev szerver indítás
npm run dev
```

Frontend elérhető: `http://localhost:5173`

### 3. PostgreSQL (Docker Compose)

```powershell
# Gyökér könyvtárból
docker compose up -d db
```

Postgres elérhető: `localhost:5432` (user: `postgres`, password: `postgres`, db: `chatapp`)

---

## Auth Flow

1. **Regisztráció (`POST /auth/register`)**
   - Email, username, password
   - Backend generál 6 jegyű kódot, hash-eli, eltárolja + lejárati idő (10 perc)
   - Mock email küldi a kódot (konzolra logolja)

2. **Kód megerősítés (`POST /auth/verify`)**
   - Email + 6 jegyű kód
   - Backend ellenőrzi: user létezik, kód hash egyezik, nem járt le
   - Siker: `verified = true`, access + refresh token kiadása

3. **Bejelentkezés (`POST /auth/login`)**
   - Email + password
   - Csak verified userek léphetnek be
   - Access token (15 perc) + refresh token (7 nap, httpOnly cookie)

4. **Token tárolás:**
   - Access token: `localStorage` (⚠️ XSS veszély - későbbi verzióban memória + silent refresh)
   - Refresh token: httpOnly cookie (XSS-proof)

---

## Chat API

**Endpointok:**
- `GET /me` – aktuális user adatai
- `GET /conversations/me` – user: saját conversation az adminnal
- `GET /conversations` – admin: összes conversation lista
- `GET /messages/:conversationId?limit=50` – üzenetek lapozhatóan
- `POST /messages` – új üzenet küldése (`{ conversationId, content }`)

**WebSocket események (Socket.IO):**
- `conversation:join` – room-hoz csatlakozás
- `message:send` – új üzenet küldése
- `message:new` – broadcast új üzenet érkezésekor
- `typing` – „user is typing" jelzés

**Jogosultságok:**
- User csak a saját conversationjét éri el
- Admin minden conversationt lát

---

## Projekt Struktúra

```
backend/
├── prisma/
│   └── schema.prisma          # Adatbázis modellek
├── src/
│   ├── main.ts                # NestJS bootstrap
│   ├── app.module.ts          # Root modul
│   ├── prisma/                # Prisma service
│   ├── email/                 # Mock email service
│   └── modules/
│       ├── auth/              # Regisztráció, verify, login, JWT
│       ├── user/              # GET /me
│       └── chat/              # Chat REST + WebSocket gateway
├── .env.example
└── package.json

frontend/
├── src/
│   ├── main.tsx               # React entry
│   ├── router/                # React Router setup
│   ├── api/                   # Axios kliens + auth/chat API
│   ├── socket.ts              # Socket.IO kliens wrapper
│   └── pages/
│       ├── Register.tsx       # Regisztrációs form
│       ├── VerifyCode.tsx     # Email kód megerősítés
│       ├── Login.tsx          # Bejelentkezés
│       └── Chat.tsx           # Chat UI (user/admin nézet)
├── index.html
├── tailwind.config.js
└── package.json

docker-compose.yml             # PostgreSQL konténer
```

---

## Biztonsági Szempontok

✅ **Jelszó hash:** bcrypt (10 rounds)  
✅ **Rate limiting:** `/auth/register`, `/auth/verify`, `/auth/login` (5-10 req/perc)  
✅ **Input validáció:** class-validator (backend), HTML5 (frontend)  
✅ **Refresh token:** httpOnly cookie (XSS-proof)  
⚠️ **Access token:** localStorage (XSS esetén ellopható – későbbi verzióban memóriában + silent refresh)  
✅ **CORS:** csak `http://localhost:5173` (frontend origin)

---

## Konfigurációk

### Backend `.env`

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatapp?schema=public

JWT_ACCESS_SECRET=your_strong_secret_here
JWT_REFRESH_SECRET=your_strong_refresh_secret_here

PORT=3000

# Optional: apply storage CORS on backend startup (set to 'true')
APPLY_BUCKET_CORS_ON_STARTUP=false

```

### Frontend környezet

Alap esetben `http://localhost:3000` backend, `http://localhost:5173` frontend.

---

## Következő Lépések (Továbbfejlesztés)

- [ ] Admin user seedelése (első indításkor)
- [ ] Refresh token rotáció + `/auth/refresh` endpoint
- [ ] Access token memóriában + silent refresh flow
- [ ] Email provider integráció (Sendgrid, AWS SES, SMTP)
- [ ] Online/offline státusz (lastSeen mező)
- [ ] Message read receipts (readAt mező)
- [ ] File upload (képek, PDF)
- [ ] Push notification / email értesítés (offline usereknek)
- [ ] Admin dashboard (statisztikák, user lista)
- [ ] Multi-admin support + round-robin chat routing

---

## Troubleshooting

**Backend nem indul (`EADDRINUSE :::3000`):**
- Már fut egy backend instance a 3000-es porton
- Állítsd le a futó terminált, vagy használj másik portot (`.env` + `main.ts`)

**Frontend nem találja a backend-et:**
- Ellenőrizd, hogy a backend fut-e (`http://localhost:3000`)
- CORS: `src/main.ts`-ben az `origin` egyezzen a frontend URL-lel

**Prisma nem talál sémát:**
- Futtasd: `npx prisma generate` majd `npx prisma migrate dev`

**Docker Compose hiba:**
- Ellenőrizd, hogy a Docker Desktop fut-e
- Futtasd: `docker compose up -d db`

---

## Licenc

MIT (vagy szabadon válaszható)

---

**Készítette:** GitHub Copilot + NestJS + React stack 🚀
