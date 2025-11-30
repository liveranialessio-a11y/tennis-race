# 🏆 MODIGLIANA ATP - Database Schema Documentation

**Versione**: 1.0.0
**Data**: 2025-01-23
**Database**: PostgreSQL (Supabase)

---

## 📊 Panoramica

Il database gestisce un sistema completo di campionati di tennis con:
- Sistema di ranking Live a 3 categorie (Gold, Silver, Bronze)
- Sistema Pro Master con punti
- Gestione partite e risultati
- Sistema trofei
- Registrazione utenti con approvazione admin
- Snapshot mensili per storico
- System logs per audit

---

## 🗂️ Tabelle del Database

### 1. **championships** - Campionati

Gestisce i campionati di tennis.

| Colonna                | Tipo      | Nullable | Default           | Descrizione                                |
|------------------------|-----------|----------|-------------------|--------------------------------------------|
| `id`                   | UUID      | NO       | gen_random_uuid() | ID univoco del campionato                  |
| `name`                 | VARCHAR   | NO       | -                 | Nome del campionato                        |
| `admin_id`             | UUID      | NO       | -                 | ID admin (FK → auth.users)                 |
| `is_public`            | BOOLEAN   | NO       | true              | Se il campionato è pubblico                |
| `enable_set_bonus`     | BOOLEAN   | NO       | true              | Bonus per vittorie in 2 set                |
| `min_matches_required` | INTEGER   | NO       | 2                 | Partite minime richieste per mese          |
| `min_matches_for_points` | INTEGER | NO       | 1                 | Partite minime per ottenere punti Pro Master |
| `first_place_points`   | INTEGER   | NO       | 500               | Punti Pro Master per il 1° posto          |
| `gold_players_count`   | INTEGER   | YES      | 0                 | Numero giocatori categoria Gold            |
| `silver_players_count` | INTEGER   | YES      | 0                 | Numero giocatori categoria Silver          |
| `bronze_players_count` | INTEGER   | YES      | 0                 | Numero giocatori categoria Bronze          |
| `created_at`           | TIMESTAMP | NO       | now()             | Data creazione                             |
| `updated_at`           | TIMESTAMP | NO       | now()             | Data ultimo aggiornamento                  |

**Indici**:
- Primary Key: `championships_pkey` (id)

**Trigger**:
- `update_championships_updated_at` - Aggiorna `updated_at` automaticamente

---

### 2. **players** - Giocatori

Gestisce i giocatori registrati nei campionati.

| Colonna                  | Tipo      | Nullable | Default           | Descrizione                                    |
|--------------------------|-----------|----------|-------------------|------------------------------------------------|
| `id`                     | UUID      | NO       | gen_random_uuid() | ID univoco giocatore                           |
| `user_id`                | UUID      | NO       | -                 | ID utente (FK → auth.users)                    |
| `championship_id`        | UUID      | NO       | -                 | ID campionato (FK → championships)             |
| `display_name`           | VARCHAR   | NO       | -                 | Nome visualizzato                              |
| `phone`                  | TEXT      | YES      | null              | Numero telefono                                |
| `avatar_url`             | TEXT      | YES      | null              | URL avatar giocatore                           |
| `live_rank_position`     | INTEGER   | YES      | null              | Posizione classifica Live (globale)            |
| `live_rank_category`     | TEXT      | YES      | null              | Categoria Live: gold, silver, bronze           |
| `best_live_rank`         | INTEGER   | YES      | null              | Miglior posizione Live mai raggiunta (globale) |
| `best_category`          | TEXT      | YES      | 'bronze'          | Miglior categoria mai raggiunta                |
| `pro_master_points`      | NUMERIC   | YES      | 0                 | Punti Pro Master                               |
| `pro_master_rank_position` | INTEGER | YES      | null              | Posizione classifica Pro Master                |
| `best_pro_master_rank`   | INTEGER   | YES      | null              | Miglior posizione Pro Master mai raggiunta     |
| `matches_this_month`     | INTEGER   | YES      | 0                 | Partite giocate nel mese corrente              |
| `is_admin`               | BOOLEAN   | YES      | false             | Se il giocatore è admin                        |
| `last_match_date`        | TIMESTAMP | YES      | null              | Data ultima partita giocata                    |
| `created_at`             | TIMESTAMP | NO       | now()             | Data creazione                                 |
| `updated_at`             | TIMESTAMP | NO       | now()             | Data ultimo aggiornamento                      |

