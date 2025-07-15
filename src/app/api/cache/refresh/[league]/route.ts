import { NextResponse } from 'next/server';
import { footballDataManager } from '@/lib/services/FootballDataManager';

export async function POST(
  request: Request,
  { params }: { params: { league: string } }
) {
  try {
    console.log(`🔄 Manual cache refresh requested for ${params.league}`);
    
    await footballDataManager.refreshLeagueData(params.league);
    
    return NextResponse.json({
      success: true,
      message: `Refreshed ${params.league} data`,
      timestamp: Date.now(),
      league: params.league
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Cache refresh failed for ${params.league}:`, errorMessage);
    
    return NextResponse.json(
      { 
        error: 'Failed to refresh data', 
        details: errorMessage,
        timestamp: Date.now(),
        league: params.league
      },
      { status: 500 }
    );
  }
} 