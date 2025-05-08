import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Match, Prediction } from '@/types/predictions';
import { Standing } from '@/services/football-api';
import StandingsTable from '../Standings/StandingsTable';
import { usePrediction } from '@/contexts/PredictionContext';

interface PredictionSummaryProps {
  predictions: Map<number, Prediction>;
  matches: Match[];
  selectedTeamIds: number[];
  standings: Standing[];
  onClose: () => void;
}

export default function PredictionSummary({ 
  predictions, 
  matches, 
  selectedTeamIds,
  standings,
  onClose 
}: PredictionSummaryProps) {
  const { isRaceMode, tableDisplayMode, setTableDisplayMode } = usePrediction();
  const [viewMode, setViewMode] = useState<'table' | 'summary'>('summary');
  
  // Add debugging to see what data we're getting
  const [matchdayData, setMatchdayData] = useState<{
    matchCount: number;
    matchdays: number[];
    predictionsCount: number;
  }>({
    matchCount: matches.length,
    matchdays: [...new Set(matches.map(m => m.matchday))],
    predictionsCount: predictions.size
  });
  
  useEffect(() => {
    // Debug log to console
    console.log("Matches:", matches);
    console.log("Matchdays available:", [...new Set(matches.map(m => m.matchday))]);
    console.log("Predictions:", Array.from(predictions.entries()));
    
    // Update state for debugging info
    setMatchdayData({
      matchCount: matches.length,
      matchdays: [...new Set(matches.map(m => m.matchday))],
      predictionsCount: predictions.size
    });
  }, [matches, predictions]);
  
  // Get team details from standings
  const getTeamDetails = (teamId: number) => {
    return standings.find(s => s.team.id === teamId)?.team;
  };
  
  // Get team points from standings
  const getTeamPoints = (teamId: number) => {
    return standings.find(s => s.team.id === teamId)?.points || 0;
  };
  
  // Helper function to get result text
  const getResultText = (match: Match, prediction: Prediction | undefined, teamId: number) => {
    if (!prediction) return 'Not predicted';
    
    const isHomeTeam = match.homeTeam.id === teamId;
    
    switch (prediction.type) {
      case 'home':
        return isHomeTeam ? 'Win' : 'Loss';
      case 'away':
        return isHomeTeam ? 'Loss' : 'Win';
      case 'draw':
        return 'Draw';
      case 'custom':
        if (prediction.homeGoals !== undefined && prediction.awayGoals !== undefined) {
          if (prediction.homeGoals > prediction.awayGoals) {
            return isHomeTeam ? 'Win' : 'Loss';
          } else if (prediction.homeGoals < prediction.awayGoals) {
            return isHomeTeam ? 'Loss' : 'Win';
          } else {
            return 'Draw';
          }
        }
        return 'Draw';
      default:
        return 'Not predicted';
    }
  };
  
  // Get result color class based on prediction
  const getResultColorClass = (match: Match, prediction: Prediction | undefined, teamId: number) => {
    if (!prediction) return 'text-gray-400';
    
    const isHomeTeam = match.homeTeam.id === teamId;
    
    switch (prediction.type) {
      case 'home':
        return isHomeTeam ? 'text-green-400' : 'text-red-400';
      case 'away':
        return isHomeTeam ? 'text-red-400' : 'text-green-400';
      case 'draw':
        return 'text-yellow-400';
      case 'custom':
        if (prediction.homeGoals !== undefined && prediction.awayGoals !== undefined) {
          if (prediction.homeGoals > prediction.awayGoals) {
            return isHomeTeam ? 'text-green-400' : 'text-red-400';
          } else if (prediction.homeGoals < prediction.awayGoals) {
            return isHomeTeam ? 'text-red-400' : 'text-green-400';
          } else {
            return 'text-yellow-400';
          }
        }
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };
  
  // Show score for custom predictions
  const getScoreText = (prediction: Prediction | undefined) => {
    if (!prediction || prediction.type !== 'custom') return '';
    if (prediction.homeGoals === undefined || prediction.awayGoals === undefined) return '';
    
    return `${prediction.homeGoals}-${prediction.awayGoals}`;
  };
  
  // Sort teams by position in the standings
  const sortedTeamIds = [...selectedTeamIds].sort((a, b) => {
    const teamAPosition = standings.find(s => s.team.id === a)?.position || 0;
    const teamBPosition = standings.find(s => s.team.id === b)?.position || 0;
    return teamAPosition - teamBPosition;
  });
  
  // Get all matchdays from the matches
  const allMatchdays = [...new Set(matches.map(match => match.matchday || 0))].sort((a, b) => a - b);
  
  // Group matches by matchday and team
  const matchesByMatchdayAndTeam = new Map<number, Map<number, Match[]>>();
  
  // Initialize the structure
  allMatchdays.forEach(matchday => {
    matchesByMatchdayAndTeam.set(matchday, new Map<number, Match[]>());
    sortedTeamIds.forEach(teamId => {
      matchesByMatchdayAndTeam.get(matchday)!.set(teamId, []);
    });
  });
  
  // Populate the structure
  matches.forEach(match => {
    const matchday = match.matchday || 0;
    const homeTeamId = match.homeTeam.id;
    const awayTeamId = match.awayTeam.id;
    
    // Check if we're tracking this matchday
    if (!matchesByMatchdayAndTeam.has(matchday)) return;
    
    // Add to home team's matches if it's a selected team
    if (selectedTeamIds.includes(homeTeamId)) {
      const teamMatches = matchesByMatchdayAndTeam.get(matchday)!.get(homeTeamId) || [];
      matchesByMatchdayAndTeam.get(matchday)!.set(homeTeamId, [...teamMatches, match]);
    }
    
    // Add to away team's matches if it's a selected team
    if (selectedTeamIds.includes(awayTeamId)) {
      const teamMatches = matchesByMatchdayAndTeam.get(matchday)!.get(awayTeamId) || [];
      matchesByMatchdayAndTeam.get(matchday)!.set(awayTeamId, [...teamMatches, match]);
    }
  });
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div className="bg-[#111111] rounded-lg p-6 w-full max-w-6xl border border-[#2a2a2a] shadow-lg max-h-[90vh] overflow-y-auto">
        {viewMode === 'table' ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex-grow text-center">
                <h2 className="text-2xl font-bold text-[#f7e479]">Final Table</h2>
              </div>
              <button
                onClick={() => setViewMode('summary')}
                className="px-4 py-2 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 text-sm font-semibold"
              >
                Show Matches
              </button>
            </div>
            
            {/* Standings table */}
            <StandingsTable 
              standings={standings} 
              loading={false} 
              selectedTeamIds={selectedTeamIds} 
            />
            
            <div className="mt-6 flex justify-center">
              <button
                onClick={onClose}
                className="px-8 py-2 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <div className="flex-grow text-center">
                <h2 className="text-2xl font-bold text-[#f7e479]">Forecast Summary</h2>
              </div>
            </div>
            
            {/* Debug info */}
            {matchdayData.matchCount === 0 && (
              <div className="text-center text-red-400 mb-4">
                No matches found. Please make predictions first.
              </div>
            )}
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="px-2 py-3 text-center text-sm font-semibold text-[#f7e479] border-b border-[#2a2a2a] min-w-[90px]">
                      Matchday
                    </th>
                    {sortedTeamIds.map(teamId => {
                      const team = getTeamDetails(teamId);
                      if (!team) return null;
                      
                      return (
                        <th key={teamId} className="px-2 py-3 text-center text-sm font-semibold text-primary border-b border-[#2a2a2a] min-w-[150px]">
                          <div className="flex flex-col items-center">
                            <div className="relative h-8 w-8 mb-2">
                              <Image
                                src={team.crest || "/placeholder-team.png"}
                                alt={team.name}
                                fill
                                className="object-contain"
                              />
                            </div>
                            <span className="text-xs">{team.shortName || team.name}</span>
                          </div>
                        </th>
                      );
                    })}
                    <th className="px-2 py-3 text-center text-sm font-semibold text-primary border-b border-[#2a2a2a] min-w-[90px]">
                      &nbsp;
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allMatchdays.map(matchday => (
                    <tr key={matchday} className="border-b border-[#2a2a2a]/50 last:border-b-0">
                      <td className="px-2 py-3 text-center font-semibold text-white">
                        {matchday}
                      </td>
                      
                      {sortedTeamIds.map(teamId => {
                        const teamMatches = matchesByMatchdayAndTeam.get(matchday)?.get(teamId) || [];
                        
                        return (
                          <td key={`${matchday}-${teamId}`} className="px-2 py-3 align-top">
                            {teamMatches.length > 0 ? (
                              <div className="space-y-2">
                                {teamMatches.map(match => {
                                  const prediction = predictions.get(match.id);
                                  const isHome = match.homeTeam.id === teamId;
                                  const opponent = isHome ? match.awayTeam : match.homeTeam;
                                  
                                  return (
                                    <div key={match.id} className="flex items-center justify-between text-sm bg-[#1a1a1a] p-2 rounded">
                                      <div className="flex items-center flex-1">
                                        <span className="text-gray-400 text-xs font-medium mr-1 min-w-[22px]">
                                          {isHome ? '(H)' : '(A)'}
                                        </span>
                                        <div className="relative h-5 w-5 mr-1">
                                          <Image
                                            src={opponent.crest || "/placeholder-team.png"}
                                            alt={opponent.name}
                                            fill
                                            className="object-contain"
                                          />
                                        </div>
                                        <span className="text-xs text-primary truncate flex-1" title={opponent.name}>
                                          {opponent.shortName || opponent.name}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center ml-1">
                                        {prediction?.type === 'custom' && (
                                          <span className="mr-1 text-[10px] text-gray-400">
                                            {getScoreText(prediction)}
                                          </span>
                                        )}
                                        <span className={`font-medium text-xs ${getResultColorClass(match, prediction, teamId)}`}>
                                          {getResultText(match, prediction, teamId)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center text-xs text-gray-400">-</div>
                            )}
                          </td>
                        );
                      })}
                      
                      <td className="px-2 py-3 text-center">
                        &nbsp;
                      </td>
                    </tr>
                  ))}
                  
                  {/* Total points row */}
                  <tr className="border-t-2 border-[#2a2a2a]">
                    <td className="px-2 py-3 text-center font-semibold text-[#f7e479]">
                      Total Points:
                    </td>
                    {sortedTeamIds.map(teamId => {
                      const points = getTeamPoints(teamId);
                      
                      return (
                        <td key={`points-${teamId}`} className="px-2 py-3 text-center">
                          <span className="text-lg font-bold text-white">{points}</span>
                        </td>
                      );
                    })}
                    <td className="px-2 py-3">&nbsp;</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 flex justify-center">
              <button
                onClick={onClose}
                className="px-8 py-2 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 