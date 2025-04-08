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

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint parameter is required' }, { status: 400 });
  }

  try {
    let url = endpoint;
    if (matchday) {
      url += `?matchday=${matchday}`;
    }

    console.log('Making API request:', {
      url,
      hasMatchday: !!matchday,
    });

    const response = await footballApi.get(url);
    
    if (!response.data) {
      console.error('Empty response from football API');
      return NextResponse.json(
        { error: 'Empty response from football API' },
        { status: 500 }
      );
    }

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('API Error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    // Return more detailed error information
    return NextResponse.json(
      { 
        error: 'Failed to fetch data from football API',
        details: error.response?.data?.message || error.message,
        status: error.response?.status
      },
      { status: error.response?.status || 500 }
    );
  }
} 