**Indici**:
- Primary Key: `players_pkey` (id)
- Unique: `players_user_id_championship_id_key` (user_id, championship_id)
- Index: `idx_players_category` (live_rank_category)
- Index: `idx_players_is_admin` (is_admin)
- Index: `idx_players_live_rank` (live_rank_position)
- Index: `idx_players_pro_master` (pro_master_points DESC)

**Trigger**:
- `update_players_updated_at` - Aggiorna `updated_at`
- `on_category_change` - Aggiorna `best_category` quando cambia categoria
- `trigger_update_best_live_rank` - Aggiorna `best_live_rank`
- `trigger_update_best_pro_master_rank` - Aggiorna `best_pro_master_rank`
- `trigger_update_category_counters` - Aggiorna contatori categorie in championships

**Note importanti**:
- `live_rank_position`: Posizione GLOBALE (1-N su tutto il campionato)
- Per la posizione RELATIVA alla categoria, usare la funzione `get_category_position()`
- Sistema a 3 categorie: Gold (top), Silver (medio), Bronze (base)

---

### 3. **matches** - Partite

Registra tutte le partite giocate e le sfide.

| Colonna              | Tipo      | Nullable | Default           | Descrizione                              |
|----------------------|-----------|----------|-------------------|------------------------------------------|
| `id`                 | UUID      | NO       | gen_random_uuid() | ID univoco partita                       |
| `championship_id`    | UUID      | NO       | -                 | ID campionato (FK → championships)       |
| `winner_id`          | UUID      | YES      | null              | ID vincitore (FK → auth.users)           |
| `loser_id`           | UUID      | YES      | null              | ID perdente (FK → auth.users)            |
| `score`              | VARCHAR   | NO       | -                 | Punteggio (es: "6-4 6-2")                |
| `is_draw`            | BOOLEAN   | YES      | false             | Se la partita è un pareggio             |
| `is_scheduled`       | BOOLEAN   | YES      | false             | Se la partita è schedulata (non giocata) |
| `challenge_status`   | TEXT      | YES      | null              | Stato sfida: 'lanciata', 'accettata', NULL (completata) |
| `challenge_launcher_id` | UUID   | YES      | null              | ID utente che ha lanciato la sfida (FK → auth.users) |
| `winner_points_gained` | NUMERIC | YES      | null              | Punti Pro Master guadagnati dal vincitore |
| `loser_points_lost`  | NUMERIC   | YES      | null              | Punti Pro Master persi dal perdente      |
| `played_at`          | TIMESTAMP | NO       | now()             | Data e ora della partita                 |
| `created_at`         | TIMESTAMP | NO       | now()             | Data creazione record                    |
| `updated_at`         | TIMESTAMP | NO       | now()             | Data ultimo aggiornamento                |

**Indici**:
- Primary Key: `matches_pkey` (id)
- Index: `idx_matches_scheduled` (is_scheduled)
- Index: `idx_matches_challenge_status` (challenge_status) WHERE challenge_status IS NOT NULL

**Foreign Keys**:
- `championship_id` → championships(id)
- `challenge_launcher_id` → auth.users(id)

**Constraint**:
- `check_challenge_status` - Valida che challenge_status sia NULL, 'lanciata' o 'accettata'

**Trigger**:
- `update_matches_updated_at` - Aggiorna `updated_at`
- `increment_monthly_matches` - Incrementa `matches_this_month` SOLO per partite completate (challenge_status IS NULL)
- `on_match_completion` - Gestisce swap posizioni SOLO per partite completate (challenge_status IS NULL)

**Note**:
- Le partite schedulate (`is_scheduled = true`) non influenzano ranking e statistiche
- Le sfide non completate (`challenge_status IS NOT NULL`) non influenzano ranking, statistiche e contatori mensili
- I pareggi (`is_draw = true`) hanno `winner_id` e `loser_id` entrambi valorizzati ma non swap posizioni
- **Flusso sfida**: lanciata → accettata → (set date/time) → is_scheduled=true, challenge_status=NULL → (register result) → is_scheduled=false → swap posizioni e statistiche

---

### 4. **registration_requests** - Richieste di Registrazione

Gestisce le richieste di registrazione degli utenti in attesa di approvazione.

