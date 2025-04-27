'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import LeagueSelector from '@/components/Standings/LeagueSelector';
import StandingsTable from '@/components/Standings/StandingsTable';
import PredictionForm from '@/components/Predictions/PredictionForm';
import ModeSelection from '@/components/Predictions/ModeSelection';
import { getStandings, Standing, getCurrentMatchday, getMatches, getLeagueData } from '@/services/football-api';
import { usePrediction } from '@/contexts/PredictionContext';
import { Match } from '@/types/predictions';

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
  // Premier League, La Liga, Serie A have 20 teams (38 matchdays)
  return 38;
};

export default function Home() {
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPredictions, setShowPredictions] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [viewingFromMatchday, setViewingFromMatchday] = useState<number | null>(null);
  
  // Cache for API data to reduce calls
  const matchdayCache = useRef<Map<string, number>>(new Map());
  const matchesCache = useRef<Map<string, Match[]>>(new Map());
  const standingsCache = useRef<Map<string, Standing[]>>(new Map());
  // Add state to pass fetched matches to PredictionForm
  const [initialMatches, setInitialMatches] = useState<Match[]>([]);

  const {
    isViewingStandings,
    setIsViewingStandings,
    predictedStandings,
    currentMatchday,
    resetPredictions,
    setCurrentMatchday,
    setIsRaceMode,
    setSelectedTeamIds
  } = usePrediction();

  // Determine the max matchday for the currently selected league
  const maxMatchday = selectedLeague ? getMaxMatchday(selectedLeague) : 38;
  
  // Check if we're at the final matchday for the current league
  const isFinalMatchday = currentMatchday >= maxMatchday;

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
    
    fetchData();
  }, [selectedLeague, fetchData]);

  const handleStartPredictions = async () => {
    if (!selectedLeague) return;
    
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
      
      // Show mode selection instead of predictions directly
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

  const handleModeSelect = (mode: 'normal' | 'race', selectedTeams?: number[]) => {
    // Set mode in context
    setIsRaceMode(mode === 'race');
    
    // Set selected teams if in race mode
    if (mode === 'race' && selectedTeams && selectedTeams.length > 0) {
      setSelectedTeamIds(selectedTeams);
    } else {
      setSelectedTeamIds([]);
    }
    
    // Show predictions
    setShowModeSelection(false);
    setShowPredictions(true);
  };

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
      <main className="min-h-screen bg-background overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 pt-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-primary mb-4">League Caster</h1>
            <p className="text-large text-secondary">Select a league to view standings and start forecasting</p>
          </div>
        </div>
        <div className="w-full">
          <LeagueSelector onLeagueSelect={setSelectedLeague} />
        </div>
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mt-10 text-white font-medium text-lg">
            Season 2024/2025
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
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-primary">League Standings</h1>
            <button
              onClick={() => {
                setSelectedLeague(null);
                setShowPredictions(false);
                setShowModeSelection(false);
                setIsViewingStandings(false);
                setViewingFromMatchday(null);
              }}
              className="mt-2 text-accent hover:text-accent-hover transition-transform hover:scale-105"
            >
              ← Back to leagues
            </button>
          </div>
        </div>

        {(!showPredictions && !showModeSelection) || isViewingStandings ? (
          <div className="bg-card rounded-lg p-6">
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <h2 className="text-2xl font-bold text-primary mb-2 sm:mb-0">Current Standings</h2>
                <div className="flex space-x-4">
                  {isViewingStandings && !loading && viewingFromMatchday && (
                    <button
                      onClick={() => {
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
                      }}
                      className="px-8 py-2 bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
                    >
                      Back to Predictions
                    </button>
                  )}
                  {!isViewingStandings && (
                    <button
                      onClick={handleStartPredictions}
                      className="px-8 py-2 bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
                    >
                      Start Forecasting
                    </button>
                  )}
                </div>
              </div>
            </div>
            <StandingsTable 
              standings={isViewingStandings && !viewingFromMatchday ? predictedStandings : viewingFromMatchday ? predictedStandings : standings} 
              initialStandings={isViewingStandings || viewingFromMatchday ? standings : undefined}
              loading={false} 
              leagueCode={selectedLeague || undefined}
            />
          </div>
        ) : showModeSelection ? (
          <ModeSelection 
            leagueCode={selectedLeague || ''}
            standings={standings}
            onModeSelect={handleModeSelect}
          />
        ) : (
          <div className="bg-card rounded-lg p-6">
            <PredictionForm
              leagueCode={selectedLeague || ''}
              initialStandings={standings}
              initialMatches={initialMatches}
            />
          </div>
        )}
      </div>
    </main>
  );
}
