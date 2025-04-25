import axios from 'axios';
import { Match, Prediction, MatchResult } from '@/types/predictions';

const LEAGUE_NAME_MAPPING: { [key: string]: string } = {
  'Primera Division': 'LaLiga',
  // Add more mappings if needed
};

// Add team name mappings for display purposes
const TEAM_NAME_MAPPING: { [key: string]: string } = {
  'Wolverhampton Wanderers FC': 'Wolves',
  // Add more team name mappings here as needed
};

export interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface Standing {
  position: number;
  team: Team;
  playedGames: number;
  points: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface League {
  id: number;
  name: string;
  country: string;
  code: string;
}

// Define a generic type for request functions
type RequestFunction = () => Promise<unknown>;

// Global request queue to prevent rate limiting
const requestQueue: Array<RequestFunction> = [];
let isProcessingQueue = false;

// Add delay between requests to avoid rate limiting
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay
const MAX_RETRIES = 2;

// Process the request queue with delay
const processQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      try {
        await request();
      } catch (error: unknown) {
        console.error('Error processing queued request:', error);
      }
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }
  
  isProcessingQueue = false;
};

// Create API instance with retry logic
const api = axios.create({
  baseURL: '/api/football',
  timeout: 10000,
});

// Add a response interceptor to handle rate limiting
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // If the error is due to rate limiting and we haven't retried too many times
    if (error.response?.status === 429 && (!originalRequest._retryCount || originalRequest._retryCount < MAX_RETRIES)) {
      // Initialize or increment retry count
      originalRequest._retryCount = originalRequest._retryCount ? originalRequest._retryCount + 1 : 1;
      
      // Extract retry-after header if available, or use exponential backoff
      const retryAfter = error.response.headers['retry-after'];
      const retryDelay = retryAfter ? parseInt(retryAfter) * 1000 : DELAY_BETWEEN_REQUESTS * Math.pow(2, originalRequest._retryCount);
      
      console.log(`Rate limited. Retrying after ${retryDelay}ms (attempt ${originalRequest._retryCount}/${MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Return the request in a wrapped promise that will be added to the queue
      return new Promise((resolve, reject) => {
        requestQueue.push(async () => {
          try {
            const response = await api(originalRequest);
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
        
        processQueue();
      });
    }
    
    // Customize the error to make it more informative for components
    if (error.response?.status === 429) {
      error.isRateLimited = true;
      error.retryAfter = error.response.headers['retry-after'] || 'a few seconds';
      error.friendlyMessage = `API rate limit reached. Please try again after ${error.retryAfter}.`;
    }
    
    return Promise.reject(error);
  }
);

// Wrapper for API calls to handle queuing and rate limiting
const queueRequest = async <T>(requestFn: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    
    processQueue();
  });
};

export const getLeagues = async (): Promise<League[]> => {
  return queueRequest(async () => {
    const response = await api.get('', {
      params: {
        endpoint: '/competitions'
      }
    });
    
    interface ApiCompetition extends League {
      // Additional fields from the football API
      area?: {
        id: number;
        name: string;
        code: string;
        flag?: string;
      };
      currentSeason?: {
        id: number;
        startDate: string;
        endDate: string;
        currentMatchday: number;
      };
      numberOfAvailableSeasons?: number;
      lastUpdated?: string;
    }
    
    return response.data.competitions
      .filter((comp: ApiCompetition) => ['PL', 'BL1', 'FL1', 'SA', 'PD'].includes(comp.code))
      .map((comp: ApiCompetition) => ({
        ...comp,
        name: LEAGUE_NAME_MAPPING[comp.name] || comp.name
      }));
  });
};

export const getStandings = async (leagueCode: string): Promise<Standing[]> => {
  return queueRequest(async () => {
    const response = await api.get('', {
      params: {
        endpoint: `/competitions/${leagueCode}/standings`
      }
    });
    
    // Apply team name mappings to standings
    return response.data.standings[0].table.map((standing: Standing) => {
      return {
        ...standing,
        team: {
          ...standing.team,
          name: TEAM_NAME_MAPPING[standing.team.name] || standing.team.name
        }
      };
    });
  });
};

export const getMatches = async (leagueCode: string, matchday: number): Promise<Match[]> => {
  return queueRequest(async () => {
    const response = await api.get('', {
      params: {
        endpoint: `/competitions/${leagueCode}/matches`,
        matchday
      }
    });
    
    const now = new Date();
    
    // Filter matches that are scheduled and not in the past
    return response.data.matches.filter((m: Match) => {
      // Check match status - only include scheduled/timed matches
      const validStatus = m.status === 'SCHEDULED' || m.status === 'TIMED';
      
      // Check match date - only include future matches
      const matchDate = new Date(m.utcDate);
      const isFutureMatch = matchDate > now;
      
      return validStatus && isFutureMatch;
    }).map((match: Match) => {
      // Apply team name mappings
      return {
        ...match,
        homeTeam: {
          ...match.homeTeam,
          name: TEAM_NAME_MAPPING[match.homeTeam.name] || match.homeTeam.name
        },
        awayTeam: {
          ...match.awayTeam,
          name: TEAM_NAME_MAPPING[match.awayTeam.name] || match.awayTeam.name
        }
      };
    });
  });
};

export const getCurrentMatchday = async (leagueCode: string): Promise<number> => {
  return queueRequest(async () => {
    const response = await api.get('', {
      params: {
        endpoint: `/competitions/${leagueCode}/matches`
      }
    });
    
    interface ApiMatch extends Match {
      matchday: number;
      status: string;
      utcDate: string;
      homeTeam: { id: number; name: string };
      awayTeam: { id: number; name: string };
    }
    
    const scheduledMatches = response.data.matches.filter(
      (m: ApiMatch) => m.status === 'SCHEDULED' || m.status === 'TIMED'
    );
    return scheduledMatches.length > 0
      ? Math.min(...scheduledMatches.map((m: ApiMatch) => m.matchday))
      : 1;
  });
};

export const processMatchPrediction = (
  prediction: Prediction,
  homeTeam: string,
  awayTeam: string
): [MatchResult, MatchResult] => {
  // Apply team name mappings for consistency
  const mappedHomeTeam = TEAM_NAME_MAPPING[homeTeam] || homeTeam;
  const mappedAwayTeam = TEAM_NAME_MAPPING[awayTeam] || awayTeam;
  
  switch (prediction.type) {
    case 'home':
      return [
        { name: mappedHomeTeam, result: 'win', goalDifference: 3 },
        { name: mappedAwayTeam, result: 'loss', goalDifference: -3 }
      ];
    case 'away':
      return [
        { name: mappedHomeTeam, result: 'loss', goalDifference: -3 },
        { name: mappedAwayTeam, result: 'win', goalDifference: 3 }
      ];
    case 'draw':
      return [
        { name: mappedHomeTeam, result: 'draw', goalDifference: 0 },
        { name: mappedAwayTeam, result: 'draw', goalDifference: 0 }
      ];
    case 'custom':
      if (prediction.homeGoals !== undefined && prediction.awayGoals !== undefined) {
        const diff = prediction.homeGoals - prediction.awayGoals;
        if (diff > 0) {
          return [
            { name: mappedHomeTeam, result: 'win', goalDifference: diff },
            { name: mappedAwayTeam, result: 'loss', goalDifference: -diff }
          ];
        } else if (diff < 0) {
          return [
            { name: mappedHomeTeam, result: 'loss', goalDifference: diff },
            { name: mappedAwayTeam, result: 'win', goalDifference: -diff }
          ];
        }
      }
      return [
        { name: mappedHomeTeam, result: 'draw', goalDifference: 0 },
        { name: mappedAwayTeam, result: 'draw', goalDifference: 0 }
      ];
    default:
      return [
        { name: mappedHomeTeam, result: 'draw', goalDifference: 0 },
        { name: mappedAwayTeam, result: 'draw', goalDifference: 0 }
      ];
  }
};

export const updateStandings = (
  homeResult: MatchResult,
  awayResult: MatchResult,
  standings: Standing[]
): Standing[] => {
  const updatedStandings = [...standings];
  
  for (const team of updatedStandings) {
    if (team.team.name === homeResult.name) {
      team.playedGames += 1;
      team.goalDifference += homeResult.goalDifference;
      
      if (homeResult.result === 'win') {
        team.won += 1;
        team.points += 3;
        team.goalsFor += Math.abs(homeResult.goalDifference);
      } else if (homeResult.result === 'draw') {
        team.draw += 1;
        team.points += 1;
      } else {
        team.lost += 1;
        team.goalsAgainst += Math.abs(homeResult.goalDifference);
      }
    } else if (team.team.name === awayResult.name) {
      team.playedGames += 1;
      team.goalDifference += awayResult.goalDifference;
      
      if (awayResult.result === 'win') {
        team.won += 1;
        team.points += 3;
        team.goalsFor += Math.abs(awayResult.goalDifference);
      } else if (awayResult.result === 'draw') {
        team.draw += 1;
        team.points += 1;
      } else {
        team.lost += 1;
        team.goalsAgainst += Math.abs(awayResult.goalDifference);
      }
    }
  }

  // Sort by points, goal difference, and wins
  updatedStandings.sort((a, b) => {
    // First sort by points (descending)
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    
    // If points are equal, sort by goal difference (descending)
    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference;
    }
    
    // If goal difference is also equal, sort by wins (descending)
    return b.won - a.won;
  });
  
  // Update positions after sorting
  updatedStandings.forEach((standing, index) => {
    standing.position = index + 1;
  });

  return updatedStandings;
};

// New function to get combined league data (standings and current matchday) in a single request
export const getLeagueData = async (leagueCode: string): Promise<{ standings: Standing[], currentMatchday: number }> => {
  return queueRequest(async () => {
    const response = await api.get('', {
      params: {
        combined: 'league_data',
        leagueCode
      }
    });
    
    // Apply team name mappings to standings
    const mappedStandings = response.data.standings.map((standing: Standing) => {
      return {
        ...standing,
        team: {
          ...standing.team,
          name: TEAM_NAME_MAPPING[standing.team.name] || standing.team.name
        }
      };
    });
    
    return {
      standings: mappedStandings,
      currentMatchday: response.data.currentMatchday
    };
  });
};

export default api; 