| Colonna          | Tipo      | Nullable | Default    | Descrizione                          |
|------------------|-----------|----------|------------|--------------------------------------|
| `id`             | UUID      | NO       | gen_random_uuid() | ID univoco richiesta          |
| `user_id`        | UUID      | NO       | -          | ID utente (FK → auth.users)          |
| `championship_id` | UUID     | NO       | -          | ID campionato (FK → championships)   |
| `display_name`   | VARCHAR   | NO       | -          | Nome proposto dall'utente            |
| `phone`          | TEXT      | YES      | null       | Telefono dell'utente                 |
| `status`         | VARCHAR   | NO       | 'pending'  | Stato: pending, approved, rejected   |
| `requested_at`   | TIMESTAMP | NO       | now()      | Data richiesta                       |
| `processed_at`   | TIMESTAMP | YES      | null       | Data processazione                   |
| `processed_by`   | UUID      | YES      | null       | ID admin che ha processato (FK → auth.users) |
| `rejected_reason` | TEXT     | YES      | null       | Motivo rifiuto (se rejected)         |
| `created_at`     | TIMESTAMP | NO       | now()      | Data creazione                       |
| `updated_at`     | TIMESTAMP | NO       | now()      | Data ultimo aggiornamento            |

**Indici**:
- Primary Key: `registration_requests_pkey` (id)
- Unique: `registration_requests_user_id_championship_id_key` (user_id, championship_id)
- Index: `idx_registration_requests_status` (status)
- Index: `idx_registration_requests_championship` (championship_id)
- Index: `idx_registration_requests_user` (user_id)

**Foreign Keys**:
- `championship_id` → championships(id)

**Trigger**:
- `update_registration_requests_updated_at` - Aggiorna `updated_at`

**Note**:
- Un utente può avere solo UNA richiesta per campionato
- Lo stato può essere: 'pending' (in attesa), 'approved' (approvato), 'rejected' (rifiutato)

---

### 5. **trophies** - Trofei

Registra i trofei assegnati ai giocatori.

| Colonna          | Tipo      | Nullable | Default           | Descrizione                              |
|------------------|-----------|----------|-------------------|------------------------------------------|
| `id`             | UUID      | NO       | gen_random_uuid() | ID univoco trofeo                        |
| `player_id`      | UUID      | NO       | -                 | ID giocatore (FK → players)              |
| `championship_id` | UUID     | NO       | -                 | ID campionato (FK → championships)       |
| `trophy_type`    | TEXT      | NO       | -                 | Tipo trofeo (es: gold_1, silver_2, etc.) |
| `position`       | INTEGER   | NO       | -                 | Posizione raggiunta                      |
| `tournament_title` | TEXT    | YES      | null              | Titolo del torneo/mese                   |
| `awarded_date`   | TIMESTAMP | NO       | now()             | Data assegnazione trofeo                 |
| `created_at`     | TIMESTAMP | NO       | now()             | Data creazione record                    |

**Indici**:
- Primary Key: `trophies_pkey` (id)
- Index: `idx_trophies_player_id` (player_id)
- Index: `idx_trophies_championship_id` (championship_id)
- Index: `idx_trophies_trophy_type` (trophy_type)
- Index: `idx_trophies_awarded_date` (awarded_date DESC)

**Foreign Keys**:
- `player_id` → players(id)
- `championship_id` → championships(id)

**Tipi di Trofeo**:
- `gold_1`, `gold_2`, `gold_3` - Primi 3 in categoria Gold
- `silver_1`, `silver_2`, `silver_3` - Primi 3 in categoria Silver
- `bronze_1`, `bronze_2`, `bronze_3` - Primi 3 in categoria Bronze
- `pro_master_1`, `pro_master_2`, `pro_master_3` - Primi 3 Pro Master
- `live_rank_1`, `live_rank_2`, `live_rank_3` - Primi 3 Live Rank globale

---

### 6. **monthly_snapshots** - Snapshot Mensili

Salva lo storico delle posizioni mensili dei giocatori.

| Colonna          | Tipo      | Nullable | Default           | Descrizione                          |
|------------------|-----------|----------|-------------------|--------------------------------------|
| `id`             | UUID      | NO       | gen_random_uuid() | ID univoco snapshot                  |
| `player_id`      | UUID      | NO       | -                 | ID giocatore (FK → players)          |
| `championship_id` | UUID     | NO       | -                 | ID campionato (FK → championships)   |
| `month_date`     | DATE      | NO       | -                 | Data del mese (primo giorno)         |
| `rank_position`  | INTEGER   | NO       | -                 | Posizione in quel mese               |
| `points_awarded` | NUMERIC   | NO       | 0                 | Punti assegnati quel mese            |
| `matches_played` | INTEGER   | NO       | 0                 | Partite giocate quel mese            |
| `created_at`     | TIMESTAMP | YES      | now()             | Data creazione                       |
| `updated_at`     | TIMESTAMP | YES      | now()             | Data ultimo aggiornamento            |

