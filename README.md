# 🎾 Tennis Race

**Tennis Race** è un'applicazione web completa per la gestione di campionati di tennis con sistema di ranking dinamico, sfide tra giocatori e classifiche mensili.

## 🌟 Caratteristiche Principali

### Sistema di Ranking Live
- **3 Categorie**: Gold, Silver, Bronze (10 giocatori per categoria)
- **Posizioni dinamiche**: Le posizioni cambiano in base ai risultati dei match
- **Scambio posizioni**: Chi vince scala la classifica automaticamente
- **Best Rank**: Tracciamento della miglior posizione mai raggiunta

### Classifica Pro Master
- **Sistema a punti**: Vincitore +3 punti, Perdente +1 punto
- **Premi mensili**: I primi classificati ricevono punti bonus a fine mese
- **Requisito minimo**: Numero minimo di partite mensili per ricevere punti

### Sistema di Sfide (Challenges)
- I giocatori possono sfidare avversari posizionati meglio in classifica
- Invio automatico di email di notifica
- Gestione sfide accettate/rifiutate/in attesa
- Registrazione risultati con scambio automatico delle posizioni

### Gestione Match
- **Match programmati**: Possibilità di programmare match futuri
- **Storico completo**: Visualizzazione di tutti i match giocati
- **Statistiche dettagliate**: Vittorie, sconfitte, set vinti/persi
- **Dashboard admin**: Creazione e gestione match da parte degli amministratori

### Trofei e Riconoscimenti
- Trofei automatici per le prime posizioni mensili
- Sistema di assegnazione trofei personalizzabili
- Visualizzazione trofei nel profilo giocatore

### Profili Giocatore
- Avatar personalizzabile
- Statistiche complete (vittorie, sconfitte, percentuali)
- Grafici annuali delle performance
- Storico trofei vinti
- Link diretto WhatsApp per contattare i giocatori

### Snapshot Mensili
- Salvataggio automatico delle classifiche a fine mese
- Storico completo delle posizioni mensili
- Sistema di retrocessione per inattività

## 🛠️ Tecnologie Utilizzate

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL)
- **Autenticazione**: Supabase Auth
- **Storage**: Supabase Storage (per avatar)
- **Email**: Servizio email integrato per notifiche sfide
- **Routing**: React Router v6
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod

## 📦 Installazione

### Prerequisiti

- Node.js 18+ e npm
- Account Supabase

### Setup Locale

1. **Clona il repository**
```bash
git clone https://github.com/liveranialessio-a11y/tennis-race.git
cd tennis-race
```

2. **Installa le dipendenze**
```bash
npm install
```

3. **Configura le variabili d'ambiente**

Crea un file `.env` nella root del progetto copiando il template `.env.example`:

```bash
cp .env.example .env
```

Modifica il file `.env` con le tue credenziali Supabase:

```env
VITE_SUPABASE_PROJECT_ID="tuo_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="tua_publishable_key"
VITE_SUPABASE_URL="https://tuo_project_id.supabase.co"

VITE_EMAIL_USER="tua_email@gmail.com"
VITE_EMAIL_PASSWORD="tua_app_password"
```

4. **Configura il database Supabase**

Esegui le migration nella cartella `supabase/migrations/` nel seguente ordine:
- `00_final_consolidated_schema.sql` (schema completo del database)
- Tutte le altre migration in ordine cronologico

5. **Avvia il server di sviluppo**
```bash
npm run dev
```

L'app sarà disponibile su `http://localhost:5173`

## 📁 Struttura del Progetto

```
tennis-race/
├── src/
│   ├── components/         # Componenti React riutilizzabili
│   │   ├── ui/            # Componenti shadcn/ui
│   │   └── layout/        # Layout dell'app (Header, BottomNav)
│   ├── pages/             # Pagine dell'applicazione
│   ├── contexts/          # React Context (Auth)
│   ├── hooks/             # Custom React Hooks
│   ├── integrations/      # Integrazione Supabase
│   └── services/          # Servizi (email, ecc.)
├── supabase/
│   ├── migrations/        # Migration SQL del database
│   └── functions/         # Edge Functions Supabase
└── public/                # Asset statici
```

## 🚀 Deployment

### Deploy su Vercel/Netlify

1. Collega il repository GitHub
2. Configura le variabili d'ambiente nel dashboard
3. Deploy automatico ad ogni push su `main`

### Variabili d'Ambiente di Produzione

Assicurati di configurare tutte le variabili d'ambiente nel tuo servizio di hosting:
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_EMAIL_USER`
- `VITE_EMAIL_PASSWORD`

## 🔒 Sicurezza

- Il file `.env` è escluso dal repository tramite `.gitignore`
- Le credenziali sensibili non sono mai committate
- Autenticazione gestita tramite Supabase Auth
- Row Level Security (RLS) abilitata su tutte le tabelle

## 🤝 Contribuire

Questo è un progetto privato. Per contribuire, contatta il proprietario del repository.

## 📄 Licenza

Progetto privato - Tutti i diritti riservati

## 👨‍💻 Autore

**Alessio Liverani**
- Email: tennisrace.app@gmail.com
- GitHub: [@liveranialessio-a11y](https://github.com/liveranialessio-a11y)

---

🎾 **Tennis Race** - Gestione campionati di tennis resa semplice e intuitiva
