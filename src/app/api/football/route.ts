import { NextResponse } from 'next/server';
import { footballDataManager } from '@/lib/services/FootballDataManager';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  const matchday = searchParams.get('matchday');
  const combined = searchParams.get('combined');
  const leagueCode = searchParams.get('leagueCode');

  if (!leagueCode) {
    return NextResponse.json({ error: 'leagueCode is required' }, { status: 400 });
  }

  try {
    console.log(`🔍 API Request: ${endpoint || combined} for ${leagueCode}`);
    
    // Handle combined data requests (most common)
    if (combined === 'league_data') {
      const [standings, currentMatchday] = await Promise.all([
        footballDataManager.getStandings(leagueCode),
        footballDataManager.getCurrentMatchday(leagueCode)
      ]);
      
      return NextResponse.json({
        standings,
        currentMatchday,
        success: true,
        source: 'upstash_redis_cache'
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
        const matches = await footballDataManager.getMatches(leagueCode, matchdayNum);
        return NextResponse.json({ 
          matches,
          source: 'upstash_redis_cache'
        });
      }
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ API Error:', errorMessage);
    
    // Return more specific error messages
    if (errorMessage.includes('API_KEY')) {
      return NextResponse.json(
        { error: 'API configuration error', details: 'Missing or invalid API key' },
        { status: 500 }
      );
    }
    
    if (errorMessage.includes('rate limit')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', details: 'Please try again later' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch data',
        details: errorMessage,
        source: 'upstash_redis_cache'
      },
      { status: 500 }
    );
  }
} 