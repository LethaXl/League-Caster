'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import LeagueSelector from '@/components/Standings/LeagueSelector';
import StandingsTable from '@/components/Standings/StandingsTable';
import PredictionForm from '@/components/Predictions/PredictionForm';
import ModeSelection from '@/components/Predictions/ModeSelection';
import PredictionSummary from '@/components/Predictions/PredictionSummary';
import { getStandings, Standing, getCurrentMatchday, getMatches, getLeagueData, getCompletedMatchesUpToMatchday, calculateHistoricalStandings } from '@/services/football-api';
import { usePrediction } from '@/contexts/PredictionContext';
import { Match } from '@/types/predictions';
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
  const [standings, setStandings] = useState<Standing[]>([]);
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
  
  // Cache for API data to reduce calls
  const matchdayCache = useRef<Map<string, number>>(new Map());
  const matchesCache = useRef<Map<string, Match[]>>(new Map());
  const standingsCache = useRef<Map<string, Standing[]>>(new Map());
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
            newMap.set(matchdayToSave, standingsToSave.map(s => ({
              ...s,
              team: { ...s.team }
            })));
            return newMap;
          });
        }
        
        // Also save for current matchday (the one being predicted or just predicted)
        setPredictedStandingsByMatchday(prev => {
          const newMap = new Map(prev);
          newMap.set(currentMatchday, predictedStandings.map(s => ({
            ...s,
            team: { ...s.team }
          })));
          return newMap;
        });
      }
      
      // Update refs after processing
      prevPredictedStandingsRef.current = [...predictedStandings];
      prevMatchdayRef.current = currentMatchday;
      
      // Also save when viewing standings (final matchday)
      if (viewingFromMatchday !== null) {
        setPredictedStandingsByMatchday(prev => {
          const newMap = new Map(prev);
          newMap.set(viewingFromMatchday, predictedStandings.map(s => ({
            ...s,
            team: { ...s.team }
          })));
          return newMap;
        });
      }
    }
  }, [predictedStandings, currentMatchday, viewingFromMatchday]);

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

  // Handle historical matchday selection
  const handleHistoricalMatchdayChange = async (matchday: number | null) => {
    if (!selectedLeague || !standings.length) return;
    
    setSelectedHistoricalMatchday(matchday);
    // In forecast mode, automatically enable comparison when selecting a historical matchday
    if (viewingFromMatchday !== null && matchday !== null) {
      setIsComparing(true); // Checked by default in forecast mode
    } else if (matchday === null) {
      setIsComparing(false); // Uncheck when clearing selection
    } else {
      setIsComparing(false); // Reset comparison when matchday changes in regular mode
    }
    
    if (matchday === null) {
      setHistoricalStandings([]);
      return;
    }
    
    
    setLoadingHistorical(true);
    
    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setError('Request timed out. Please try again.');
      setLoadingHistorical(false);
    }, 15000); // 15 seconds timeout
    
    try {
      // Get all completed matches up to the selected matchday
      const completedMatches = await getCompletedMatchesUpToMatchday(selectedLeague, matchday);
      
      // Calculate historical standings from completed matches
      const calculatedStandings = calculateHistoricalStandings(standings, completedMatches);
      setHistoricalStandings(calculatedStandings);
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error fetching historical standings:', error);
      setError('Failed to load historical standings. Please try again.');
    } finally {
      setLoadingHistorical(false);
    }
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
        setViewingFromMatchday(null);
      }
      
      // Clear selected historical matchday when viewing standings from predictions
      // This ensures we show current predicted standings, not a previously viewed historical matchday
      setSelectedHistoricalMatchday(null);
      setHistoricalStandings([]);
      setIsComparing(false);
      
      setShowPredictions(false);
    }
  }, [isViewingStandings]);

  // Convert fetchData to useCallback to fix the dependency warning
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    // Add a timeout to prevent infinite loading spinner
    const timeoutId = setTimeout(() => {
      setError('Request timed out. API may be rate limited. Please try again later.');
      setLoading(false);
    }, 15000); // 15 seconds timeout
    
    try {
      // Make sure selectedLeague is not null
      if (!selectedLeague) {
        console.error("League not selected");
        clearTimeout(timeoutId);
        return;
      }

      // Try to use cached data first
      const combinedCacheKey = selectedLeague;
      
      if (standingsCache.current.has(combinedCacheKey) && matchdayCache.current.has(combinedCacheKey)) {
        // If both standings and current matchday are already cached, use them
        const standingsData = standingsCache.current.get(combinedCacheKey)!;
        const currentMatchdayData = matchdayCache.current.get(combinedCacheKey)!;
        
        setStandings(standingsData);
        if (predictedStandings.length === 0) {
          setCurrentMatchday(currentMatchdayData);
        }
        clearTimeout(timeoutId);
      } else {
        // Otherwise, use the combined endpoint to fetch both at once
        try {
          // Use the combined endpoint to get both standings and current matchday
          const { standings: standingsData, currentMatchday: currentMatchdayData } = 
            await getLeagueData(selectedLeague);
            
          // Cache the results
          standingsCache.current.set(combinedCacheKey, standingsData);
          matchdayCache.current.set(combinedCacheKey, currentMatchdayData);
          
          setStandings(standingsData);
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
          const [standingsData, currentMatchdayData] = await Promise.all([
            standingsPromise,
            currentMatchdayPromise
          ]);
          
          // Cache the results
          standingsCache.current.set(combinedCacheKey, standingsData);
          matchdayCache.current.set(combinedCacheKey, currentMatchdayData);
          
          setStandings(standingsData);
          if (predictedStandings.length === 0) {
            setCurrentMatchday(currentMatchdayData);
          }
          clearTimeout(timeoutId);
        }
      }
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
    }
  }, [selectedLeague, predictedStandings.length, setCurrentMatchday]);

  useEffect(() => {
    if (!selectedLeague) return;
    
    // Reset historical matchday when league changes
    setSelectedHistoricalMatchday(null);
    setHistoricalStandings([]);
    setIsDropdownOpen(false);
    
    fetchData();
  }, [selectedLeague, fetchData]);

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
        
        // Create an array of promises for all matchdays to check in parallel
        const matchPromises = matchdaysToCheck.map(async (md) => {
          const mdCacheKey = `${selectedLeague}_md${md}`;
          if (matchesCache.current.has(mdCacheKey)) {
            return { md, matches: matchesCache.current.get(mdCacheKey)! };
          } else {
            const mdMatches = await getMatches(selectedLeague, md);
            matchesCache.current.set(mdCacheKey, mdMatches);
            return { md, matches: mdMatches };
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
              <div className="flex flex-row justify-between items-center mb-2 sm:mb-4 gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                <h2
                  className={
                      `text-base sm:text-xl font-semibold sm:font-bold text-primary flex items-center gap-2 sm:gap-3 ` +
                    ((isViewingStandings || viewingFromMatchday) && (viewingFromMatchday === maxMatchday || (currentMatchday === maxMatchday && !viewingFromMatchday)) ? 'text-center w-full mx-auto my-0' : 'mb-2 sm:mb-0')
                  }
                >
                  {isViewingStandings || viewingFromMatchday 
                    ? (viewingFromMatchday === maxMatchday || (currentMatchday === maxMatchday && !viewingFromMatchday)) 
                      ? 'Final Table' 
                      : (
                            /* Dropdown for forecast mode */
                            currentMatchday > 1 && (
                              <div className={`flex flex-col sm:flex-row items-center ${selectedHistoricalMatchday === null ? 'justify-center sm:justify-start sm:gap-4 min-h-[44px] sm:min-h-0' : 'gap-3 sm:gap-4 justify-start'}`}>
                                <div className="relative inline-block group historical-dropdown-container">
                                  <button
                                    type="button"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    disabled={loadingHistorical || loading}
                                    className="appearance-none bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full px-3 sm:px-4 text-xs sm:text-sm font-semibold cursor-pointer hover:bg-[#f7e479] hover:text-black transition-all duration-300 focus:outline-none focus:bg-[#f7e479] focus:text-black pr-6 sm:pr-8 w-[160px] sm:w-[180px] h-[28px] sm:h-[36px] flex items-center justify-center"
                                  >
                                    {selectedHistoricalMatchday ? `Matchday ${selectedHistoricalMatchday}` : `Matchday ${viewingFromMatchday || currentMatchday}`}
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
                                      {Array.from({ length: Math.max(0, viewingFromMatchday || currentMatchday - 1) }, (_, i) => i + 1)
                                        .filter((md) => {
                                          // Filter out the currently selected historical matchday
                                          if (md === selectedHistoricalMatchday) return false;
                                          // In forecast mode, show all matchdays up to viewingFromMatchday (including predicted ones)
                                          // In regular mode, only show matchdays before currentMatchday
                                          if (viewingFromMatchday !== null) {
                                            // Forecast mode: show matchdays from 1 to viewingFromMatchday, excluding the current selected one
                                            if (md > viewingFromMatchday) return false;
                                            // Don't show the current matchday button text matchday (viewingFromMatchday)
                                            if (md === viewingFromMatchday) return false;
                                          } else {
                                            // Regular mode: only show matchdays before currentMatchday
                                            if (md >= currentMatchday) return false;
                                          }
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
                                        {viewingFromMatchday ? `Compare to MD ${viewingFromMatchday}` : 'Compare To Today'}
                          </span>
                                    </div>
                                  </div>
                                </label>
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
                                          {viewingFromMatchday ? `Compare to MD ${viewingFromMatchday}` : 'Compare To Today'}
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
                  {/* Show Prediction Summary button for race mode at final matchday */}
                  {isRaceMode && isViewingStandings && 
                   (viewingFromMatchday === maxMatchday || (currentMatchday === maxMatchday && !viewingFromMatchday)) && (
                    <button
                      onClick={handleShowPredictionSummary}
                      className="text-xs px-3 py-1 xs:text-sm xs:px-4 xs:py-1.5 sm:text-base sm:px-8 sm:py-2 bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
                    >
                      Match Summary
                    </button>
                  )}
                  {isViewingStandings && !loading && viewingFromMatchday && (
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
                  )}
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
            
            <StandingsTable 
              standings={(() => {
                if (loadingHistorical) return standings;
                
                // In forecast mode with selected historical matchday, ALWAYS show historical standings (actual fixtures)
                // Only show predicted standings if it's a future/predicted matchday (greater than current matchday)
                if (viewingFromMatchday !== null && selectedHistoricalMatchday !== null) {
                  // If selected matchday is in the past (before current matchday), show historical standings
                  if (selectedHistoricalMatchday < currentMatchday) {
                    if (historicalStandings.length > 0) {
                      return historicalStandings;
                    }
                  } else {
                    // For predicted matchdays, show predicted standings
                    const savedStandings = predictedStandingsByMatchday.get(selectedHistoricalMatchday);
                    if (savedStandings && savedStandings.length > 0) {
                      return savedStandings.map(s => ({
                        ...s,
                        playedGames: selectedHistoricalMatchday,
                        team: { ...s.team }
                      }));
                    }
                  }
                }
                
                // Regular historical standings (regular mode)
                if (selectedHistoricalMatchday && historicalStandings.length > 0 && viewingFromMatchday === null) {
                  return historicalStandings;
                }
                
                // Default predicted or current standings
                if (isViewingStandings && !viewingFromMatchday) {
                  return predictedStandings;
                }
                if (viewingFromMatchday) {
                  return predictedStandings;
                }
                return standings;
              })()} 
              initialStandings={
                // In forecast mode with selected historical matchday and comparison enabled, compare predicted at selected matchday to predicted at current matchday
                viewingFromMatchday !== null && selectedHistoricalMatchday !== null && isComparing
                  ? predictedStandings // Compare predicted (at selectedHistoricalMatchday) to predicted (at viewingFromMatchday/currentMatchday)
                  : isComparing && selectedHistoricalMatchday && historicalStandings.length > 0 && viewingFromMatchday === null
                    ? standings // Compare historical to current standings (regular mode)
                  : viewingFromMatchday !== null && selectedHistoricalMatchday === null
                    ? standings // Default comparison in forecast mode: compare predicted to actual current standings
                    : undefined // No comparison when checkbox is unchecked in other cases
              }
              compareToCurrent={
                // In forecast mode: comparing predicted at selected matchday to predicted at current matchday when checkbox is checked
                (viewingFromMatchday !== null && selectedHistoricalMatchday !== null && isComparing) ||
                // In forecast mode: default comparison of predicted to actual current standings
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
