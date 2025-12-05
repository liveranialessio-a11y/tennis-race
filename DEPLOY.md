# 🚀 Guida al Deploy su Vercel

## ⚠️ IMPORTANTE: Progetto Corretto

Questo progetto deve essere deployato su **tennis-race**, NON su "tennis".

## 📋 Procedura di Deploy

### 1. Verifica il Progetto Collegato

Prima di fare il deploy, verifica sempre che sei collegato al progetto corretto:

```bash
npx vercel ls
```

Dovresti vedere **tennis-race** come progetto attivo. Se vedi "tennis", devi ricollegare il progetto.

### 2. Collega il Progetto Corretto (se necessario)

Se non sei collegato a tennis-race, esegui:

```bash
npx vercel link --project tennis-race --yes
```

Questo comando:
- Collega il progetto locale a **tennis-race** su Vercel
- Crea/aggiorna la cartella `.vercel`
- Scarica le variabili d'ambiente di sviluppo in `.env.local`

### 3. Build Locale (Opzionale ma Consigliato)

Prima di fare il deploy, testa il build localmente:

```bash
npm run build
```

Se il build fallisce, NON procedere con il deploy. Correggi prima gli errori.

### 4. Deploy su Production

Per fare il deploy in produzione:

```bash
npx vercel --prod
```

Questo comando:
1. Fa il build del progetto
2. Carica i file su Vercel
3. Deploy in produzione su **tennis-race.vercel.app**

### 5. Verifica il Deploy

Dopo il deploy, verifica che sia stato fatto sul progetto corretto:

```bash
npx vercel inspect <URL-DEPLOYMENT>
```

Controlla che il campo `name` sia **tennis-race**.

## 🌐 URL del Progetto

Il dominio principale di produzione è:
- **https://tennis-race.vercel.app**

Altri alias automatici:
- https://tennis-race-liveranialessio-7181s-projects.vercel.app
- https://tennis-race-liveranialessio-7181-liveranialessio-7181s-projects.vercel.app

## 🔧 Comandi Utili

### Vedere tutti i deployment
```bash
npx vercel ls
```

### Vedere i progetti disponibili
```bash
npx vercel projects ls
```

### Ispezionare un deployment specifico
```bash
npx vercel inspect <URL-DEPLOYMENT>
```

### Vedere i log di un deployment
```bash
npx vercel logs <URL-DEPLOYMENT>
```

### Rifare il deploy di un deployment precedente
```bash
npx vercel redeploy <URL-DEPLOYMENT> --prod
```

## ❌ Errori Comuni

### Errore: Deploy fatto su "tennis" invece di "tennis-race"

**Sintomo**: Il deploy va a buon fine ma l'app su tennis-race.vercel.app non si aggiorna.

**Soluzione**:
1. Esegui `npx vercel link --project tennis-race --yes`
2. Riprova il deploy con `npx vercel --prod`

### Errore: "Invalid route source pattern"

**Sintomo**: Errore durante il deploy con messaggio su pattern regex non valido.

**Causa**: Il file `vercel.json` contiene una regex non supportata da Vercel.

**Soluzione**: Verifica che il `vercel.json` usi solo pattern regex supportati da Vercel (vedi documentazione Vercel).

## 📁 File Importanti per il Deploy

- **vercel.json**: Configurazione di Vercel (rewrites, headers, redirects)
- **.vercel/**: Cartella con configurazione del progetto collegato (NON committare)
- **.env.local**: Variabili d'ambiente locali (NON committare)
- **package.json**: Script `build` deve produrre la cartella `dist/`

## 🎯 Checklist Pre-Deploy

Prima di fare ogni deploy, verifica:

- [ ] Il build locale funziona (`npm run build`)
- [ ] Sei collegato al progetto **tennis-race** (`npx vercel ls`)
- [ ] Non ci sono errori TypeScript
- [ ] Non ci sono console.log di debug (se in produzione)
- [ ] Le variabili d'ambiente sono configurate correttamente su Vercel

## 🔐 Variabili d'Ambiente

Le variabili d'ambiente sono configurate su Vercel dashboard:
1. Vai su https://vercel.com/dashboard
2. Seleziona il progetto **tennis-race**
3. Vai su Settings > Environment Variables

Variabili necessarie:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

## 📞 Support

Se hai problemi con il deploy:
1. Controlla i log con `npx vercel logs`
2. Verifica che il progetto sia **tennis-race**
3. Controlla la dashboard Vercel per errori di build

---

**Ultimo aggiornamento**: 2 Dicembre 2025
**Progetto**: tennis-race
**Dominio**: https://tennis-race.vercel.app
