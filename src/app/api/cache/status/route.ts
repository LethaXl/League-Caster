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
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: 'Failed to get cache stats', 
        details: error.message,
        timestamp: Date.now(),
        status: 'error'
      },
      { status: 500 }
    );
  }
} 