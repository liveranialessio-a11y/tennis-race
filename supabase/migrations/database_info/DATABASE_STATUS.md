# 📊 MODIGLIANA ATP - Database Status

**Data Snapshot**: 2025-01-23
**Ambiente**: Produzione
**Database**: PostgreSQL (Supabase)

---

## 🎯 Statistiche Attuali

| Tabella                | Record | Stato            | Note                                      |
|------------------------|--------|------------------|-------------------------------------------|
| **championships**      | 1      | ✅ Attivo        | Un campionato principale configurato      |
| **players**            | 15     | ✅ Attivo        | 15 giocatori registrati                   |
| **matches**            | 8      | ✅ Attivo        | 8 partite giocate                         |
| **registration_requests** | 4   | ⏳ In Attesa     | 4 richieste da processare                 |
| **trophies**           | 0      | 🆕 Vuoto         | Nessun trofeo ancora assegnato            |
| **monthly_snapshots**  | 0      | 🆕 Vuoto         | Nessuno snapshot salvato                  |
| **system_logs**        | 1      | ✅ Attivo        | Sistema di logging attivo                 |

**Totale Record**: 29

---

## 🏆 Campionato Attivo

### Configurazione

- **Numero Campionati**: 1
- **Giocatori Totali**: 15
- **Partite Giocate**: 8
- **Richieste Pendenti**: 4

### Parametri Championship

Dal database risulta configurato:
- **min_matches_required**: 2 partite/mese (per evitare retrocessione)
- **min_matches_for_points**: 1 partita/mese (per ricevere punti Pro Master)
- **first_place_points**: 500 punti (per il 1° classificato Live Rank)
- **enable_set_bonus**: true (bonus per vittorie in 2 set)

### Distribuzione Categorie

Contatori attuali (da `gold_players_count`, `silver_players_count`, `bronze_players_count`):
- **Gold**: Configurato nel championship
- **Silver**: Configurato nel championship
- **Bronze**: Configurato nel championship

*(I valori esatti dipendono dalla configurazione specifica del championship)*

---

## 📈 Metriche Sistema

### Engagement

- **Media partite/giocatore**: 8 partite ÷ 15 giocatori = ~0.53 partite a testa
- **Tasso approvazione**: 15 approvati su (15+4) = ~79% richieste processate
- **Richieste in sospeso**: 4 (21%)

### Status Trofei

⚠️ **Attenzione**: Nessun trofeo assegnato ancora
- Possibile che i trofei vengano assegnati a fine mese
- Oppure il sistema di assegnazione deve essere attivato manualmente

### Snapshot Mensili

⚠️ **Attenzione**: Nessuno snapshot salvato
- Gli snapshot vengono creati tipicamente a inizio mese
- Se il sistema è nuovo, il primo snapshot sarà creato al prossimo ciclo mensile

---

## 🔧 Funzionalità Database

### Funzioni Disponibili: 34

**Admin Functions** (8):
- `admin_create_match`
- `admin_update_match_score`
- `admin_delete_match`
- `admin_adjust_player_rank`
- `admin_move_player`
- `approve_registration_request`
- `reject_registration_request`
- `reset_monthly_matches`

**Ranking & Points** (5):
- `calculate_pro_master_points`
- `update_pro_master_rankings`
- `calculate_inactivity_demotion`
- `process_category_swaps`
- `recompact_positions`

**Utility** (10):
- `get_category_by_position`
- `get_category_position`
- `get_pro_master_points_by_position`
- `get_default_championship_id`
- `is_admin`
- `can_user_create_challenge`
- `calculate_sets_from_score`
- `calculate_games_from_score`
- `create_player_profile`
- `test_match_counts`

**Stats** (3):
- `get_filtered_player_stats`
- `get_player_monthly_stats`
- `get_player_stats_by_range`

**Triggers** (8):
- Trigger function: `update_updated_at_column`
- Trigger function: `handle_match_completion`
- Trigger function: `increment_matches_this_month`
- Trigger function: `swap_live_rank_positions`
- Trigger function: `update_best_category`
- Trigger function: `update_best_live_rank`
- Trigger function: `update_best_pro_master_rank`
- Trigger function: `update_category_counters`

