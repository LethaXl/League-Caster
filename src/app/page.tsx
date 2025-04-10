'use client';

import { useState, useEffect, useRef } from 'react';
import LeagueSelector from '@/components/Standings/LeagueSelector';
import StandingsTable from '@/components/Standings/StandingsTable';
import PredictionForm from '@/components/Predictions/PredictionForm';
import { getStandings, Standing, getCurrentMatchday, getMatches, getLeagueData } from '@/services/football-api';
import { usePrediction } from '@/contexts/PredictionContext';
import { Match } from '@/types/predictions';

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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Make sure selectedLeague is not null
      if (!selectedLeague) {
        console.error("League not selected");
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
        } catch (error) {
          console.error('Combined endpoint failed, falling back to separate requests:', error);
          
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
        }
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.response?.data?.error || 'Failed to fetch data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedLeague) return;
    
    fetchData();
  }, [selectedLeague]);

  const handleStartPredictions = async () => {
    if (!selectedLeague) return;
    
    setLoading(true);
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
      setShowPredictions(true);
    } catch (error: any) {
      console.error('Error fetching current matchday:', error);
      setError(error.response?.data?.error || 'Failed to start predictions. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <h3 className="text-xl font-medium text-red-600">Error</h3>
            <p className="mt-2 text-gray-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedLeague) {
    return (
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">League Caster</h1>
            <p className="text-xl text-gray-600">Select a league to view standings and make predictions</p>
          </div>
          <LeagueSelector onLeagueSelect={setSelectedLeague} />
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">League Standings</h1>
            <button
              onClick={() => {
                setSelectedLeague(null);
                setShowPredictions(false);
                setIsViewingStandings(false);
                setViewingFromMatchday(null);
              }}
              className="mt-2 text-blue-600 hover:text-blue-800"
            >
              ← Back to leagues
            </button>
          </div>
        </div>

        {!showPredictions || isViewingStandings ? (
          <div className="bg-white shadow rounded-lg">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {isViewingStandings && viewingFromMatchday ? 'Current Standings' :
                     isViewingStandings && isFinalMatchday ? 'Final Predicted Standings' : 
                     isViewingStandings ? 'Predicted Standings' : 'Current Standings'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedLeague === 'PL' ? 'Premier League' : 
                     selectedLeague === 'BL1' ? 'Bundesliga' :
                     selectedLeague === 'FL1' ? 'Ligue 1' :
                     selectedLeague === 'SA' ? 'Serie A' : 'La Liga'}
                    {/* Display previous matchday when viewing current standings from predictions */}
                    {viewingFromMatchday && ` after Matchday ${viewingFromMatchday - 1}`}
                    {/* Display current matchday for predicted standings */}
                    {isViewingStandings && !isFinalMatchday && !viewingFromMatchday && ` after Matchday ${currentMatchday}`}
                    {/* Display previous matchday when in prediction mode */}
                    {!isViewingStandings && showPredictions && ` after Matchday ${currentMatchday - 1}`}
                  </p>
                </div>
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
                        setViewingFromMatchday(null);
                      }}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors"
                    >
                      Back to Predictions
                    </button>
                  )}
                  {!isViewingStandings && (
                    <button
                      onClick={handleStartPredictions}
                      className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                    >
                      Start Predictions
                    </button>
                  )}
                </div>
              </div>
            </div>
            <StandingsTable 
              standings={isViewingStandings && !viewingFromMatchday ? predictedStandings : viewingFromMatchday ? predictedStandings : standings} 
              initialStandings={isViewingStandings || viewingFromMatchday ? standings : undefined}
              loading={false} 
            />
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <PredictionForm
              leagueCode={selectedLeague}
              initialStandings={standings}
              initialMatches={initialMatches}
            />
          </div>
        )}
      </div>
    </main>
  );
}
