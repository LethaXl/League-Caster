'use client';

import { useState, useEffect, useRef } from 'react';
import LeagueSelector from '@/components/Standings/LeagueSelector';
import StandingsTable from '@/components/Standings/StandingsTable';
import PredictionForm from '@/components/Predictions/PredictionForm';
import { getStandings, Standing, getCurrentMatchday, getMatches } from '@/services/football-api';
import { usePrediction } from '@/contexts/PredictionContext';
import { Match } from '@/types/predictions';

export default function Home() {
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPredictions, setShowPredictions] = useState(false);
  
  // Cache for API data to reduce calls
  const matchdayCache = useRef<Map<string, number>>(new Map());
  const matchesCache = useRef<Map<string, Match[]>>(new Map());
  const standingsCache = useRef<Map<string, Standing[]>>(new Map());

  const {
    isViewingStandings,
    setIsViewingStandings,
    predictedStandings,
    currentMatchday,
    resetPredictions,
    setCurrentMatchday,
  } = usePrediction();

  useEffect(() => {
    if (!selectedLeague) return;
    
    // Generate cache keys
    const standingsCacheKey = selectedLeague;
    const matchdayCacheKey = selectedLeague;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try to use cached data first
        let standingsData: Standing[];
        let currentMatchdayData: number;
        
        // Get standings (from cache if available)
        if (standingsCache.current.has(standingsCacheKey)) {
          standingsData = standingsCache.current.get(standingsCacheKey)!;
        } else {
          standingsData = await getStandings(selectedLeague);
          standingsCache.current.set(standingsCacheKey, standingsData);
        }
        
        // Get current matchday (from cache if available)
        if (matchdayCache.current.has(matchdayCacheKey)) {
          currentMatchdayData = matchdayCache.current.get(matchdayCacheKey)!;
        } else {
          currentMatchdayData = await getCurrentMatchday(selectedLeague);
          matchdayCache.current.set(matchdayCacheKey, currentMatchdayData);
        }
        
        setStandings(standingsData);
        
        if (predictedStandings.length === 0) {
          setCurrentMatchday(currentMatchdayData);
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError(error.response?.data?.error || 'Failed to fetch data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedLeague]);

  const handleStartPredictions = async () => {
    if (!selectedLeague) return;
    
    setLoading(true);
    try {
      // Use cache when possible
      const matchdayCacheKey = selectedLeague;
      
      // Get current matchday (from cache if available)
      let currentMatchdayData: number;
      if (matchdayCache.current.has(matchdayCacheKey)) {
        currentMatchdayData = matchdayCache.current.get(matchdayCacheKey)!;
      } else {
        currentMatchdayData = await getCurrentMatchday(selectedLeague);
        matchdayCache.current.set(matchdayCacheKey, currentMatchdayData);
      }
      
      // Check if there are matches for this matchday
      const matchesCacheKey = `${selectedLeague}_md${currentMatchdayData}`;
      let matches: Match[];
      
      if (matchesCache.current.has(matchesCacheKey)) {
        matches = matchesCache.current.get(matchesCacheKey)!;
      } else {
        matches = await getMatches(selectedLeague, currentMatchdayData);
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
        ].filter(md => md >= 1 && md <= 38);
        
        for (const md of matchdaysToCheck) {
          const mdCacheKey = `${selectedLeague}_md${md}`;
          let mdMatches: Match[];
          
          if (matchesCache.current.has(mdCacheKey)) {
            mdMatches = matchesCache.current.get(mdCacheKey)!;
          } else {
            mdMatches = await getMatches(selectedLeague, md);
            matchesCache.current.set(mdCacheKey, mdMatches);
          }
          
          if (mdMatches.length > 0) {
            targetMatchday = md;
            break;
          }
        }
      }
      
      resetPredictions();
      setCurrentMatchday(targetMatchday);
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
              }}
              className="mt-2 text-blue-600 hover:text-blue-800"
            >
              ← Back to leagues
            </button>
          </div>
        </div>

        {!showPredictions ? (
          <div className="bg-white shadow rounded-lg">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {isViewingStandings ? 'Predicted Final Standings' : 'Current Standings'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedLeague === 'PL' ? 'Premier League' : 
                     selectedLeague === 'BL1' ? 'Bundesliga' :
                     selectedLeague === 'FL1' ? 'Ligue 1' :
                     selectedLeague === 'SA' ? 'Serie A' : 'La Liga'}
                  </p>
                </div>
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
            <StandingsTable 
              standings={isViewingStandings ? predictedStandings : standings} 
              loading={false} 
            />
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <PredictionForm
              leagueCode={selectedLeague}
              initialStandings={standings}
            />
          </div>
        )}
      </div>
    </main>
  );
}
