import { NextResponse } from 'next/server';
import { footballDataManager } from '@/lib/services/FootballDataManager';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  const matchday = searchParams.get('matchday');
  const combined = searchParams.get('combined');
  const leagueCode = searchParams.get('leagueCode');

  try {
    // Handle all leagues request (no leagueCode needed)
    if (combined === 'all_leagues') {
      console.log(`🔍 API Request: all_leagues`);
      const allLeaguesData = await footballDataManager.getAllLeaguesData();
      return NextResponse.json({
        leagues: allLeaguesData,
        success: true
      });
    }

    if (!leagueCode) {
      return NextResponse.json({ error: 'leagueCode is required' }, { status: 400 });
    }

    console.log(`🔍 API Request: ${endpoint || combined} for ${leagueCode}`);
    
    // Handle combined data requests (most common)
    if (combined === 'league_data') {
      // Use getLeagueData once instead of calling getStandings and getCurrentMatchday separately
      // This prevents duplicate API calls since both methods call getLeagueData internally
      const leagueData = await footballDataManager.getLeagueData(leagueCode);
      
      return NextResponse.json({
        standings: leagueData.standings,
        currentMatchday: leagueData.currentMatchday,
        matches: leagueData.matches, // Include matches so frontend can use them
        success: true,
        source: leagueData.source === 'cache' ? 'upstash_redis_cache' : 'api'
      });
    }

    // Handle individual endpoints
    if (endpoint) {
      if (endpoint.includes('/standings')) {
        const standings = await footballDataManager.getStandings(leagueCode);
        return NextResponse.json({ 
          standings: [{ table: standings }],
          source: 'upstash_redis_cache'
        });
      }
      
      if (endpoint.includes('/matches')) {
        const matchdayNum = matchday ? parseInt(matchday) : undefined;
        // Check if we need all matches (including completed) - indicated by 'all' query param
        const getAllMatches = searchParams.get('all') === 'true';
        const getAllMatchesForLeague = searchParams.get('allMatches') === 'true';
        
        if (getAllMatchesForLeague) {
          // Fetch all matches for the league at once (more efficient)
          try {
            const matches = await footballDataManager.getAllMatches(leagueCode);
            return NextResponse.json({ 
              matches,
              source: 'api'
            });
          } catch (error: unknown) {
            // Handle 429 rate limit errors gracefully
            const axiosError = error as { response?: { status?: number }; message?: string };
            if (axiosError.response?.status === 429 || axiosError.message?.includes('rate limit')) {
              console.error(`❌ Rate limit error fetching all matches for ${leagueCode}`);
              return NextResponse.json(
                { 
                  error: 'rate_limited', 
                  message: 'Too many requests to football-data. Try again later.',
                  matches: [] // Return empty array so frontend can handle gracefully
                },
                { status: 429 }
              );
            }
            throw error;
          }
        } else if (getAllMatches && matchdayNum) {
          // Fetch all matches (including completed) for the matchday
          try {
            const matches = await footballDataManager.getAllMatchesForMatchday(leagueCode, matchdayNum);
            return NextResponse.json({ 
              matches,
              source: 'api'
            });
          } catch (error: unknown) {
            // Handle 429 rate limit errors gracefully
            const axiosError = error as { response?: { status?: number }; message?: string };
            if (axiosError.response?.status === 429 || axiosError.message?.includes('rate limit')) {
              console.error(`❌ Rate limit error fetching matches for ${leagueCode} matchday ${matchdayNum}`);
              return NextResponse.json(
                { 
                  error: 'rate_limited', 
                  message: 'Too many requests to football-data. Try again later.',
                  matches: []
                },
                { status: 429 }
              );
            }
            throw error;
          }
        } else {
          // Use the regular method (upcoming matches only)
          const matches = await footballDataManager.getMatches(leagueCode, matchdayNum);
          return NextResponse.json({ 
            matches,
            source: 'upstash_redis_cache'
          });
        }
      }
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const axiosError = error as { response?: { status?: number; data?: { message?: string } }; status?: number };
    const statusCode = axiosError.response?.status || axiosError.status || 500;
    
    console.error('❌ API Error:', errorMessage);
    
    // Handle 429 rate limit errors gracefully
    if (statusCode === 429 || errorMessage.includes('rate limit') || errorMessage.includes('request limit')) {
      return NextResponse.json(
        { 
          error: 'rate_limited', 
          message: 'Too many requests to football-data. Try again later.',
          details: axiosError.response?.data?.message || errorMessage
        },
        { status: 429 }
      );
    }
    
    // Return more specific error messages
    if (errorMessage.includes('API_KEY')) {
      return NextResponse.json(
        { error: 'API configuration error', details: 'Missing or invalid API key' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch data',
        details: errorMessage,
        source: 'upstash_redis_cache'
      },
      { status: statusCode }
    );
  }
} 