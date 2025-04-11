export interface League {
  code: string;
  name: string;
  country: string;
  flag: string;
  image: string;
}

export interface Standing {
  position: number;
  team: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
  };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
} 