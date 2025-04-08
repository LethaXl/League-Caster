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

const api = axios.create({
  baseURL: '/api/football',
});

export const getLeagues = async (): Promise<League[]> => {
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
};

export const getStandings = async (leagueCode: string): Promise<Standing[]> => {
  const response = await api.get('', {
    params: {
      endpoint: `/competitions/${leagueCode}/standings`
    }
  });
  return response.data.standings[0].table;
};

export const getMatches = async (leagueCode: string, matchday: number): Promise<Match[]> => {
  const response = await api.get('', {
    params: {
      endpoint: `/competitions/${leagueCode}/matches`,
      matchday
    }
  });
  return response.data.matches.filter((m: Match) => 
    m.status === 'SCHEDULED' || m.status === 'TIMED'
  );
};

export const getCurrentMatchday = async (leagueCode: string): Promise<number> => {
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
};

export const processMatchPrediction = (
  prediction: Prediction,
  homeTeam: string,
  awayTeam: string
): [MatchResult, MatchResult] => {
  switch (prediction.type) {
    case 'win_home':
      return [
        { name: homeTeam, result: 'win', goalDifference: 3 },
        { name: awayTeam, result: 'loss', goalDifference: -3 }
      ];
    case 'win_away':
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
      } else if (homeResult.result === 'draw') {
        team.draw += 1;
        team.points += 1;
      } else {
        team.lost += 1;
      }
    } else if (team.team.name === awayResult.name) {
      team.playedGames += 1;
      team.goalDifference += awayResult.goalDifference;
      if (awayResult.result === 'win') {
        team.won += 1;
        team.points += 3;
      } else if (awayResult.result === 'draw') {
        team.draw += 1;
        team.points += 1;
      } else {
        team.lost += 1;
      }
    }
  }

  return updatedStandings.sort((a, b) => 
    b.points - a.points || 
    b.goalDifference - a.goalDifference || 
    b.won - a.won
  );
};

export default api; 