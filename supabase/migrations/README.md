# Database Migrations - MODIGLIANA ATP

## ⚠️ IMPORTANTE: Gestione Migration per Produzione

Questo progetto contiene numerosi file di migration che si sono accumulati durante lo sviluppo.
Per la pubblicazione in produzione, è necessario consolidarli.

## 📋 File di Migration Chiave (DA MANTENERE)

I seguenti file contengono la logica finale e DEVONO essere mantenuti:

### Core Schema
- `20250116_registration_requests.sql` - Sistema di registrazione utenti
- `20250122_matches_this_month_system.sql` - Tracking partite mensili
- `20250123_add_category_counters.sql` - Contatori categoria (gold/silver/bronze)
- `20250123_update_category_counters_trigger.sql` - Trigger aggiornamento contatori
- `20250123_fix_approve_registration_initial_values.sql` - Fix inizializzazione giocatori
- `20250122_add_best_pro_master_rank_trigger.sql` - Trigger best Pro Master rank
- `20250117_add_live_rank_trophy_type.sql` - Tipo trofeo live rank

### Trophies & Achievements
- `create_trophies_table.sql` - Tabella trofei

### Cleanup & Fixes
- `20250122_remove_unused_player_columns.sql` - Rimozione colonne inutilizzate
- `20250120_cleanup_debug_functions.sql` - Pulizia funzioni di debug

## 🗑️ File da Eliminare (Obsoleti o Ridondanti)

I seguenti file possono essere eliminati in quanto:
- Sono stati sostituiti da versioni più recenti
- Contengono codice di debug/test
- Sono migration intermedie superate

### Da Eliminare:
```
- admin_functions.sql (sostituito da versioni successive)
- admin_functions_correct.sql
- admin_functions_correct_final.sql
- admin_functions_real_schema.sql
- admin_functions_final.sql
- cleanup_admin_functions.sql
- create_player_profile_function.sql (non più usato)
- create_monthly_snapshots_table.sql (feature non implementata)
- admin_functions_monthly_split.sql
- admin_functions_complete.sql
- admin_functions_live_ranking.sql
- fix_profiles_schema.sql (obsoleto)
- check_tables.sql (debug)
- fix_category_swaps_order.sql (fix intermedio)
- fix_admin_create_match_position_swap.sql (fix intermedio)
- add_category_promotions_demotions.sql (logica cambiata)
- 20250120_fix_silver_positions.sql (fix intermedio)
- 20250120_fix_inactivity_demotion.sql (logica cambiata)
- 20250121_add_min_matches_to_championships.sql (superato)
- 20250121_add_pro_master_params_to_championships.sql (superato)
- 20250121_update_pro_master_points_function.sql (superato)
- 20250121_add_total_points_to_championships.sql (superato)
- 20250121_update_pro_master_with_total_points.sql (superato)
- 20250121_cleanup_total_points.sql (cleanup intermedio)
- 20250122_migrate_best_rank_to_global_system.sql (migration già applicata)
- 20250122_fix_pro_master_ranking_update.sql (fix intermedio)
- 20250122_fix_all_player_insert_functions.sql (fix intermedio)
- 20250122_fix_match_completion_trigger.sql (fix intermedio)
- populate_players.sql (dati di test)
- 20250122_remove_match_delete_trigger.sql (cleanup intermedio)
- 20250122_fix_is_admin_function.sql (fix intermedio)
- 20250122_fix_admin_update_match_score.sql (fix intermedio)
```

### Tutti i file Supabase generati automaticamente (formato UUID):
```
- 20250926182842_*.sql
- 20250926182912_*.sql
- 20250926182936_*.sql
- 20250929121420_*.sql
- 20250930085221_*.sql
- 20251004090240_*.sql
- 20251006195223_*.sql
```

## 🔧 Come Consolidare le Migration

### Opzione 1: Mantenimento Incrementale (Consigliato per Supabase)
Mantieni tutti i file esistenti se il database è già in produzione con Supabase.
Supabase traccia quali migration sono state applicate.

### Opzione 2: Fresh Start (Solo per nuovo deploy)
Se stai facendo un nuovo deploy da zero:

1. Esporta lo schema attuale del database:
```bash
supabase db dump --schema-only > supabase/migrations/00_consolidated_schema.sql
```

2. Elimina tutti i vecchi file di migration

3. Usa solo il file consolidato per nuove installazioni

## 📊 Schema Finale (Riepilogo)

### Tabelle Principali:
- **championships** - Campionati (con contatori categorie)
- **players** - Giocatori (con ranking live, Pro Master, stats)
- **matches** - Partite (con score, punti, scheduled flag)
- **registration_requests** - Richieste registrazione
- **trophies** - Trofei assegnati
- **challenges** - Sfide tra giocatori

### Funzioni Principali:
- `approve_registration_request()` - Approva registrazione utente
- `reject_registration_request()` - Rifiuta registrazione
- `get_default_championship_id()` - Ottieni championship di default
- `increment_matches_this_month()` - Incrementa contatore partite mensili
- `reset_monthly_matches()` - Reset contatore mensile
- Varie funzioni admin per gestione partite e ranking

### Trigger Attivi:
- `increment_monthly_matches` - Incrementa partite mensili
- `update_best_pro_master_rank` - Aggiorna best Pro Master rank
- `update_category_counters` - Aggiorna contatori categorie
- `update_*_updated_at` - Aggiorna timestamp

## 🚀 Per la Pubblicazione

Prima di pubblicare:

1. ✅ Verifica che tutte le migration siano applicate al DB di produzione
2. ✅ Fai un backup completo del database
3. ✅ Testa tutte le funzionalità dell'app
4. ✅ (Opzionale) Elimina i file obsoleti per pulizia
5. ✅ Documenta lo schema finale

## 📝 Note

- Le migration sono ordinate cronologicamente per timestamp
- Supabase applica automaticamente le migration in ordine
- Non eliminare file se il database di produzione li ha già applicati
- Per sicurezza, mantieni sempre un backup prima di modificare le migration
