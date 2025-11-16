'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import LeagueSelector from '@/components/Standings/LeagueSelector';
import StandingsTable from '@/components/Standings/StandingsTable';
import PredictionForm from '@/components/Predictions/PredictionForm';
import ModeSelection from '@/components/Predictions/ModeSelection';
import PredictionSummary from '@/components/Predictions/PredictionSummary';
import { getStandings, Standing, getCurrentMatchday, getMatches, getLeagueData, getCompletedMatchesUpToMatchday, calculateHistoricalStandings, getAllLeaguesData } from '@/services/football-api';
import { Match } from '@/types/predictions';

// Cache for team forms (shared with StandingsTable)
const teamFormsCache = new Map<string, Map<number, ('W' | 'D' | 'L')[]>>();

// Helper functions for localStorage-based form caching with TTL (1 day)
const FORMS_CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day in milliseconds

interface CachedForms {
  data: Record<string, ('W' | 'D' | 'L')[]>; // Stored as object for JSON serialization
  timestamp: number;
}

const getCachedForms = (cacheKey: string): Map<number, ('W' | 'D' | 'L')[]> | null => {
  // First check in-memory cache
  const memoryCache = teamFormsCache.get(cacheKey);
  if (memoryCache) {
    return memoryCache;
  }
  
  // Then check localStorage
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  
  try {
    const cachedStr = localStorage.getItem(`forms_cache_${cacheKey}`);
    if (!cachedStr) {
      return null;
    }
    
    const cached: CachedForms = JSON.parse(cachedStr);
    const now = Date.now();
    
    // Check if cache is still valid (less than 1 day old)
    if (now - cached.timestamp < FORMS_CACHE_TTL) {
      // Convert array format back to Map
      const formsMap = new Map<number, ('W' | 'D' | 'L')[]>();
      Object.entries(cached.data).forEach(([teamId, form]) => {
        formsMap.set(Number(teamId), form);
      });
      
      // Also store in memory cache for faster access
      teamFormsCache.set(cacheKey, formsMap);
      return formsMap;
    } else {
      // Cache expired, remove it
      localStorage.removeItem(`forms_cache_${cacheKey}`);
      return null;
    }
  } catch (e) {
    console.error('Error reading cached forms from localStorage:', e);
    return null;
  }
};

const setCachedForms = (cacheKey: string, forms: Map<number, ('W' | 'D' | 'L')[]>): void => {
  // Store in memory cache
  teamFormsCache.set(cacheKey, forms);
  
  // Also store in localStorage with timestamp
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  
  try {
    // Convert Map to object format for JSON storage
    const formsObj: Record<string, ('W' | 'D' | 'L')[]> = {};
    forms.forEach((form, teamId) => {
      formsObj[teamId.toString()] = form;
    });
    
    const cached: CachedForms = {
      data: formsObj,
      timestamp: Date.now()
    };
    
    localStorage.setItem(`forms_cache_${cacheKey}`, JSON.stringify(cached));
  } catch (e) {
    console.error('Error caching forms to localStorage:', e);
  }
};
import { usePrediction } from '@/contexts/PredictionContext';
import { Prediction } from '@/types/predictions';
import Image from 'next/image';

// Interface for API error responses
interface ApiError {
  message: string;
  response?: {
    status?: number;
    data?: {
      error?: string;
      details?: string;
      message?: string;
    };
  };
}

// Function to determine the max matchday for a league
const getMaxMatchday = (leagueCode: string): number => {
  // Bundesliga and Ligue 1 have 18 teams (34 matchdays)
  if (leagueCode === 'BL1' || leagueCode === 'FL1') {
    return 34;
  }
  // Champions League has league phase up to matchday 8 (25-26 season format)
  if (leagueCode === 'CL') {
    return 8;
  }
  // Premier League, La Liga, Serie A have 20 teams (38 matchdays)
  return 38;
};

// League info for header (copied from LeagueSelector)
const LEAGUES = [
  { code: 'PL', name: 'Premier League', country: 'England', flag: '🏴', image: '/premierleague.png' },
  { code: 'BL1', name: 'Bundesliga', country: 'Germany', flag: '🇩🇪', image: '/bundesliga.png' },
  { code: 'FL1', name: 'Ligue 1', country: 'France', flag: '🇫🇷', image: '/ligue1.png' },
  { code: 'SA', name: 'Serie A', country: 'Italy', flag: '🇮🇹', image: '/seriea.png' },
  { code: 'PD', name: 'La Liga', country: 'Spain', flag: '🇪🇸', image: '/laliga.png' },
  { code: 'CL', name: 'Champions League', country: 'Europe', flag: '🇪🇺', image: '/ucl.png' },
];

