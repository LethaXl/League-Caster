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
}

const MAX_MATCHDAY = 38;

export default function PredictionForm({ leagueCode, initialStandings }: PredictionFormProps) {
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
  
  // Cache for matchday data to reduce API calls
  const matchdayCache = useRef<Map<number, Match[]>>(new Map());
  // Keep track of matchdays we've already checked to avoid duplicate API calls
  const checkedMatchdays = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fetchMatches = async (matchday: number) => {
      if (loading && checkedMatchdays.current.has(matchday)) {
        return; // Skip if we're already checking this matchday
      }
      
      setLoading(true);
      setError(null);
      checkedMatchdays.current.add(matchday);
      
      try {
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
  }, [leagueCode, currentMatchday]);

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

    if (currentMatchday === MAX_MATCHDAY) {
      setIsViewingStandings(true);
      return;
    }
    
    // Find the next matchday with matches using cached data if possible
    setLoading(true);
    
    // Try the next couple matchdays first (most likely to have matches)
    for (let offset = 1; offset <= 3; offset++) {
      const nextMatchday = currentMatchday + offset;
      if (nextMatchday > MAX_MATCHDAY) break;
      
      // Check cache first
      if (matchdayCache.current.has(nextMatchday)) {
        const cachedMatches = matchdayCache.current.get(nextMatchday)!;
        if (cachedMatches.length > 0) {
          setCurrentMatchday(nextMatchday);
          setLoading(false);
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
            return;
          }
        } catch (error) {
          console.error(`Error checking matchday ${nextMatchday}:`, error);
        }
      }
    }
    
    // If not found in the next few, just go to view standings
    setIsViewingStandings(true);
    setLoading(false);
  };

  const handleViewStandings = () => {
    setIsViewingStandings(true);
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
        {!isCheckingMatchdays && (
          <button
            onClick={() => {
              setIsCheckingMatchdays(true);
              findNextAvailableMatchday(currentMatchday);
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          >
            Find Next Available Matchday
          </button>
        )}
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
            {currentMatchday === MAX_MATCHDAY ? 'Show Final Table' : 'Submit Predictions'}
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