# 🚀 Deployment Guide - Chat Alkalmazás

## 📋 Mit fogsz csinálni:
1. **Railway** - Backend + PostgreSQL adatbázis (ingyen)
2. **Vercel** - Frontend (ingyen)

---

## 🔧 Railway Backend Setup

### 1. Railway.app bejelentkezés
1. Nyisd meg: https://railway.app
2. **Login with GitHub**
3. Engedélyezd a hozzáférést

### 2. Projekt létrehozása
1. Kattints: **"New Project"**
2. Válaszd: **"Deploy from GitHub repo"**
3. Válaszd ki: **wattapoliper88-netizen/csetem**
4. Railway automatikusan felismeri a Node.js projektet

### 3. PostgreSQL hozzáadása
1. A projekt dashboardon kattints: **"New"**
2. Válaszd: **"Database"**
3. Válaszd: **"Add PostgreSQL"**
4. Railway automatikusan összeköti a `DATABASE_URL` változóval

### 4. Környezeti változók beállítása
Kattints a backend szolgáltatásra → **"Variables"** fül

Adj hozzá ezeket:

| Változó neve | Érték |
|-------------|-------|
| `JWT_SECRET` | `your-super-secret-jwt-key-123456789` (generálj véletlenszerű stringet) |
| `PORT` | `3000` |
| `CORS_ORIGIN` | `https://your-app.vercel.app` (később frissítsd a Vercel URL-lel) |

### 5. Domain URL megszerzése
1. Kattints: **"Settings"** fül
2. Görgess le: **"Domains"** szekcióhoz
3. Kattints: **"Generate Domain"**
4. **Másold ki ezt az URL-t!** (pl. `https://csetem-production.up.railway.app`)

### 6. Deployment
Railway automatikusan telepíti a kódot. Várj, amíg zöld pipát nem látsz ✅

---

## 🎨 Vercel Frontend Setup

### 1. Vercel.com bejelentkezés
1. Nyisd meg: https://vercel.com
2. **Continue with GitHub**
3. Engedélyezd a hozzáférést

### 2. Projekt importálása
1. Kattints: **"Add New..."** → **"Project"**
2. Válaszd ki: **wattapoliper88-netizen/csetem**
3. Kattints: **"Import"**

### 3. Build beállítások
Töltsd ki ezeket a mezőket:

| Mező | Érték |
|------|-------|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

### 4. Környezeti változók
Kattints: **"Environment Variables"**

| Változó neve | Érték |
|-------------|-------|
| `VITE_API_URL` | `https://csetem.onrender.com` (a Render backend URL-je) |

### 5. Deploy
Kattints: **"Deploy"** gombra és várj 2-3 percet

---

## ✅ CORS frissítés Railway-en

Most, hogy megvan a Vercel URL (pl. `https://csetem-xyz.vercel.app`):

1. Menj vissza **Railway.app**-ra
2. Kattints a backend szolgáltatásra
3. **Variables** fül
4. Keresd meg a `CORS_ORIGIN` változót
5. Frissítsd az értékét a Vercel URL-re: `https://csetem-xyz.vercel.app`
6. Railway automatikusan újratelepíti

---

## 🧪 Tesztelés

1. Nyisd meg a Vercel URL-edet: `https://csetem-xyz.vercel.app`
2. Próbálj meg:
   - Regisztrálni
   - Bejelentkezni
   - Üzenetet küldeni
   - Fájlt feltölteni

---

## 🐛 Hibaelhárítás

### "CORS error" a konzolban
✅ **Megoldás:** Ellenőrizd, hogy a Railway `CORS_ORIGIN` változó értéke megegyezik-e a Vercel URL-lel

### "Failed to fetch" hiba
✅ **Megoldás:** Ellenőrizd, hogy a Vercel `VITE_API_URL` változó értéke megegyezik-e a Railway URL-lel

### Backend nem indul el Railway-en
✅ **Megoldás:** 
- Ellenőrizd a Railway **Logs** fület
- Nézd meg, hogy a `DATABASE_URL` be van-e állítva
- Futtasd újra a deploy-t: **Deploy** → **Redeploy**

### Adatbázis migrációs hiba
✅ **Megoldás:**
- Railway dashboardon nyisd meg a PostgreSQL szolgáltatást
- Ellenőrizd, hogy fut-e
- Backend logs-ban keresd: `prisma migrate deploy`
 - Ha szükséges (pl. új modellek hozzáadása), futtasd a migration parancsot: `npx prisma migrate deploy` vagy a fejlesztői gépen: `npx prisma migrate dev --name add_user_folders`

---

## 💰 Költségek

**Railway:**
- Ingyenes tier: $5 kredit havonta
- Ez bőven elég kezdéshez
- Később: $5-20/hó

**Vercel:**
- Ingyenes tier: korlátlan deploy
- Bandwidth: 100GB/hó
- Később: $20/hó (ha kell több)

**Összesen:** 0 Ft kezdéshez! 🎉

---

## 🔄 Frissítés (ha változtatsz a kódon)

```powershell
cd C:\dev\WEB_cset
git add .
git commit -m "Update: leírás a változásokról"
git push
```

Railway és Vercel **automatikusan újratelepítik** az alkalmazást!

---

## 📧 Email funkció (opcionális)

Ha szeretnéd használni az email küldést:

1. Gmail fiókban engedélyezd a "Less secure app access"-t
2. Railway Variables-ban add hozzá:
   - `EMAIL_HOST`: `smtp.gmail.com`
   - `EMAIL_PORT`: `587`
   - `EMAIL_USER`: `your-email@gmail.com`
   - `EMAIL_PASSWORD`: `your-password`

---

## 🎉 Kész vagy!

Most az alkalmazásod elérhető a világ bármely pontjáról:
- **Frontend:** `https://csetem-xyz.vercel.app`
- **Backend:** `https://csetem-production.up.railway.app`

---

## 🌐 Render-specifikus megjegyzés

Amennyiben Renderen hosztolod a frontend statikus site-ot, adj a `frontend/static.json` fájlhoz egy catch-all rewrite szabályt:

```json
{
   "routes": [
      { "src": "/.*", "dest": "/index.html" }
   ]
}
```

Ez biztosítja, hogy a React Router útvonalai (pl. `/register`, `/chat`) akkor is működjenek, ha a felhasználó közvetlenül az URL-t nyitja meg, mert minden kérés az `index.html`-re irányítódik.

Ne felejtsd el Renderen az `Environment Variables` között a `VITE_API_URL`-t `https://csetem.onrender.com` értékre állítani, és a backend `CORS_ORIGIN` változóban a Render frontend URL-jét szerepeltetni.

---

## 📞 Segítség

Ha elakadsz:
1. Railway Logs: Dashboard → Backend Service → Logs
2. Vercel Logs: Dashboard → Deployment → Logs
3. Browser Console: F12 → Console fül