**Indici**:
- Primary Key: `monthly_snapshots_pkey` (id)
- Unique: `monthly_snapshots_player_month_unique` (player_id, month_date)
- Index: `idx_monthly_snapshots_player_id` (player_id)
- Index: `idx_monthly_snapshots_championship_id` (championship_id)
- Index: `idx_monthly_snapshots_month_date` (month_date)

**Foreign Keys**:
- `player_id` → players(id)
- `championship_id` → championships(id)

**Note**:
- Ogni giocatore può avere UN SOLO snapshot per mese
- Usato per generare grafici storici e statistiche temporali

---

### 7. **system_logs** - Log di Sistema

Registra eventi e azioni di sistema per audit e debug.

| Colonna      | Tipo      | Nullable | Default           | Descrizione                    |
|--------------|-----------|----------|-------------------|--------------------------------|
| `id`         | UUID      | NO       | gen_random_uuid() | ID univoco log                 |
| `event_type` | TEXT      | NO       | -                 | Tipo evento (es: "match_created") |
| `message`    | TEXT      | YES      | null              | Messaggio descrittivo          |
| `details`    | JSONB     | YES      | null              | Dettagli strutturati in JSON   |
| `created_at` | TIMESTAMP | YES      | now()             | Data evento                    |

**Indici**:
- Primary Key: `system_logs_pkey` (id)

**Note**:
- Il campo `details` può contenere qualsiasi struttura JSON per informazioni aggiuntive
- Usato principalmente per debugging e audit trail

---

## 🔗 Relazioni tra Tabelle

```
championships (1) ──────< (N) players
championships (1) ──────< (N) matches
championships (1) ──────< (N) registration_requests
championships (1) ──────< (N) trophies
championships (1) ──────< (N) monthly_snapshots

players (1) ──────< (N) trophies
players (1) ──────< (N) monthly_snapshots

auth.users (1) ──────< (N) players (via user_id)
auth.users (1) ──────< (N) matches (via winner_id, loser_id)
auth.users (1) ──────< (N) registration_requests (via user_id, processed_by)
auth.users (1) ──────< (N) championships (via admin_id)
```

---

## ⚙️ Funzioni Principali

### Funzioni Admin

| Funzione                      | Tipo Return | Descrizione                                    |
|-------------------------------|-------------|------------------------------------------------|
| `admin_create_match`          | JSON        | Crea una nuova partita (admin only)            |
| `admin_update_match_score`    | JSON        | Aggiorna score di una partita                  |
| `admin_delete_match`          | JSON        | Elimina una partita                            |
| `admin_adjust_player_rank`    | JSON        | Modifica manualmente posizione giocatore       |
| `admin_move_player`           | JSON        | Sposta giocatore tra categorie                 |

### Funzioni Registrazione

| Funzione                        | Tipo Return | Descrizione                                  |
|---------------------------------|-------------|----------------------------------------------|
| `approve_registration_request`  | JSON        | Approva richiesta e crea giocatore           |
| `reject_registration_request`   | JSON        | Rifiuta richiesta di registrazione           |
| `get_default_championship_id`   | UUID        | Ritorna ID del campionato di default         |

### Funzioni Ranking & Punti

| Funzione                          | Tipo Return | Descrizione                                |
|-----------------------------------|-------------|--------------------------------------------|
| `calculate_pro_master_points`     | JSON        | Calcola punti Pro Master per tutti         |
| `update_pro_master_rankings`      | JSON        | Aggiorna posizioni Pro Master              |
| `calculate_inactivity_demotion`   | JSON        | Retrocede giocatori inattivi               |
| `process_category_swaps`          | JSON        | Gestisce promozioni/retrocessioni categorie |
| `reset_monthly_matches`           | JSON        | Reset contatore partite mensili            |
| `recompact_positions`             | JSON        | Ricompatta posizioni dopo eliminazioni     |

### Funzioni Sfide (Challenge)

| Funzione                          | Tipo Return | Descrizione                                |
|-----------------------------------|-------------|--------------------------------------------|
| `launch_challenge`                | JSON        | Lancia una sfida ad un altro giocatore     |
| `accept_challenge`                | JSON        | Accetta una sfida ricevuta                 |
| `reject_challenge`                | JSON        | Rifiuta una sfida ricevuta                 |
| `set_challenge_datetime`          | JSON        | Imposta data/ora per sfida accettata       |
| `can_delete_challenge`            | BOOLEAN     | Verifica se user può eliminare una sfida   |
| `is_player_challengeable`         | BOOLEAN     | Verifica se giocatore può essere sfidato   |

### Funzioni Utilità

