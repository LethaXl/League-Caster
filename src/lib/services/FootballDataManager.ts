import axios from 'axios';
import { cacheService } from '@/lib/cache/CacheService';
import { Match } from '@/types/predictions';
import { Standing } from '@/types/standings';

export interface FootballApiData {
  standings: Standing[];
  matches: Match[];
  currentMatchday: number;
  lastUpdated: number;
  source: 'cache' | 'api';
  error?: string; // Optional error field for failed fetches
}

export class FootballDataManager {
  private readonly API_BASE_URL = 'https://api.football-data.org/v4';
  private readonly API_KEY = process.env.API_KEY;
  private readonly LEAGUES = ['PL', 'BL1', 'FL1', 'SA', 'PD', 'CL'];
  
  private apiClient = axios.create({
    baseURL: this.API_BASE_URL,
    headers: { 'X-Auth-Token': this.API_KEY },
    timeout: 10000
  });

  // Request deduplication: track in-flight requests to prevent duplicate API calls
  private inFlightRequests: Map<string, Promise<FootballApiData>> = new Map();

  async getLeagueData(leagueCode: string): Promise<FootballApiData> {
    const cacheKey = `league_${leagueCode}`;
    
    // Try cache first
    let data = await cacheService.get<FootballApiData>(cacheKey);
    
    if (data) {
      // Only log cache hit if in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Cache hit for ${leagueCode}`);
      }
      return { ...data, source: 'cache' as const };
    }
    
    // Check if there's already an in-flight request for this league
    if (this.inFlightRequests.has(cacheKey)) {
      // Wait for the existing request instead of making a new one
      if (process.env.NODE_ENV === 'development') {
        console.log(`⏳ Waiting for in-flight request for ${leagueCode}...`);
      }
      return await this.inFlightRequests.get(cacheKey)!;
    }
    