export default function Home() {
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  // Store standings per league to prevent flicker when switching leagues
  const [standingsByLeague, setStandingsByLeague] = useState<Record<string, Standing[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPredictions, setShowPredictions] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [viewingFromMatchday, setViewingFromMatchday] = useState<number | null>(null);
  const [showPredictionSummary, setShowPredictionSummary] = useState(false);
  const [completedMatches, setCompletedMatches] = useState<Match[]>([]);
  const [matchPredictions, setMatchPredictions] = useState<Map<number, Prediction>>(new Map());
  const [seasonOver, setSeasonOver] = useState(false); // Season is active
  const [selectedHistoricalMatchday, setSelectedHistoricalMatchday] = useState<number | null>(null);
  const [historicalStandings, setHistoricalStandings] = useState<Standing[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [predictedStandingsByMatchday, setPredictedStandingsByMatchday] = useState<Map<number, Standing[]>>(new Map());
  const [teamForms, setTeamForms] = useState<Map<number, ('W' | 'D' | 'L')[]>>(new Map());
  const [formsLoading, setFormsLoading] = useState(false);
  
  // Cache for API data to reduce calls
  const matchdayCache = useRef<Map<string, number>>(new Map());
  const matchesCache = useRef<Map<string, Match[]>>(new Map()); // Per-matchday cache (legacy)
  const allMatchesCache = useRef<Map<string, Match[]>>(new Map()); // Per-league cache (all matches)
  const standingsCache = useRef<Map<string, Standing[]>>(new Map());
  const historicalStandingsCache = useRef<Map<string, Standing[]>>(new Map());
  const allCompletedMatchesCache = useRef<Map<string, Match[]>>(new Map()); // Cache all completed matches per league
  const fetchingFormsRef = useRef<Map<string, boolean>>(new Map()); // Track ongoing form fetches to prevent duplicates
  const fetchingDataRef = useRef<string | null>(null); // Track ongoing data fetch to prevent duplicates
  
  // Derive current standings from the selected league
  // This ensures we always show the correct league's standings, preventing flicker
  const standings = selectedLeague ? (standingsByLeague[selectedLeague] || []) : [];
  
  // Helper functions to get matches from cache (no API calls)
  const getCachedMatches = useCallback((leagueCode: string): Match[] | null => {
    return allMatchesCache.current.get(leagueCode) || null;
  }, []);

  const getCompletedMatchesUpToMatchdayFromCache = useCallback((
    leagueCode: string,
    matchday: number
  ): Match[] => {
    const matches = allMatchesCache.current.get(leagueCode);
    if (!matches) return [];
    
    return matches.filter(
      (m: Match) =>
        m.matchday !== undefined &&
        m.matchday <= matchday &&
        m.status === 'FINISHED' &&
        m.score?.fullTime?.home !== null &&
        m.score?.fullTime?.away !== null
    );
  }, []);
  
  // Add state to pass fetched matches to PredictionForm
  const [initialMatches, setInitialMatches] = useState<Match[]>([]);
  // Add initialization flag to track if a reset has been done on this session
  const initializedRef = useRef(false);
  // Add state for responsive design
  const [isMobileLConstrainedView, setIsMobileLConstrainedView] = useState(false);

  const {
    isViewingStandings,
    setIsViewingStandings,
    predictedStandings,
    currentMatchday,
    resetPredictions,
    setCurrentMatchday,
    setIsRaceMode,
    setSelectedTeamIds,
    selectedTeamIds,
    isRaceMode,
    setUnfilteredMatchesMode,
    setTableDisplayMode,
    tableDisplayMode
  } = usePrediction();
  
  // Save predicted standings for each matchday as they're calculated
  // Track previous standings and matchday to detect changes
  const prevPredictedStandingsRef = useRef<Standing[]>([]);
  const prevMatchdayRef = useRef<number>(currentMatchday);
  
  // Save predicted standings when they change
  useEffect(() => {
    if (predictedStandings.length > 0) {
      // Check if standings actually changed (compare by points to detect real changes)
      const standingsChanged = prevPredictedStandingsRef.current.length === 0 || 
        JSON.stringify(predictedStandings.map(s => ({ id: s.team.id, points: s.points })).sort((a, b) => a.id - b.id)) !== 
        JSON.stringify(prevPredictedStandingsRef.current.map(s => ({ id: s.team.id, points: s.points })).sort((a, b) => a.id - b.id));
      
      const matchdayChanged = currentMatchday !== prevMatchdayRef.current;
      
      if (standingsChanged) {
        // Always save predicted standings for the matchday they correspond to
        if (matchdayChanged && currentMatchday > prevMatchdayRef.current) {
          // Matchday incremented - save previous standings for the matchday that was just completed
          const matchdayToSave = prevMatchdayRef.current;
          const standingsToSave = prevPredictedStandingsRef.current.length > 0 
            ? prevPredictedStandingsRef.current 
            : predictedStandings;
          
          setPredictedStandingsByMatchday(prev => {
            const newMap = new Map(prev);
            // Normalize key to Number
            newMap.set(Number(matchdayToSave), standingsToSave.map(s => ({
              ...s,
              team: { ...s.team }
            })));
            return newMap;
          });
        }
        
        // Also save for current matchday (the one being predicted or just predicted)
        setPredictedStandingsByMatchday(prev => {
          const newMap = new Map(prev);
          // Normalize key to Number
          newMap.set(Number(currentMatchday), predictedStandings.map(s => ({
            ...s,
            team: { ...s.team }
          })));
          return newMap;
        });
      }
      
      // Update refs after processing
      prevPredictedStandingsRef.current = [...predictedStandings];
      prevMatchdayRef.current = currentMatchday;
      
      // Also save when viewing standings (final matchday) - write the final row when viewing it
      const forecastEndMd = computeForecastEndMd();
      if (forecastEndMd !== null && forecastEndMd !== undefined) {
        setPredictedStandingsByMatchday(prev => {
          const newMap = new Map(prev);
          // Normalize key to Number and save under forecastEndMd
          newMap.set(Number(forecastEndMd), predictedStandings.map(s => ({
            ...s,
            team: { ...s.team }
          })));
          return newMap;
        });
      }
    }
  }, [predictedStandings, currentMatchday, viewingFromMatchday, selectedLeague]);

  // Track screen width for responsive layouts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setIsMobileLConstrainedView(window.innerWidth >= 375 && window.innerWidth < 450);
    };
    
    // Set initial value
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ensure race mode settings are reset on initial load
  useEffect(() => {
    // Only execute this once per session
    if (!initializedRef.current) {
      console.log("Initial app load - resetting race mode settings");
      
      // Reset race mode settings to ensure clean initial state
      setIsRaceMode(false);
      setSelectedTeamIds([]);
      
      // Clear race mode related localStorage items
      localStorage.removeItem('predictionState');
      
      // Mark as initialized
      initializedRef.current = true;
    }
  }, [setIsRaceMode, setSelectedTeamIds]);

  // Determine the max matchday for the currently selected league
  const maxMatchday = selectedLeague ? getMaxMatchday(selectedLeague) : 38;

  // Helper function to compute forecastEndMd (single source of truth)
  // Priority: viewingFromMatchday > maxCompletedMd > lastFromMap > currentMatchday
  const computeForecastEndMd = (): number => {
    if (!selectedLeague) return currentMatchday;
    
    // Normalize map keys to Numbers
    const mapKeys = Array.from(predictedStandingsByMatchday.keys()).map(Number);
    const lastFromMap = mapKeys.length > 0 ? Math.max(...mapKeys) : null;
    
    // Get max completed matchday
    const completedMatchdays = JSON.parse(localStorage.getItem('completedMatchdays') || '{}');
    const currentCompleted = completedMatchdays[selectedLeague] || [];
    const maxCompletedMd = currentCompleted.length > 0 ? Math.max(...currentCompleted) : null;
    
    // Priority: viewingFromMatchday > maxCompletedMd > lastFromMap > currentMatchday
    return viewingFromMatchday ?? maxCompletedMd ?? lastFromMap ?? currentMatchday;
  };

  // Handle historical matchday selection
  const handleHistoricalMatchdayChange = async (matchday: number | null) => {
    if (!selectedLeague || !standings.length) return;
    
    setSelectedHistoricalMatchday(matchday);
    // In forecast mode, automatically enable comparison when selecting a historical matchday
    if (viewingFromMatchday !== null && matchday !== null) {
      setIsComparing(true); // Checked by default in forecast mode
    } else if (matchday === null) {
      setIsComparing(false); // Uncheck when clearing selection
    }
    // In regular mode, preserve the isComparing state when switching between matchdays
    // (don't reset it - let the user's checkbox preference persist)
    
    if (matchday === null) {
      setHistoricalStandings([]);
      return;
    }
    
    // In forecast mode, only short-circuit to predicted standings for FUTURE matchdays
    // For past/current matchdays (like MD1), we need to calculate historical standings from real matches
    if (viewingFromMatchday !== null && matchday !== null) {
      const savedPredictedStandings = predictedStandingsByMatchday.get(Number(matchday));
      const isFutureMd = matchday > currentMatchday;
      
      if (isFutureMd && savedPredictedStandings && savedPredictedStandings.length > 0) {
        // For future MDs, we show predictions instead of calculating from real matches
        setHistoricalStandings([]);
        return;
      }
      // For past/current matchdays, continue to calculate historical standings from completed matches
    }
    
    // Check cache first for calculated standings
    const cacheKey = `${selectedLeague}-${matchday}`;
    const cachedStandings = historicalStandingsCache.current.get(cacheKey);
    
    if (cachedStandings) {
      // Use cached data
      setHistoricalStandings(cachedStandings);
      return;
    }
    
    // Check if we have all completed matches cached for this league
    // Try to get matches from cache first (from all_leagues prefetch)
    let allCompletedMatches = allCompletedMatchesCache.current.get(selectedLeague);
    
    if (!allCompletedMatches) {
      // Try to get from allMatchesCache (prefetched from all_leagues)
      const cachedMatches = getCachedMatches(selectedLeague);
      if (cachedMatches && cachedMatches.length > 0) {
        // Filter for completed matches only
        const completed = cachedMatches.filter(
          (match: Match) =>
            match.status === 'FINISHED' &&
            match.score?.fullTime?.home !== null &&
            match.score?.fullTime?.away !== null
        );
        allCompletedMatches = completed;
        // Cache for future use
        allCompletedMatchesCache.current.set(selectedLeague, completed);
      } else {
        // Fallback: Fetch from API only if not in cache
        setLoadingHistorical(true);
        
        const timeoutId = setTimeout(() => {
          setError('Request timed out. Please try again.');
          setLoadingHistorical(false);
        }, 15000);
        
        try {
          // Fetch all matches up to max matchday to get all completed matches
          allCompletedMatches = await getCompletedMatchesUpToMatchday(selectedLeague, maxMatchday);
          // Cache all completed matches for this league
          allCompletedMatchesCache.current.set(selectedLeague, allCompletedMatches);
          clearTimeout(timeoutId);
        } catch (error) {
          clearTimeout(timeoutId);
          console.error('Error fetching all completed matches:', error);
          setError('Failed to load historical standings. Please try again.');
          setLoadingHistorical(false);
          return;
        } finally {
          setLoadingHistorical(false);
        }
      }
    }
    
    // Filter matches up to the selected matchday
    const completedMatchesUpToMatchday = (allCompletedMatches || []).filter(
      (match: Match) => match.matchday !== undefined && match.matchday <= matchday
    );
    
    // Calculate historical standings from filtered matches
    const calculatedStandings = calculateHistoricalStandings(standings, completedMatchesUpToMatchday);
    
    // Cache the calculated standings for this specific matchday
    historicalStandingsCache.current.set(cacheKey, calculatedStandings);
    
    setHistoricalStandings(calculatedStandings);
  };
  
  // Check if we're at the final matchday for the current league
  // const isFinalMatchday = currentMatchday >= maxMatchday;

  // Check for the current view state when isViewingStandings changes
  useEffect(() => {
    if (isViewingStandings) {
      // Check if we're viewing current standings from predictions
      const viewingFromMatchdayStr = localStorage.getItem('viewingCurrentStandingsFrom');
      if (viewingFromMatchdayStr) {
        setViewingFromMatchday(parseInt(viewingFromMatchdayStr, 10));
        // Clear the flag after reading it
        localStorage.removeItem('viewingCurrentStandingsFrom');
      } else {
        // In forecast mode, never allow viewingFromMatchday to be null
        // Use single source of truth
        const forecastEndMd = computeForecastEndMd();
        setViewingFromMatchday(forecastEndMd);
      }
      
      // Clear selected historical matchday when viewing standings from predictions
      // This ensures we show current predicted standings, not a previously viewed historical matchday
      setSelectedHistoricalMatchday(null);
      setHistoricalStandings([]);
      // Keep isComparing state when switching to viewing standings so indicators remain visible if checkbox was on
      
      setShowPredictions(false);
    }
  }, [isViewingStandings, predictedStandingsByMatchday, selectedLeague, currentMatchday]);

  // Terminal statements when viewing final table after completing all matchdays
  useEffect(() => {
    if (isViewingStandings && predictedStandingsByMatchday.size > 0) {
      const forecastEndMd = computeForecastEndMd();
      const leagueMaxMd = selectedLeague === 'CL' ? 8 : (selectedLeague === 'BL1' || selectedLeague === 'FL1') ? 34 : 38;
      const isForecastComplete = forecastEndMd === leagueMaxMd;
      const isViewingFinalTable = isForecastComplete && (viewingFromMatchday === null || viewingFromMatchday === forecastEndMd);
      
      if (isViewingFinalTable) {
        console.log('🎯 FINAL TABLE VIEWED - All Matchdays Completed', {
          forecastEndMd,
          viewingFromMatchday,
          currentMatchday,
          maxMatchday: leagueMaxMd,
          league: selectedLeague,
          isForecastComplete,
          totalPredictedMatchdays: predictedStandingsByMatchday.size,
          predictedMatchdays: Array.from(predictedStandingsByMatchday.keys()).map(Number).sort((a, b) => a - b),
          isComparing,
          selectedHistoricalMatchday
        });
      }
    }
  }, [isViewingStandings, viewingFromMatchday, predictedStandingsByMatchday, currentMatchday, selectedLeague, isComparing, selectedHistoricalMatchday]);

  // Calculate team forms from completed matches and standings
  // Helper function to convert prediction to match result (W/D/L) for a team
  const getPredictionResult = useCallback((prediction: Prediction, teamId: number, match: Match): 'W' | 'D' | 'L' | null => {
    const isHome = match.homeTeam.id === teamId;
    
    switch (prediction.type) {
      case 'home':
        return isHome ? 'W' : 'L';
      case 'away':
        return isHome ? 'L' : 'W';
      case 'draw':
        return 'D';
      case 'custom':
        if (prediction.homeGoals !== undefined && prediction.awayGoals !== undefined) {
          const homeScore = prediction.homeGoals;
          const awayScore = prediction.awayGoals;
          if (isHome) {
            if (homeScore > awayScore) return 'W';
            if (homeScore < awayScore) return 'L';
            return 'D';
          } else {
            if (awayScore > homeScore) return 'W';
            if (awayScore < homeScore) return 'L';
            return 'D';
          }
        }
        return 'D';
      default:
        return null;
    }
  }, []);

  // Helper function to get completed matches from localStorage (no API call)
  // Gets ALL matches from localStorage (not just up to a matchday) to ensure we have complete data
  const getCompletedMatchesFromLocalStorage = useCallback((leagueCode: string, upToMatchday?: number): Match[] => {
    const allMatches: Match[] = [];
    
    // Try to get matches from localStorage for matchdays 1-50 (covers most leagues)
    // If upToMatchday is provided, we could limit, but it's safer to get all and filter later
    const maxMatchday = upToMatchday || 50;
    
    for (let md = 1; md <= maxMatchday; md++) {
      try {
        const matchesKey = `${leagueCode}_md${md}_all`;
        const storedMatches = localStorage.getItem(matchesKey);
        
        if (storedMatches) {
          const parsedMatches = JSON.parse(storedMatches) as Match[];
          // Only include finished matches with scores AND valid matchday
          const completedMatches = parsedMatches.filter(match => {
            // Must have matchday set
            if (match.matchday === undefined || match.matchday === null) {
              return false;
            }
            // Must be finished with scores
            return match.status === 'FINISHED' &&
              match.score?.fullTime?.home !== null &&
              match.score?.fullTime?.away !== null;
          });
          allMatches.push(...completedMatches);
        }
      } catch (e) {
        // Silently continue - some matchdays might not exist in localStorage
      }
    }
    
    return allMatches;
  }, []);

  // Helper function to get predicted matches from localStorage up to a matchday
  const getPredictedMatchesUpToMatchday = useCallback((leagueCode: string, upToMatchday: number): Match[] => {
    const allMatches: Match[] = [];
    const savedPredictions = JSON.parse(localStorage.getItem(`predictions_${leagueCode}`) || '{}');
    
    // Get matches from localStorage for each matchday up to target
    for (let md = 1; md <= upToMatchday; md++) {
      try {
        const matchesKey = `${leagueCode}_md${md}_all`;
        const storedMatches = localStorage.getItem(matchesKey);
        
        if (storedMatches) {
          const parsedMatches = JSON.parse(storedMatches) as Match[];
          // Only include matches that have predictions
          const matchesWithPredictions = parsedMatches.filter(match => 
            savedPredictions[match.id] !== undefined
          );
          allMatches.push(...matchesWithPredictions);
        }
      } catch (e) {
        console.error(`Error getting predicted matches for matchday ${md}:`, e);
      }
    }
    
    return allMatches;
  }, []);

  const calculateTeamForms = useCallback((standingsData: Standing[], completedMatches: Match[], predictions?: Map<number, Prediction>) => {
    const forms = new Map<number, ('W' | 'D' | 'L')[]>();
    
    standingsData.forEach(standing => {
      const teamId = standing.team.id;
      
      // Get all matches for this team
      // IMPORTANT: completedMatches should already be filtered for finished matches with scores,
      // but we double-check here to ensure we only use valid matches
      const teamMatches = completedMatches
        .filter(match => {
          // Only include matches for this team
          const isTeamMatch = match.homeTeam.id === teamId || match.awayTeam.id === teamId;
          
          // For regular mode (no predictions), ensure match is finished with scores
          if (!predictions || predictions.size === 0) {
            return isTeamMatch &&
              match.status === 'FINISHED' &&
              match.score?.fullTime?.home !== null &&
              match.score?.fullTime?.away !== null;
          }
          
          // For forecast mode, include matches with predictions even if not finished
          return isTeamMatch;
        })
        .sort((a, b) => {
          // Sort by matchday first (descending), then by date (descending)
          // This ensures we get the most recent matches first
          const matchdayA = a.matchday ?? 0;
          const matchdayB = b.matchday ?? 0;
          if (matchdayA !== matchdayB) {
            return matchdayB - matchdayA; // Higher matchday first (most recent)
          }
          // If same matchday, sort by date (most recent first)
          return new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime();
        })
        .slice(0, 5); // Take last 5 results (most recent)
      
      // Debug: Log if team has fewer matches than expected
      if (process.env.NODE_ENV === 'development' && teamMatches.length < 5 && teamMatches.length > 0) {
        const matchdays = teamMatches.map(m => m.matchday).join(', ');
        console.log(`[Forms] ${standing.team.name}: Only ${teamMatches.length} matches found. Matchdays: [${matchdays}]`);
      }
      
      const form: ('W' | 'D' | 'L')[] = teamMatches.map(match => {
        // Priority: Use actual scores if match is finished and has scores
        if (match.status === 'FINISHED' && 
            match.score?.fullTime?.home !== null && 
            match.score?.fullTime?.away !== null &&
            match.score?.fullTime) {
          const isHome = match.homeTeam.id === teamId;
          const homeScore = match.score.fullTime.home ?? 0;
          const awayScore = match.score.fullTime.away ?? 0;
          
          if (isHome) {
            if (homeScore > awayScore) return 'W';
            if (homeScore < awayScore) return 'L';
            return 'D';
          } else {
            if (awayScore > homeScore) return 'W';
            if (awayScore < homeScore) return 'L';
            return 'D';
          }
        }
        
        // Fallback: Use prediction if available (for predicted matches)
        if (predictions && predictions.has(match.id)) {
          const prediction = predictions.get(match.id);
          if (prediction) {
            return getPredictionResult(prediction, teamId, match) || 'D';
          }
        }
        
        // Final fallback: draw if no score and no prediction
        return 'D';
      });
      
      forms.set(teamId, form);
    });
    
    return forms;
  }, [getPredictionResult]);

  // Convert fetchData to useCallback to fix the dependency warning
  const fetchData = useCallback(async () => {
    // Prevent duplicate concurrent fetches
    if (!selectedLeague) {
      return;
    }
    
    if (fetchingDataRef.current === selectedLeague) {
      // Already fetching for this league, skip
      return;
    }
    
    fetchingDataRef.current = selectedLeague;
    setLoading(true);
    setError(null);
    
    // Add a timeout to prevent infinite loading spinner
    const timeoutId = setTimeout(() => {
      setError('Request timed out. API may be rate limited. Please try again later.');
      setLoading(false);
      fetchingDataRef.current = null;
    }, 15000); // 15 seconds timeout
    
    try {
      // Make sure selectedLeague is not null
      if (!selectedLeague) {
        console.error("League not selected");
        clearTimeout(timeoutId);
        fetchingDataRef.current = null;
        return;
      }

      // Try to use cached data first
      const combinedCacheKey = selectedLeague;
      
      let standingsData: Standing[];
      let currentMatchdayData: number;
      let completedMatches: Match[] = [];
      
      if (standingsCache.current.has(combinedCacheKey) && matchdayCache.current.has(combinedCacheKey)) {
        // If both standings and current matchday are already cached, use them
        standingsData = standingsCache.current.get(combinedCacheKey)!;
        currentMatchdayData = matchdayCache.current.get(combinedCacheKey)!;
        
        // Update standings map for this league
        setStandingsByLeague(prev => ({
          ...prev,
          [selectedLeague]: standingsData
        }));
        if (predictedStandings.length === 0) {
          setCurrentMatchday(currentMatchdayData);
        }
        clearTimeout(timeoutId);
      } else {
        // Otherwise, use the combined endpoint to fetch both at once
        try {
          // Use the combined endpoint to get both standings and current matchday
          const leagueDataPromise = getLeagueData(selectedLeague);
          
          // Start fetching completed matches in parallel (we'll need matchday, but start early)
          // We'll get the matchday from leagueData, then fetch matches
          const { standings: fetchedStandings, currentMatchday: fetchedMatchday } = await leagueDataPromise;
          
          standingsData = fetchedStandings;
          currentMatchdayData = fetchedMatchday;
          
          // Cache the results
          standingsCache.current.set(combinedCacheKey, standingsData);
          matchdayCache.current.set(combinedCacheKey, currentMatchdayData);
          
          // Update standings map for this league
          setStandingsByLeague(prev => ({
            ...prev,
            [selectedLeague]: standingsData
          }));
          if (predictedStandings.length === 0) {
            setCurrentMatchday(currentMatchdayData);
          }
          clearTimeout(timeoutId);
        } catch (error: unknown) {
          const err = error as ApiError;
          console.error('Combined endpoint failed, falling back to separate requests:', err);
          
          // Check if rate limited (429)
          if (err.response?.status === 429) {
            clearTimeout(timeoutId);
            setError(`API rate limit reached: ${err.response?.data?.details || 'Too many requests. Please wait a moment and try again.'}`);
            return;
          }
          
          // Fallback to parallel individual requests
          let standingsPromise: Promise<Standing[]>;
          let currentMatchdayPromise: Promise<number>;
          
          // Get standings (from cache if available)
          if (standingsCache.current.has(combinedCacheKey)) {
            standingsPromise = Promise.resolve(standingsCache.current.get(combinedCacheKey)!);
          } else {
            standingsPromise = getStandings(selectedLeague);
          }
          
          // Get current matchday (from cache if available)
          if (matchdayCache.current.has(combinedCacheKey)) {
            currentMatchdayPromise = Promise.resolve(matchdayCache.current.get(combinedCacheKey)!);
          } else {
            currentMatchdayPromise = getCurrentMatchday(selectedLeague);
          }
          
          // Run both requests in parallel
          const [fetchedStandings, fetchedMatchday] = await Promise.all([
            standingsPromise,
            currentMatchdayPromise
          ]);
          
          standingsData = fetchedStandings;
          currentMatchdayData = fetchedMatchday;
          
          // Cache the results
          standingsCache.current.set(combinedCacheKey, standingsData);
          matchdayCache.current.set(combinedCacheKey, currentMatchdayData);
          
          // Update standings map for this league
          setStandingsByLeague(prev => ({
            ...prev,
            [selectedLeague]: standingsData
          }));
          if (predictedStandings.length === 0) {
            setCurrentMatchday(currentMatchdayData);
          }
          clearTimeout(timeoutId);
        }
      }
      
      // Determine which matchday to use for forms
      // If viewing historical matchday, use that; otherwise use current matchday
      const targetMatchday = selectedHistoricalMatchday || currentMatchdayData;
      
      // fetchData only handles regular mode (not forecast mode)
      // Forecast mode is handled by the separate useEffect
      // Skip form fetching in fetchData - let the useEffect handle it to avoid duplicate API calls
      // Just set loading to false so forms can be loaded by the useEffect
      setFormsLoading(false);
    } catch (error: unknown) {
      const err = error as ApiError;
      clearTimeout(timeoutId);
      console.error('Error fetching data:', err);
      
      // Better error handling with specific messages
      if (err.response?.status === 429) {
        setError('API rate limit reached. Please wait a moment and try again later.');
      } else if (err.response?.status === 404) {
        setError('League data not found. Please try another league.');
      } else if (err.response?.status && err.response.status >= 500) {
        setError('Football API server error. Please try again later.');
      } else {
        setError(err.response?.data?.error || err.response?.data?.details || 
                'Failed to fetch data. Please try again later.');
      }
    } finally {
      setLoading(false);
      fetchingDataRef.current = null;
    }
  }, [selectedLeague, predictedStandings.length, setCurrentMatchday, calculateTeamForms]);

  // Pre-fetch all leagues data on initial load (single API call)
  useEffect(() => {
    const prefetchAllLeagues = async () => {
      try {
        console.log('🚀 Pre-fetching all leagues data...');
        const allLeaguesData = await getAllLeaguesData();
        
        // Cache all leagues data for instant access when user selects a league
        Object.entries(allLeaguesData).forEach(([leagueCode, leagueData]) => {
          // Skip if no standings (likely an error)
          if (!leagueData.standings || leagueData.standings.length === 0) {
            console.warn(`⚠️ No standings data for ${leagueCode}`);
            return;
          }
          
          // Cache standings
          standingsCache.current.set(leagueCode, leagueData.standings);
          
          // Also update standings map for instant access
          setStandingsByLeague(prev => ({
            ...prev,
            [leagueCode]: leagueData.standings
          }));
          
          // Cache current matchday
          matchdayCache.current.set(leagueCode, leagueData.currentMatchday);
          
          // Cache ALL matches for this league (for forms and historical data)
          if (leagueData.matches && leagueData.matches.length > 0) {
            allMatchesCache.current.set(leagueCode, leagueData.matches);
            console.log(`✅ Pre-cached ${leagueCode}: ${leagueData.standings.length} teams, matchday ${leagueData.currentMatchday}, ${leagueData.matches.length} matches`);
          } else {
            console.log(`✅ Pre-cached ${leagueCode}: ${leagueData.standings.length} teams, matchday ${leagueData.currentMatchday}`);
          }
        });
        
        console.log('✅ All leagues pre-fetched and cached');
      } catch (error) {
        console.error('Error pre-fetching all leagues:', error);
        // Don't show error to user - individual league fetches will still work
      }
    };
    
    // Only prefetch once on mount
    prefetchAllLeagues();
  }, []); // Empty dependency array - run once on mount

  useEffect(() => {
    if (!selectedLeague) return;
    
    // Reset historical matchday when league changes
    setSelectedHistoricalMatchday(null);
    setHistoricalStandings([]);
    setIsDropdownOpen(false);
    setTeamForms(new Map());
    setFormsLoading(false);
    // Clear form fetching refs when league changes
    fetchingFormsRef.current.clear();
    
    fetchData();
  }, [selectedLeague, fetchData]);
  
  // Fetch forms when historical matchday changes or when viewing historical standings
  useEffect(() => {
    if (!selectedLeague || !standings.length) return;
    
    // Determine target matchday for forms
    // Priority: selectedHistoricalMatchday > viewingFromMatchday > currentMatchday
    let targetMatchday: number | null = null;
    let isForecastMode = false;
    
    if (selectedHistoricalMatchday) {
      // If viewing a historical matchday, use that
      targetMatchday = selectedHistoricalMatchday;
      // Check if we're in forecast mode (viewing predicted standings)
      isForecastMode = viewingFromMatchday !== null && predictedStandingsByMatchday.has(selectedHistoricalMatchday);
    } else if (viewingFromMatchday !== null) {
      // If in forecast mode, use viewingFromMatchday
      targetMatchday = viewingFromMatchday;
      isForecastMode = true;
    } else {
      // Otherwise use current matchday
      targetMatchday = currentMatchday;
      isForecastMode = false;
    }
    
    if (!targetMatchday) return;
    
    const formsCacheKey = `${selectedLeague}_${targetMatchday}_${isForecastMode ? 'forecast' : 'actual'}`;
    const cachedForms = getCachedForms(formsCacheKey);
    
    // For MD1, always recalculate to ensure we have forms for all teams
    // Don't use cached forms for MD1 to avoid incomplete form maps
    if (cachedForms && targetMatchday !== 1) {
      setTeamForms(cachedForms);
      setFormsLoading(false);
      return;
    }
    
    // Debug: Log when we're calculating forms for MD1
    if (targetMatchday === 1) {
      console.log(`[Forms] MD1: Calculating forms for ${selectedLeague} (bypassing cache)`);
    }
    
    // Check if already fetching
    if (fetchingFormsRef.current.get(formsCacheKey)) {
      return;
    }
    
    // Forecast mode: combine real completed matches with predicted matches
    if (isForecastMode) {
      fetchingFormsRef.current.set(formsCacheKey, true);
      setFormsLoading(true);
      
      // Helper function to calculate forecast forms with both real and predicted matches
      const calculateForecastForms = (realMatches: Match[]) => {
        try {
          // Get predicted matches up to target matchday
          const predictedMatches = getPredictedMatchesUpToMatchday(selectedLeague, targetMatchday);
          
          // Get predictions from localStorage
          const savedPredictions = JSON.parse(localStorage.getItem(`predictions_${selectedLeague}`) || '{}');
          const predictionsMap = new Map<number, Prediction>();
          Object.keys(savedPredictions).forEach(matchId => {
            predictionsMap.set(Number(matchId), savedPredictions[matchId]);
          });
          
          // Combine real completed matches with predicted matches
          // Real matches are up to currentMatchday, predicted matches are from currentMatchday+1 to targetMatchday
          const allMatches = [
            ...realMatches, // Real completed matches up to current matchday
            ...predictedMatches // Predicted matches from current matchday + 1 to target matchday
          ].filter(
            (match: Match) => match.matchday !== undefined && match.matchday <= targetMatchday
          );
          
          // Calculate forms from combined matches
          // calculateTeamForms will use actual scores for real matches and predictions for predicted matches
          const forms = calculateTeamForms(standings, allMatches, predictionsMap);
          setCachedForms(formsCacheKey, forms);
          setTeamForms(forms);
          setFormsLoading(false);
          fetchingFormsRef.current.delete(formsCacheKey);
        } catch (error) {
          console.error('Error calculating predicted team forms:', error);
          setFormsLoading(false);
          fetchingFormsRef.current.delete(formsCacheKey);
        }
      };
      
      // Get real completed matches up to current matchday
      const maxRealMatchday = Math.min(targetMatchday, currentMatchday);
      
      // Try cache first (from all_leagues prefetch)
      let allCompletedMatches = allCompletedMatchesCache.current.get(selectedLeague);
      
      if (!allCompletedMatches) {
        // Try to get from allMatchesCache and filter for completed matches
        const cachedMatches = getCachedMatches(selectedLeague);
        if (cachedMatches && cachedMatches.length > 0) {
          allCompletedMatches = getCompletedMatchesUpToMatchdayFromCache(selectedLeague, maxRealMatchday);
          // Also cache all completed matches for future use
          const allCompleted = cachedMatches.filter(
            (match: Match) =>
              match.status === 'FINISHED' &&
              match.score?.fullTime?.home !== null &&
              match.score?.fullTime?.away !== null
          );
          allCompletedMatchesCache.current.set(selectedLeague, allCompleted);
        }
      }
      
      if (allCompletedMatches && allCompletedMatches.length > 0) {
        // Filter real completed matches up to current matchday (only finished matches with scores)
        // CRITICAL: Ensure we only use finished matches with valid scores
        const realMatches = allCompletedMatches.filter(
          (match: Match) => 
            match.matchday !== undefined && 
            match.matchday <= maxRealMatchday &&
            match.status === 'FINISHED' &&
            match.score?.fullTime?.home !== null &&
            match.score?.fullTime?.away !== null &&
            match.score?.fullTime // Ensure score object exists
        );
        
        // Calculate forms with real + predicted matches
        calculateForecastForms(realMatches);
      } else {
        // Try localStorage first (no API call!)
        // Get all matches from localStorage, then filter by matchday later
        const localStorageMatches = getCompletedMatchesFromLocalStorage(selectedLeague);
        
        if (localStorageMatches.length > 0) {
          // Cache the matches from localStorage
          allCompletedMatchesCache.current.set(selectedLeague, localStorageMatches);
          
          // Filter only finished matches with scores
          const realMatches = localStorageMatches.filter(
            (match: Match) => 
              match.status === 'FINISHED' &&
              match.score?.fullTime?.home !== null &&
              match.score?.fullTime?.away !== null
          );
          
          // Calculate forms with real + predicted matches
          calculateForecastForms(realMatches);
        } else {
          // Only fetch from API as last resort (if no cache and no localStorage)
          getCompletedMatchesUpToMatchday(selectedLeague, maxRealMatchday)
            .then(fetchedMatches => {
              // Cache all completed matches for future use
              allCompletedMatchesCache.current.set(selectedLeague, fetchedMatches);
              
              // Filter only finished matches with scores
              const realMatches = fetchedMatches.filter(
                (match: Match) => 
                  match.status === 'FINISHED' &&
                  match.score?.fullTime?.home !== null &&
                  match.score?.fullTime?.away !== null
              );
              
              // Calculate forms with real + predicted matches
              calculateForecastForms(realMatches);
            })
            .catch(error => {
              console.error('Error fetching completed matches for forms:', error);
              // Continue with form calculation even if fetch fails (empty real matches)
              calculateForecastForms([]);
            });
        }
      }
      return;
    }
    
    // Regular mode: use completed matches
    // Priority order:
    // 1. Try localStorage first (most reliable - has all matchdays from previous sessions)
    // 2. Try allMatchesCache (from all_leagues prefetch - might not have all historical matchdays)
    // 3. Fallback to allCompletedMatchesCache
    
    // First, try localStorage (most complete source for historical matchdays)
    // Get ALL matches from localStorage (not just up to targetMatchday) to ensure completeness
    const localStorageMatches = getCompletedMatchesFromLocalStorage(selectedLeague);
    let allCompletedMatches: Match[] = [];
    
    if (localStorageMatches.length > 0) {
      // localStorage has matches - use it and cache for future use
      allCompletedMatches = localStorageMatches;
      allCompletedMatchesCache.current.set(selectedLeague, localStorageMatches);
      
      if (process.env.NODE_ENV === 'development') {
        const matchdayCounts = new Map<number, number>();
        localStorageMatches.forEach(m => {
          const md = m.matchday || 0;
          matchdayCounts.set(md, (matchdayCounts.get(md) || 0) + 1);
        });
        const matchdays = Array.from(matchdayCounts.keys()).sort((a, b) => a - b);
        console.log(`[Forms] ${selectedLeague}: Loaded ${localStorageMatches.length} matches from localStorage. Matchdays: ${matchdays.join(', ')}`);
      }
    } else {
      // localStorage doesn't have matches, try allMatchesCache
      const cachedAllMatches = getCachedMatches(selectedLeague);
      
      if (cachedAllMatches && cachedAllMatches.length > 0) {
        // Filter for completed matches only from the full match list
        // IMPORTANT: Only include matches that are finished AND have valid scores AND have a matchday
        allCompletedMatches = cachedAllMatches.filter(
          (match: Match) => {
            // Must have matchday set (critical for historical matchdays)
            if (match.matchday === undefined || match.matchday === null) {
              return false;
            }
            // Must be finished with scores
            return match.status === 'FINISHED' &&
              match.score?.fullTime?.home !== null &&
              match.score?.fullTime?.away !== null;
          }
        );
        // Update cache for future use
        allCompletedMatchesCache.current.set(selectedLeague, allCompletedMatches);
        
        // Debug: Log what we found
        if (process.env.NODE_ENV === 'development') {
          const matchdayCounts = new Map<number, number>();
          allCompletedMatches.forEach(m => {
            const md = m.matchday || 0;
            matchdayCounts.set(md, (matchdayCounts.get(md) || 0) + 1);
          });
          const matchdays = Array.from(matchdayCounts.keys()).sort((a, b) => a - b);
          console.log(`[Forms] ${selectedLeague}: Loaded ${allCompletedMatches.length} completed matches from allMatchesCache. Matchdays: ${matchdays.join(', ')}`);
        }
      } else {
        // Fallback to allCompletedMatchesCache if allMatchesCache doesn't have data
        allCompletedMatches = allCompletedMatchesCache.current.get(selectedLeague) || [];
      }
    }
    
    // Special handling for MD1: ALWAYS run first, even if allCompletedMatches is empty
    // This ensures MD1 forms work for all leagues
    if (targetMatchday === 1) {
      console.log(`[Forms] MD1: Processing MD1 forms for ${selectedLeague}`);
      console.log(`[Forms] MD1: allCompletedMatches.length = ${allCompletedMatches.length}`);
      
      const md1Matches = allCompletedMatches.filter(m => 
        m.matchday === 1 &&
        m.status === 'FINISHED' &&
        m.score?.fullTime?.home !== null &&
        m.score?.fullTime?.away !== null
      );

      console.log(`[Forms] MD1: Found ${md1Matches.length} finished MD1 matches in allCompletedMatches`);

      const manualForms = new Map<number, ('W' | 'D' | 'L')[]>();

      standings.forEach(standing => {
        const teamId = standing.team.id;

        // Find this team's MD1 match if it exists
        const teamMatch = md1Matches.find(m => 
          m.homeTeam.id === teamId || m.awayTeam.id === teamId
        );

        if (teamMatch && teamMatch.score?.fullTime) {
          const isHome = teamMatch.homeTeam.id === teamId;
          const homeScore = teamMatch.score.fullTime.home ?? 0;
          const awayScore = teamMatch.score.fullTime.away ?? 0;

          let result: 'W' | 'D' | 'L';
          if (isHome) {
            if (homeScore > awayScore) result = 'W';
            else if (homeScore < awayScore) result = 'L';
            else result = 'D';
          } else {
            if (awayScore > homeScore) result = 'W';
            else if (awayScore < homeScore) result = 'L';
            else result = 'D';
          }

          manualForms.set(teamId, [result]);
        } else {
          // No MD1 game for this team
          // Put an empty form array so StandingsTable does not think it is still loading
          manualForms.set(teamId, []);
        }
      });

      // Even if there were zero MD1 matches, we still set an empty forms map for all teams
      console.log(`[Forms] MD1: Built forms for ${manualForms.size} teams (some may have empty form)`);
      console.log(`[Forms] MD1: Setting teamForms and stopping loading`);

      setCachedForms(formsCacheKey, manualForms);
      setTeamForms(manualForms);
      setFormsLoading(false);
      return;
    }
    
    // For other matchdays (MD2+), use normal calculation
    if (allCompletedMatches.length > 0) {
      // Filter matches up to target matchday AND ensure they're finished with scores
      // This is critical for historical matchdays - we only want completed matches
      // IMPORTANT: Don't filter by status/score again here since allCompletedMatches already has that
      // Just filter by matchday to get matches up to the target matchday
      const completedMatchesUpToMatchday = allCompletedMatches.filter(
        (match: Match) => {
          // Ensure matchday is valid and within range
          const matchday = match.matchday;
          if (matchday === undefined || matchday === null) {
            return false; // Skip matches without matchday
          }
          return matchday <= targetMatchday;
        }
      );
      
      // Debug: Log match counts to help diagnose form issues
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Forms] ${selectedLeague} MD ${targetMatchday}: Found ${completedMatchesUpToMatchday.length} completed matches (from ${allCompletedMatches.length} total completed)`);
        // Log matchday distribution
        const matchdayCounts = new Map<number, number>();
        completedMatchesUpToMatchday.forEach(m => {
          const md = m.matchday || 0;
          matchdayCounts.set(md, (matchdayCounts.get(md) || 0) + 1);
        });
        console.log(`[Forms] Matchday distribution:`, Object.fromEntries(matchdayCounts));
      }
      
      // For other matchdays (MD2+), use normal calculation
      // If we have matches for the target matchday, calculate forms
      if (completedMatchesUpToMatchday.length > 0) {
        // Calculate forms from cached matches (no API call!)
        const forms = calculateTeamForms(standings, completedMatchesUpToMatchday);
        
        setCachedForms(formsCacheKey, forms);
        setTeamForms(forms);
        setFormsLoading(false);
        return;
      } else {
        // We have matches in cache, but none for the target matchday
        // This can happen if cache only has matches from later matchdays
        // For MD1, try to manually calculate from MD1 matches in cache
        if (targetMatchday === 1) {
          const md1Matches = allCompletedMatches.filter(m => m.matchday === 1 && 
            m.status === 'FINISHED' &&
            m.score?.fullTime?.home !== null &&
            m.score?.fullTime?.away !== null
          );
          
          if (md1Matches.length > 0) {
            console.log(`[Forms] MD1: Manually calculating forms from ${md1Matches.length} MD1 matches (from cache, no matches in filtered set)`);
            const manualForms = new Map<number, ('W' | 'D' | 'L')[]>();
            
            standings.forEach(standing => {
              const teamId = standing.team.id;
              // Find this team's MD1 match
              const teamMatch = md1Matches.find(m => 
                m.homeTeam.id === teamId || m.awayTeam.id === teamId
              );
              
              if (teamMatch && teamMatch.score?.fullTime) {
                const isHome = teamMatch.homeTeam.id === teamId;
                const homeScore = teamMatch.score.fullTime.home ?? 0;
                const awayScore = teamMatch.score.fullTime.away ?? 0;
                
                let result: 'W' | 'D' | 'L';
                if (isHome) {
                  if (homeScore > awayScore) result = 'W';
                  else if (homeScore < awayScore) result = 'L';
                  else result = 'D';
                } else {
                  if (awayScore > homeScore) result = 'W';
                  else if (awayScore < homeScore) result = 'L';
                  else result = 'D';
                }
                
                manualForms.set(teamId, [result]);
              }
            });
            
            if (manualForms.size > 0) {
              console.log(`[Forms] MD1: Manually calculated forms for ${manualForms.size} teams (from cache)`);
              setCachedForms(formsCacheKey, manualForms);
              setTeamForms(manualForms);
              setFormsLoading(false);
              return;
            }
          }
        }
        
        // Fall through to API fetch
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[Forms] ${selectedLeague} MD ${targetMatchday}: Cache has ${allCompletedMatches.length} matches but none for matchday ${targetMatchday}. Fetching from API...`);
        }
      }
    }
    
    // If we get here, either:
    // 1. No matches in cache/localStorage at all, OR
    // 2. Cache has matches but none for the target matchday
    // Fetch from API as fallback
    
    // Only fetch from API as last resort (if no cache and no localStorage, or cache doesn't have target matchday)
    fetchingFormsRef.current.set(formsCacheKey, true);
    setFormsLoading(true);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Forms] ${selectedLeague} MD ${targetMatchday}: Fetching from API (cache miss or no matches for target matchday)`);
    }
    
    getCompletedMatchesUpToMatchday(selectedLeague, targetMatchday)
      .then(completedMatches => {
        // Cache all completed matches for future use
        allCompletedMatchesCache.current.set(selectedLeague, completedMatches);
        
        // Ensure we only use finished matches with scores (API should return these, but double-check)
        const validMatches = completedMatches.filter(
          (match: Match) =>
            match.status === 'FINISHED' &&
            match.score?.fullTime?.home !== null &&
            match.score?.fullTime?.away !== null &&
            match.matchday !== undefined &&
            match.matchday !== null &&
            match.matchday <= targetMatchday
        );
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Forms] ${selectedLeague} MD ${targetMatchday}: Fetched ${completedMatches.length} matches from API, ${validMatches.length} valid for form calculation`);
          if (targetMatchday === 1) {
            const md1Matches = validMatches.filter(m => m.matchday === 1);
            console.log(`[Forms] MD1: ${md1Matches.length} matches with matchday === 1 from API`);
          }
        }
        
        // Special handling for MD1: always build a complete forms map from API data
        if (targetMatchday === 1) {
          const md1Matches = validMatches.filter(m => 
            m.matchday === 1 &&
            m.status === 'FINISHED' &&
            m.score?.fullTime?.home !== null &&
            m.score?.fullTime?.away !== null
          );

          console.log(`[Forms] MD1: ${md1Matches.length} matches with matchday === 1 from API`);

          const manualForms = new Map<number, ('W' | 'D' | 'L')[]>();

          standings.forEach(standing => {
            const teamId = standing.team.id;
            const teamMatch = md1Matches.find(m => 
              m.homeTeam.id === teamId || m.awayTeam.id === teamId
            );

            if (teamMatch && teamMatch.score?.fullTime) {
              const isHome = teamMatch.homeTeam.id === teamId;
              const homeScore = teamMatch.score.fullTime.home ?? 0;
              const awayScore = teamMatch.score.fullTime.away ?? 0;

              let result: 'W' | 'D' | 'L';
              if (isHome) {
                if (homeScore > awayScore) result = 'W';
                else if (homeScore < awayScore) result = 'L';
                else result = 'D';
              } else {
                if (awayScore > homeScore) result = 'W';
                else if (awayScore < homeScore) result = 'L';
                else result = 'D';
              }

              manualForms.set(teamId, [result]);
            } else {
              // Team has no MD1 match in API data
              manualForms.set(teamId, []);
            }
          });

          console.log(`[Forms] MD1: Built forms for ${manualForms.size} teams from API data`);

          setCachedForms(formsCacheKey, manualForms);
          setTeamForms(manualForms);
          setFormsLoading(false);
          fetchingFormsRef.current.delete(formsCacheKey);
          return;
        }
        
        // For other matchdays (MD2+), use normal calculation
        const forms = calculateTeamForms(standings, validMatches);
        setCachedForms(formsCacheKey, forms);
        setTeamForms(forms);
        setFormsLoading(false);
        fetchingFormsRef.current.delete(formsCacheKey);
      })
      .catch(error => {
        console.error('Error fetching team forms for historical matchday:', error);
        setFormsLoading(false);
        fetchingFormsRef.current.delete(formsCacheKey);
        // Try fallback from previous matchdays
        for (let md = targetMatchday - 1; md >= 1; md--) {
          const fallbackKey = `${selectedLeague}_${md}_actual`;
          const fallbackForms = getCachedForms(fallbackKey);
          if (fallbackForms) {
            setTeamForms(fallbackForms);
            break;
          }
        }
      });
  }, [selectedLeague, standings, currentMatchday, selectedHistoricalMatchday, viewingFromMatchday, predictedStandingsByMatchday, calculateTeamForms, getPredictedMatchesUpToMatchday, getCompletedMatchesFromLocalStorage]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isDropdownOpen && !target.closest('.historical-dropdown-container')) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleStartPredictions = async () => {
    if (!selectedLeague) return;
    
    // Reset all race mode settings when starting predictions
    setIsRaceMode(false);
    setSelectedTeamIds([]);
    
    // Clear the initialFetchDone flag for this league
    localStorage.removeItem(`${selectedLeague}_initialFetchDone`);
    
    // Clear any saved prediction state for a clean start
    localStorage.removeItem('predictionState');
    
    setLoading(true);
    setError(null);
    
    // Add a timeout to prevent infinite loading spinner
    const timeoutId = setTimeout(() => {
      setError('Request timed out. API may be rate limited. Please try again later.');
      setLoading(false);
    }, 15000); // 15 seconds timeout
    
    try {
      // Use cache when possible
      const matchdayCacheKey = selectedLeague;
      
      // Get current matchday (from cache if available)
      let currentMatchdayPromise: Promise<number>;
      if (matchdayCache.current.has(matchdayCacheKey)) {
        currentMatchdayPromise = Promise.resolve(matchdayCache.current.get(matchdayCacheKey)!);
      } else {
        currentMatchdayPromise = getCurrentMatchday(selectedLeague);
      }
      
      // Resolve the current matchday
      const currentMatchdayData = await currentMatchdayPromise;
      
      // Cache the current matchday if needed
      if (!matchdayCache.current.has(matchdayCacheKey)) {
        matchdayCache.current.set(matchdayCacheKey, currentMatchdayData);
      }
      
      // Check if there are matches for this matchday
      const matchesCacheKey = `${selectedLeague}_md${currentMatchdayData}`;
      let matchesPromise: Promise<Match[]>;
      
      if (matchesCache.current.has(matchesCacheKey)) {
        matchesPromise = Promise.resolve(matchesCache.current.get(matchesCacheKey)!);
      } else {
        matchesPromise = getMatches(selectedLeague, currentMatchdayData);
      }
      
      // Resolve the matches
      let matches = await matchesPromise;
      
      // Cache the matches if needed
      if (!matchesCache.current.has(matchesCacheKey)) {
        matchesCache.current.set(matchesCacheKey, matches);
      }
      
      // If no matches found for the current matchday, find a matchday with matches
      let targetMatchday = currentMatchdayData;
      
      if (matches.length === 0) {
        // Try just a few matchdays (most likely to have matches) - limit API calls
        const matchdaysToCheck = [
          currentMatchdayData + 1,
          currentMatchdayData + 2,
          currentMatchdayData - 1,
          currentMatchdayData - 2
        ].filter(md => md >= 1 && md <= getMaxMatchday(selectedLeague));
        
        // Try to get from allMatchesCache first (from all_leagues prefetch)
        const cachedAllMatches = getCachedMatches(selectedLeague);
        
        // Create an array of promises for all matchdays to check
        const matchPromises = matchdaysToCheck.map(async (md) => {
          if (cachedAllMatches && cachedAllMatches.length > 0) {
            // Filter from cached matches
            const mdMatches = cachedAllMatches.filter((m: Match) => m.matchday === md);
            return { md, matches: mdMatches };
          } else {
            // Fallback: use per-matchday cache or fetch from API
            const mdCacheKey = `${selectedLeague}_md${md}`;
            if (matchesCache.current.has(mdCacheKey)) {
              return { md, matches: matchesCache.current.get(mdCacheKey)! };
            } else {
              const mdMatches = await getMatches(selectedLeague, md);
              matchesCache.current.set(mdCacheKey, mdMatches);
              return { md, matches: mdMatches };
            }
          }
        });
        
        // Run all matchday checks in parallel
        const results = await Promise.all(matchPromises);
        
        // Find the first matchday that has matches
        const matchdayWithMatches = results.find(result => result.matches.length > 0);
        if (matchdayWithMatches) {
          targetMatchday = matchdayWithMatches.md;
          matches = matchdayWithMatches.matches;
        }
      }
      
      resetPredictions();
      setCurrentMatchday(targetMatchday);
      setInitialMatches(matches);
      
      // Show mode selection directly, without setTimeout
      setShowModeSelection(true);
      setShowPredictions(false);
      
      clearTimeout(timeoutId);
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      console.error('Error fetching initial data:', error);
      const err = error as ApiError;
      
      if (err.response?.status === 429) {
        setError('API rate limit reached. Please wait a moment and try again later.');
      } else if (err.response?.status === 404) {
        setError('League data not found. Please try another league.');
      } else {
        setError(err.message || 'Failed to fetch league data. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleModeSelect = (
    mode: 'normal' | 'race', 
    selectedTeams?: number[], 
    unfilteredMatchesMode?: 'auto' | 'draws',
    tableDisplayMode?: 'mini' | 'full'
  ) => {
    console.log(`Mode selected: ${mode}`);
    
    if (mode === 'normal') {
      console.log("Setting Classic Mode - resetting race mode settings");
      setIsRaceMode(false);
      setSelectedTeamIds([]);
      // Ensure unfiltered mode is reset too
      setUnfilteredMatchesMode('auto');
      // Reset table display mode
      setTableDisplayMode('mini');
      
      // Force clear any problematic storage that might be affecting filtering
      localStorage.removeItem(`${selectedLeague}_initialFetchDone`);
      console.log("Classic Mode: Cleared initialFetchDone flag to ensure fresh data load");
    } else if (mode === 'race' && selectedTeams && selectedTeams.length > 0) {
      console.log(`Setting Race Mode with ${selectedTeams.length} teams selected`);
      setIsRaceMode(true);
      setSelectedTeamIds(selectedTeams);
      if (unfilteredMatchesMode) {
        console.log(`Setting unfiltered matches mode to: ${unfilteredMatchesMode}`);
        setUnfilteredMatchesMode(unfilteredMatchesMode);
      }
      if (tableDisplayMode) {
        console.log(`Setting table display mode to: ${tableDisplayMode}`);
        setTableDisplayMode(tableDisplayMode);
      }
    }
    
    setShowPredictions(true);
    setShowModeSelection(false);
  };

  // Function to collect completed matches for the prediction summary
  const collectCompletedMatches = useCallback(() => {
    if (!selectedLeague) return;
    
    // Get completed match IDs from localStorage
    const completedMatchesData = JSON.parse(localStorage.getItem('completedMatches') || '{}');
    const completedIds = completedMatchesData[selectedLeague] || [];
    
    if (completedIds.length === 0) {
      console.log("No completed matches found for this league");
      return;
    }
    
    // Get all completed matchdays from localStorage
    const completedMatchdays = JSON.parse(localStorage.getItem('completedMatchdays') || '{}');
    const matchdaysList = completedMatchdays[selectedLeague] || [];
    
    console.log("Completed matchdays from localStorage:", matchdaysList);
    
    if (matchdaysList.length === 0) {
      console.log("No completed matchdays found in localStorage");
    }

    // We'll collect matches from each matchday
    const allMatches: Match[] = [];
    const predictionsMap = new Map();
    
    // Try to get saved predictions from localStorage
    const savedPredictions = JSON.parse(localStorage.getItem(`predictions_${selectedLeague}`) || '{}');
    console.log("Saved predictions:", savedPredictions);
    
    // For each completed matchday, try to find the matches in the cache
    matchdaysList.forEach((matchday: number) => {
      console.log(`Looking for matches in matchday ${matchday}`);
      
      // Try the standard string format for cache key
      const cacheKey = `${selectedLeague}_md${matchday}`;
      
      if (matchesCache.current.has(cacheKey)) {
        console.log(`Found matches using cache key: ${cacheKey}`);
        
        const matchdayMatches = matchesCache.current.get(cacheKey)!;
        
        // Only include matches that are in completedIds
        const filteredMatches = matchdayMatches.filter(m => completedIds.includes(m.id));
        console.log(`Found ${filteredMatches.length} completed matches for matchday ${matchday}`);
        
        // Make sure matchday property is set correctly
        filteredMatches.forEach(match => {
          // Always set matchday explicitly
          match.matchday = matchday;
          
          // Apply the saved prediction if available
          const savedPrediction = savedPredictions[match.id];
          if (savedPrediction) {
            predictionsMap.set(match.id, savedPrediction);
          } else {
            // Fallback to default prediction if no saved prediction found
            predictionsMap.set(match.id, {
              matchId: match.id,
              type: 'home' // Default to home win instead of draw
            });
          }
        });
        
        // Add to all matches
        allMatches.push(...filteredMatches);
      } else {
        console.log(`No matches found in cache for matchday ${matchday}`);
        
        // If we don't have matches in the cache, try to get them from localStorage
        try {
          const storedMatches = localStorage.getItem(`${selectedLeague}_md${matchday}_all`);
          
          if (storedMatches) {
            console.log(`Found matches in localStorage for matchday ${matchday}`);
            const parsedMatches = JSON.parse(storedMatches) as Match[];
            
            // Only include matches that are in completedIds
            const filteredMatches = parsedMatches.filter(m => completedIds.includes(m.id));
            console.log(`Found ${filteredMatches.length} completed matches from localStorage for matchday ${matchday}`);
            
            // Make sure matchday property is set correctly
            filteredMatches.forEach(match => {
              // Always set matchday explicitly
              match.matchday = matchday;
              
              // Apply the saved prediction if available
              const savedPrediction = savedPredictions[match.id];
              if (savedPrediction) {
                predictionsMap.set(match.id, savedPrediction);
              } else {
                // Fallback to default prediction if no saved prediction found
                predictionsMap.set(match.id, {
                  matchId: match.id,
                  type: 'home' // Default to home win instead of draw
                });
              }
            });
            
            // Add to all matches
            allMatches.push(...filteredMatches);
          }
        } catch (e) {
          console.error(`Error retrieving matches from localStorage for matchday ${matchday}:`, e);
        }
      }
    });
    
    console.log(`Collected ${allMatches.length} matches across ${new Set(allMatches.map(m => m.matchday)).size} matchdays`);
    console.log("Matchdays in collected matches:", [...new Set(allMatches.map(m => m.matchday))]);
    
    // Set the collected matches and predictions
    setCompletedMatches(allMatches);
    setMatchPredictions(predictionsMap);
  }, [selectedLeague, maxMatchday]);

  // Handle showing prediction summary
  const handleShowPredictionSummary = useCallback(() => {
    collectCompletedMatches();
    setShowPredictionSummary(true);
  }, [collectCompletedMatches]);



  if (error) {
    return (
      <div className="min-h-screen p-8 bg-background flex items-center justify-center">
        <div className="max-w-7xl mx-auto">
          <div className="bg-card rounded-lg p-8 text-center shadow-lg border border-red-500/20">
            <div className="mb-6 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-red-400 mb-4">Error Encountered</h3>
            <p className="mt-2 text-secondary text-lg mb-6">{error}</p>
            <div className="flex justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-accent text-white rounded-full hover:bg-accent-hover transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedLeague) {
    // Format the current date as DD/MM/YYYY
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    
    return (
      <main className="min-h-screen bg-background overflow-x-hidden overflow-y-hidden md:overflow-y-auto">
        <div className="w-full sm:max-w-7xl sm:mx-auto px-1 sm:px-8 pt-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-primary mb-4">League Caster</h1>
            <p className="text-large text-secondary">Select a league to view standings and start forecasting</p>
          </div>
        </div>
        <div className="w-full">
          <LeagueSelector onLeagueSelect={setSelectedLeague} />
        </div>
        <div className="w-full sm:max-w-7xl sm:mx-auto px-1 sm:px-8">
          <div className="text-center mt-6 sm:mt-4 text-white font-medium text-lg">
            Season 2025/2026
            <div className="mt-1 text-xs text-gray-400">Last Updated: {formattedDate}</div>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-background flex items-center justify-center">
        <div className="max-w-7xl mx-auto">
          <div className="bg-card rounded-lg p-6">
            <div className="hourglassBackground">
              <div className="hourglassContainer">
                <div className="hourglassCurves"></div>
                <div className="hourglassCapTop"></div>
                <div className="hourglassGlassTop"></div>
                <div className="hourglassSand"></div>
                <div className="hourglassSandStream"></div>
                <div className="hourglassCapBottom"></div>
                <div className="hourglassGlass"></div>
              </div>
            </div>
            <style jsx>{`
              .hourglassBackground {
                position: relative;
                background-color: rgb(71, 60, 60);
                height: 130px;
                width: 130px;
                border-radius: 50%;
                margin: 30px auto;
              }

              .hourglassContainer {
                position: absolute;
                top: 30px;
                left: 40px;
                width: 50px;
                height: 70px;
                -webkit-animation: hourglassRotate 2s ease-in 0s infinite;
                animation: hourglassRotate 2s ease-in 0s infinite;
                transform-style: preserve-3d;
                perspective: 1000px;
              }

              .hourglassContainer div,
              .hourglassContainer div:before,
              .hourglassContainer div:after {
                transform-style: preserve-3d;
              }

              @-webkit-keyframes hourglassRotate {
                0% {
                  transform: rotateX(0deg);
                }

                50% {
                  transform: rotateX(180deg);
                }

                100% {
                  transform: rotateX(180deg);
                }
              }

              @keyframes hourglassRotate {
                0% {
                  transform: rotateX(0deg);
                }

                50% {
                  transform: rotateX(180deg);
                }

                100% {
                  transform: rotateX(180deg);
                }
              }

              .hourglassCapTop {
                top: 0;
              }

              .hourglassCapTop:before {
                top: -25px;
              }

              .hourglassCapTop:after {
                top: -20px;
              }

              .hourglassCapBottom {
                bottom: 0;
              }

              .hourglassCapBottom:before {
                bottom: -25px;
              }

              .hourglassCapBottom:after {
                bottom: -20px;
              }

              .hourglassGlassTop {
                transform: rotateX(90deg);
                position: absolute;
                top: -16px;
                left: 3px;
                border-radius: 50%;
                width: 44px;
                height: 44px;
                background-color: #999999;
              }

              .hourglassGlass {
                perspective: 100px;
                position: absolute;
                top: 32px;
                left: 20px;
                width: 10px;
                height: 6px;
                background-color: #999999;
                opacity: 0.5;
              }

              .hourglassGlass:before,
              .hourglassGlass:after {
                content: '';
                display: block;
                position: absolute;
                background-color: #999999;
                left: -17px;
                width: 44px;
                height: 28px;
              }

              .hourglassGlass:before {
                top: -27px;
                border-radius: 0 0 25px 25px;
              }

              .hourglassGlass:after {
                bottom: -27px;
                border-radius: 25px 25px 0 0;
              }

              .hourglassCurves:before,
              .hourglassCurves:after {
                content: '';
                display: block;
                position: absolute;
                top: 32px;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: #333;
                animation: hideCurves 2s ease-in 0s infinite;
              }

              .hourglassCurves:before {
                left: 15px;
              }

              .hourglassCurves:after {
                left: 29px;
              }

              @-webkit-keyframes hideCurves {
                0% {
                  opacity: 1;
                }

                25% {
                  opacity: 0;
                }

                30% {
                  opacity: 0;
                }

                40% {
                  opacity: 1;
                }

                100% {
                  opacity: 1;
                }
              }

              @keyframes hideCurves {
                0% {
                  opacity: 1;
                }

                25% {
                  opacity: 0;
                }

                30% {
                  opacity: 0;
                }

                40% {
                  opacity: 1;
                }

                100% {
                  opacity: 1;
                }
              }

              .hourglassSandStream:before {
                content: '';
                display: block;
                position: absolute;
                left: 24px;
                width: 3px;
                background-color: white;
                -webkit-animation: sandStream1 2s ease-in 0s infinite;
                animation: sandStream1 2s ease-in 0s infinite;
              }

              .hourglassSandStream:after {
                content: '';
                display: block;
                position: absolute;
                top: 36px;
                left: 19px;
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-bottom: 6px solid #fff;
                animation: sandStream2 2s ease-in 0s infinite;
              }

              @-webkit-keyframes sandStream1 {
                0% {
                  height: 0;
                  top: 35px;
                }

                50% {
                  height: 0;
                  top: 45px;
                }

                60% {
                  height: 35px;
                  top: 8px;
                }

                85% {
                  height: 35px;
                  top: 8px;
                }

                100% {
                  height: 0;
                  top: 8px;
                }
              }

              @keyframes sandStream1 {
                0% {
                  height: 0;
                  top: 35px;
                }

                50% {
                  height: 0;
                  top: 45px;
                }

                60% {
                  height: 35px;
                  top: 8px;
                }

                85% {
                  height: 35px;
                  top: 8px;
                }

                100% {
                  height: 0;
                  top: 8px;
                }
              }

              @-webkit-keyframes sandStream2 {
                0% {
                  opacity: 0;
                }

                50% {
                  opacity: 0;
                }

                51% {
                  opacity: 1;
                }

                90% {
                  opacity: 1;
                }

                91% {
                  opacity: 0;
                }

                100% {
                  opacity: 0;
                }
              }

              @keyframes sandStream2 {
                0% {
                  opacity: 0;
                }

                50% {
                  opacity: 0;
                }

                51% {
                  opacity: 1;
                }

                90% {
                  opacity: 1;
                }

                91% {
                  opacity: 0;
                }

                100% {
                  opacity: 0;
                }
              }

              .hourglassSand:before,
              .hourglassSand:after {
                content: '';
                display: block;
                position: absolute;
                left: 6px;
                background-color: white;
                perspective: 500px;
              }

              .hourglassSand:before {
                top: 8px;
                width: 39px;
                border-radius: 3px 3px 30px 30px;
                animation: sandFillup 2s ease-in 0s infinite;
              }

              .hourglassSand:after {
                border-radius: 30px 30px 3px 3px;
                animation: sandDeplete 2s ease-in 0s infinite;
              }

              @-webkit-keyframes sandFillup {
                0% {
                  opacity: 0;
                  height: 0;
                }

                60% {
                  opacity: 1;
                  height: 0;
                }

                100% {
                  opacity: 1;
                  height: 17px;
                }
              }

              @keyframes sandFillup {
                0% {
                  opacity: 0;
                  height: 0;
                }

                60% {
                  opacity: 1;
                  height: 0;
                }

                100% {
                  opacity: 1;
                  height: 17px;
                }
              }

              @-webkit-keyframes sandDeplete {
                0% {
                  opacity: 0;
                  top: 45px;
                  height: 17px;
                  width: 38px;
                  left: 6px;
                }

                1% {
                  opacity: 1;
                  top: 45px;
                  height: 17px;
                  width: 38px;
                  left: 6px;
                }

                24% {
                  opacity: 1;
                  top: 45px;
                  height: 17px;
                  width: 38px;
                  left: 6px;
                }

                25% {
                  opacity: 1;
                  top: 41px;
                  height: 17px;
                  width: 38px;
                  left: 6px;
                }

                50% {
                  opacity: 1;
                  top: 41px;
                  height: 17px;
                  width: 38px;
                  left: 6px;
                }

                90% {
                  opacity: 1;
                  top: 41px;
                  height: 0;
                  width: 10px;
                  left: 20px;
                }
              }

              @keyframes sandDeplete {
                0% {
                  opacity: 0;
                  top: 45px;
                  height: 17px;
                  width: 38px;
                  left: 6px;
                }

                1% {
                  opacity: 1;
                  top: 45px;
                  height: 17px;
                  width: 38px;
                  left: 6px;
                }

                24% {
                  opacity: 1;
                  top: 45px;
                  height: 17px;
                  width: 38px;
                  left: 6px;
                }

                25% {
                  opacity: 1;
                  top: 41px;
                  height: 17px;
                  width: 38px;
                  left: 6px;
                }

                50% {
                  opacity: 1;
                  top: 41px;
                  height: 17px;
                  width: 38px;
                  left: 6px;
                }

                90% {
                  opacity: 1;
                  top: 41px;
                  height: 0;
                  width: 10px;
                  left: 20px;
                }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full pt-6 pb-1 sm:p-8 bg-background overflow-x-hidden overflow-y-hidden md:overflow-y-auto">
      <div className="w-full sm:max-w-7xl sm:mx-auto px-1 sm:px-0">
        <div className="flex justify-between items-center mb-8">
          <div className="ml-6 sm:ml-0">
            <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold text-primary">
              {selectedLeague && (
                (() => {
                  const league = LEAGUES.find(l => l.code === selectedLeague);
                  if (!league) return null;
                  return (
                    <div className="flex items-center gap-2 sm:gap-4">
                      <Image
                        src={league.image}
                        alt={league.name}
                        width={92}
                        height={92}
                        className="w-12 h-12 xs:w-15 xs:h-15 sm:w-19 sm:h-19 md:w-23 md:h-23 object-contain"
                        style={{ maxWidth: '3.5rem', maxHeight: '3.5rem' }} 
                      />
                      <span className={`${isMobileLConstrainedView ? 'text-2xl' : 'text-lg xs:text-xl'} sm:text-2xl md:text-3xl font-bold text-primary`}>{league.name}</span>
                    </div>
                  );
                })()
              )}
            </h1>
            <button
              onClick={() => {
                // Clear the initialFetchDone flags for all leagues
                ['PL', 'BL1', 'FL1', 'SA', 'PD', 'CL'].forEach(league => {
                  localStorage.removeItem(`${league}_initialFetchDone`);
                });
                setSelectedLeague(null);
                setShowPredictions(false);
                setShowModeSelection(false);
                setIsViewingStandings(false);
                setViewingFromMatchday(null);
                setSelectedHistoricalMatchday(null);
                setHistoricalStandings([]);
                // Reset race mode when returning to league selection
                resetPredictions();
              }}
              className="mt-1 text-xs xs:text-sm text-accent hover:text-accent-hover transition-transform hover:scale-105"
            >
              ← Back to leagues
            </button>
          </div>
        </div>

        {(!showPredictions && !showModeSelection) || isViewingStandings ? (
          <div className="bg-card rounded-lg p-2 sm:p-6 my-6 sm:my-10 ml-1 mr-1 sm:ml-0">
            <div className="mb-2 sm:mb-4">
              <div className="flex flex-row justify-between items-center mb-2 sm:mb-4 gap-2 sm:gap-4 relative">
                <div className="flex items-center gap-2 sm:gap-3">
                <h2
                  className={
                      `text-base sm:text-xl font-semibold sm:font-bold text-primary flex items-center gap-2 sm:gap-3 mb-2 sm:mb-0`
                  }
                >
                  {isViewingStandings || viewingFromMatchday 
                    ? (
                            /* Dropdown for forecast mode */
                            currentMatchday > 1 && (
                              <div className="flex items-center gap-2">
                                <div className={`flex flex-col sm:flex-row items-center ${selectedHistoricalMatchday === null ? 'justify-center sm:justify-start sm:gap-4 min-h-[44px] sm:min-h-0' : 'gap-3 sm:gap-4 justify-start'}`}>
                                  <div className="relative inline-block group historical-dropdown-container">
                                    <button
                                      type="button"
                                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                      disabled={loadingHistorical || loading}
                                      className="appearance-none bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full px-3 sm:px-4 text-xs sm:text-sm font-semibold cursor-pointer hover:bg-[#f7e479] hover:text-black transition-all duration-300 focus:outline-none focus:bg-[#f7e479] focus:text-black pr-6 sm:pr-8 w-[160px] sm:w-[180px] h-[28px] sm:h-[36px] flex items-center justify-center"
                                    >
                                    {(() => {
                                      if (selectedHistoricalMatchday) {
                                        return `Matchday ${selectedHistoricalMatchday}`;
                                      }
                                      // Use single source of truth
                                      const forecastEndMd = computeForecastEndMd();
                                      return `Matchday ${forecastEndMd}`;
                                    })()}
                                  </button>
                                  {isDropdownOpen && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-card rounded-lg shadow-lg z-50 w-[140px] overflow-y-auto max-h-[252px]" style={{ border: '2px solid #f7e479' }}>
                                      {selectedHistoricalMatchday !== null && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleHistoricalMatchdayChange(null);
                                            setIsDropdownOpen(false);
                                          }}
                                          className="w-full text-center px-3 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap text-primary hover:bg-[#f7e479] group/item"
                                          onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
                                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                                        >
                                          Matchday {viewingFromMatchday || currentMatchday}
                                        </button>
                                      )}
                                      {(() => {
                                        // In forecast mode, show all matchdays from 1 to forecastEndMd
                                        if (viewingFromMatchday !== null) {
                                          // Use single source of truth
                                          const forecastEndMd = computeForecastEndMd();
                                          
                                          // Show all matchdays from 1 to forecastEndMd, excluding the current viewingFromMatchday
                                          const allMatchdays = Array.from({ length: forecastEndMd }, (_, i) => i + 1)
                                            .filter(md => {
                                              // Exclude the current viewing matchday
                                              if (viewingFromMatchday !== null && Number(md) === Number(viewingFromMatchday)) {
                                                return false;
                                              }
                                              // Exclude the currently selected historical matchday (if any)
                                              if (selectedHistoricalMatchday !== null && Number(md) === Number(selectedHistoricalMatchday)) {
                                                return false;
                                              }
                                              return true;
                                            });
                                          
                                          return allMatchdays.map((md) => (
                                            <button
                                              key={md}
                                              type="button"
                                              onClick={() => {
                                                handleHistoricalMatchdayChange(md);
                                                setIsDropdownOpen(false);
                                              }}
                                              className="w-full text-center px-3 py-2 text-xs sm:text-sm font-semibold transition-colors text-primary hover:bg-[#f7e479]"
                                              onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
                                              onMouseLeave={(e) => e.currentTarget.style.color = ''}
                                            >
                                              Matchday {md}
                                            </button>
                                          ));
                                        }
                                        
                                        // Regular mode: show historical matchdays before currentMatchday
                                        return Array.from({ length: Math.max(0, currentMatchday - 1) }, (_, i) => i + 1)
                                          .filter((md) => md !== selectedHistoricalMatchday && md < currentMatchday)
                                          .map((md) => (
                                            <button
                                              key={md}
                                              type="button"
                                              onClick={() => {
                                                handleHistoricalMatchdayChange(md);
                                                setIsDropdownOpen(false);
                                              }}
                                              className="w-full text-center px-3 py-2 text-xs sm:text-sm font-semibold transition-colors text-primary hover:bg-[#f7e479]"
                                              onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
                                              onMouseLeave={(e) => e.currentTarget.style.color = ''}
                                            >
                                              Matchday {md}
                                            </button>
                                          ));
                                      })()}
                                    </div>
                                  )}
                                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3">
                                    <svg className={`h-3 w-3 sm:h-4 sm:w-4 transition-colors duration-300 ${isDropdownOpen ? 'text-black' : 'text-[#f7e479]'} group-hover:text-black`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </div>
                                {/* Compare checkbox - always render to prevent layout shift, hide when not needed */}
                                <label className={`flex items-center cursor-pointer transition-all duration-300 ${selectedHistoricalMatchday === null ? 'opacity-0 pointer-events-none h-0 overflow-hidden m-0 p-0' : ''}`}>
                                  <div className="flex items-center border border-[#f7e479] rounded">
                                    <input
                                      type="checkbox"
                                      checked={isComparing}
                                      onChange={(e) => setIsComparing(e.target.checked)}
                                      disabled={selectedHistoricalMatchday === null}
                                      className="h-4 w-4 border-r border-[#f7e479] rounded-l cursor-pointer appearance-none focus:ring-1 focus:ring-[#f7e479] relative flex-shrink-0"
                                      style={{
                                        backgroundColor: isComparing ? '#f7e479' : 'var(--card-bg)',
                                        backgroundImage: isComparing ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23000000\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M5 13l4 4L19 7\'/%3E%3C/svg%3E")' : 'none',
                                        backgroundSize: '70%',
                                        backgroundPosition: 'center',
                                        backgroundRepeat: 'no-repeat',
                                        padding: '0',
                                        boxSizing: 'border-box'
                                      }}
                                    />
                                    <div 
                                      className="h-4 px-1.5 flex items-center rounded-r bg-card"
                                    >
                                      <span className="text-[10px] font-medium whitespace-nowrap leading-none text-[#f7e479]">
                                        {(() => {
                                          // In forecast mode, never use "today"
                                          if (viewingFromMatchday !== null) {
                                            // Use single source of truth
                                            const forecastEndMd = computeForecastEndMd();
                                            return `Compare to MD ${forecastEndMd}`;
                                          }
                                          // ONLY in regular mode (viewingFromMatchday === null): show "Compare To Today"
                                          return 'Compare To Today';
                                        })()}
                          </span>
                                    </div>
                                  </div>
                                </label>
                              </div>
                            </div>
                            )
                        )
                    : (
                        <>
                            {/* Integrated dropdown styled like Start Forecasting button */}
                            {!isViewingStandings && !viewingFromMatchday && currentMatchday > 1 && (
                              <div className={`flex flex-col sm:flex-row items-center ${selectedHistoricalMatchday === null ? 'justify-center sm:justify-start sm:gap-4 min-h-[44px] sm:min-h-0' : 'gap-3 sm:gap-4 justify-start'}`}>
                                <div className="relative inline-block group historical-dropdown-container">
                                  <button
                                    type="button"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    disabled={loadingHistorical || loading}
                                    className={`appearance-none bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full px-3 sm:px-4 text-xs sm:text-sm font-semibold cursor-pointer hover:bg-[#f7e479] hover:text-black transition-all duration-300 focus:outline-none focus:bg-[#f7e479] focus:text-black pr-6 sm:pr-8 flex items-center justify-center ${
                                      selectedHistoricalMatchday === null 
                                        ? 'w-[100px] sm:w-[180px] h-auto min-h-[28px] sm:h-[36px] py-1 sm:py-0 whitespace-normal sm:whitespace-nowrap leading-tight' 
                                        : 'w-[160px] sm:w-[180px] h-[28px] sm:h-[36px] whitespace-nowrap'
                                    }`}
                                  >
                                    {selectedHistoricalMatchday ? `Matchday ${selectedHistoricalMatchday}` : 'Current Standings'}
                                  </button>
                                  {isDropdownOpen && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-card rounded-lg shadow-lg z-50 w-[140px] overflow-y-auto max-h-[252px]" style={{ border: '2px solid #f7e479' }}>
                                      {selectedHistoricalMatchday !== null && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleHistoricalMatchdayChange(null);
                                            setIsDropdownOpen(false);
                                          }}
                                          className="w-full text-center px-3 py-2 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap text-primary hover:bg-[#f7e479] group/item"
                                          onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
                                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                                        >
                                          Current Standings
                                        </button>
                                      )}
                                      {Array.from({ length: Math.max(0, currentMatchday - 1) }, (_, i) => i + 1)
                                        .filter((md) => {
                                          // Filter out the currently selected historical matchday
                                          if (md === selectedHistoricalMatchday) return false;
                                          // Filter out the last completed matchday (currentMatchday - 1) because it's "Current Standings"
                                          if (md === currentMatchday - 1) return false;
                                          // Only show matchdays before the current one
                                          if (md >= currentMatchday) return false;
                                          return true;
                                        })
                                        .map((md) => (
                                        <button
                                          key={md}
                                          type="button"
                                          onClick={() => {
                                            handleHistoricalMatchdayChange(md);
                                            setIsDropdownOpen(false);
                                          }}
                                          className="w-full text-center px-3 py-2 text-xs sm:text-sm font-semibold transition-colors text-primary hover:bg-[#f7e479]"
                                          onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
                                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                                        >
                                          Matchday {md}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3">
                                    <svg className={`h-3 w-3 sm:h-4 sm:w-4 transition-colors duration-300 ${isDropdownOpen ? 'text-black' : 'text-[#f7e479]'} group-hover:text-black`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </div>
                                {/* Compare checkbox - always render to prevent layout shift, hide when not needed */}
                                <label className={`flex items-center cursor-pointer transition-all duration-300 ${selectedHistoricalMatchday === null ? 'opacity-0 pointer-events-none h-0 overflow-hidden m-0 p-0' : ''}`}>
                                  <div className="flex items-center border border-[#f7e479] rounded">
                                    <input
                                      type="checkbox"
                                      checked={isComparing}
                                      onChange={(e) => setIsComparing(e.target.checked)}
                                      disabled={selectedHistoricalMatchday === null}
                                      className="h-4 w-4 border-r border-[#f7e479] rounded-l cursor-pointer appearance-none focus:ring-1 focus:ring-[#f7e479] relative flex-shrink-0"
                                      style={{
                                        backgroundColor: isComparing ? '#f7e479' : 'var(--card-bg)',
                                        backgroundImage: isComparing ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23000000\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M5 13l4 4L19 7\'/%3E%3C/svg%3E")' : 'none',
                                        backgroundSize: '70%',
                                        backgroundPosition: 'center',
                                        backgroundRepeat: 'no-repeat',
                                        padding: '0',
                                        boxSizing: 'border-box'
                                      }}
                                    />
                                      <div 
                                        className="h-4 px-1.5 flex items-center rounded-r bg-card"
                                      >
                                        <span className="text-[10px] font-medium whitespace-nowrap leading-none text-[#f7e479]">
                                          Compare To Today
                          </span>
                                      </div>
                                  </div>
                                </label>
                              </div>
                            )}
                        </>
                      )}
                </h2>
                </div>
                <div className="flex items-center space-x-4">
                  {/* Show Prediction Summary button for race mode when viewing standings */}
                  {isRaceMode && isViewingStandings && viewingFromMatchday !== null && (
                    <button
                      onClick={handleShowPredictionSummary}
                      className="text-xs px-3 py-1 xs:text-sm xs:px-4 xs:py-1.5 sm:text-base sm:px-8 sm:py-2 bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
                    >
                      Match Summary
                    </button>
                  )}
                  {isViewingStandings && !loading && viewingFromMatchday && (() => {
                    const leagueMaxMd = selectedLeague === 'CL' ? 8 : (selectedLeague === 'BL1' || selectedLeague === 'FL1') ? 34 : 38;
                    
                    // Check if all matchdays are completed
                    const completedMatchdays = JSON.parse(localStorage.getItem('completedMatchdays') || '{}');
                    const currentCompleted = completedMatchdays[selectedLeague] || [];
                    const allMatchdaysCompleted = currentCompleted.includes(leagueMaxMd);
                    
                    // Use single source of truth
                    const forecastEndMd = computeForecastEndMd();
                    const hasFinalPredicted = forecastEndMd === leagueMaxMd;
                    
                    // Hide button if all matchdays are completed
                    if (allMatchdaysCompleted || hasFinalPredicted) {
                      return null;
                    }
                    
                    return (
                    <button
                      onClick={() => {
                        // Clear the initialFetchDone flag for this league to allow a fresh fetch
                        if (selectedLeague) {
                          localStorage.removeItem(`${selectedLeague}_initialFetchDone`);
                        }
                        
                        // Clear initialMatches to ensure fresh data
                        setInitialMatches([]);
                        
                        // Get completed matchdays
                        const completedMatchdays = JSON.parse(localStorage.getItem('completedMatchdays') || '{}');
                        const currentCompleted = completedMatchdays[selectedLeague] || [];
                        
                        // Find the next uncompleted matchday
                        let nextMatchday = currentMatchday;
                        while (currentCompleted.includes(nextMatchday) && nextMatchday <= maxMatchday) {
                          nextMatchday++;
                        }
                        
                        // Update the current matchday before showing predictions
                        setCurrentMatchday(nextMatchday);
                        setIsViewingStandings(false);
                        setShowPredictions(true);
                        setShowModeSelection(false);
                        setViewingFromMatchday(null);
                          setSelectedHistoricalMatchday(null);
                          setHistoricalStandings([]);
                          setIsComparing(false);
                      }}
                        className="px-3 sm:px-4 text-xs sm:text-sm bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold h-[28px] sm:h-[36px] flex items-center justify-center"
                    >
                      Back to Predictions
                    </button>
                    );
                  })()}
                  {!isViewingStandings && (
                    <button
                      onClick={handleStartPredictions}
                      className="px-4 py-1 text-xs sm:px-8 sm:py-2 sm:text-base bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold h-auto min-h-[28px] sm:h-[36px] flex items-center justify-center leading-tight"
                    >
                      <span className="block sm:hidden">
                        Start<br />Forecasting
                      </span>
                      <span className="hidden sm:inline">Start Forecasting</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {(() => {
              // Use single source of truth
              const forecastEndMd = computeForecastEndMd();
              const leagueMaxMd = selectedLeague === 'CL' ? 8 : (selectedLeague === 'BL1' || selectedLeague === 'FL1') ? 34 : 38;
              const isForecastComplete = forecastEndMd === leagueMaxMd;
              
              return (
            <StandingsTable 
              key={selectedLeague} // Force remount on league change to prevent flicker
              teamForms={teamForms}
              formsLoading={formsLoading}
              standings={(() => {
                if (loadingHistorical) return standings;
                
                // In forecast mode with selected historical matchday
                // Use predicted standings ONLY for future matchdays
                // Use historical standings (actual fixtures) for past/current matchdays
                if (viewingFromMatchday !== null && selectedHistoricalMatchday !== null) {
                  const isFutureMd = selectedHistoricalMatchday > currentMatchday;
                  const savedStandings = predictedStandingsByMatchday.get(Number(selectedHistoricalMatchday));
                  
                  // For future matchdays, use predicted standings if we have them
                  if (isFutureMd && savedStandings && savedStandings.length > 0) {
                    return savedStandings.map(s => ({
                      ...s,
                      playedGames: selectedHistoricalMatchday,
                      team: { ...s.team }
                    }));
                  }
                  
                  // For past (and current) matchdays, use real historical standings if available
                  if (!isFutureMd && historicalStandings.length > 0) {
                    return historicalStandings;
                  }
                }
                
                // Regular historical standings (regular mode)
                if (selectedHistoricalMatchday && historicalStandings.length > 0 && viewingFromMatchday === null) {
                  return historicalStandings;
                }
                
                // Default predicted or current standings
                if (isViewingStandings && !viewingFromMatchday) {
                  // In race mode mini table, filter to only selected teams
                  if (isRaceMode && tableDisplayMode === 'mini' && selectedTeamIds && selectedTeamIds.length > 0) {
                    const filtered = predictedStandings.filter(s => selectedTeamIds.includes(s.team.id));
                    console.log(`[Race Mode] Filtered predicted standings from ${predictedStandings.length} to ${filtered.length} teams`);
                    return filtered;
                  }
                  return predictedStandings;
                }
                if (viewingFromMatchday) {
                  // Get the saved predicted standings for this matchday, or fall back to current predictedStandings
                  // Normalize key to Number when reading from Map
                  const savedStandings = predictedStandingsByMatchday.get(Number(viewingFromMatchday));
                  if (savedStandings && savedStandings.length > 0) {
                    // In race mode mini table, filter to only selected teams
                    if (isRaceMode && tableDisplayMode === 'mini' && selectedTeamIds && selectedTeamIds.length > 0) {
                      const filtered = savedStandings.filter(s => selectedTeamIds.includes(s.team.id));
                      console.log(`[Race Mode] Filtered saved standings from ${savedStandings.length} to ${filtered.length} teams`);
                      return filtered;
                    }
                    return savedStandings;
                  }
                  // In race mode mini table, filter to only selected teams
                  if (isRaceMode && tableDisplayMode === 'mini' && selectedTeamIds && selectedTeamIds.length > 0) {
                    const filtered = predictedStandings.filter(s => selectedTeamIds.includes(s.team.id));
                    console.log(`[Race Mode] Filtered predicted standings (fallback) from ${predictedStandings.length} to ${filtered.length} teams`);
                    return filtered;
                  }
                  return predictedStandings;
                }
                // In race mode mini table, filter to only selected teams
                if (isRaceMode && tableDisplayMode === 'mini' && selectedTeamIds && selectedTeamIds.length > 0) {
                  const filtered = standings.filter(s => selectedTeamIds.includes(s.team.id));
                  console.log(`[Race Mode] Filtered standings from ${standings.length} to ${filtered.length} teams`);
                  return filtered;
                }
                return standings;
              })()} 
              initialStandings={
                // In forecast mode with selected historical matchday and comparison enabled, compare predicted at selected matchday to predicted final matchday
                viewingFromMatchday !== null && selectedHistoricalMatchday !== null && isComparing
                  ? (() => {
                      // Use forecastEndMd as baseline when comparing to a selected matchday (the final predicted table)
                      const baselineMd = forecastEndMd;
                      // Normalize key to Number when reading from Map
                      const baseline = predictedStandingsByMatchday.get(Number(baselineMd)) ?? predictedStandings;
                      return baseline;
                    })()
                  : isComparing && selectedHistoricalMatchday && historicalStandings.length > 0 && viewingFromMatchday === null
                    ? standings // Compare historical to current standings (regular mode)
                  : viewingFromMatchday !== null && selectedHistoricalMatchday === null
                    ? (() => {
                        // In forecast mode viewing current standings: show indicators by default
                        // Compare predicted standings to actual current standings (today's real table)
                        // This shows how predictions differ from reality
                        return standings; // Use actual current standings as baseline
                      })()
                  : undefined // No comparison when checkbox is unchecked in other cases
              }
              compareToCurrent={
                // In forecast mode: comparing predicted at selected matchday to predicted final matchday when checkbox is checked
                (viewingFromMatchday !== null && selectedHistoricalMatchday !== null && isComparing) ||
                // In forecast mode viewing current standings: show indicators by default (always compare)
                (viewingFromMatchday !== null && selectedHistoricalMatchday === null) ||
                // In regular mode: comparing historical to current when "Compare To Today" is checked
                (isComparing && selectedHistoricalMatchday !== null && historicalStandings.length > 0 && viewingFromMatchday === null)
              }
              isForecastMode={viewingFromMatchday !== null}
              isComparingToPast={viewingFromMatchday !== null && selectedHistoricalMatchday !== null && isComparing}
              loading={loadingHistorical} 
              leagueCode={selectedLeague || undefined}
              selectedTeamIds={isRaceMode ? selectedTeamIds : undefined}
            />
              );
            })()}
            
            {/* Table display toggle - at the bottom of the table */}
            {isRaceMode && isViewingStandings && (
              <div className="flex justify-center items-center mt-4">
                <div className="inline-flex rounded-md">
                  <button 
                    type="button" 
                    className={`px-4 py-2 text-sm font-semibold border-2 rounded-l-lg transition-all duration-300 ease-in-out ${tableDisplayMode === 'mini' 
                      ? 'bg-[#12121a] text-[#f7e479] border-[#f7e479]' 
                      : 'bg-transparent text-[#555555] border-[#333333] hover:border-[#555555] hover:text-[#777777]'}`}
                    onClick={() => setTableDisplayMode('mini')}
                  >
                    Mini Table
                  </button>
                  <button 
                    type="button" 
                    className={`px-4 py-2 text-sm font-semibold border-2 rounded-r-lg transition-all duration-300 ease-in-out ${tableDisplayMode === 'full' 
                      ? 'bg-[#12121a] text-[#f7e479] border-[#f7e479]' 
                      : 'bg-transparent text-[#555555] border-[#333333] hover:border-[#555555] hover:text-[#777777]'}`}
                    onClick={() => setTableDisplayMode('full')}
                  >
                    Full Table
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : showModeSelection ? (
          <ModeSelection 
            leagueCode={selectedLeague || ''}
            standings={standings}
            onModeSelect={handleModeSelect}
          />
        ) : (
          <div className="bg-card rounded-lg p-6 mx-1 sm:mx-2 md:mx-3 mb-4 sm:mb-6">
            {selectedLeague ? (
              <PredictionForm
                leagueCode={selectedLeague}
                initialStandings={standings}
                initialMatches={initialMatches}
              />
            ) : (
              <div className="text-center py-8 text-red-500 font-bold">
                Please select a league before starting predictions.
              </div>
            )}
          </div>
        )}
        
        {/* Prediction Summary Modal */}
        {showPredictionSummary && (
          <PredictionSummary
            predictions={matchPredictions}
            matches={completedMatches}
            selectedTeamIds={selectedTeamIds}
            standings={predictedStandings}
            onClose={() => {
              setShowPredictionSummary(false);
              // No need to clear matches/predictions since we might want to show them again
            }}
          />
        )}
      </div>
    </main>
  );
}
