'use client';

import { useState, useEffect, useRef } from 'react';
import { Match, Prediction, PredictionType } from '@/types/predictions';
import { getMatches, processMatchPrediction, updateStandings } from '@/services/football-api';
import MatchPrediction from './MatchPrediction';
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
    isViewingStandings,
    setIsViewingStandings,
  } = usePrediction();

  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Map<number, Prediction>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingMatchdays, setIsCheckingMatchdays] = useState(false);
  
  // Get the maximum matchday for this league
  const MAX_MATCHDAY = getMaxMatchday(leagueCode);
  
  // Cache for matchday data to reduce API calls
  const matchdayCache = useRef<Map<number, Match[]>>(new Map());
  // Keep track of matchdays we've already checked to avoid duplicate API calls
  const checkedMatchdays = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fetchMatches = async (matchday: number) => {
      if (loading && checkedMatchdays.current.has(matchday)) {
        return; // Skip if we're already checking this matchday
      }
      
      // Check if this matchday has been completed
      const completedMatchdays = JSON.parse(localStorage.getItem('completedMatchdays') || '{}');
      const isCompleted = completedMatchdays[leagueCode]?.includes(matchday);
      
      // If this matchday is completed, find the next uncompleted matchday
      if (isCompleted && !isCheckingMatchdays) {
        setIsCheckingMatchdays(true);
        // Find the next uncompleted matchday
        let nextUncompleted = matchday;
        const completed = completedMatchdays[leagueCode] || [];
        
        while (completed.includes(nextUncompleted) && nextUncompleted <= MAX_MATCHDAY) {
          nextUncompleted++;
        }
        
        if (nextUncompleted <= MAX_MATCHDAY) {
          setCurrentMatchday(nextUncompleted);
          setIsCheckingMatchdays(false);
          return;
        }
        // If all matchdays are completed, continue with the current one
      }
      
      setLoading(true);
      setError(null);
      checkedMatchdays.current.add(matchday);
      
      try {
        // Use initialMatches if available on first render
        if (initialMatches.length > 0 && !matchdayCache.current.has(matchday)) {
          setMatches(initialMatches);
          matchdayCache.current.set(matchday, initialMatches);
          
          // Initialize predictions with draws
          const initialPredictions = new Map<number, Prediction>();
          initialMatches.forEach(match => {
            initialPredictions.set(match.id, {
              matchId: match.id,
              type: 'draw'
            });
          });
          setPredictions(initialPredictions);
          
          // Initialize standings if needed
          if (predictedStandings.length === 0) {
            setPredictedStandings(initialStandings);
          }
          
          setLoading(false);
          return;
        }
        
        // Check if we have cached data for this matchday
        if (matchdayCache.current.has(matchday)) {
          const cachedData = matchdayCache.current.get(matchday)!;
          setMatches(cachedData);
          
          // Initialize predictions if we have matches
          if (cachedData.length > 0) {
            const initialPredictions = new Map<number, Prediction>();
            cachedData.forEach(match => {
              initialPredictions.set(match.id, {
                matchId: match.id,
                type: 'draw'
              });
            });
            setPredictions(initialPredictions);
            
            // Initialize standings if needed
            if (predictedStandings.length === 0) {
              setPredictedStandings(initialStandings);
            }
            
            setLoading(false);
            return;
          }
        }
        
        // Fetch from API if not cached
        const matchData = await getMatches(leagueCode, matchday);
        // Cache the result
        matchdayCache.current.set(matchday, matchData);
        
        // If no matches available for this matchday, try to find the next available matchday
        if (matchData.length === 0 && !isCheckingMatchdays && matchday < MAX_MATCHDAY) {
          setIsCheckingMatchdays(true);
          findNextAvailableMatchday(matchday);
          return;
        }
        
        setMatches(matchData);
        
        // Initialize predictions with draws
        if (matchData.length > 0) {
          const initialPredictions = new Map<number, Prediction>();
          matchData.forEach(match => {
            initialPredictions.set(match.id, {
              matchId: match.id,
              type: 'draw'
            });
          });
          setPredictions(initialPredictions);

          // Initialize standings if needed
          if (predictedStandings.length === 0) {
            setPredictedStandings(initialStandings);
          }
        }
        
        setIsCheckingMatchdays(false);
      } catch (error: any) {
        console.error('Error fetching matches:', error);
        setError(error.response?.data?.error || 'Failed to fetch matches. Please try again later.');
        setIsCheckingMatchdays(false);
      } finally {
        setLoading(false);
      }
    };

    const findNextAvailableMatchday = async (startMatchday: number) => {
      // Use a more efficient approach with fewer API calls
      // First, try the next few matchdays (most likely to have matches)
      const nextFewMatchdays = [
        startMatchday + 1,
        startMatchday + 2,
        startMatchday - 1
      ].filter(md => md >= 1 && md <= MAX_MATCHDAY);
      
      for (const md of nextFewMatchdays) {
        if (checkedMatchdays.current.has(md)) {
          const cachedData = matchdayCache.current.get(md);
          if (cachedData && cachedData.length > 0) {
            setCurrentMatchday(md);
            return;
          }
          continue; // Skip if already checked and no matches
        }
        
        try {
          checkedMatchdays.current.add(md);
          const matchData = await getMatches(leagueCode, md);
          matchdayCache.current.set(md, matchData);
          
          if (matchData.length > 0) {
            // Found a matchday with matches
            setCurrentMatchday(md);
            return;
          }
        } catch (error) {
          console.error(`Error checking matchday ${md}:`, error);
        }
      }
      
      // If still no matches found, we won't check every single matchday
      // Just show the no matches UI for the current matchday
      setIsCheckingMatchdays(false);
      setLoading(false);
    };

    fetchMatches(currentMatchday);
  }, [leagueCode, currentMatchday, initialMatches, initialStandings, predictedStandings, setPredictedStandings]);

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

  const handleSubmit = async () => {
    let updatedStandings = [...predictedStandings];

    // Store the current matchday as completed
    const completedMatchdays = JSON.parse(localStorage.getItem('completedMatchdays') || '{}');
    completedMatchdays[leagueCode] = [...(completedMatchdays[leagueCode] || []), currentMatchday];
    localStorage.setItem('completedMatchdays', JSON.stringify(completedMatchdays));

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

    setPredictedStandings(updatedStandings);

    // Only show standings if we're at the very last matchday
    if (currentMatchday === MAX_MATCHDAY) {
      setIsViewingStandings(true);
      return;
    }
    
    // Find the next matchday with matches using cached data if possible
    setLoading(true);
    
    // Try more matchdays to handle gaps from cancelled matches
    let foundNextMatchday = false;
    
    // Check up to 10 matchdays ahead to handle larger gaps
    for (let offset = 1; offset <= 10; offset++) {
      const nextMatchday = currentMatchday + offset;
      if (nextMatchday > MAX_MATCHDAY) {
        // If we've hit the last matchday, show the standings
        setIsViewingStandings(true);
        setLoading(false);
        return;
      }
      
      // Skip if this matchday was already completed
      if (completedMatchdays[leagueCode]?.includes(nextMatchday)) {
        continue;
      }
      
      // Check cache first
      if (matchdayCache.current.has(nextMatchday)) {
        const cachedMatches = matchdayCache.current.get(nextMatchday)!;
        if (cachedMatches.length > 0) {
          setCurrentMatchday(nextMatchday);
          setLoading(false);
          foundNextMatchday = true;
          return;
        }
      } else if (!checkedMatchdays.current.has(nextMatchday)) {
        // If not in cache and not checked yet, check it
        try {
          checkedMatchdays.current.add(nextMatchday);
          const matchData = await getMatches(leagueCode, nextMatchday);
          matchdayCache.current.set(nextMatchday, matchData);
          
          if (matchData.length > 0) {
            setCurrentMatchday(nextMatchday);
            setLoading(false);
            foundNextMatchday = true;
            return;
          }
        } catch (error) {
          console.error(`Error checking matchday ${nextMatchday}:`, error);
        }
      }
    }
    
    // If not found in the checked matchdays, show the final standings
    if (!foundNextMatchday) {
      setIsViewingStandings(true);
    }
    setLoading(false);
  };

  const handleViewStandings = () => {
    // We'll pass a special flag to indicate viewing current standings during predictions
    setIsViewingStandings(true);
    // Store the current matchday in localStorage for reference
    localStorage.setItem('viewingCurrentStandingsFrom', String(currentMatchday));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 h-32 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <h3 className="text-xl font-medium text-red-600">Error</h3>
        <p className="mt-2 text-gray-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-8">
        <h3 className="text-xl font-medium text-gray-900">No Matches Available</h3>
        <p className="mt-2 text-gray-600">There are no scheduled matches for matchday {currentMatchday}.</p>
        <div className="flex flex-col gap-3 mt-4 items-center">
          {!isCheckingMatchdays && (
            <button
              onClick={() => {
                setIsCheckingMatchdays(true);
                findNextAvailableMatchday(currentMatchday);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              Find Next Available Matchday
            </button>
          )}
          <button
            onClick={() => {
              // Reset completed matchdays for this league
              const completedMatchdays = JSON.parse(localStorage.getItem('completedMatchdays') || '{}');
              completedMatchdays[leagueCode] = [];
              localStorage.setItem('completedMatchdays', JSON.stringify(completedMatchdays));
              // Reload the page
              window.location.reload();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
          >
            Reset Progress (Fix Issues)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Matchday {currentMatchday} Predictions</h2>
          <p className="text-sm text-gray-500 mt-1">
            Make your predictions for each match
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleViewStandings}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
          >
            View Current Standings
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          >
            Submit Predictions
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {matches.map(match => (
          <MatchPrediction
            key={match.id}
            match={match}
            onPredictionChange={handlePredictionChange}
          />
        ))}
      </div>

      <div className="text-sm text-gray-500 text-center pt-4 border-t border-gray-200">
        Matchday {currentMatchday} of {MAX_MATCHDAY}
      </div>
    </div>
  );
} 