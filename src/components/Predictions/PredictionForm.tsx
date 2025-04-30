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
    unfilteredMatchesMode
  } = usePrediction();

  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Map<number, Prediction>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
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
    if (!isRaceMode || selectedTeamIds.length === 0) {
      return matches;
    }
    
    return matches.filter(match => {
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
        
        // Disabling automatic prefetching to prevent unwanted API calls
        /* Original code commented out
        // If there's no prefetching in progress, initiate prefetching
        if (!localStorage.getItem(`prefetching_${leagueCode}`)) {
          // Add a slight delay to ensure the initial fetch completes first
          setTimeout(() => {
            prefetchRemainingMatchdays(currentMatchday);
          }, 1000);
        }
        */
      } catch (e) {
        console.error("Error parsing cache:", e);
      }
    }
    
    // Fetch data for the current matchday
    fetchMatches(currentMatchday);
  }, [leagueCode, currentMatchday, fetchMatches, saveCache, shouldRefreshCache, clearCache, prefetchRemainingMatchdays]);

  useEffect(() => {
    fetchMatches(currentMatchday);
    
    // Safety timeout to prevent infinite loading
    const safetyTimer = setTimeout(() => {
      if (loading) {
        console.log('Safety timeout triggered - resetting loading state');
        setLoading(false);
      }
    }, 20000); // 20 seconds
    
    return () => clearTimeout(safetyTimer);
  }, [leagueCode, currentMatchday, fetchMatches, loading, setLoading]);

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
      // Try to get from cache first
      const cacheKey = `${leagueCode}_md${matchday}_all`;
      const cachedMatches = localStorage.getItem(cacheKey);
      
      if (cachedMatches) {
        return JSON.parse(cachedMatches);
      }
      
      // Otherwise fetch from API
      const response = await getMatches(leagueCode, matchday);
      
      // Cache for future use
      localStorage.setItem(cacheKey, JSON.stringify(response));
      
      return response;
    } catch (error) {
      console.error('Error fetching unfiltered matches:', error);
      return [];
    }
  };

  // Process unfiltered matches for race mode
  const processUnfilteredMatches = async (updatedStandings: Standing[]): Promise<Standing[]> => {
    if (!isRaceMode) return updatedStandings;
    
    try {
      // Get all matches for the current matchday
      const allMatches = await getUnfilteredMatches(currentMatchday);
      
      // Find matches that were filtered out (not in the current matches list)
      const filteredMatches = new Set(matches.map(m => m.id));
      const unfilteredMatches = allMatches.filter(m => !filteredMatches.has(m.id));
      
      if (unfilteredMatches.length === 0) return updatedStandings;
      
      console.log(`Processing ${unfilteredMatches.length} unfiltered matches using mode: ${unfilteredMatchesMode}`);
      
      // Process each unfiltered match with automatic result assignment
      let resultStandings = [...updatedStandings];
      
      for (const match of unfilteredMatches) {
        // Find team positions in the current standings
        const homeTeam = resultStandings.find(s => s.team.id === match.homeTeam.id);
        const awayTeam = resultStandings.find(s => s.team.id === match.awayTeam.id);
        
        if (!homeTeam || !awayTeam) continue;
        
        // Determine result type based on the unfilteredMatchesMode setting
        let resultType: PredictionType = 'draw'; // Default to draw
        
        if (unfilteredMatchesMode === 'auto') {
          // Auto-assign based on team positions
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
    
    // Process data with visual indication but without triggering loading spinner
    let updatedStandings = [...predictedStandings];

    // Store both completed matchday and completed match IDs
    const completedMatchdays = JSON.parse(localStorage.getItem('completedMatchdays') || '{}');
    const completedMatches = JSON.parse(localStorage.getItem('completedMatches') || '{}');
    
    if (!completedMatches[leagueCode]) {
      completedMatches[leagueCode] = [];
    }
    
    // Add current match IDs to completed matches
    matches.forEach(match => {
      if (!completedMatches[leagueCode].includes(match.id)) {
        completedMatches[leagueCode].push(match.id);
      }
    });
    
    // Update completed matchdays
    completedMatchdays[leagueCode] = [...(completedMatchdays[leagueCode] || []), currentMatchday];
    
    // Save both to localStorage
    localStorage.setItem('completedMatchdays', JSON.stringify(completedMatchdays));
    localStorage.setItem('completedMatches', JSON.stringify(completedMatches));

    // Process predictions and update standings
    matches.forEach(match => {
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
            {matches.length <= 5 ? (
              // Single row for 5 or fewer matches
              <div className={`grid gap-4 mx-auto ${
                matches.length === 1 ? 'grid-cols-1' : 
                matches.length === 2 ? 'grid-cols-2' :
                matches.length === 3 ? 'grid-cols-3' :
                matches.length === 4 ? 'grid-cols-4' :
                'grid-cols-5 w-full'
              }`} style={{ width: matches.length <= 4 ? `${matches.length * 230}px` : '100%' }}>
                {matches.map(match => (
                  <div key={match.id} style={{ width: '210px', height: '200px' }}>
                    <MatchPrediction
                      key={match.id}
                      match={match}
                      onPredictionChange={handlePredictionChange}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* First row */}
                <div className={`grid gap-4 ${
                  matches.length === 8 ? 'grid-cols-4 w-full' : 
                  matches.length === 7 ? 'grid-cols-4 w-full' : 
                  matches.length === 6 ? 'grid-cols-3 w-full' : 
                  'grid-cols-5 w-full'
                }`}>
                  {(() => {
                    if (matches.length === 8) {
                      return matches.slice(0, 4).map(match => (
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      ));
                    } else if (matches.length === 7) {
                      return matches.slice(0, 4).map(match => (
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      ));
                    } else if (matches.length === 6) {
                      return matches.slice(0, 3).map(match => (
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      ));
                    } else {
                      return matches.slice(0, 5).map(match => (
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      ));
                    }
                  })()}
                </div>

                {/* Add gap between rows */}
                <div className="h-6"></div>

                {/* Second row */}
                <div className={`grid gap-4 ${
                  matches.length === 8 ? 'grid-cols-4 w-full' : 
                  matches.length === 7 ? 'grid-cols-3 w-full' : 
                  matches.length === 6 ? 'grid-cols-3 w-full' : 
                  matches.length === 9 ? 'grid-cols-4 w-full' : 
                  'grid-cols-5 w-full'
                }`}>
                  {(() => {
                    if (matches.length === 8) {
                      return matches.slice(4).map(match => (
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      ));
                    } else if (matches.length === 7) {
                      return matches.slice(4).map(match => (
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      ));
                    } else if (matches.length === 6) {
                      return matches.slice(3).map(match => (
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      ));
                    } else {
                      return matches.slice(5).map(match => (
                        <MatchPrediction
                          key={match.id}
                          match={match}
                          onPredictionChange={handlePredictionChange}
                        />
                      ));
                    }
                  })()}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex justify-center space-x-4 mt-8">
        <button
          onClick={handleSubmit}
          className="px-8 py-2 bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
          disabled={isProcessing || loading}
        >
          Submit Predictions
        </button>
        <button
          onClick={handleViewStandings}
          className="px-8 py-2 bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
          disabled={isProcessing || loading}
        >
          View Standings
        </button>
      </div>
    </div>
  );
} 