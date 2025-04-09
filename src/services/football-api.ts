import axios from 'axios';
import { Match, Prediction, MatchResult } from '@/types/predictions';

const LEAGUE_NAME_MAPPING: { [key: string]: string } = {
  'Primera Division': 'LaLiga',
  // Add more mappings if needed
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

// Global request queue to prevent rate limiting
const requestQueue: Array<() => Promise<any>> = [];
let isProcessingQueue = false;

// Add delay between requests to avoid rate limiting
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second delay

// Process the request queue with delay
const processQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      try {
        await request();
      } catch (error) {
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
    
    // If the error is due to rate limiting and we haven't retried yet
    if (error.response?.status === 429 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Wait for a longer time (exponential backoff)
      const retryDelay = DELAY_BETWEEN_REQUESTS * 2;
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
    return response.data.competitions
      .filter((comp: any) => ['PL', 'BL1', 'FL1', 'SA', 'PD'].includes(comp.code))
      .map((comp: League) => ({
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
    return response.data.standings[0].table;
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
    return response.data.matches.filter((m: Match) => 
      m.status === 'SCHEDULED' || m.status === 'TIMED'
    );
  });
};

export const getCurrentMatchday = async (leagueCode: string): Promise<number> => {
  return queueRequest(async () => {
    const response = await api.get('', {
      params: {
        endpoint: `/competitions/${leagueCode}/matches`
      }
    });
    const scheduledMatches = response.data.matches.filter(
      (m: Match) => m.status === 'SCHEDULED' || m.status === 'TIMED'
    );
    return scheduledMatches.length > 0
      ? Math.min(...scheduledMatches.map((m: Match) => m.matchday))
      : 1;
  });
};

export const processMatchPrediction = (
  prediction: Prediction,
  homeTeam: string,
  awayTeam: string
): [MatchResult, MatchResult] => {
  switch (prediction.type) {
    case 'home':
      return [
        { name: homeTeam, result: 'win', goalDifference: 3 },
        { name: awayTeam, result: 'loss', goalDifference: -3 }
      ];
    case 'away':
      return [
        { name: homeTeam, result: 'loss', goalDifference: -3 },
        { name: awayTeam, result: 'win', goalDifference: 3 }
      ];
    case 'draw':
      return [
        { name: homeTeam, result: 'draw', goalDifference: 0 },
        { name: awayTeam, result: 'draw', goalDifference: 0 }
      ];
    case 'custom':
      if (prediction.homeGoals !== undefined && prediction.awayGoals !== undefined) {
        const diff = prediction.homeGoals - prediction.awayGoals;
        if (diff > 0) {
          return [
            { name: homeTeam, result: 'win', goalDifference: diff },
            { name: awayTeam, result: 'loss', goalDifference: -diff }
          ];
        } else if (diff < 0) {
          return [
            { name: homeTeam, result: 'loss', goalDifference: diff },
            { name: awayTeam, result: 'win', goalDifference: -diff }
          ];
        }
      }
      return [
        { name: homeTeam, result: 'draw', goalDifference: 0 },
        { name: awayTeam, result: 'draw', goalDifference: 0 }
      ];
    default:
      return [
        { name: homeTeam, result: 'draw', goalDifference: 0 },
        { name: awayTeam, result: 'draw', goalDifference: 0 }
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
    
    return {
      standings: response.data.standings,
      currentMatchday: response.data.currentMatchday
    };
  });
};

export default api; 