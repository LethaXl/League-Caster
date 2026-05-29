import type { Match } from '@/types/predictions';

const UPCOMING_STATUSES = ['SCHEDULED', 'TIMED'] as const;

/** PL, La Liga (PD), Serie A (SA): 38 matchdays; BL1/FL1: 34; UCL league phase: 8 */
export function getLeagueMaxMatchday(leagueCode: string): number {
  if (leagueCode === 'BL1' || leagueCode === 'FL1') return 34;
  if (leagueCode === 'CL') return 8;
  return 38;
}

export function isLeagueSeasonComplete(
  leagueCode: string,
  currentMatchday: number,
  standings?: { playedGames: number }[]
): boolean {
  const maxMd = getLeagueMaxMatchday(leagueCode);
  if (currentMatchday > maxMd) return true;
  if (standings?.length) {
    const maxPlayed = Math.max(...standings.map((s) => s.playedGames));
    if (maxPlayed >= maxMd) return true;
  }
  return currentMatchday - 1 >= maxMd;
}

/** Football season label e.g. "2025/2026" (Aug–Jul). */
export function getFootballSeasonLabel(referenceDate = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  if (month >= 7) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
}

export const REPLAY_FORECAST_STORAGE_KEY = 'replayForecast';

export interface ReplayForecastState {
  leagueCode: string;
  startMatchday: number;
}

export function getReplayForecastState(): ReplayForecastState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(REPLAY_FORECAST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReplayForecastState;
    if (parsed?.leagueCode && parsed.startMatchday >= 1) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function setReplayForecastState(state: ReplayForecastState | null): void {
  if (typeof window === 'undefined') return;
  if (state) {
    localStorage.setItem(REPLAY_FORECAST_STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(REPLAY_FORECAST_STORAGE_KEY);
  }
}

export function isReplayForecastActive(leagueCode: string): boolean {
  const state = getReplayForecastState();
  return state?.leagueCode === leagueCode;
}

export function getLiveStandingsLabel(
  leagueCode: string,
  currentMatchday: number,
  standings?: { playedGames: number }[]
): string {
  return isLeagueSeasonComplete(leagueCode, currentMatchday, standings)
    ? 'Final Standings'
    : 'Current Standings';
}

/**
 * Derives the app's "current" matchday (next round to play).
 * When the season has no upcoming fixtures, uses last finished matchday + 1.
 */
export function deriveCurrentMatchday(leagueCode: string, allMatches: Match[]): number {
  const now = new Date();

  const upcomingMatches = allMatches.filter((match) => {
    const matchDate = new Date(match.utcDate);
    const isUpcoming = matchDate > now;
    const isValidStatus = UPCOMING_STATUSES.includes(
      match.status as (typeof UPCOMING_STATUSES)[number]
    );
    return isUpcoming && isValidStatus;
  });

  if (leagueCode === 'CL') {
    if (upcomingMatches.length > 0) {
      const upcomingMatchdays = upcomingMatches
        .map((m) => m.matchday)
        .filter((md): md is number => md !== undefined && md !== null && md >= 4);
      if (upcomingMatchdays.length > 0) {
        const md = Math.min(...upcomingMatchdays);
        return md === 0 || md < 4 ? 4 : md;
      }
    }
    const clFinished = finishedMatchdays(allMatches).filter((md) => md >= 4);
    if (clFinished.length > 0) {
      return Math.max(...clFinished) + 1;
    }
    return 4;
  }

  if (upcomingMatches.length > 0) {
    const upcomingMatchdays = upcomingMatches
      .map((m) => m.matchday)
      .filter((md): md is number => md !== undefined && md !== null);
    if (upcomingMatchdays.length > 0) {
      return Math.min(...upcomingMatchdays);
    }
  }

  const finished = finishedMatchdays(allMatches);
  if (finished.length > 0) {
    return Math.max(...finished) + 1;
  }

  return 1;
}

function finishedMatchdays(matches: Match[]): number[] {
  return matches
    .filter(
      (m) =>
        m.matchday !== undefined &&
        m.matchday !== null &&
        m.status === 'FINISHED'
    )
    .map((m) => m.matchday as number);
}

/** Correct stale matchday=1 when standings show a completed season. */
export function reconcileCurrentMatchday(
  apiMatchday: number,
  matches: Match[],
  leagueCode: string,
  maxPlayedGames?: number
): number {
  const derived = deriveCurrentMatchday(leagueCode, matches);
  if (apiMatchday <= 1 && derived > 1) {
    return derived;
  }
  if (maxPlayedGames !== undefined && maxPlayedGames > 0 && apiMatchday <= 1) {
    return maxPlayedGames + 1;
  }
  return apiMatchday > 0 ? apiMatchday : derived;
}
