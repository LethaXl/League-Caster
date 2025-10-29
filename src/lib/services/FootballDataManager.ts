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

  async getLeagueData(leagueCode: string): Promise<FootballApiData> {
    const cacheKey = `league_${leagueCode}`;
    
    // Try cache first
    let data = await cacheService.get<FootballApiData>(cacheKey);
    
    if (data) {
      // Only log cache hit if in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Cache hit for ${leagueCode}`);
      }
      return { ...data, source: 'cache' };
    }
    
    // Cache miss - fetch from API
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Cache miss for ${leagueCode}, fetching from API...`);
    }
    data = await this.fetchFromAPI(leagueCode);
    
    // Cache for 10 minutes (longer TTL to reduce API calls)
    await cacheService.set(cacheKey, data, 600);
    
    return { ...data, source: 'api' };
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
      
      // Process matches - filter for upcoming matches only
      const allMatches = matchesResponse.data.matches;
      const now = new Date();
      
      const upcomingMatches = allMatches.filter((match: Match) => {
        const matchDate = new Date(match.utcDate);
        const isUpcoming = matchDate > now;
        const isValidStatus = ['SCHEDULED', 'TIMED'].includes(match.status);
        return isUpcoming && isValidStatus;
      });

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
        matches: upcomingMatches,
        currentMatchday,
        lastUpdated: Date.now(),
        source: 'api'
      };

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Fetched ${leagueCode}: ${upcomingMatches.length} matches, matchday ${currentMatchday}`);
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
}

export const footballDataManager = new FootballDataManager(); 