export interface Match {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  group: string | null;
  homeTeam: {
    id: number;
    name: string;
    shortName?: string;
    tla?: string;
    crest?: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName?: string;
    tla?: string;
    crest?: string;
  };
  score?: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
}

export type PredictionType = 'home' | 'away' | 'draw' | 'custom';

export interface Prediction {
  matchId: number;
  type: PredictionType;
  homeGoals?: number;
  awayGoals?: number;
}

export interface MatchResult {
  name: string;
  result: 'win' | 'draw' | 'loss';
  goalDifference: number;
}

export interface TeamResult {
  team: string;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
} 