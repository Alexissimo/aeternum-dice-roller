Aeternum Dice Roller

Aeternum Dice Roller è una web app per lanciare i dadi preset del sistema Aeternum.

Supporta:

🎲 Solo locale: tiri offline (cronologia nel browser)

🌐 Room multiplayer in tempo reale (Socket.IO)

👑 Strumenti GM: tiri pubblici, GM-only, richieste di tiri segreti a un singolo player

📱 PWA installabile (desktop / mobile)

✨ Funzionalità principali
🎲 Lancio dadi (preset Aeternum)

Preset ufficiali: d4 → d20 (step 2)

Selezione multipla: es. d12×2 + d6×1

Limite: 15 dadi per tipo per singolo tiro

Icone:

🗡️ = successi (1 / 2 / 3)

⚡ = fallimenti (singolo o doppio, mostrato come ⚡⚡)

🌐 Room (multiplayer)

Crea una room come GM e ottieni:

Join Code (per i player)

Master Code (solo GM)

Nickname unici all’interno della stessa room

Tutti i player possono fare tiri pubblici

Il GM può:

fare tiri GM-only (visibili solo a sé)

richiedere un tiro segreto a un player specifico (visibile solo a GM + player)

bloccare/sbloccare ingressi

kickare un player

🧾 Feed & storicizzazione

Feed cronologico in room (pubblico + segreti visibili solo agli interessati)

Pagina Status per health check backend e latenza: /status

⏱️ Room lifetime

La room resta viva finché il GM è online

Se il GM cade, c’è un grace period di 5 minuti per rientrare

🧱 Architettura

Il progetto è volutamente senza build system.

Frontend

HTML / CSS / JS nativi

ES Modules (type="module")

Nessun framework

PWA (manifest.json + sw.js)

Deploy su Cloudflare Pages

Backend realtime

Node.js + Express

Socket.IO

Stato in memoria (no database)

Deploy separato (es. Render / altro)

Nota: i tiri in Room vengono generati dal server (anti-cheat / coerenza).

📁 Struttura progetto
aeternum-dice-roller/
├─ frontend/
│  ├─ index.html        # Home
│  ├─ room.html         # Room multiplayer
│  ├─ roll.html         # Solo locale
│  ├─ about.html        # Guida
│  ├─ status.html       # Health/latency backend
│  ├─ qr.html           # Guida rapida da QR (se presente)
│  ├─ manifest.json     # PWA
│  ├─ sw.js             # Service Worker
│  ├─ robots.txt
│  ├─ sitemap.xml
│  ├─ icon-192.png
│  ├─ icon-512.png
│  └─ assets/
│     ├─ styles.css
│     ├─ presets.js
│     ├─ room/          # moduli JS pagina Room
│     └─ roll/          # moduli JS pagina Roll
└─ backend/
   ├─ server.js
   ├─ package.json
   └─ room/
      ├─ handlers.js
      ├─ store.js
      ├─ dice.js
      ├─ codes.js
      └─ config.js
▶️ Avvio in locale
Requisiti

Node.js (LTS)

VS Code + estensione “Live Server” (consigliato) oppure qualsiasi server statico

1) Avvio backend (Socket.IO)
cd backend
npm install
npm start

Backend su:

http://localhost:3000

Health check: GET /health

2) Avvio frontend
Opzione consigliata: VS Code Live Server

apri frontend/index.html

“Open with Live Server”

URL tipico:

http://127.0.0.1:5500/frontend/

Alternativa: server statico
cd frontend
npx serve .
🔌 Configurazione BACKEND_URL (frontend)

Il frontend decide automaticamente se usare backend locale o produzione.

Esempio (in frontend/assets/room/config.js):

export const BACKEND_URL =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://<TUO-BACKEND-PROD>";

👉 In pratica: in locale punta a localhost, in deploy punta al backend pubblico.

🚀 Deploy
Frontend — Cloudflare Pages

Impostazioni consigliate:

Root directory: frontend

Build command: (vuoto)

Build output directory: frontend (o “Output: frontend” a seconda della UI)

Il sito finale (prod):

https://aeternum-dice-roller.pages.dev/

✅ Non serve alcun redirect globale tipo /* → /index.html (non è una SPA).

Se vuoi URL “puliti” tipo /roll invece di /roll.html, vanno fatti con regole specifiche (e attenzione ai loop). Se oggi funziona già /roll senza regole, NON aggiungere redirect.

Backend realtime

Deploy della cartella backend/ su un host Node (Render o altro):

Start command: npm start

CORS: configurare ALLOWED_ORIGINS se previsto (includendo il dominio Pages)

🤖 SEO (robots + sitemap)

Metti in frontend/:

robots.txt

sitemap.xml

Ricorda che l’indicizzazione richiede tempo: pubblicare sitemap, verificare proprietà su Google Search Console e inviare sitemap/URL.

📱 Installazione come app (PWA)
iPhone

Su iOS l’installazione PWA funziona tramite Safari:

Safari → Condividi → Aggiungi a Home

Brave su iPhone usa il motore WebKit e spesso non mostra “Installa app” come Android/desktop.

Android / Desktop

Dal menu del browser → Installa app

Se l’icona non si aggiorna dopo modifiche: disinstalla e reinstalla.

🧠 Note di sviluppo

Nessun database: le room sono effimere

Il backend genera i risultati dei tiri in room

Frontend minimale, pensato per essere esteso (macro, campagne, persistenza, ecc.)