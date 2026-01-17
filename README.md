# Aeternum Dice Roller

Aeternum Dice Roller è una web app per il lancio di dadi **custom** progettata
per il sistema di gioco **Aeternum**.

Supporta:
- 🎲 lancio dadi **locale** (offline, senza room)
- 🌐 **room multiplayer** in tempo reale (Socket.IO)
- 👑 gestione GM con tiri pubblici, segreti e GM-only
- 📱 PWA installabile (desktop / mobile)

Il progetto è diviso in **frontend statico** e **backend realtime**.

---

## ✨ Funzionalità principali

### Lancio dadi
- Preset ufficiali Aeternum: **d4 → d20 (step 2)**
- Selezione multipla: `d12×2 + d6×1`
- Limite: **15 dadi per tipo**
- Icone personalizzate:
  - 🗡️ successi (1 / 2 / 3)
  - ⚡ fallimenti (singolo o doppio)

### Modalità Room (multiplayer)
- Creazione room con:
  - **Join Code** (player)
  - **Master Code** (GM)
- Nickname **unici** nella stessa room
- Tutti possono fare tiri pubblici
- Il GM può:
  - fare tiri visibili solo a sé
  - richiedere un **tiro segreto** a un player specifico
  - kickare player
  - bloccare/sbloccare ingressi
- Le room restano attive **finché il GM è online**
  - Grace period: **5 minuti** se il GM cade

### Extra
- Feed cronologico dei tiri
- Status page (`/status`) per health check backend
- Anti-spam / cooldown sui socket
- UI pensata per desktop e mobile

---

## 🧱 Architettura

Il progetto è volutamente **senza build system**.

### Frontend
- HTML / CSS / JS nativi
- ES Modules (`type="module"`)
- Nessun framework
- Deploy statico su Netlify
- Funziona anche offline (pagina roll)

### Backend
- Node.js
- Express
- Socket.IO
- Stato **in memoria**
- Deploy su Render

---

## 📁 Struttura del progetto

aeternum-dice/
├─ frontend/ # Statico (Netlify)
│ ├─ index.html # Home
│ ├─ room.html # Room multiplayer
│ ├─ roll.html # Lancio locale
│ ├─ about.html # Guida
│ ├─ status.html # Health / latency backend
│ ├─ manifest.json # PWA
│ ├─ sw.js # Service Worker
│ ├─ netlify.toml
│ └─ assets/
│ ├─ styles.css
│ ├─ presets.js
│ ├─ room/ # Moduli JS pagina Room
│ └─ roll/ # Moduli JS pagina Roll
│
└─ backend/ # Node + Socket.IO (Render)
├─ server.js
├─ package.json
└─ room/
├─ handlers.js
├─ store.js
├─ dice.js
├─ codes.js
└─ config.js

yaml
Copia codice

---

## ▶️ Avvio in locale

### Requisiti
- Node.js (LTS)
- Browser moderno

---

### 1️⃣ Avvio backend (Socket.IO)

```bash
cd backend
npm install
npm start
Il backend sarà disponibile su:

arduino
Copia codice
http://localhost:3000
Endpoint utili:

GET /health → health check

2️⃣ Avvio frontend
Opzione consigliata — VS Code Live Server
Apri frontend/index.html

“Open with Live Server”

URL tipico:

cpp
Copia codice
http://127.0.0.1:5500
Alternativa
bash
Copia codice
cd frontend
npx serve .
🔌 Configurazione backend URL (frontend)
Il frontend rileva automaticamente se è in locale o in produzione.

In frontend/assets/room/config.js:

js
Copia codice
export const BACKEND_URL =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://aeternum-dice-roller.onrender.com";
👉 Non serve modificare nulla per il deploy.

🚀 Deploy
Frontend — Netlify
Pubblica la cartella frontend/

Progetto multi-pagina (NON SPA)

Esempio netlify.toml:

toml
Copia codice
[build]
  publish = "."

[[redirects]]
  from = "/"
  to = "/index.html"
  status = 200

[[redirects]]
  from = "/room"
  to = "/room.html"
  status = 200

[[redirects]]
  from = "/roll"
  to = "/roll.html"
  status = 200

[[redirects]]
  from = "/about"
  to = "/about.html"
  status = 200

[[redirects]]
  from = "/status"
  to = "/status.html"
  status = 200
⚠️ Non usare un redirect globale /* → /index.html.

Backend — Render
Deploy della cartella backend/

Start command:

bash
Copia codice
npm start
Impostare eventuale ALLOWED_ORIGINS per CORS

📊 Status Page
La pagina:

bash
Copia codice
/status
mostra:

stato backend

latenza

risposta /health

Utile per verificare se Render è in sleep.

🧠 Note di sviluppo
Il backend non usa database

Le room sono effimere

Tutti i tiri sono generati dal server

Il frontend è volutamente semplice e manutenibile

Il codice è pensato per essere esteso (macro, campagne, persistenza)