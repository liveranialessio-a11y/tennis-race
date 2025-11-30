# Guida alle Migration per Frecce di Classifica

## Panoramica
Queste migration aggiungono le frecce di movimento in classifica per:
1. **Inactivity Demolition** - Frecce mensili che mostrano chi è stato demolito/promosso
2. **Sfide** - Frecce immediate dopo match completati

## Migration da eseguire in ordine:

### 1. Aggiungi colonna `previous_live_rank_position`
```bash
psql "postgresql://postgres.bisbpmrrzckhdibqrsyh:Alessio2001!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" -f "c:\Users\pc\Desktop\Saas\1\tennis\supabase\migrations\20250126_add_previous_position_tracking.sql"
```

**Cosa fa:**
- Aggiunge la colonna `previous_live_rank_position` alla tabella `players`
- Inizializza i valori esistenti con le posizioni attuali

### 2. Aggiorna funzione `calculate_inactivity_demotion`
```bash
psql "postgresql://postgres.bisbpmrrzckhdibqrsyh:Alessio2001!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" -f "c:\Users\pc\Desktop\Saas\1\tennis\supabase\migrations\20250126_fix_inactivity_demotion_correct_algorithm.sql"
```

**Cosa fa:**
- Fix dell'algoritmo di inactivity demolition (algoritmo corretto)
- Retrocede inattivi di 1 posizione
- Riempie buchi con attivi dall'alto
- Ricompatta eventuali buchi rimasti

### 3. Aggiorna funzione per salvare posizioni precedenti (inactivity)
```bash
psql "postgresql://postgres.bisbpmrrzckhdibqrsyh:Alessio2001!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" -f "c:\Users\pc\Desktop\Saas\1\tennis\supabase\migrations\20250126_update_inactivity_demotion_save_previous_position.sql"
```

**Cosa fa:**
- Modifica `calculate_inactivity_demotion` per salvare `previous_live_rank_position` prima di applicare i cambiamenti
- Questo permette di mostrare le frecce dopo la demolition

### 4. Aggiorna trigger per salvare posizioni precedenti (sfide)
```bash
psql "postgresql://postgres.bisbpmrrzckhdibqrsyh:Alessio2001!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" -f "c:\Users\pc\Desktop\Saas\1\tennis\supabase\migrations\20250126_update_match_trigger_save_previous_position.sql"
```

**Cosa fa:**
- Modifica il trigger `handle_match_completion` per salvare `previous_live_rank_position` prima dello swap
- Se vincitore batte uno sopra → swap + salva posizioni precedenti
- Se vincitore batte uno sotto → nessuno swap, aggiorna previous_position = current (nessuna freccia)

## Logica delle Frecce

### Freccia Verde ↑ (Miglioramento)
- `live_rank_position < previous_live_rank_position`
- Esempio: Da 5° a 2° → **↑ +3**

### Freccia Rossa ↓ (Peggioramento)
- `live_rank_position > previous_live_rank_position`
- Esempio: Da 2° a 5° → **↓ -3**

### Nessuna Freccia
- `live_rank_position === previous_live_rank_position`
- Esempio: Vincitore più forte (nessun cambio posizione)

## Casi d'uso:

### 1. Inactivity Demolition (mensile)
```
Prima:  1° Alessio (0 partite) | 2° Riccardo (2 partite)
Dopo:   1° Riccardo ↑+1       | 2° Alessio ↓-1
```

### 2. Sfida vinta contro uno più forte
```
Prima:  3° Mario sfida 1° Luca
Dopo:   1° Mario ↑+2          | 3° Luca ↓-2
```

### 3. Sfida vinta contro uno più debole
```
Prima:  1° Luca sfida 3° Mario
Dopo:   1° Luca (nessuna freccia) | 3° Mario (nessuna freccia)
```

### 4. Sfida persa contro uno più debole
```
Prima:  1° Luca perde contro 3° Mario
Dopo:   1° Mario ↑+2          | 3° Luca ↓-2
```

## Verifica Post-Migration

Dopo aver eseguito tutte le migration, verifica che tutto funzioni:

```sql
-- 1. Verifica che la colonna esista
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'players' AND column_name = 'previous_live_rank_position';

-- 2. Verifica i dati
SELECT
  display_name,
  live_rank_position,
  previous_live_rank_position,
  live_rank_position - previous_live_rank_position as movement
FROM players
WHERE live_rank_category = 'gold'
ORDER BY live_rank_position;

-- 3. Testa l'inactivity demolition (se vuoi)
SELECT calculate_inactivity_demotion(
  (SELECT id FROM championships LIMIT 1),
  NULL,
  2
);
```

## Frontend

Il frontend è già stato aggiornato in `src/pages/Championships.tsx`:
- Aggiunta funzione `getPositionArrow(player)` che restituisce le frecce
- Modificata la tabella per mostrare le frecce accanto alla posizione
- Frecce visibili nella "Classifica Live Completa"

## Reset delle Frecce

Se vuoi resettare tutte le frecce (far sparire tutti i movimenti):

```sql
UPDATE players
SET previous_live_rank_position = live_rank_position;
```

Questo farà sparire tutte le frecce fino al prossimo cambiamento di posizione.
