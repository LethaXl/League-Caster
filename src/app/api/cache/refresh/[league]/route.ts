import { NextResponse } from 'next/server';
import { footballDataManager } from '@/lib/services/FootballDataManager';

interface RouteParams {
  params: Promise<{ league: string }>;
}

export async function POST(
  request: Request,
  { params }: RouteParams
) {
  try {
    const { league } = await params;
    console.log(`🔄 Manual cache refresh requested for ${league}`);
    
    await footballDataManager.refreshLeagueData(league);
    
    return NextResponse.json({
      success: true,
      message: `Refreshed ${league} data`,
      timestamp: Date.now(),
      league: league
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const { league } = await params;
    console.error(`❌ Cache refresh failed for ${league}:`, errorMessage);
    
    return NextResponse.json(
      { 
        error: 'Failed to refresh data', 
        details: errorMessage,
        timestamp: Date.now(),
        league: league
      },
      { status: 500 }
    );
  }
} 