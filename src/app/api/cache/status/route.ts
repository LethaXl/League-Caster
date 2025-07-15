import { NextResponse } from 'next/server';
import { footballDataManager } from '@/lib/services/FootballDataManager';

export async function GET() {
  try {
    const stats = await footballDataManager.getCacheStats();
    
    return NextResponse.json({
      cache: stats,
      timestamp: Date.now(),
      status: 'healthy',
      message: 'Vercel KV cache is working'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to get cache stats', 
        details: errorMessage,
        timestamp: Date.now(),
        status: 'error'
      },
      { status: 500 }
    );
  }
} 