| Funzione                          | Tipo Return | Descrizione                                |
|-----------------------------------|-------------|--------------------------------------------|
| `get_category_by_position`        | TEXT        | Ritorna categoria data una posizione       |
| `get_category_position`           | INTEGER     | Ritorna posizione relativa nella categoria |
| `get_pro_master_points_by_position` | NUMERIC   | Punti Pro Master per una posizione         |
| `calculate_sets_from_score`       | RECORD      | Calcola set vinti/persi da score string    |
| `calculate_games_from_score`      | RECORD      | Calcola games vinti/persi da score string  |
| `is_admin`                        | BOOLEAN     | Verifica se user è admin                   |
| `can_user_create_challenge`       | BOOLEAN     | Verifica se user può creare sfida          |
| `get_user_email`                  | TEXT        | Ritorna email di un utente                 |

### Funzioni Statistiche

| Funzione                       | Tipo Return | Descrizione                                   |
|--------------------------------|-------------|-----------------------------------------------|
| `get_filtered_player_stats`    | RECORD      | Statistiche giocatore filtrate (SOLO partite completate: is_scheduled=false, challenge_status IS NULL) |
| `get_player_monthly_stats`     | RECORD      | Statistiche mensili giocatore                 |
| `get_player_stats_by_range`    | RECORD      | Statistiche in un intervallo di date          |
| `test_match_counts`            | RECORD      | Test per conteggio partite (debug)            |

---

## 🎯 Trigger Attivi

| Trigger                               | Tabella               | Evento | Funzione                            | Scopo                                      |
|---------------------------------------|-----------------------|--------|-------------------------------------|--------------------------------------------|
| `update_championships_updated_at`     | championships         | UPDATE | `update_updated_at_column()`        | Aggiorna timestamp automaticamente         |
| `update_players_updated_at`           | players               | UPDATE | `update_updated_at_column()`        | Aggiorna timestamp automaticamente         |
| `update_matches_updated_at`           | matches               | UPDATE | `update_updated_at_column()`        | Aggiorna timestamp automaticamente         |
| `update_registration_requests_updated_at` | registration_requests | UPDATE | `update_updated_at_column()`    | Aggiorna timestamp automaticamente         |
| `on_category_change`                  | players               | UPDATE | `update_best_category()`            | Traccia miglior categoria mai raggiunta    |
| `trigger_update_best_live_rank`       | players               | UPDATE | `update_best_live_rank()`           | Traccia miglior posizione Live             |
| `trigger_update_best_pro_master_rank` | players               | UPDATE | `update_best_pro_master_rank()`     | Traccia miglior posizione Pro Master       |
| `trigger_update_category_counters`    | players               | INSERT | `update_category_counters()`        | Aggiorna contatori in championships        |
| `increment_monthly_matches`           | matches               | INSERT/UPDATE | `increment_matches_this_month()` | Incrementa contatore partite mensili (SOLO se challenge_status IS NULL) |
| `on_match_completion`                 | matches               | INSERT/UPDATE | `handle_match_completion()`      | Swap posizioni SOLO per partite completate (challenge_status IS NULL) |

---

## 📈 Note Tecniche

### Sistema Ranking Live

- **Posizione Globale**: `live_rank_position` è un numero da 1 a N su TUTTO il campionato
- **Posizione Relativa**: Per ottenere la posizione 1-N all'interno della propria categoria, usare `get_category_position(player_id)`
- **3 Categorie**: Gold (top), Silver (medio), Bronze (base)
- **Swap Automatico**: Quando un giocatore vince contro uno sopra di lui, scambiano posizioni

### Sistema Pro Master

- **Punti**: Assegnati mensilmente in base alla posizione Live
- **Ranking**: Ordinato per `pro_master_points DESC`
- **Requisiti**: Minimo `min_matches_for_points` partite nel mese per ricevere punti
- **Best Rank**: `best_pro_master_rank` traccia la miglior posizione mai raggiunta

### Inattività

- Giocatori con meno di `min_matches_required` partite al mese vengono retrocessi automaticamente
- Gestito dalla funzione `calculate_inactivity_demotion()`

### RLS (Row Level Security)

⚠️ **IMPORTANTE**: Le RLS policies sono attualmente **DISABILITATE** per questo progetto.

---

## 🔐 Sicurezza

- **Autenticazione**: Gestita da Supabase Auth
- **Foreign Keys**: Tutte le relazioni hanno constraint di integrità referenziale con `ON DELETE CASCADE`
- **Funzioni SECURITY DEFINER**: Le funzioni admin girano con privilegi elevati ma verificano permessi internamente
- **Unique Constraints**: Prevenzione duplicati su coppie (user_id, championship_id)

---

**Documento generato da query dirette al database di produzione**
**Ultima revisione**: 2025-01-23