### Trigger Attivi: 12

Tutti i trigger sono configurati e funzionanti:
- 4 trigger `update_*_updated_at` (timestamps automatici)
- 2 trigger `on_match_completion` (INSERT/UPDATE su matches)
- 2 trigger `increment_monthly_matches` (INSERT/UPDATE su matches)
- 4 trigger su players (best_rank, best_category, category_counters)

---

## 🎨 Indici Ottimizzati: 25

Tutti gli indici sono stati creati per ottimizzare le query più frequenti:
- **Primary Keys**: 7 (uno per tabella)
- **Unique Constraints**: 3 (prevenzione duplicati)
- **Performance Indexes**: 15 (per ricerche veloci)

### Indici Critici per Performance

1. `idx_players_live_rank` - Per classifica Live
2. `idx_players_pro_master` (DESC) - Per classifica Pro Master
3. `idx_players_category` - Per filtri categoria
4. `idx_trophies_player_id` - Per visualizzazione trofei
5. `idx_matches_scheduled` - Per filtrare partite schedulate

---

## 🔐 Sicurezza

### RLS (Row Level Security)

**Status**: ⚠️ **DISABILITATO**

Le RLS policies sono state disabilitate per questo progetto.
Se necessario abilitare in futuro, fare riferimento ai file di migration per le policy originali.

### Foreign Keys: 6

Tutte le relazioni hanno constraint di integrità:
1. matches → championships
2. registration_requests → championships
3. trophies → championships
4. trophies → players
5. monthly_snapshots → championships
6. monthly_snapshots → players

Tutte configurate con `ON DELETE CASCADE` per integrità referenziale.

---

## ⚠️ Azioni Consigliate

### Priorità ALTA

1. **Processare richieste pendenti**
   - 4 richieste di registrazione in attesa di approvazione
   - Usare funzione: `approve_registration_request(request_id, category)`

### Priorità MEDIA

2. **Assegnare trofei**
   - Verificare se i trofei vanno assegnati manualmente o automaticamente
   - Tabella `trophies` attualmente vuota

3. **Creare primo snapshot mensile**
   - Quando inizia un nuovo mese, creare snapshot delle posizioni
   - Questo permette di tracciare lo storico

### Priorità BASSA

4. **Monitorare system_logs**
   - Solo 1 log presente, verificare se il logging funziona correttamente
   - Aggiungere più logging per eventi critici se necessario

---

## 📊 Query Utili per Monitoraggio

### Controllare richieste pendenti
```sql
SELECT * FROM registration_requests
WHERE status = 'pending'
ORDER BY requested_at;
```

### Vedere classifica Live corrente
```sql
SELECT
  display_name,
  live_rank_position,
  live_rank_category,
  matches_this_month
FROM players
ORDER BY live_rank_position ASC;
```

### Vedere classifica Pro Master
```sql
SELECT
  display_name,
  pro_master_points,
  pro_master_rank_position,
  best_pro_master_rank
FROM players
ORDER BY pro_master_points DESC;
```

### Ultime partite giocate
```sql
SELECT
  m.played_at,
  m.score,
  m.is_draw,
  pw.display_name as winner,
  pl.display_name as loser
FROM matches m
LEFT JOIN players pw ON pw.user_id = m.winner_id
LEFT JOIN players pl ON pl.user_id = m.loser_id
ORDER BY m.played_at DESC;
```

---

## 🚀 Performance

### Dimensioni Database

- **Tabelle**: 7
- **Record Totali**: 29
- **Indici**: 25
- **Funzioni**: 34
- **Trigger**: 12

### Ottimizzazioni Implementate

✅ Indici su tutte le colonne di ricerca frequente
✅ Trigger per aggiornamenti automatici
✅ Foreign keys con CASCADE per integrità
✅ Unique constraints per prevenire duplicati
✅ Funzioni con SECURITY DEFINER per controllo accessi

---

**Prossimo aggiornamento consigliato**: Dopo il primo ciclo mensile completo (reset partite + assegnazione trofei + snapshot)

**Documento generato da**: Query dirette al database di produzione
**Data**: 2025-01-23
