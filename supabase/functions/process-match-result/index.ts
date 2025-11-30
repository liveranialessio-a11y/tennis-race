import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MatchResult {
  id: string
  challenge_id: string
  player1_id: string
  player2_id: string
  player1_sets: number[]
  player2_sets: number[]
  winner_id: string
  submitted_by: string
  status: string
}

interface AppConfig {
  punti_vincitore: number
  punti_perdente: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    const { match_result_id } = await req.json()

    if (!match_result_id) {
      throw new Error('match_result_id is required')
    }

    console.log('Processing match result:', match_result_id)

    // Get auth user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Fetch match result
    const { data: matchResult, error: matchError } = await supabaseClient
      .from('match_results')
      .select('*')
      .eq('id', match_result_id)
      .single()

    if (matchError || !matchResult) {
      throw new Error('Match result not found')
    }

    const result = matchResult as MatchResult

    // Verify result is not already processed
    if (result.status === 'validated') {
      throw new Error('Result already processed')
    }

    // Get app config for points
    const { data: config, error: configError } = await supabaseClient
      .from('app_config')
      .select('punti_vincitore, punti_perdente')
      .limit(1)
      .single()

    if (configError || !config) {
      throw new Error('App config not found')
    }

    const appConfig = config as AppConfig

    // Calculate sets won
    const player1SetsWon = result.player1_sets.filter((score, i) => score > result.player2_sets[i]).length
    const player2SetsWon = result.player2_sets.filter((score, i) => score > result.player1_sets[i]).length

    const totalPlayer1Games = result.player1_sets.reduce((a, b) => a + b, 0)
    const totalPlayer2Games = result.player2_sets.reduce((a, b) => a + b, 0)

    const loserId = result.winner_id === result.player1_id ? result.player2_id : result.player1_id

    // Get current profiles data
    const { data: winnerProfile } = await supabaseClient
      .from('profiles')
      .select('master_points, matches_played, matches_won, sets_won, sets_lost')
      .eq('user_id', result.winner_id)
      .single()

    const { data: loserProfile } = await supabaseClient
      .from('profiles')
      .select('master_points, matches_played, matches_lost, sets_won, sets_lost')
      .eq('user_id', loserId)
      .single()

    if (!winnerProfile || !loserProfile) {
      throw new Error('Player profiles not found')
    }

    // Update winner profile
    await supabaseClient
      .from('profiles')
      .update({
        master_points: winnerProfile.master_points + appConfig.punti_vincitore,
        matches_played: winnerProfile.matches_played + 1,
        matches_won: winnerProfile.matches_won + 1,
        sets_won: winnerProfile.sets_won + (result.winner_id === result.player1_id ? player1SetsWon : player2SetsWon),
        sets_lost: winnerProfile.sets_lost + (result.winner_id === result.player1_id ? player2SetsWon : player1SetsWon),
      })
      .eq('user_id', result.winner_id)

    // Update loser profile
    await supabaseClient
      .from('profiles')
      .update({
        master_points: loserProfile.master_points + appConfig.punti_perdente,
        matches_played: loserProfile.matches_played + 1,
        matches_lost: loserProfile.matches_lost + 1,
        sets_won: loserProfile.sets_won + (loserId === result.player1_id ? player1SetsWon : player2SetsWon),
        sets_lost: loserProfile.sets_lost + (loserId === result.player1_id ? player2SetsWon : player1SetsWon),
      })
      .eq('user_id', loserId)

    // Update monthly stats
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    for (const playerId of [result.player1_id, result.player2_id]) {
      const isWinner = playerId === result.winner_id

      // Check if monthly stat exists
      const { data: existingStat } = await supabaseClient
        .from('monthly_stats')
        .select('id')
        .eq('user_id', playerId)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle()

      if (existingStat) {
        // Get current stats
        const { data: currentStat } = await supabaseClient
          .from('monthly_stats')
          .select('matches_played, matches_won, matches_lost')
          .eq('id', existingStat.id)
          .single()

        if (currentStat) {
          // Update existing
          await supabaseClient
            .from('monthly_stats')
            .update({
              matches_played: currentStat.matches_played + 1,
              matches_won: isWinner ? currentStat.matches_won + 1 : currentStat.matches_won,
              matches_lost: !isWinner ? currentStat.matches_lost + 1 : currentStat.matches_lost,
            })
            .eq('id', existingStat.id)
        }
      } else {
        // Create new
        await supabaseClient
          .from('monthly_stats')
          .insert({
            user_id: playerId,
            year,
            month,
            matches_played: 1,
            matches_won: isWinner ? 1 : 0,
            matches_lost: !isWinner ? 1 : 0,
          })
      }
    }

    // Update match result status if not already validated
    if (result.status !== 'validated') {
      const { error: updateError } = await supabaseClient
        .from('match_results')
        .update({
          status: 'validated',
          validated_at: new Date().toISOString(),
        })
        .eq('id', match_result_id)

      if (updateError) {
        throw updateError
      }
    }

    // Update challenge status
    await supabaseClient
      .from('challenges')
      .update({ status: 'completed' })
      .eq('id', result.challenge_id)

    // Get current positions of winner and loser
    const { data: winnerData } = await supabaseClient
      .from('profiles')
      .select('current_position, current_level')
      .eq('user_id', result.winner_id)
      .single()

    const { data: loserData } = await supabaseClient
      .from('profiles')
      .select('current_position, current_level')
      .eq('user_id', loserId)
      .single()

    // If winner was lower than loser and in same level, swap positions
    if (winnerData && loserData && 
        winnerData.current_level === loserData.current_level &&
        winnerData.current_position > loserData.current_position) {
      
      const winnerNewPosition = loserData.current_position
      const loserNewPosition = winnerData.current_position

      await supabaseClient
        .from('profiles')
        .update({ current_position: winnerNewPosition })
        .eq('user_id', result.winner_id)

      await supabaseClient
        .from('profiles')
        .update({ current_position: loserNewPosition })
        .eq('user_id', loserId)

      console.log(`Swapped positions: Winner from ${winnerData.current_position} to ${winnerNewPosition}, Loser from ${loserData.current_position} to ${loserNewPosition}`)
    } else {
      // Otherwise just recalculate based on points
      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('user_id, master_points, current_level')
        .order('current_level', { ascending: true })
        .order('master_points', { ascending: false })

      if (!profilesError && profiles) {
        let currentLevel = 1
        let positionInLevel = 1

        for (const profile of profiles) {
          if (profile.current_level !== currentLevel) {
            currentLevel = profile.current_level
            positionInLevel = 1
          }

          await supabaseClient
            .from('profiles')
            .update({ current_position: positionInLevel })
            .eq('user_id', profile.user_id)

          positionInLevel++
        }
      }
    }

    // Create notifications for both players
    await supabaseClient.from('notifications').insert([
      {
        user_id: result.winner_id,
        title: 'Vittoria confermata!',
        message: `Hai vinto ${appConfig.punti_vincitore} punti master`,
        type: 'success',
        related_challenge_id: result.challenge_id,
      },
      {
        user_id: loserId,
        title: 'Risultato confermato',
        message: `Hai ricevuto ${appConfig.punti_perdente} punto master`,
        type: 'info',
        related_challenge_id: result.challenge_id,
      },
    ])

    console.log('Match result processed successfully')

    return new Response(
      JSON.stringify({ success: true, message: 'Match result processed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error processing match result:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
