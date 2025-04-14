import { NextResponse } from 'next/server';
import axios from 'axios';

const API_BASE_URL = 'https://api.football-data.org/v4';
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('API_KEY environment variable is not set!');
}

console.log('API Configuration:', {
  baseUrl: API_BASE_URL,
  hasApiKey: !!API_KEY,
});

const footballApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'X-Auth-Token': API_KEY,
  },
});

// Define interface for match data from API
interface ApiMatch {
  status: string;
  matchday: number;
  // Add other properties as needed
}

export async function GET(request: Request) {
  if (!API_KEY) {
    console.error('API_KEY is not defined in environment variables');
    return NextResponse.json(
      { error: 'API configuration error - Missing API key' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');
  const matchday = searchParams.get('matchday');
  const combined = searchParams.get('combined');

  if (!endpoint && !combined) {
    return NextResponse.json({ error: 'Endpoint or combined parameter is required' }, { status: 400 });
  }

  try {
    // Handle combined data requests
    if (combined === 'league_data') {
      const leagueCode = searchParams.get('leagueCode');
      
      if (!leagueCode) {
        return NextResponse.json({ error: 'leagueCode is required for combined requests' }, { status: 400 });
      }
      
      console.log('Making combined API request for league:', leagueCode);
      
      // Make parallel requests for standings and matches
      const [standingsResponse, matchesResponse] = await Promise.all([
        footballApi.get(`/competitions/${leagueCode}/standings`),
        footballApi.get(`/competitions/${leagueCode}/matches`)
      ]);
      
      // Extract and process data
      const standings = standingsResponse.data.standings[0].table;
      
      const scheduledMatches = matchesResponse.data.matches.filter(
        (m: ApiMatch) => m.status === 'SCHEDULED' || m.status === 'TIMED'
      );
      
      const currentMatchday = scheduledMatches.length > 0
        ? Math.min(...scheduledMatches.map((m: ApiMatch) => m.matchday))
        : 1;
      
      // Return the combined data
      return NextResponse.json({
        standings,
        currentMatchday,
        success: true
      });
    }

    // Original single endpoint handling
    let url = endpoint;
    if (matchday) {
      url += `?matchday=${matchday}`;
    }

    console.log('Making API request:', {
      url,
      hasMatchday: !!matchday,
    });

    // Ensure url is not null before making the request
    if (!url) {
      return NextResponse.json(
        { error: 'Endpoint parameter is required' },
        { status: 400 }
      );
    }

    const response = await footballApi.get(url);
    
    if (!response.data) {
      console.error('Empty response from football API');
      return NextResponse.json(
        { error: 'Empty response from football API' },
        { status: 500 }
      );
    }

    return NextResponse.json(response.data);
  } catch (error: unknown) {
    const err = error as { 
      message: string; 
      response?: { 
        data?: { message?: string }; 
        status?: number; 
      }; 
    };
    
    console.error('API Error:', {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });

    // Return more detailed error information
    return NextResponse.json(
      { 
        error: 'Failed to fetch data from football API',
        details: err.response?.data?.message || err.message,
        status: err.response?.status
      },
      { status: err.response?.status || 500 }
    );
  }
} 