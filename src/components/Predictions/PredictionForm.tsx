'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Match, Prediction, PredictionType } from '@/types/predictions';
import { getMatches, processMatchPrediction, updateStandings } from '@/services/football-api';
import MatchPrediction from './MatchPrediction';
import NoRaceMatches from './NoRaceMatches';
import { Standing } from '@/services/football-api';
import { usePrediction } from '@/contexts/PredictionContext';

interface PredictionFormProps {
  leagueCode: string;
  initialStandings: Standing[];
  initialMatches?: Match[];
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

export default function PredictionForm({ leagueCode, initialStandings, initialMatches = [] }: PredictionFormProps) {
  const {
    currentMatchday,
    setCurrentMatchday,
    predictedStandings,
    setPredictedStandings,
    setIsViewingStandings,
    isRaceMode,
    selectedTeamIds,
    unfilteredMatchesMode,
    tableDisplayMode,
    setTableDisplayMode
  } = usePrediction();

  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Map<number, Prediction>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // Add state for screen width tracking
  const [screenWidth, setScreenWidth] = useState(0);
  // Add a state for mini table toggle
  const [showMiniTable, setShowMiniTable] = useState(() => {
    // Initialize based on tableDisplayMode from context
    return tableDisplayMode === 'mini';
  });
  
  // Track screen width for responsive layouts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };
    
    // Set initial value
    setScreenWidth(window.innerWidth);
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Determine if we're in the constrained view
  const isConstrainedView = screenWidth >= 1026 && screenWidth <= 1280;

  // Determine if we're in the very specific 1001-1025px range that needs fixing
  const isSpecificConstrainedView = screenWidth >= 1001 && screenWidth <= 1025;

  // Determine if we're in the medium constrained view (between 700px and 1000px)
  const isMediumConstrainedView = screenWidth >= 750 && screenWidth <= 1000;

  const isTabletSmallConstrainedView = screenWidth >= 640 && screenWidth < 750;

  const isMobileXLConstrainedView = screenWidth >= 450 && screenWidth < 640;

  const isMobileLConstrainedView = screenWidth >= 375 && screenWidth < 450;

  const isMobileMConstrainedView = screenWidth >= 340 && screenWidth < 375;

  const isMobileSConstrainedView = screenWidth >= 320 && screenWidth < 340;
  
  // Get the maximum matchday for this league
  const MAX_MATCHDAY = getMaxMatchday(leagueCode);
  
  // Cache for matchday data to reduce API calls
  const matchdayCache = useRef<Map<number, Match[]>>(new Map());
  // Keep track of matchdays we've already checked to avoid duplicate API calls
  const checkedMatchdays = useRef<Set<number>>(new Set());
  // Keep track of ongoing API calls
  const pendingRequests = useRef<Map<number, Promise<Match[]>>>(new Map());
  // Keep track of when the cache was last refreshed
  const cacheLastRefreshed = useRef<number>(0);
  // Set cache expiry time (in milliseconds) - 1 hour
  const CACHE_EXPIRY_TIME = 60 * 60 * 1000;

  // Save cache to localStorage whenever it changes
  const saveCache = useCallback(() => {
    const cacheObj = Object.fromEntries(matchdayCache.current.entries());
    localStorage.setItem(`matchdayCache_${leagueCode}`, JSON.stringify(cacheObj));
    // Update the last refreshed timestamp
    cacheLastRefreshed.current = Date.now();
    localStorage.setItem(`cacheLastRefreshed_${leagueCode}`, cacheLastRefreshed.current.toString());
  }, [leagueCode]);

  // Function to check if cache needs to be refreshed
  const shouldRefreshCache = useCallback((): boolean => {
    const now = Date.now();
    return now - cacheLastRefreshed.current > CACHE_EXPIRY_TIME;
  }, [CACHE_EXPIRY_TIME]);

  // Function to clear the cache and force a refresh
  const clearCache = useCallback(() => {
    console.log('Clearing cache to ensure fresh match data');
    matchdayCache.current.clear();
    checkedMatchdays.current.clear();
    localStorage.removeItem(`matchdayCache_${leagueCode}`);
    cacheLastRefreshed.current = Date.now();
    localStorage.setItem(`cacheLastRefreshed_${leagueCode}`, cacheLastRefreshed.current.toString());
  }, [leagueCode]);

  // Function to filter out matches that have likely already been played
  const filterAlreadyPlayedMatches = useCallback((matches: Match[]): Match[] => {
    const now = new Date();
    
    // Filter matches that were scheduled in the past
    return matches.filter(match => {
      const matchDate = new Date(match.utcDate);
      
      // If match date is in the past (before current time), filter it out
      if (matchDate < now) {
        console.log(`Filtering out already played match: ${match.homeTeam.name} vs ${match.awayTeam.name} scheduled for ${matchDate.toLocaleString()}`);
        return false;
      }
      
      // Keep all future matches
      return true;
    });
  }, []);

  // Function to filter matches for race mode (only including selected teams)
  const filterMatchesForRaceMode = useCallback((matches: Match[]): Match[] => {
    // Add debugging information
    console.log("Filter matches for race mode called");
    console.log("isRaceMode:", isRaceMode);
    console.log("selectedTeamIds:", selectedTeamIds);
    
    if (!isRaceMode || selectedTeamIds.length === 0) {
      console.log("Not filtering matches - race mode disabled or no teams selected");
      return matches;
    }
    
    console.log(`Filtering ${matches.length} matches for race mode with ${selectedTeamIds.length} teams`);
    
    const filteredMatches = matches.filter(match => {
      const homeTeamId = match.homeTeam.id;
      const awayTeamId = match.awayTeam.id;
      
      const isHomeTeamSelected = selectedTeamIds.includes(homeTeamId);
      const isAwayTeamSelected = selectedTeamIds.includes(awayTeamId);
      
      // Mark matches between two selected teams as head-to-head
      if (isHomeTeamSelected && isAwayTeamSelected) {
        match.isHeadToHead = true;
      } else {
        match.isHeadToHead = false;
      }
      
      // Include the match only if at least one of the teams is in the selected teams
      return isHomeTeamSelected || isAwayTeamSelected;
    });
    
    console.log(`Filtered matches from ${matches.length} to ${filteredMatches.length}`);
    return filteredMatches;
  }, [isRaceMode, selectedTeamIds]);

  // Function to filter out the problematic Villarreal vs Espanyol match
  const filterLaLigaProblematicMatches = useCallback((matches: Match[], currentMd: number): Match[] => {
    if (leagueCode !== 'PD') return matches;
    
    return matches.filter(match => {
      // Check for Villarreal CF vs RCD Espanyol de Barcelona match that's causing issues
      const isProblematicMatch = 
        (match.homeTeam.name.includes('Villarreal') && match.awayTeam.name.includes('Espanyol')) ||
        (match.awayTeam.name.includes('Villarreal') && match.homeTeam.name.includes('Espanyol'));
      
      // Filter it out if it's showing in the wrong matchday (should only be in matchday 26)
      if (isProblematicMatch && currentMd !== 26) {
        console.log(`Filtered out problematic match: ${match.homeTeam.name} vs ${match.awayTeam.name} from matchday ${currentMd}`);
        return false;
      }
      
      return true;
    });
  }, [leagueCode]);

  // Add a function to prefetch all remaining matchdays
  const prefetchRemainingMatchdays = useCallback(async (startMatchday: number) => {
    // Disabling prefetching to prevent unwanted API calls
    console.log('Prefetching disabled to prevent extra API calls');
    return;
    
    // Original prefetching code below (now unreachable)
    console.log(`Prefetching remaining matchdays starting from ${startMatchday}`);
    
    // Only prefetch if we haven't done so already for this league and session
    const prefetchedKey = `prefetched_${leagueCode}_${isRaceMode ? 'race' : 'classic'}`;
    if (localStorage.getItem(prefetchedKey)) {
      console.log(`Already prefetched data for this league in ${isRaceMode ? 'race' : 'classic'} mode`);
      return;
    }

    // Set a flag to indicate prefetching is in progress
    localStorage.setItem(`prefetching_${leagueCode}`, 'true');
    
    try {
      // Limit how many matchdays to prefetch at once to reduce API load
      const maxPrefetchCount = 3;
      let prefetchCount = 0;
      
      // Prefetch remaining matchdays
      for (let md = startMatchday + 1; md <= MAX_MATCHDAY && prefetchCount < maxPrefetchCount; md++) {
        // Skip problematic matchdays for LaLiga
        if (leagueCode === 'PD' && md >= 27 && md <= 30) {
          continue;
        }
        
        // Skip if we already have this matchday in cache
        if (matchdayCache.current.has(md)) {
          continue;
        }
        
        try {
          console.log(`Prefetching matchday ${md}`);
          const matchData = await getMatches(leagueCode, md);
          prefetchCount++;
          
          // Filter LaLiga problematic matches
          let filteredMatchData = matchData;
          if (leagueCode === 'PD') {
            filteredMatchData = filterLaLigaProblematicMatches(filteredMatchData, md);
          }
          
          // Apply filter for already played matches
          filteredMatchData = filterAlreadyPlayedMatches(filteredMatchData);
          
          // Cache the result
          matchdayCache.current.set(md, filteredMatchData);
          
          // Save cache after each successful fetch
          saveCache();
          
          // Add a small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error prefetching matchday ${md}:`, error);
          // Continue with other matchdays even if one fails
        }
      }
      
      // Mark as prefetched for this mode
      localStorage.setItem(prefetchedKey, 'true');
    } finally {
      // Remove the prefetching flag
      localStorage.removeItem(`prefetching_${leagueCode}`);
    }
  }, [leagueCode, MAX_MATCHDAY, filterAlreadyPlayedMatches, filterLaLigaProblematicMatches, saveCache, isRaceMode]);

  // Convert fetchMatches to use useCallback to avoid dependency issues in useEffect
  const fetchMatches = useCallback(async (matchday: number) => {
    // Skip matchdays 27-30 for LaLiga
    if (leagueCode === 'PD' && matchday >= 27 && matchday <= 30) {
      // Move to matchday 31 if we're in the skipped range
      setCurrentMatchday(31);
      return;
    }

    // Create a storage key to track if we've already fetched for this league
    const hasInitialFetchKey = `${leagueCode}_initialFetchDone`;
    const hasInitialFetch = localStorage.getItem(hasInitialFetchKey);
    
    // If we've already done the initial fetch for this league, don't fetch again
    if (hasInitialFetch === 'true') {
      console.log(`Preventing additional API call for ${leagueCode}. Initial fetch already done.`);
      // Just use cached data if available
      if (matchdayCache.current.has(matchday)) {
        const cachedData = matchdayCache.current.get(matchday)!;
        
        // Filter matches appropriately
        let filteredMatches = filterLaLigaProblematicMatches(cachedData, matchday);
        filteredMatches = filterAlreadyPlayedMatches(filteredMatches);
        
        // Log race mode settings before applying filter
        console.log(`Using cached data for matchday ${matchday} with race mode: ${isRaceMode ? 'enabled' : 'disabled'}`);
        console.log(`Race mode settings: ${JSON.stringify({
          isRaceMode,
          selectedTeamIds,
          unfilteredMatchesMode
        })}`);
        
        filteredMatches = filterMatchesForRaceMode(filteredMatches);
        
        setMatches(filteredMatches);
        
        // Initialize predictions
        const initialPredictions = new Map<number, Prediction>();
        filteredMatches.forEach(match => {
          initialPredictions.set(match.id, {
            matchId: match.id,
            type: 'draw'
          });
        });
        setPredictions(initialPredictions);
      }
      return;
    }

    // Only skip if we've already checked this matchday
    if (checkedMatchdays.current.has(matchday)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    checkedMatchdays.current.add(matchday);
    
    // Add a timeout to prevent infinite loading spinner
    const timeoutId = setTimeout(() => {
      setError('Request timed out. API may be rate limited. Please try again later.');
      setLoading(false);
    }, 15000); // 15 seconds timeout
    
    try {
      // Use initialMatches if available on first render
      if (initialMatches.length > 0 && !matchdayCache.current.has(matchday)) {
        // Filter out already predicted matches and already played matches
        const completedMatches = JSON.parse(localStorage.getItem('completedMatches') || '{}');
        let unpredictedMatches = initialMatches.filter(
          match => !completedMatches[leagueCode]?.includes(match.id)
        );
        
        // Apply filter for already played matches
        unpredictedMatches = filterAlreadyPlayedMatches(unpredictedMatches);
        
        // Log race mode settings before applying filter
        console.log(`Using initial matches for matchday ${matchday} with race mode: ${isRaceMode ? 'enabled' : 'disabled'}`);
        console.log(`Race mode settings: ${JSON.stringify({
          isRaceMode,
          selectedTeamIds,
          unfilteredMatchesMode
        })}`);
        
        // Apply race mode filter if enabled
        unpredictedMatches = filterMatchesForRaceMode(unpredictedMatches);
        
        if (unpredictedMatches.length > 0) {
          setMatches(unpredictedMatches);
          matchdayCache.current.set(matchday, unpredictedMatches);
          saveCache();
          
          // Initialize predictions with draws
          const initialPredictions = new Map<number, Prediction>();
          unpredictedMatches.forEach(match => {
            initialPredictions.set(match.id, {
              matchId: match.id,
              type: 'draw'
            });
          });
          setPredictions(initialPredictions);
          
          // Initialize standings if needed
          if (predictedStandings.length === 0) {
            const deepCopyStandings = initialStandings.map(standing => ({
              ...standing,
              team: { ...standing.team }
            }));
            setPredictedStandings(deepCopyStandings);
          }
          
          clearTimeout(timeoutId);
          setLoading(false);
          
          // Mark that we've done the initial fetch for this league
          localStorage.setItem(hasInitialFetchKey, 'true');
          console.log(`Initial fetch for ${leagueCode} completed and marked as done.`);
          return;
        }
      }
      
      // Check if we have cached data for this matchday
      if (matchdayCache.current.has(matchday)) {
        const cachedData = matchdayCache.current.get(matchday)!;
        // Filter out the problematic LaLiga match if needed
        const laLigaFiltered = filterLaLigaProblematicMatches(cachedData, matchday);
        // Filter out matches that have already been played
        let filteredMatches = filterAlreadyPlayedMatches(laLigaFiltered);
        // Apply race mode filter if enabled
        filteredMatches = filterMatchesForRaceMode(filteredMatches);
        
        if (filteredMatches.length > 0) {
          setMatches(filteredMatches);
          
          // Initialize predictions if we have matches
          const initialPredictions = new Map<number, Prediction>();
          filteredMatches.forEach(match => {
            initialPredictions.set(match.id, {
              matchId: match.id,
              type: 'draw'
            });
          });
          setPredictions(initialPredictions);
          
          // Initialize standings if needed
          if (predictedStandings.length === 0) {
            const deepCopyStandings = initialStandings.map(standing => ({
              ...standing,
              team: { ...standing.team }
            }));
            setPredictedStandings(deepCopyStandings);
          }
          
          clearTimeout(timeoutId);
          setLoading(false);
          
          // Mark that we've done the initial fetch for this league
          localStorage.setItem(hasInitialFetchKey, 'true');
          console.log(`Initial fetch for ${leagueCode} (from cache) completed and marked as done.`);
          return;
        }
      }
      
      // Check if there's already a pending request for this matchday
      if (pendingRequests.current.has(matchday)) {
        await pendingRequests.current.get(matchday);
        clearTimeout(timeoutId);
        
        // Mark that we've done the initial fetch for this league
        localStorage.setItem(hasInitialFetchKey, 'true');
        console.log(`Initial fetch for ${leagueCode} (from pending request) completed and marked as done.`);
        return;
      }
      
      // Fetch from API if not cached - this is the actual API call
      console.log(`Making API call for ${leagueCode} matchday ${matchday}`);
      const request = getMatches(leagueCode, matchday);
      pendingRequests.current.set(matchday, request);
      
      const matchData = await request;
      pendingRequests.current.delete(matchday);
      
      // CRITICAL: Store ALL matches to localStorage BEFORE any filtering
      // This ensures we have complete data for unfiltered matches processing in racemode
      try {
        const allMatchesKey = `${leagueCode}_md${matchday}_all`;
        const existingAllMatches = (() => {
          try {
            const cached = localStorage.getItem(allMatchesKey);
            if (cached && cached !== 'null' && cached.trim() !== '') {
              return JSON.parse(cached);
            }
          } catch (e) {
            // Ignore parse errors
          }
          return [];
        })();
        
        // Only update if we got new matches from API
        if (Array.isArray(matchData) && matchData.length > 0) {
          // Merge with existing to avoid duplicates
          const existingIds = new Set(existingAllMatches.map((m: Match) => m.id));
          const newMatches = matchData.filter(m => !existingIds.has(m.id));
          
          if (newMatches.length > 0 || existingAllMatches.length === 0) {
            const allMatchesToStore = [
              ...existingAllMatches.map((m: Match) => ({ ...m, matchday: matchday })),
              ...newMatches.map(m => ({ ...m, matchday: matchday }))
            ];
            
            localStorage.setItem(allMatchesKey, JSON.stringify(allMatchesToStore));
            console.log(`Stored ${allMatchesToStore.length} total matches for matchday ${matchday} to _all cache (${newMatches.length} new)`);
          }
        }
      } catch (storageErr) {
        console.warn(`Error storing all matches for matchday ${matchday}:`, storageErr);
      }
      
      // Special handling for LaLiga to remove problematic matches
      let filteredMatchData = matchData;
      if (leagueCode === 'PD') {
        // Filter out the specific problematic fixtures that are showing up in multiple matchdays
        filteredMatchData = matchData.filter(match => {
          // Check for Villarreal CF vs RCD Espanyol de Barcelona match that's causing issues
          const isProblematicMatch = 
            (match.homeTeam.name.includes('Villarreal') && match.awayTeam.name.includes('Espanyol')) ||
            (match.awayTeam.name.includes('Villarreal') && match.homeTeam.name.includes('Espanyol'));
          
          // Filter it out if it's showing in the wrong matchday
          if (isProblematicMatch && currentMatchday !== 26) {
            console.log(`Filtered out problematic match: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
            return false;
          }
          
          return true;
        });
      }
      
      // Apply filter for already played matches here too
      filteredMatchData = filterAlreadyPlayedMatches(filteredMatchData);
      
      // Apply race mode filter if enabled
      filteredMatchData = filterMatchesForRaceMode(filteredMatchData);
      
      matchdayCache.current.set(matchday, filteredMatchData);
      saveCache();
      
      if (filteredMatchData.length === 0) {
        // If no matches available, try the next matchday
        if (matchday < MAX_MATCHDAY) {
          clearTimeout(timeoutId);
          setCurrentMatchday(matchday + 1);
          
          // Mark that we've done the initial fetch for this league
          localStorage.setItem(hasInitialFetchKey, 'true');
          console.log(`Initial fetch for ${leagueCode} completed with no matches. Moving to next matchday.`);
          return;
        }
      }
      
      setMatches(filteredMatchData);
      
      // Initialize predictions with draws
      if (filteredMatchData.length > 0) {
        const initialPredictions = new Map<number, Prediction>();
        filteredMatchData.forEach(match => {
          initialPredictions.set(match.id, {
            matchId: match.id,
            type: 'draw'
          });
        });
        setPredictions(initialPredictions);
        
        // Initialize standings if needed
        if (predictedStandings.length === 0) {
          const deepCopyStandings = initialStandings.map(standing => ({
            ...standing,
            team: { ...standing.team }
          }));
          setPredictedStandings(deepCopyStandings);
        }
      }
      
      clearTimeout(timeoutId);
      
      // Mark that we've done the initial fetch for this league
      localStorage.setItem(hasInitialFetchKey, 'true');
      console.log(`Initial fetch for ${leagueCode} completed and marked as done.`);
    } catch (error: Error | unknown) {
      clearTimeout(timeoutId);
      console.error('Error fetching matches:', error);
      // Better error handling with specific messages
      const err = error as { response?: { status?: number, data?: { error?: string, details?: string } } };
      if (err.response?.status === 429) {
        setError('API rate limit reached. Please wait a moment and try again later.');
      } else if (err.response?.status === 404) {
        setError('Match data not found. Please try another matchday.');
      } else if (err.response?.status && err.response.status >= 500) {
        setError('Football API server error. Please try again later.');
      } else {
        setError(err.response?.data?.error || err.response?.data?.details || 
                'Failed to fetch matches. Please try again later.');
      }
      pendingRequests.current.delete(matchday);
    } finally {
      setLoading(false);
    }
  }, [
    leagueCode, 
    saveCache, 
    setCurrentMatchday,
    setLoading,
    setError,
    setMatches,
    setPredictions,
    setPredictedStandings,
    predictedStandings,
    initialStandings,
    initialMatches,
    filterAlreadyPlayedMatches,
    filterLaLigaProblematicMatches,
    filterMatchesForRaceMode,
    MAX_MATCHDAY,
    currentMatchday
  ]);

  // Load cached data from localStorage on mount
  useEffect(() => {
    // Always reset loading state when component mounts
    setLoading(false);
    
    const now = new Date();
    const savedCache = localStorage.getItem(`matchdayCache_${leagueCode}`);
    const savedTimestamp = localStorage.getItem(`cacheLastRefreshed_${leagueCode}`);
    
    // Log race mode state on component mount/update
    console.log(`PredictionForm useEffect - race mode state: ${isRaceMode ? 'enabled' : 'disabled'}`);
    console.log(`Current selectedTeamIds: ${JSON.stringify(selectedTeamIds)}`);
    
    // Force clear the cache once to ensure team name mappings are applied
    // We'll use a flag in localStorage to track if we've already cleared for this league
    const nameMapClearedKey = `teamNameMappingCleared_${leagueCode}`;
    const hasNameMappingBeenCleared = localStorage.getItem(nameMapClearedKey);
    
    if (!hasNameMappingBeenCleared) {
      console.log('Clearing cache to apply team name mappings');
      clearCache();
      localStorage.setItem(nameMapClearedKey, 'true');
      fetchMatches(currentMatchday);
      return;
    }
    
    if (savedTimestamp) {
      cacheLastRefreshed.current = parseInt(savedTimestamp);
    }
    
    // Check if we need to refresh the cache
    if (shouldRefreshCache()) {
      clearCache();
      fetchMatches(currentMatchday);
      return;
    }
    
    if (savedCache) {
      try {
        const parsedCache = JSON.parse(savedCache);
        // Create a new filtered cache that removes matches that have already been played
        const filteredCache = new Map();
        
        Object.entries(parsedCache).forEach(([key, value]) => {
          const matchdayNumber = parseInt(key);
          const matches = value as Match[];
          
          // Filter out matches that have already been played
          const futureMatches = matches.filter(match => {
            const matchDate = new Date(match.utcDate);
            return matchDate > now;
          });
          
          if (futureMatches.length > 0) {
            filteredCache.set(matchdayNumber, futureMatches);
          }
        });
        
        // Set the filtered cache
        matchdayCache.current = filteredCache;
        
        // Save the updated cache back to localStorage
        saveCache();
      } catch (e) {
        console.error("Error parsing cache:", e);
      }
    }
    
    // Fetch data for the current matchday
    fetchMatches(currentMatchday);
  }, [leagueCode, currentMatchday, fetchMatches, saveCache, shouldRefreshCache, clearCache, isRaceMode, selectedTeamIds]);

  useEffect(() => {
    console.log(`Running matchday update effect - race mode: ${isRaceMode ? 'enabled' : 'disabled'}, teams: ${selectedTeamIds.length}`);
    
    // Clear initialFetchDone flag to ensure proper filtering is applied
    localStorage.removeItem(`${leagueCode}_initialFetchDone`);
    
    fetchMatches(currentMatchday);
    
    // Safety timeout to prevent infinite loading
    const safetyTimer = setTimeout(() => {
      if (loading) {
        console.log('Safety timeout triggered - resetting loading state');
        setLoading(false);
      }
    }, 20000); // 20 seconds
    
    return () => clearTimeout(safetyTimer);
  }, [leagueCode, currentMatchday, fetchMatches, loading, setLoading, isRaceMode, selectedTeamIds]);

  const handlePredictionChange = (
    matchId: number,
    type: PredictionType,
    homeGoals?: number,
    awayGoals?: number
  ) => {
    setPredictions(prev => {
      const newPredictions = new Map(prev);
      newPredictions.set(matchId, {
        matchId,
        type,
        ...(type === 'custom' && { homeGoals, awayGoals })
      });
      
      // Save prediction to localStorage
      const savedPredictions = JSON.parse(localStorage.getItem(`predictions_${leagueCode}`) || '{}');
      savedPredictions[matchId] = {
        matchId,
        type,
        ...(type === 'custom' && { homeGoals, awayGoals })
      };
      localStorage.setItem(`predictions_${leagueCode}`, JSON.stringify(savedPredictions));
      
      return newPredictions;
    });
  };

  // New function to determine automatic result for unfiltered matches
  const determineAutomaticResult = (homeTeamPosition: number, awayTeamPosition: number): PredictionType => {
    // Calculate position difference
    const positionDiff = Math.abs(homeTeamPosition - awayTeamPosition);
    
    // If position difference is 2 or less, it's a close match - draw
    if (positionDiff <= 2) {
      return 'draw';
    }
    
    // Otherwise, higher position team wins (lower position number)
    return homeTeamPosition < awayTeamPosition ? 'home' : 'away';
  };

  // Function to get all matches for a matchday (filtered + unfiltered)
  const getUnfilteredMatches = async (matchday: number): Promise<Match[]> => {
    try {
      const cacheKey = `${leagueCode}_md${matchday}_all`;
      
      // For completed/past matchdays, we must use localStorage (API filters out past matches)
      // For current/future matchdays, try API first, then fallback to cache
      const completedMatchdaysData = (() => {
        try {
          const data = localStorage.getItem('completedMatchdays');
          if (data && data !== 'null' && data.trim() !== '') {
            return JSON.parse(data);
          }
        } catch (e) {
          // Ignore parse errors
        }
        return {};
      })();
      
      const isCompletedMatchday = completedMatchdaysData[leagueCode]?.includes(matchday);
      
      // Try cache first (especially important for completed matchdays)
      const cachedMatchesStr = localStorage.getItem(cacheKey);
      if (cachedMatchesStr && cachedMatchesStr !== 'null' && cachedMatchesStr.trim() !== '') {
        try {
          const cachedMatches = JSON.parse(cachedMatchesStr);
          if (Array.isArray(cachedMatches) && cachedMatches.length > 0) {
            // For completed matchdays, trust the cache
            if (isCompletedMatchday) {
              console.log(`Using cached matches for completed matchday ${matchday} (${cachedMatches.length} matches)`);
              return cachedMatches;
            }
            // For current matchday, verify cache has unfiltered matches
            const hasUnfilteredMatches = cachedMatches.some((m: Match) => {
              const isHomeSelected = selectedTeamIds.includes(m.homeTeam?.id);
              const isAwaySelected = selectedTeamIds.includes(m.awayTeam?.id);
              return !isHomeSelected && !isAwaySelected;
            });
            
            if (hasUnfilteredMatches || cachedMatches.length >= 10) {
              console.log(`Using cached matches for matchday ${matchday} (${cachedMatches.length} matches)`);
              return cachedMatches;
            }
          }
        } catch (parseError) {
          console.warn(`Error parsing cached matches for ${cacheKey}:`, parseError);
        }
      }
      
      // If cache doesn't work or is incomplete, fetch from API
      console.log(`Fetching all matches for matchday ${matchday} from API`);
      const response = await getMatches(leagueCode, matchday);
      
      if (!Array.isArray(response)) {
        console.warn(`getMatches returned non-array for matchday ${matchday}`);
        // If API fails and we have cached data, return that instead
        if (cachedMatchesStr && cachedMatchesStr !== 'null' && cachedMatchesStr.trim() !== '') {
          try {
            return JSON.parse(cachedMatchesStr);
          } catch (e) {
            // Ignore
          }
        }
        return [];
      }
      
      // Cache for future use with error handling
      if (response.length > 0) {
        try {
          const matchesWithMatchday = response.map(m => ({
            ...m,
            matchday: matchday
          }));
          localStorage.setItem(cacheKey, JSON.stringify(matchesWithMatchday));
          console.log(`Cached ${matchesWithMatchday.length} matches for matchday ${matchday}`);
        } catch (storageError) {
          console.warn(`Error caching matches for matchday ${matchday}:`, storageError);
        }
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching unfiltered matches:', error);
      // Try to return cached data as fallback
      try {
        const cacheKey = `${leagueCode}_md${matchday}_all`;
        const cachedMatchesStr = localStorage.getItem(cacheKey);
        if (cachedMatchesStr && cachedMatchesStr !== 'null' && cachedMatchesStr.trim() !== '') {
          return JSON.parse(cachedMatchesStr);
        }
      } catch (e) {
        // Ignore
      }
      return [];
    }
  };

  // Process unfiltered matches for race mode
  const processUnfilteredMatches = async (updatedStandings: Standing[]): Promise<Standing[]> => {
    if (!isRaceMode) return updatedStandings;
    
    try {
      // Get completed matchdays and matches with robust error handling for cross-browser compatibility
      let completedMatchdays: Record<string, number[]> = {};
      let completedMatches: Record<string, number[]> = {};
      
      try {
        const matchdaysStr = localStorage.getItem('completedMatchdays');
        const matchesStr = localStorage.getItem('completedMatches');
        
        // Handle browser differences in localStorage (Edge may return null differently)
        if (matchdaysStr && matchdaysStr !== 'null' && matchdaysStr.trim() !== '') {
          completedMatchdays = JSON.parse(matchdaysStr);
        }
        if (matchesStr && matchesStr !== 'null' && matchesStr.trim() !== '') {
          completedMatches = JSON.parse(matchesStr);
        }
      } catch (parseError) {
        console.warn('Error parsing localStorage data:', parseError);
        // Continue with empty objects if parsing fails
      }
      
      const completedMatchdaysForLeague = completedMatchdays[leagueCode] || [];
      
      // For ALL leagues, only process COMPLETED matchdays (not future ones)
      // This prevents processing matches from matchdays that haven't been submitted yet
      // This is the same logic that works for UCL
      let matchdaysToProcess: number[] = [];
      
      // Only process matchdays that are actually completed (submitted by user)
      // Include current matchday as it's being submitted now
      matchdaysToProcess = [...completedMatchdaysForLeague];
      
      // Add current matchday if not already in the list
      if (!matchdaysToProcess.includes(currentMatchday)) {
        matchdaysToProcess.push(currentMatchday);
      }
      
      // Sort to process in order
      matchdaysToProcess.sort((a, b) => a - b);
      
      // Filter out any matchdays that are in the future (beyond current)
      // This prevents processing matchdays that haven't been reached yet
      matchdaysToProcess = matchdaysToProcess.filter(md => md <= currentMatchday);
      
      console.log(`${leagueCode}: Will process matchdays ${matchdaysToProcess.join(', ')} (completed: ${completedMatchdaysForLeague.join(', ')}, current: ${currentMatchday})`);
      
      // Process unfiltered matches for ALL matchdays
      let resultStandings = [...updatedStandings];
      
      // Collect ALL filtered match IDs across ALL matchdays we're processing
      // This ensures we don't miss any matches that were already processed
      const allFilteredMatchIds = new Set<number>();
      
      // Collect from ALL matchdays we're processing
      for (const matchday of matchdaysToProcess) {
        try {
          const matchdayKey = `${leagueCode}_md${matchday}_all`;
          const storedMatchesStr = localStorage.getItem(matchdayKey);
          if (storedMatchesStr && storedMatchesStr !== 'null' && storedMatchesStr.trim() !== '') {
            try {
              const storedMatches = JSON.parse(storedMatchesStr);
              if (Array.isArray(storedMatches)) {
                storedMatches.forEach((m: Match) => {
                  const isHomeSelected = selectedTeamIds.includes(m.homeTeam?.id);
                  const isAwaySelected = selectedTeamIds.includes(m.awayTeam?.id);
                  if (isHomeSelected || isAwaySelected) {
                    allFilteredMatchIds.add(m.id);
                  }
                });
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      // Also include matches that were explicitly marked as completed
      const completedMatchIds = new Set<number>(completedMatches[leagueCode] || []);
      completedMatchIds.forEach(id => allFilteredMatchIds.add(id));
      
      console.log(`${leagueCode}: Collected ${allFilteredMatchIds.size} filtered/processed match IDs from ${matchdaysToProcess.length} matchdays`);
      
      const newlyProcessedMatches: number[] = [];
      
      // Process each matchday in order
      for (const matchday of matchdaysToProcess) {
        try {
          // CRITICAL: Always get matches from localStorage first (not API)
          // API filters out past matches and causes unnecessary API calls
          // localStorage has all matches for completed matchdays
          const allMatchesKey = `${leagueCode}_md${matchday}_all`;
          let allMatches: Match[] = [];
          
          // First, try to get from localStorage (no API call needed)
          try {
            const cachedAllStr = localStorage.getItem(allMatchesKey);
            if (cachedAllStr && cachedAllStr !== 'null' && cachedAllStr.trim() !== '') {
              const cachedAll = JSON.parse(cachedAllStr);
              if (Array.isArray(cachedAll) && cachedAll.length > 0) {
                allMatches = cachedAll;
                console.log(`${leagueCode} MD${matchday}: Found ${allMatches.length} matches in localStorage`);
              }
            }
          } catch (e) {
            console.warn(`${leagueCode} MD${matchday}: Error parsing localStorage:`, e);
          }
          
          // Only use API if localStorage doesn't have matches (shouldn't happen for completed matchdays)
          if (allMatches.length === 0) {
            console.warn(`${leagueCode} MD${matchday}: No matches in localStorage, trying getUnfilteredMatches`);
            allMatches = await getUnfilteredMatches(matchday);
          }
          
          // Validate we have matches
          if (!Array.isArray(allMatches) || allMatches.length === 0) {
            console.warn(`${leagueCode} MD${matchday}: No matches found - skipping`);
            continue;
          }
          
          // Find matches that were filtered out (not involving selected teams) AND haven't been processed
          // CRITICAL: Only process matches from the current or completed matchdays, not future ones
          const unfilteredMatches = allMatches.filter(m => {
            // Check if match involves selected teams (these were already processed)
            const isHomeTeamSelected = selectedTeamIds.includes(m.homeTeam?.id);
            const isAwayTeamSelected = selectedTeamIds.includes(m.awayTeam?.id);
            
            // Exclude matches involving selected teams (these were processed separately)
            if (isHomeTeamSelected || isAwayTeamSelected) {
              return false;
            }
            
            // CRITICAL: Only process matches from this matchday (not future matchdays)
            // This prevents processing matches from matchdays that haven't been submitted
            if (m.matchday && m.matchday !== matchday) {
              console.warn(`Skipping match ${m.id}: matchday mismatch (match is ${m.matchday}, processing ${matchday})`);
              return false;
            }
            
            // Only process matches that haven't been marked as processed
            // We check both allFilteredMatchIds (matches involving selected teams) and completedMatchIds
            return !allFilteredMatchIds.has(m.id);
          });
          
          if (unfilteredMatches.length === 0) {
            console.log(`${leagueCode} MD${matchday}: No unfiltered matches to process (all ${allMatches.length} matches already processed or involve selected teams)`);
            continue;
          }
          
          console.log(`${leagueCode} MD${matchday}: Processing ${unfilteredMatches.length} unfiltered matches (out of ${allMatches.length} total) using mode: ${unfilteredMatchesMode}`);
          
          // Process each unfiltered match with automatic result assignment
          for (const match of unfilteredMatches) {
            // Find team positions in the current standings
            const homeTeam = resultStandings.find(s => s.team.id === match.homeTeam?.id);
            const awayTeam = resultStandings.find(s => s.team.id === match.awayTeam?.id);
            
            if (!homeTeam || !awayTeam) {
              console.warn(`${leagueCode} MD${matchday}: Skipping match ${match.id} - team not found (home: ${match.homeTeam?.id}, away: ${match.awayTeam?.id})`);
              continue;
            }
            
            // Determine result type based on the unfilteredMatchesMode setting
            let resultType: PredictionType = 'draw'; // Default to draw
            
            if (unfilteredMatchesMode === 'auto') {
              // Auto-assign: ≤ 2-place gap → draw; larger gap → higher-placed wins
              resultType = determineAutomaticResult(homeTeam.position, awayTeam.position);
            }
            // For 'draws' mode, we already set it to 'draw' by default
            
            // Create prediction object
            const autoPrediction: Prediction = {
              matchId: match.id,
              type: resultType
            };
            
            // Process prediction and update standings
            const [homeResult, awayResult] = processMatchPrediction(
              autoPrediction,
              match.homeTeam.name,
              match.awayTeam.name
            );
            
            resultStandings = updateStandings(homeResult, awayResult, resultStandings);
            
            // Mark this match as processed
            allFilteredMatchIds.add(match.id);
            newlyProcessedMatches.push(match.id);
          }
        } catch (matchdayError) {
          console.error(`Error processing matchday ${matchday}:`, matchdayError);
          // Continue with next matchday
          continue;
        }
      }
      
      // Update completed matches in localStorage with better error handling
      if (newlyProcessedMatches.length > 0) {
        try {
          if (!completedMatches[leagueCode]) {
            completedMatches[leagueCode] = [];
          }
          // Merge new matches with existing ones
          const existingSet = new Set(completedMatches[leagueCode]);
          newlyProcessedMatches.forEach(id => existingSet.add(id));
          completedMatches[leagueCode] = Array.from(existingSet);
          
          localStorage.setItem('completedMatches', JSON.stringify(completedMatches));
        } catch (storageError) {
          console.error('Error saving completed matches to localStorage:', storageError);
        }
      }
      
      return resultStandings;
    } catch (error) {
      console.error('Error processing unfiltered matches:', error);
      return updatedStandings;
    }
  };

  const handleSubmit = async () => {
    // First phase: visual fading without full loading state
    setIsProcessing(true);
    
    // Log current race mode settings before handling predictions
    console.log(`Submitting predictions with race mode: ${isRaceMode ? 'enabled' : 'disabled'}`);
    console.log(`Race mode settings on submit: ${JSON.stringify({
      isRaceMode,
      selectedTeamIds: selectedTeamIds,
      matchCount: matches.length
    })}`);
    
    // Process data with visual indication but without triggering loading spinner
    let updatedStandings = [...predictedStandings];

    // Store both completed matchday and completed match IDs with robust cross-browser handling
    let completedMatchdays: Record<string, number[]> = {};
    let completedMatches: Record<string, number[]> = {};
    
    try {
      const matchdaysStr = localStorage.getItem('completedMatchdays');
      const matchesStr = localStorage.getItem('completedMatches');
      
      // Handle browser differences in localStorage (Edge may return null differently)
      if (matchdaysStr && matchdaysStr !== 'null' && matchdaysStr.trim() !== '') {
        completedMatchdays = JSON.parse(matchdaysStr);
      }
      if (matchesStr && matchesStr !== 'null' && matchesStr.trim() !== '') {
        completedMatches = JSON.parse(matchesStr);
      }
    } catch (parseError) {
      console.warn('Error parsing localStorage data in handleSubmit:', parseError);
      // Continue with empty objects if parsing fails
    }
    
    if (!completedMatches[leagueCode]) {
      completedMatches[leagueCode] = [];
    }
    
    // Add current match IDs to completed matches
    matches.forEach(match => {
      if (!completedMatches[leagueCode].includes(match.id)) {
        completedMatches[leagueCode].push(match.id);
      }
      
      // Ensure matchday property is set correctly for each match and save to localStorage
      match.matchday = currentMatchday;
      
      // Store each match in localStorage for later retrieval
      // IMPORTANT: We merge with existing matches, not overwrite, to preserve unfiltered matches
      try {
        // Get existing matches for this matchday
        const matchdayKey = `${leagueCode}_md${currentMatchday}_all`;
        const storedMatchesStr = localStorage.getItem(matchdayKey);
        let storedMatches: Match[] = [];
        
        // Handle browser differences in localStorage parsing
        if (storedMatchesStr && storedMatchesStr !== 'null' && storedMatchesStr.trim() !== '') {
          try {
            storedMatches = JSON.parse(storedMatchesStr);
          } catch (parseErr) {
            console.warn(`Error parsing stored matches for ${matchdayKey}:`, parseErr);
            storedMatches = [];
          }
        }
        
        // Check if this match is already stored
        const matchIndex = storedMatches.findIndex((m: Match) => m.id === match.id);
        
        if (matchIndex >= 0) {
          // Update the existing match
          storedMatches[matchIndex] = {
            ...storedMatches[matchIndex],
            ...match,
            matchday: currentMatchday
          };
        } else {
          // Add the new match with matchday information
          storedMatches.push({
            ...match,
            matchday: currentMatchday
          });
        }
        
        // Save back to localStorage with error handling
        // NOTE: We're MERGING, not overwriting, to preserve all matches
        try {
          localStorage.setItem(matchdayKey, JSON.stringify(storedMatches));
        } catch (storageErr) {
          console.error(`Error saving to localStorage for ${matchdayKey}:`, storageErr);
        }
      } catch (e) {
        console.error("Error storing match data in localStorage", e);
      }
    });
    
    // CRITICAL: Before processing unfiltered matches, ensure ALL matches for this matchday are stored
    // This prevents issues where cache only has filtered matches
    // ESPECIALLY IMPORTANT FOR UCL in Edge browser
    if (isRaceMode && leagueCode === 'CL') {
      try {
        const matchdayKey = `${leagueCode}_md${currentMatchday}_all`;
        const existingCache = localStorage.getItem(matchdayKey);
        let needsFullFetch = false;
        
        if (!existingCache || existingCache === 'null' || existingCache.trim() === '[]') {
          needsFullFetch = true;
        } else {
          // Check if cache has all matches (not just filtered)
          try {
            const cachedMatches = JSON.parse(existingCache);
            if (Array.isArray(cachedMatches)) {
              // If cache has fewer than expected matches or no unfiltered matches, fetch fresh
              const hasUnfilteredMatches = cachedMatches.some((m: Match) => {
                const isHomeSelected = selectedTeamIds.includes(m.homeTeam?.id);
                const isAwaySelected = selectedTeamIds.includes(m.awayTeam?.id);
                return !isHomeSelected && !isAwaySelected;
              });
              
              // For UCL, each matchday typically has 8 matches (16 teams playing)
              // If we have fewer than 8 matches or no unfiltered matches, likely incomplete
              if (!hasUnfilteredMatches && cachedMatches.length < 8) {
                needsFullFetch = true;
                console.log(`UCL matchday ${currentMatchday} cache incomplete: ${cachedMatches.length} matches, no unfiltered`);
              }
            }
          } catch (parseErr) {
            needsFullFetch = true;
          }
        }
        
        if (needsFullFetch) {
          console.log(`UCL: Ensuring complete match cache for matchday ${currentMatchday}`);
          // Fetch all matches for this matchday to ensure complete cache
          const allMatchesForMatchday = await getMatches(leagueCode, currentMatchday);
          
          if (Array.isArray(allMatchesForMatchday) && allMatchesForMatchday.length > 0) {
            // Merge with existing matches to avoid duplicates
            const existingMatches = (() => {
              try {
                const cached = localStorage.getItem(matchdayKey);
                if (cached && cached !== 'null' && cached.trim() !== '') {
                  return JSON.parse(cached);
                }
              } catch (e) {
                // Ignore
              }
              return [];
            })();
            
            const existingIds = new Set(existingMatches.map((m: Match) => m.id));
            const newMatches = allMatchesForMatchday.filter((m: Match) => !existingIds.has(m.id));
            const mergedMatches = [
              ...existingMatches.map((m: Match) => ({ ...m, matchday: currentMatchday })),
              ...newMatches.map((m: Match) => ({ ...m, matchday: currentMatchday }))
            ];
            
            try {
              localStorage.setItem(matchdayKey, JSON.stringify(mergedMatches));
              console.log(`UCL: Cached ${mergedMatches.length} total matches for matchday ${currentMatchday} (${newMatches.length} new)`);
            } catch (cacheErr) {
              console.error(`Error caching all matches for matchday ${currentMatchday}:`, cacheErr);
            }
          }
        }
      } catch (err) {
        console.error('Error ensuring complete cache for matchday:', err);
      }
    }
    
    // Update completed matchdays
    completedMatchdays[leagueCode] = [...new Set([...(completedMatchdays[leagueCode] || []), currentMatchday])];
    
    // Save both to localStorage with error handling for cross-browser compatibility
    try {
      localStorage.setItem('completedMatchdays', JSON.stringify(completedMatchdays));
    } catch (err) {
      console.error('Error saving completedMatchdays to localStorage:', err);
    }
    try {
      localStorage.setItem('completedMatches', JSON.stringify(completedMatches));
    } catch (err) {
      console.error('Error saving completedMatches to localStorage:', err);
    }
    
    // Store the current predictions
    const currentPredictions: Record<string, Prediction> = {};
    predictions.forEach((prediction, matchId) => {
      currentPredictions[matchId.toString()] = prediction;
    });
    
    // Update the saved predictions with robust error handling
    try {
      const predictionsStr = localStorage.getItem(`predictions_${leagueCode}`);
      let savedPredictions: Record<string, Prediction> = {};
      
      if (predictionsStr && predictionsStr !== 'null' && predictionsStr.trim() !== '') {
        try {
          savedPredictions = JSON.parse(predictionsStr);
        } catch (parseErr) {
          console.warn(`Error parsing saved predictions for ${leagueCode}:`, parseErr);
          savedPredictions = {};
        }
      }
      
      try {
        localStorage.setItem(`predictions_${leagueCode}`, JSON.stringify({
          ...savedPredictions,
          ...currentPredictions
        }));
      } catch (storageErr) {
        console.error(`Error saving predictions to localStorage for ${leagueCode}:`, storageErr);
      }
    } catch (err) {
      console.error('Error updating saved predictions:', err);
    }

    // Process predictions and update standings
    // Only process matches that have not already been played
    const unplayedMatches = filterAlreadyPlayedMatches(matches);

    unplayedMatches.forEach(match => {
      const prediction = predictions.get(match.id);
      if (prediction) {
        const [homeResult, awayResult] = processMatchPrediction(
          prediction,
          match.homeTeam.name,
          match.awayTeam.name
        );
        updatedStandings = updateStandings(homeResult, awayResult, updatedStandings);
      }
    });

    // Process unfiltered matches for race mode
    if (isRaceMode) {
      updatedStandings = await processUnfilteredMatches(updatedStandings);
    }

    setPredictedStandings(updatedStandings);

    // Only show standings if we're at the very last matchday
    if (currentMatchday === MAX_MATCHDAY) {
      setIsViewingStandings(true);
      setIsProcessing(false);
      return;
    }
    
    // Find the next uncompleted matchday
    let nextMatchday = currentMatchday + 1;
    const completed = completedMatchdays[leagueCode] || [];
    
    // Skip completed matchdays and matchdays 27-30 for LaLiga
    while ((completed.includes(nextMatchday) || (leagueCode === 'PD' && nextMatchday >= 27 && nextMatchday <= 30)) && nextMatchday <= MAX_MATCHDAY) {
      nextMatchday++;
    }
    
    if (nextMatchday > MAX_MATCHDAY) {
      setIsViewingStandings(true);
      setIsProcessing(false);
      return;
    }

    // Use the cached data first - the data should already be prefetched
    if (matchdayCache.current.has(nextMatchday)) {
      console.log(`Using cached data for matchday ${nextMatchday}`);
      const cachedData = matchdayCache.current.get(nextMatchday)!;
      
      // Filter out the problematic LaLiga match if needed
      const laLigaFiltered = filterLaLigaProblematicMatches(cachedData, nextMatchday);
      
      // Filter out matches that have already been played
      const filteredMatches = filterAlreadyPlayedMatches(laLigaFiltered);
      
      // Apply race mode filtering here, before any UI updates
      const raceFilteredMatches = filterMatchesForRaceMode(filteredMatches);
      
      if (raceFilteredMatches.length > 0) {
        // Prepare next matchday data but don't update UI yet
        const nextMatches = raceFilteredMatches;
        const initialPredictions = new Map<number, Prediction>();
        nextMatches.forEach(match => {
          initialPredictions.set(match.id, {
            matchId: match.id,
            type: 'draw'
          });
        });
        
        // Second phase: Update all state at once to avoid flash
        setTimeout(() => {
          setCurrentMatchday(nextMatchday);
          setMatches(nextMatches);
          setPredictions(initialPredictions);
          setIsProcessing(false);
        }, 300);
        return;
      }
    }
    
    // Only fetch from API if cache doesn't have the data (should be rare due to prefetching)
    try {
      console.log(`Cache miss for matchday ${nextMatchday}. Fetching from API.`);
      // Now we need to show loading state since we're making an API call
      setLoading(true);
      
      // Fetch matches for the next matchday
      const request = getMatches(leagueCode, nextMatchday);
      pendingRequests.current.set(nextMatchday, request);
      let matchData = await request;
      pendingRequests.current.delete(nextMatchday);
      
      // Filter LaLiga problematic matches
      if (leagueCode === 'PD') {
        matchData = filterLaLigaProblematicMatches(matchData, nextMatchday);
      }
      
      // Apply filter for already played matches
      matchData = filterAlreadyPlayedMatches(matchData);
      
      // Apply race mode filtering before updating state
      matchData = filterMatchesForRaceMode(matchData);
      
      // Cache the result (store the unfiltered data in cache)
      const unfilteredForCache = filterAlreadyPlayedMatches(
        leagueCode === 'PD' ? filterLaLigaProblematicMatches(await request, nextMatchday) : await request
      );
      matchdayCache.current.set(nextMatchday, unfilteredForCache);
      saveCache();
      
      if (matchData.length > 0) {
        // Prepare next matchday data
        const nextMatches = matchData;
        const initialPredictions = new Map<number, Prediction>();
        nextMatches.forEach(match => {
          initialPredictions.set(match.id, {
            matchId: match.id,
            type: 'draw'
          });
        });
        
        // Update all state at once to avoid flash
        setCurrentMatchday(nextMatchday);
        setMatches(nextMatches);
        setPredictions(initialPredictions);
      } else {
        // If no matches found for this matchday, try the next one
        setCurrentMatchday(nextMatchday + 1);
      }
      
      // Removed prefetching call to avoid additional API requests
    } catch (error) {
      console.error('Error fetching next matchday:', error);
      setError('Failed to fetch next matchday. Please try again.');
    } finally {
      setLoading(false);
      setIsProcessing(false);
    }
  };

  const handleViewStandings = () => {
    // We'll pass a special flag to indicate viewing current standings during predictions
    // Use the previous matchday for standings, not the current one being predicted
    setIsViewingStandings(true);
    // Store the previous matchday in localStorage for reference (the one whose results we're viewing)
    const previousMatchday = currentMatchday > 1 ? currentMatchday - 1 : 1;
    localStorage.setItem('viewingCurrentStandingsFrom', String(previousMatchday));
    // We no longer need to handle the showMiniTable state separately since we're using context
  };

  // Add toggle function for mini table
  const toggleMiniTable = () => {
    const newMode = tableDisplayMode === 'mini' ? 'full' : 'mini';
    setShowMiniTable(newMode === 'mini');
    setTableDisplayMode(newMode);
  };

  // Add this handler function right after handleViewStandings
  const handleNextMatchday = useCallback(() => {
    // Find the next matchday (similar to what we do in handleSubmit)
    let nextMatchday = currentMatchday + 1;
    const completedMatchdays = JSON.parse(localStorage.getItem('completedMatchdays') || '{}');
    const completed = completedMatchdays[leagueCode] || [];
    
    // Skip completed matchdays and matchdays 27-30 for LaLiga
    while ((completed.includes(nextMatchday) || (leagueCode === 'PD' && nextMatchday >= 27 && nextMatchday <= 30)) && nextMatchday <= MAX_MATCHDAY) {
      nextMatchday++;
    }
    
    if (nextMatchday > MAX_MATCHDAY) {
      // We've reached the end, show standings
      setIsViewingStandings(true);
      return;
    }
    
    // Update the current matchday - this will trigger fetchMatches via useEffect
    setCurrentMatchday(nextMatchday);
  }, [currentMatchday, leagueCode, MAX_MATCHDAY, setCurrentMatchday, setIsViewingStandings]);

  // Effect to sync showMiniTable with tableDisplayMode from context
  useEffect(() => {
    setShowMiniTable(tableDisplayMode === 'mini');
  }, [tableDisplayMode]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
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
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        {/* Error component remains the same */}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-8">
        {/* No matches component remains the same */}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Just keep the matchday fixtures header and other elements */}
      <div className="flex justify-center items-center mb-6">
        <h2 className="text-2xl font-bold text-primary">Matchday {currentMatchday} Fixtures</h2>
      </div>

      {/* Improved transition effect */}
      <div className={`transition-opacity duration-300 ${isProcessing ? 'opacity-40' : 'opacity-100'}`}>
        {isRaceMode && matches.length === 0 ? (
          <NoRaceMatches onNextMatchday={handleNextMatchday} />
        ) : (
          <>
            {isMobileSConstrainedView ? (
              // Special layout for smallest mobile screens (320px-340px) - 2 cards per row
              <div className="grid grid-cols-2 gap-1 mx-auto max-w-[310px]">
                {matches.length % 2 === 1 ? (
                  // For odd number of matches, use special handling to center the last one
                  <>
                    {/* First render pairs (all except the last match) */}
                    {matches.slice(0, matches.length - 1).map((match: Match) => (
                      <div key={match.id} className="flex justify-center mb-1">
                        <div className="w-[130px]">
                    <MatchPrediction
                      key={match.id}
                      match={match}
                      onPredictionChange={handlePredictionChange}
                    />
                        </div>
                  </div>
                ))}
                    {/* Then render the last match centered across two columns */}
                    <div className="flex justify-center col-span-2 mt-0.5">
                      <div className="w-[130px]">
                        <MatchPrediction
                          key={matches[matches.length - 1].id}
                          match={matches[matches.length - 1]}
                          onPredictionChange={handlePredictionChange}
                        />
              </div>
                    </div>
                  </>
                ) : (
                  // For even number of matches, regular grid layout
                  matches.map((match: Match) => (
                    <div key={match.id} className="flex justify-center mb-1">
                      <div className="w-[130px]">
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : isMobileMConstrainedView ? (
              // Special layout for smallest mobile screens (340px-375px) - 2 cards per row
              <div className="grid grid-cols-2 gap-2 mx-auto max-w-[340px]">
                {matches.length % 2 === 1 ? (
                  // For odd number of matches, use special handling to center the last one
                  <>
                    {/* First render pairs (all except the last match) */}
                    {matches.slice(0, matches.length - 1).map((match: Match) => (
                      <div key={match.id} className="flex justify-center mb-3">
                        <div className="w-[145px]">
                      <MatchPrediction
                        key={match.id}
                        match={match}
                        onPredictionChange={handlePredictionChange}
                      />
                    </div>
                  </div>
                ))}
                    {/* Then render the last match centered across two columns */}
                    <div className="flex justify-center col-span-2 mt-1">
                      <div className="w-[145px]">
                        <MatchPrediction
                          key={matches[matches.length - 1].id}
                          match={matches[matches.length - 1]}
                          onPredictionChange={handlePredictionChange}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  // For even number of matches, regular grid layout
                  matches.map((match: Match) => (
                    <div key={match.id} className="flex justify-center mb-3">
                      <div className="w-[145px]">
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : isMobileLConstrainedView ? (
              // Special layout for small mobile screens (375px-450px) - 2 cards per row
              <div className="grid grid-cols-2 gap-2 mx-auto max-w-[370px]">
                {matches.length % 2 === 1 ? (
                  // For odd number of matches, use special handling to center the last one
                  <>
                    {/* First render pairs (all except the last match) */}
                    {matches.slice(0, matches.length - 1).map((match: Match) => (
                      <div key={match.id} className="flex justify-center mb-3">
                        <div className="w-[160px]">
                          <MatchPrediction
                            key={match.id}
                            match={match}
                            onPredictionChange={handlePredictionChange}
                          />
                        </div>
                      </div>
                    ))}
                    {/* Then render the last match centered across two columns */}
                    <div className="flex justify-center col-span-2 mt-1">
                      <div className="w-[160px]">
                        <MatchPrediction
                          key={matches[matches.length - 1].id}
                          match={matches[matches.length - 1]}
                          onPredictionChange={handlePredictionChange}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  // For even number of matches, regular grid layout
                  matches.map((match: Match) => (
                    <div key={match.id} className="flex justify-center mb-3">
                      <div className="w-[160px]">
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : isMobileXLConstrainedView ? (
              // Special layout for mobile screens (450px-640px) - 2 cards per row
              <div className="grid grid-cols-2 gap-3 mx-auto max-w-[450px]">
                {matches.length % 2 === 1 ? (
                  // For odd number of matches, use special handling to center the last one
                  <>
                    {/* First render pairs (all except the last match) */}
                    {matches.slice(0, matches.length - 1).map((match: Match) => (
                      <div key={match.id} className="flex justify-center mb-3">
                        <div className="w-[185px]">
                          <MatchPrediction
                            key={match.id}
                            match={match}
                            onPredictionChange={handlePredictionChange}
                          />
                        </div>
                      </div>
                    ))}
                    {/* Then render the last match centered across two columns */}
                    <div className="flex justify-center col-span-2 mt-1">
                      <div className="w-[185px]">
                        <MatchPrediction
                          key={matches[matches.length - 1].id}
                          match={matches[matches.length - 1]}
                          onPredictionChange={handlePredictionChange}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  // For even number of matches, regular grid layout
                  matches.map((match: Match) => (
                    <div key={match.id} className="flex justify-center mb-3">
                      <div className="w-[185px]">
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : isTabletSmallConstrainedView ? (
              // Special layout for small tablets (640px-750px) - 2 cards per row
              <div className="grid grid-cols-2 gap-4 max-w-[460px] mx-auto">
                {matches.length % 2 === 1 ? (
                  // For odd number of matches, use special handling to center the last one
                  <>
                    {/* First render pairs (all except the last match) */}
                    {matches.slice(0, matches.length - 1).map((match: Match) => (
                      <div key={match.id} className="flex justify-center mb-3">
                    <div className="w-[210px]">
                      <MatchPrediction
                        key={match.id}
                        match={match}
                        onPredictionChange={handlePredictionChange}
                      />
                    </div>
                  </div>
                ))}
                    {/* Then render the last match centered across two columns */}
                    <div className="flex justify-center col-span-2 mt-1">
                      <div className="w-[210px]">
                        <MatchPrediction
                          key={matches[matches.length - 1].id}
                          match={matches[matches.length - 1]}
                          onPredictionChange={handlePredictionChange}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  // For even number of matches, regular grid layout
                  matches.map((match: Match) => (
                    <div key={match.id} className="flex justify-center mb-3">
                      <div className="w-[210px]">
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : isMediumConstrainedView ? (
              // Special layout for medium screens (750px-1000px) - 3 cards per row
              <div className="grid grid-cols-3 gap-4 max-w-[700px] mx-auto">
                {matches.length % 3 === 0 ? (
                  // For matches divisible by 3, use regular grid
                  matches.map((match: Match) => (
                    <div key={match.id} className="flex justify-center mb-3">
                      <div className="w-[210px]">
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      </div>
                    </div>
                  ))
                ) : matches.length % 3 === 1 ? (
                  // For matches with remainder 1, center the last card
                  <>
                    {/* First render all complete rows */}
                    {matches.slice(0, matches.length - 1).map((match: Match) => (
                      <div key={match.id} className="flex justify-center mb-3">
                        <div className="w-[210px]">
                          <MatchPrediction
                            key={match.id}
                            match={match}
                            onPredictionChange={handlePredictionChange}
                          />
                        </div>
                      </div>
                    ))}
                    {/* Then render the last match centered */}
                    <div className="flex justify-center col-span-3 mt-1">
                      <div className="w-[210px]">
                        <MatchPrediction
                          key={matches[matches.length - 1].id}
                          match={matches[matches.length - 1]}
                          onPredictionChange={handlePredictionChange}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  // For matches with remainder 2, render normally with placeholders
                  <>
                    {matches.map((match: Match) => (
                      <div key={match.id} className="flex justify-center mb-3">
                        <div className="w-[210px]">
                          <MatchPrediction
                            key={match.id}
                            match={match}
                            onPredictionChange={handlePredictionChange}
                          />
                        </div>
                      </div>
                    ))}
                    {/* Add empty cell for alignment if needed */}
                    {matches.length % 3 === 2 && (
                  <div className="flex justify-center opacity-0"></div>
                    )}
                  </>
                )}
              </div>
            ) : matches.length <= 5 ? (
              // Single row for 5 or fewer matches
              <div className="flex flex-wrap justify-center gap-4 max-w-full md:max-w-none xl:max-w-none lg:max-w-[900px] mx-auto">
                {matches.map((match: Match) => (
                  <div key={match.id} style={{ width: '210px' }}>
                    <MatchPrediction
                      key={match.id}
                      match={match}
                      onPredictionChange={handlePredictionChange}
                    />
                  </div>
                ))}
              </div>
            ) : isSpecificConstrainedView ? (
              // Special handling for 1001px-1025px range (3 cards per row with centering)
              <>
                {/* First row */}
                <div className="flex flex-wrap justify-center gap-4 mb-4 max-w-full mx-auto">
                  {(() => {
                    if (matches.length === 3) {
                      // For exactly 3 matches, display in one row
                      return matches.map((match: Match) => (
                        <div key={match.id} style={{ width: '210px' }}>
                          <MatchPrediction
                            key={match.id}
                            match={match}
                            onPredictionChange={handlePredictionChange}
                          />
                        </div>
                      ));
                    } else if (matches.length === 2) {
                      // For exactly 2 matches, center them
                      return (
                        <>
                          <div style={{ width: 'calc(50% - 210px)', minWidth: '15px' }}></div>
                          {matches.slice(0, 2).map((match: Match) => (
                            <div key={match.id} style={{ width: '210px' }}>
                              <MatchPrediction
                                key={match.id}
                                match={match}
                                onPredictionChange={handlePredictionChange}
                              />
                            </div>
                          ))}
                          <div style={{ width: 'calc(50% - 210px)', minWidth: '15px' }}></div>
                        </>
                      );
                    } else if (matches.length === 1) {
                      // Center a single match
                      return (
                        <>
                          <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                          <div key={matches[0].id} style={{ width: '210px' }}>
                            <MatchPrediction
                              key={matches[0].id}
                              match={matches[0]}
                              onPredictionChange={handlePredictionChange}
                            />
                          </div>
                          <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                        </>
                      );
                    } else {
                      // For more matches, display first 3
                      return matches.slice(0, 3).map((match: Match) => (
                        <div key={match.id} style={{ width: '210px' }}>
                          <MatchPrediction
                            key={match.id}
                            match={match}
                            onPredictionChange={handlePredictionChange}
                          />
                        </div>
                      ));
                    }
                  })()}
                </div>

                {/* Second row (if more than 3 matches) */}
                {matches.length > 3 && (
                  <div className="flex flex-wrap justify-center gap-4 max-w-full mx-auto">
                    {(() => {
                      if (matches.length === 4) {
                        // For 4 matches, center the single match in second row
                        return (
                          <>
                            <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                            <div key={matches[3].id} style={{ width: '210px' }}>
                              <MatchPrediction
                                key={matches[3].id}
                                match={matches[3]}
                                onPredictionChange={handlePredictionChange}
                              />
                            </div>
                            <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                          </>
                        );
                      } else if (matches.length === 5) {
                        // For 5 matches, center the 2 matches in second row
                        return (
                          <>
                            <div style={{ width: 'calc(50% - 210px)', minWidth: '15px' }}></div>
                            {matches.slice(3, 5).map((match: Match) => (
                              <div key={match.id} style={{ width: '210px' }}>
                                <MatchPrediction
                                  key={match.id}
                                  match={match}
                                  onPredictionChange={handlePredictionChange}
                                />
                              </div>
                            ))}
                            <div style={{ width: 'calc(50% - 210px)', minWidth: '15px' }}></div>
                          </>
                        );
                      } else if (matches.length === 6) {
                        // For 6 matches, display 3 in second row
                        return matches.slice(3, 6).map((match: Match) => (
                          <div key={match.id} style={{ width: '210px' }}>
                            <MatchPrediction
                              key={match.id}
                              match={match}
                              onPredictionChange={handlePredictionChange}
                            />
                          </div>
                        ));
                      } else {
                        // For more than 6 matches, display next 3
                        return matches.slice(3, 6).map((match: Match) => (
                          <div key={match.id} style={{ width: '210px' }}>
                            <MatchPrediction
                              key={match.id}
                              match={match}
                              onPredictionChange={handlePredictionChange}
                            />
                          </div>
                        ));
                      }
                    })()}
                  </div>
                )}

                {/* Third row (if more than 6 matches) */}
                {matches.length > 6 && (
                  <div className="flex flex-wrap justify-center gap-4 max-w-full mx-auto mt-4">
                    {(() => {
                      if (matches.length === 7) {
                        // For 7 matches, center the single match in third row
                        return (
                          <>
                            <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                            <div key={matches[6].id} style={{ width: '210px' }}>
                              <MatchPrediction
                                key={matches[6].id}
                                match={matches[6]}
                                onPredictionChange={handlePredictionChange}
                              />
                            </div>
                            <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                          </>
                        );
                      } else if (matches.length === 8) {
                        // For 8 matches, center the 2 matches in third row
                        return (
                          <>
                            <div style={{ width: 'calc(50% - 210px)', minWidth: '15px' }}></div>
                            {matches.slice(6, 8).map((match: Match) => (
                              <div key={match.id} style={{ width: '210px' }}>
                                <MatchPrediction
                                  key={match.id}
                                  match={match}
                                  onPredictionChange={handlePredictionChange}
                                />
                              </div>
                            ))}
                            <div style={{ width: 'calc(50% - 210px)', minWidth: '15px' }}></div>
                          </>
                        );
                      } else {
                        // For 9 or more matches, display next 3
                        return matches.slice(6, 9).map((match: Match) => (
                          <div key={match.id} style={{ width: '210px' }}>
                            <MatchPrediction
                              key={match.id}
                              match={match}
                              onPredictionChange={handlePredictionChange}
                            />
                          </div>
                        ));
                      }
                    })()}
                  </div>
                )}

                {/* Fourth row (if more than 9 matches) */}
                {matches.length > 9 && (
                  <div className="flex flex-wrap justify-center gap-4 max-w-full mx-auto mt-4">
                    {(() => {
                      const remainingCount = matches.length - 9;
                      
                      if (remainingCount === 1) {
                        // Center a single match
                        return (
                          <>
                            <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                            <div key={matches[9].id} style={{ width: '210px' }}>
                              <MatchPrediction
                                key={matches[9].id}
                                match={matches[9]}
                                onPredictionChange={handlePredictionChange}
                              />
                            </div>
                            <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                          </>
                        );
                      } else if (remainingCount === 2) {
                        // Center two matches
                        return (
                          <>
                            <div style={{ width: 'calc(50% - 210px)', minWidth: '15px' }}></div>
                            {matches.slice(9, 11).map((match: Match) => (
                              <div key={match.id} style={{ width: '210px' }}>
                                <MatchPrediction
                                  key={match.id}
                                  match={match}
                                  onPredictionChange={handlePredictionChange}
                                />
                              </div>
                            ))}
                            <div style={{ width: 'calc(50% - 210px)', minWidth: '15px' }}></div>
                          </>
                        );
                      } else {
                        // Display up to three more matches
                        return matches.slice(9, 12).map((match: Match) => (
                          <div key={match.id} style={{ width: '210px' }}>
                            <MatchPrediction
                              key={match.id}
                              match={match}
                              onPredictionChange={handlePredictionChange}
                            />
                          </div>
                        ));
                      }
                    })()}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* First row */}
                <div className="flex flex-wrap justify-center gap-4 mb-4 max-w-full md:max-w-none xl:max-w-none lg:max-w-[900px] mx-auto">
                  {(() => {
                    if (matches.length === 8) {
                      return matches.slice(0, 4).map((match: Match) => (
                        <div key={match.id} style={{ width: '210px' }}>
                          <MatchPrediction
                            key={match.id}
                            match={match}
                            onPredictionChange={handlePredictionChange}
                          />
                        </div>
                      ));
                    } else if (matches.length === 7) {
                      return matches.slice(0, 4).map((match: Match) => (
                        <div key={match.id} style={{ width: '210px' }}>
                          <MatchPrediction
                            key={match.id}
                            match={match}
                            onPredictionChange={handlePredictionChange}
                          />
                        </div>
                      ));
                    } else if (matches.length === 6) {
                      return matches.slice(0, 3).map((match: Match) => (
                        <div key={match.id} style={{ width: '210px' }}>
                          <MatchPrediction
                            key={match.id}
                            match={match}
                            onPredictionChange={handlePredictionChange}
                          />
                        </div>
                      ));
                    } else if (matches.length === 1) {
                      // Center a single match
                      return (
                        <>
                          <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                          <div key={matches[0].id} style={{ width: '210px' }}>
                            <MatchPrediction
                              key={matches[0].id}
                              match={matches[0]}
                              onPredictionChange={handlePredictionChange}
                            />
                          </div>
                          <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                        </>
                      );
                    } else if (isConstrainedView && matches.length === 3) {
                      // For constrained view with 3 matches, use special centering
                      return (
                        <>
                          {matches.slice(0, 3).map((match: Match) => (
                            <div key={match.id} style={{ width: '210px' }}>
                              <MatchPrediction
                                key={match.id}
                                match={match}
                                onPredictionChange={handlePredictionChange}
                              />
                            </div>
                          ))}
                        </>
                      );
                    } else if (isConstrainedView && matches.length === 2) {
                      // For constrained view with 2 matches, center them
                      return (
                        <>
                          <div style={{ width: 'calc(50% - 210px)', minWidth: '15px' }}></div>
                          {matches.slice(0, 2).map((match: Match) => (
                            <div key={match.id} style={{ width: '210px' }}>
                              <MatchPrediction
                                key={match.id}
                                match={match}
                                onPredictionChange={handlePredictionChange}
                              />
                            </div>
                          ))}
                          <div style={{ width: 'calc(50% - 210px)', minWidth: '15px' }}></div>
                        </>
                      );
                    } else {
                      // For constrained view, display only first 4, otherwise 5
                      return matches.slice(0, isConstrainedView ? 4 : 5).map((match: Match) => (
                        <div key={match.id} style={{ width: '210px' }}>
                          <MatchPrediction
                            key={match.id}
                            match={match}
                            onPredictionChange={handlePredictionChange}
                          />
                        </div>
                      ));
                    }
                  })()}
                </div>

                {/* Second row */}
                {matches.length > (isConstrainedView ? 4 : 5) && (
                  <div className="flex flex-wrap justify-center gap-4 max-w-full md:max-w-none xl:max-w-none lg:max-w-[900px] mx-auto">
                    {(() => {
                      if (matches.length === 8) {
                        return matches.slice(4).map((match: Match) => (
                          <div key={match.id} style={{ width: '210px' }}>
                            <MatchPrediction
                              key={match.id}
                              match={match}
                              onPredictionChange={handlePredictionChange}
                            />
                          </div>
                        ));
                      } else if (matches.length === 7) {
                        return matches.slice(4).map((match: Match) => (
                          <div key={match.id} style={{ width: '210px' }}>
                            <MatchPrediction
                              key={match.id}
                              match={match}
                              onPredictionChange={handlePredictionChange}
                            />
                          </div>
                        ));
                      } else if (matches.length === 6) {
                        return matches.slice(3).map((match: Match) => (
                          <div key={match.id} style={{ width: '210px' }}>
                            <MatchPrediction
                              key={match.id}
                              match={match}
                              onPredictionChange={handlePredictionChange}
                            />
                          </div>
                        ));
                      } else if (isConstrainedView && matches.length === 5) {
                        // For constrained view with 5 matches, last match centered
                        return (
                          <>
                            <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                            <div key={matches[4].id} style={{ width: '210px' }}>
                              <MatchPrediction
                                key={matches[4].id}
                                match={matches[4]}
                                onPredictionChange={handlePredictionChange}
                              />
                            </div>
                            <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                          </>
                        );
                      } else {
                        // Calculate remaining matches
                        const remainingMatches = matches.length - (isConstrainedView ? 4 : 5);
                        
                        if (remainingMatches === 1) {
                          // Center a single match
                          const matchIndex = isConstrainedView ? 4 : 5;
                          return (
                            <>
                              <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                              <div key={matches[matchIndex].id} style={{ width: '210px' }}>
                                <MatchPrediction
                                  key={matches[matchIndex].id}
                                  match={matches[matchIndex]}
                                  onPredictionChange={handlePredictionChange}
                                />
                              </div>
                              <div style={{ width: 'calc(50% - 105px)', minWidth: '15px' }}></div>
                            </>
                          );
                        } else if (remainingMatches === 2) {
                          // Center two matches
                          const startIndex = isConstrainedView ? 4 : 5;
                          return (
                            <>
                              <div style={{ width: 'calc(50% - 210px)', minWidth: '15px' }}></div>
                              {matches.slice(startIndex, startIndex + 2).map((match: Match) => (
                                <div key={match.id} style={{ width: '210px' }}>
                                  <MatchPrediction
                                    key={match.id}
                                    match={match}
                                    onPredictionChange={handlePredictionChange}
                                  />
                                </div>
                              ))}
                              <div style={{ width: 'calc(50% - 210px)', minWidth: '15px' }}></div>
                            </>
                          );
                        } else {
                          // For constrained view, start from the 5th, otherwise 6th
                          return matches.slice(isConstrainedView ? 4 : 5).map((match: Match) => (
                            <div key={match.id} style={{ width: '210px' }}>
                              <MatchPrediction
                                key={match.id}
                                match={match}
                                onPredictionChange={handlePredictionChange}
                              />
                            </div>
                          ));
                        }
                      }
                    })()}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className={`flex justify-center ${(isMobileSConstrainedView || isMobileMConstrainedView || isMobileLConstrainedView) ? 'space-x-2 mt-4' : 'space-x-4 mt-8'}`}>
        <button
          onClick={handleSubmit}
          className={`${(isMobileSConstrainedView || isMobileMConstrainedView || isMobileLConstrainedView) ? 'px-4 py-1.5 text-sm border border-[#f7e479]' : 'px-8 py-2 border-2 border-[#f7e479]'} bg-transparent text-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold`}
          disabled={isProcessing || loading}
        >
          Submit Predictions
        </button>
        <button
          onClick={handleViewStandings}
          className={`${(isMobileSConstrainedView || isMobileMConstrainedView || isMobileLConstrainedView) ? 'px-4 py-1.5 text-sm border border-[#f7e479]' : 'px-8 py-2 border-2 border-[#f7e479]'} bg-transparent text-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold`}
          disabled={isProcessing || loading}
        >
          View Standings
        </button>
      </div>
    </div>
  );
} 