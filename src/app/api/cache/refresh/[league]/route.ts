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
  } catch (error: any) {
    console.error(`❌ Cache refresh failed for ${params.league}:`, error);
    
    return NextResponse.json(
      { 
        error: 'Failed to refresh data', 
        details: error.message,
        timestamp: Date.now(),
        league: params.league
      },
      { status: 500 }
    );
  }
} 