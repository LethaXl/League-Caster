'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  // Keep track of ongoing API calls
  const pendingRequests = useRef<Map<number, Promise<Match[]>>>(new Map());

  // Load cached data from localStorage on mount
  useEffect(() => {
    const savedCache = localStorage.getItem(`matchdayCache_${leagueCode}`);
    if (savedCache) {
      const parsedCache = JSON.parse(savedCache);
      matchdayCache.current = new Map(Object.entries(parsedCache).map(([key, value]) => [parseInt(key), value as Match[]]));
    }
  }, [leagueCode]);

  // Save cache to localStorage whenever it changes
  const saveCache = useCallback(() => {
    const cacheObj = Object.fromEntries(matchdayCache.current.entries());
    localStorage.setItem(`matchdayCache_${leagueCode}`, JSON.stringify(cacheObj));
  }, [leagueCode]);

  const fetchMatches = async (matchday: number) => {
    // Skip matchdays 27-30 for LaLiga
    if (leagueCode === 'PD' && matchday >= 27 && matchday <= 30) {
      // Move to matchday 31 if we're in the skipped range
      setCurrentMatchday(31);
      return;
    }

    // Only skip if we've already checked this matchday
    if (checkedMatchdays.current.has(matchday)) {
      return;
    }
    
    setLoading(true);
    setError(null);
    checkedMatchdays.current.add(matchday);
    
    try {
      // Use initialMatches if available on first render
      if (initialMatches.length > 0 && !matchdayCache.current.has(matchday)) {
        // Filter out already predicted matches
        const completedMatches = JSON.parse(localStorage.getItem('completedMatches') || '{}');
        const unpredictedMatches = initialMatches.filter(
          match => !completedMatches[leagueCode]?.includes(match.id)
        );
        
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
          
          setLoading(false);
          return;
        }
      }
      
      // Check if we have cached data for this matchday
      if (matchdayCache.current.has(matchday)) {
        const cachedData = matchdayCache.current.get(matchday)!;
        if (cachedData.length > 0) {
          setMatches(cachedData);
          
          // Initialize predictions if we have matches
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
            const deepCopyStandings = initialStandings.map(standing => ({
              ...standing,
              team: { ...standing.team }
            }));
            setPredictedStandings(deepCopyStandings);
          }
          
          setLoading(false);
          return;
        }
      }
      
      // Check if there's already a pending request for this matchday
      if (pendingRequests.current.has(matchday)) {
        const matchData = await pendingRequests.current.get(matchday);
        return;
      }
      
      // Fetch from API if not cached
      const request = getMatches(leagueCode, matchday);
      pendingRequests.current.set(matchday, request);
      
      const matchData = await request;
      pendingRequests.current.delete(matchday);
      
      matchdayCache.current.set(matchday, matchData);
      saveCache();
      
      if (matchData.length === 0) {
        // If no matches available, try the next matchday
        if (matchday < MAX_MATCHDAY) {
          setCurrentMatchday(matchday + 1);
          return;
        }
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
          const deepCopyStandings = initialStandings.map(standing => ({
            ...standing,
            team: { ...standing.team }
          }));
          setPredictedStandings(deepCopyStandings);
        }
      }
    } catch (error: any) {
      console.error('Error fetching matches:', error);
      setError(error.response?.data?.error || 'Failed to fetch matches. Please try again later.');
      pendingRequests.current.delete(matchday);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

    setPredictedStandings(updatedStandings);

    // Only show standings if we're at the very last matchday
    if (currentMatchday === MAX_MATCHDAY) {
      setIsViewingStandings(true);
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
      return;
    }

    // Check if we already have the next matchday's data in cache
    if (matchdayCache.current.has(nextMatchday)) {
      const cachedData = matchdayCache.current.get(nextMatchday)!;
      if (cachedData.length > 0) {
        setCurrentMatchday(nextMatchday);
        setMatches(cachedData);
        
        // Initialize predictions with draws
        const initialPredictions = new Map<number, Prediction>();
        cachedData.forEach(match => {
          initialPredictions.set(match.id, {
            matchId: match.id,
            type: 'draw'
          });
        });
        setPredictions(initialPredictions);
        return;
      }
    }
    
    // Set loading state
    setLoading(true);
    
    try {
      // Check if there's already a pending request
      let matchData: Match[];
      if (pendingRequests.current.has(nextMatchday)) {
        const pendingData = await pendingRequests.current.get(nextMatchday);
        if (!pendingData) {
          throw new Error('Failed to fetch matches');
        }
        matchData = pendingData;
      } else {
        // Fetch matches for the next matchday
        const request = getMatches(leagueCode, nextMatchday);
        pendingRequests.current.set(nextMatchday, request);
        matchData = await request;
        pendingRequests.current.delete(nextMatchday);
        
        // Cache the result
        matchdayCache.current.set(nextMatchday, matchData);
        saveCache();
      }
      
      if (matchData.length > 0) {
        // Update the current matchday and matches
        setCurrentMatchday(nextMatchday);
        setMatches(matchData);
        
        // Initialize predictions with draws
        const initialPredictions = new Map<number, Prediction>();
        matchData.forEach(match => {
          initialPredictions.set(match.id, {
            matchId: match.id,
            type: 'draw'
          });
        });
        setPredictions(initialPredictions);
      } else {
        // If no matches found for this matchday, try the next one
        setCurrentMatchday(nextMatchday + 1);
      }
    } catch (error) {
      console.error('Error fetching next matchday:', error);
      setError('Failed to fetch next matchday. Please try again.');
      pendingRequests.current.delete(nextMatchday);
    } finally {
      setLoading(false);
    }
  };

  const handleViewStandings = () => {
    // We'll pass a special flag to indicate viewing current standings during predictions
    setIsViewingStandings(true);
    // Store the current matchday in localStorage for reference
    localStorage.setItem('viewingCurrentStandingsFrom', String(currentMatchday));
  };

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
        <h3 className="text-xl font-medium text-red-400">Error</h3>
        <p className="mt-2 text-secondary">{error}</p>
        <button
          onClick={() => {
            checkedMatchdays.current.clear();
            matchdayCache.current.clear();
            fetchMatches(currentMatchday);
          }}
          className="mt-4 px-4 py-2 bg-accent text-white rounded-full hover:bg-accent-hover transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-8">
        <h3 className="text-xl font-medium text-primary">No Matches Available</h3>
        <p className="mt-2 text-secondary">There are no scheduled matches for matchday {currentMatchday}.</p>
        <div className="flex flex-col gap-3 mt-4 items-center">
          {!isCheckingMatchdays && currentMatchday < MAX_MATCHDAY && (
            <button
              onClick={() => {
                setIsCheckingMatchdays(true);
                setCurrentMatchday(currentMatchday + 1);
              }}
              className="px-4 py-2 bg-accent text-white rounded-full hover:bg-accent-hover transition-colors"
            >
              Find Next Available Matchday
            </button>
          )}
          <button
            onClick={() => {
              const completedMatchdays = JSON.parse(localStorage.getItem('completedMatchdays') || '{}');
              completedMatchdays[leagueCode] = [];
              localStorage.setItem('completedMatchdays', JSON.stringify(completedMatchdays));
              window.location.reload();
            }}
            className="px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            Reset Progress (Fix Issues)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center items-center mb-6">
        <h2 className="text-2xl font-bold text-primary">Matchday {currentMatchday} Fixtures</h2>
      </div>

      {/* First row - center if only one match */}
      <div className={`grid grid-cols-5 gap-4 ${matches.length === 1 ? 'justify-items-center' : ''}`}>
        {matches.length === 1 ? (
          <div className="col-start-3">
            <MatchPrediction
              key={matches[0].id}
              match={matches[0]}
              onPredictionChange={handlePredictionChange}
            />
          </div>
        ) : (
          matches.slice(0, 5).map(match => (
            <MatchPrediction
              key={match.id}
              match={match}
              onPredictionChange={handlePredictionChange}
            />
          ))
        )}
      </div>

      {/* Second row */}
      {matches.length > 5 && (
        <div className={`grid ${matches.length === 9 ? 'grid-cols-4 ml-[0%]' : 'grid-cols-5'} gap-4`}>
          {matches.slice(5).map(match => (
            <MatchPrediction
              key={match.id}
              match={match}
              onPredictionChange={handlePredictionChange}
            />
          ))}
        </div>
      )}

      <div className="flex justify-center space-x-4 mt-8">
        <button
          onClick={handleSubmit}
          className="px-8 py-2 bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
        >
          Submit Predictions
        </button>
        <button
          onClick={handleViewStandings}
          className="px-8 py-2 bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
        >
          View Standings
        </button>
      </div>
    </div>
  );
} 