    // Cache miss - fetch from API
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Cache miss for ${leagueCode}, fetching from API...`);
    }
    
    // Create the fetch promise and store it
    const fetchPromise = (async (): Promise<FootballApiData> => {
      try {
        const fetchedData = await this.fetchFromAPI(leagueCode);
        
        // Cache for 10 minutes (longer TTL to reduce API calls)
        await cacheService.set(cacheKey, fetchedData, 600);
        
        // Remove from in-flight requests
        this.inFlightRequests.delete(cacheKey);
        
        return { ...fetchedData, source: 'api' as const };
      } catch (error) {
        // Remove from in-flight requests on error
        this.inFlightRequests.delete(cacheKey);
        throw error;
      }
    })();
    
    // Store the promise
    this.inFlightRequests.set(cacheKey, fetchPromise);
    
    return await fetchPromise;
  }

  private async fetchFromAPI(leagueCode: string): Promise<FootballApiData> {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🌐 Fetching ${leagueCode} data from football-data.org...`);
      }
      
      // Make parallel API calls
      const [standingsResponse, matchesResponse] = await Promise.all([
        this.apiClient.get(`/competitions/${leagueCode}/standings`),
        this.apiClient.get(`/competitions/${leagueCode}/matches`)
      ]);

      // Process standings
      const standings = standingsResponse.data.standings[0].table;
      
      // Process matches - return ALL matches (both completed and upcoming) for forms and historical data
      const allMatches = matchesResponse.data.matches;
      const now = new Date();
      
      // Filter for upcoming matches only (for current matchday calculation)
      const upcomingMatches = allMatches.filter((match: Match) => {
        const matchDate = new Date(match.utcDate);
        const isUpcoming = matchDate > now;
        const isValidStatus = ['SCHEDULED', 'TIMED'].includes(match.status);
        return isUpcoming && isValidStatus;
      });
      
      // Return ALL matches (not just upcoming) so forms and historical data can use them
      // The matches array will contain both completed and upcoming matches

      // Calculate current matchday
      let currentMatchday: number;
      if (leagueCode === 'CL') {
        // For UCL, start from matchday 4 (current matchday in 25-26 season)
        const upcomingMatchdays = upcomingMatches.map((m: Match) => m.matchday);
        const filteredMatchdays = upcomingMatchdays.filter((md: number) => md >= 4);
        
        currentMatchday = filteredMatchdays.length > 0 
          ? Math.min(...filteredMatchdays)
          : 4;
        
        // Handle case where API returns 0 or invalid matchday
        if (currentMatchday === 0 || currentMatchday < 4) {
          currentMatchday = 4;
        }
      } else {
        // For other leagues, use the minimum upcoming matchday
        currentMatchday = upcomingMatches.length > 0
          ? Math.min(...upcomingMatches.map((m: Match) => m.matchday))
          : 1;
      }

      const data: FootballApiData = {
        standings,
        matches: allMatches, // Return ALL matches (completed + upcoming) for forms and historical data
        currentMatchday,
        lastUpdated: Date.now(),
        source: 'api'
      };

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Fetched ${leagueCode}: ${allMatches.length} total matches (${upcomingMatches.length} upcoming), matchday ${currentMatchday}`);
      }
      return data;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const responseData = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      console.error(`❌ API Error for ${leagueCode}:`, responseData || errorMessage);
      throw new Error(`Failed to fetch ${leagueCode} data: ${responseData || errorMessage}`);
    }
  }

  async getMatches(leagueCode: string, matchday?: number): Promise<Match[]> {
    const data = await this.getLeagueData(leagueCode);
    
    if (matchday) {
      return data.matches.filter(match => match.matchday === matchday);
    }
    
    return data.matches;
  }

  async getAllMatchesForMatchday(leagueCode: string, matchday: number): Promise<Match[]> {
    try {
      const response = await this.apiClient.get(`/competitions/${leagueCode}/matches`, {
        params: { matchday }
      });
      
      // Return all matches (both completed and scheduled) for the matchday
      return response.data.matches.map((match: Match) => match);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error fetching matches for ${leagueCode} matchday ${matchday}:`, errorMessage);
      throw error;
    }
  }

  async getAllMatches(leagueCode: string): Promise<Match[]> {
    try {
      const response = await this.apiClient.get(`/competitions/${leagueCode}/matches`);
      
      // Return all matches (both completed and scheduled)
      return response.data.matches.map((match: Match) => match);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error fetching all matches for ${leagueCode}:`, errorMessage);
      throw error;
    }
  }

  async getStandings(leagueCode: string): Promise<Standing[]> {
    const data = await this.getLeagueData(leagueCode);
    return data.standings;
  }

  async getCurrentMatchday(leagueCode: string): Promise<number> {
    const data = await this.getLeagueData(leagueCode);
    return data.currentMatchday;
  }

  async refreshLeagueData(leagueCode: string): Promise<void> {
    console.log(`🔄 Manually refreshing ${leagueCode} data...`);
    await cacheService.invalidate(`league_${leagueCode}`);
    await this.getLeagueData(leagueCode);
  }

  async getCacheStats(): Promise<{ keys: string[]; count: number }> {
    return await cacheService.getCacheStats();
  }

  async getAllLeaguesData(): Promise<Record<string, FootballApiData>> {
    const leagues = ['PL', 'BL1', 'FL1', 'SA', 'PD', 'CL'];
    
    // Fetch all leagues in parallel (they'll use caching and request deduplication)
    const leagueDataPromises = leagues.map(async (leagueCode) => {
      try {
        const data = await this.getLeagueData(leagueCode);
        return { leagueCode, data };
      } catch (error) {
        // If one league fails, return error for that league but continue with others
        console.error(`Error fetching data for ${leagueCode}:`, error);
        return { 
          leagueCode, 
          data: null, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
    
    const results = await Promise.all(leagueDataPromises);
    
    // Convert to object format
    const allLeaguesData: Record<string, FootballApiData> = {};
    results.forEach(({ leagueCode, data, error }) => {
      if (data) {
        allLeaguesData[leagueCode] = data;
      } else {
        // Store error info if fetch failed
        allLeaguesData[leagueCode] = {
          standings: [],
          matches: [],
          currentMatchday: 1,
          lastUpdated: Date.now(),
          source: 'api',
          error
        } as FootballApiData & { error?: string };
      }
    });
    
    return allLeaguesData;
  }
}

export const footballDataManager = new FootballDataManager(); 