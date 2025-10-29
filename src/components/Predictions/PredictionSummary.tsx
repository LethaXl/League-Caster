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
  
  // Add state for screen width tracking
  const [screenWidth, setScreenWidth] = useState(0);
  
  // Add state to track expanded cell
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  
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
  
  // Determine if we're in different constraint views
  const isMobileSConstrainedView = screenWidth >= 320 && screenWidth < 360;
  const isMobileMConstrainedView = screenWidth >= 360 && screenWidth < 390;
  const isMobileLConstrainedView = screenWidth >= 390 && screenWidth < 414;
  const isMobileXLConstrainedView = screenWidth >= 414 && screenWidth < 640;
  const isTabletSmallConstrainedView = screenWidth >= 640 && screenWidth < 768;
  const isMediumConstrainedView = screenWidth >= 768 && screenWidth <= 1024;
  const isSpecificConstrainedView = screenWidth >= 1024 && screenWidth <= 1080;
  const isConstrainedView = screenWidth <= 1080;
  
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
        return 'text-yellow-300';
      case 'custom':
        if (prediction.homeGoals !== undefined && prediction.awayGoals !== undefined) {
          if (prediction.homeGoals > prediction.awayGoals) {
            return isHomeTeam ? 'text-green-400' : 'text-red-400';
          } else if (prediction.homeGoals < prediction.awayGoals) {
            return isHomeTeam ? 'text-red-400' : 'text-green-400';
          } else {
            return 'text-yellow-300';
          }
        }
        return 'text-yellow-300';
      default:
        return 'text-gray-400';
    }
  };
  
  // Get result background color class based on prediction - for tablet view
  const getResultBgColorClass = (match: Match, prediction: Prediction | undefined, teamId: number) => {
    if (!prediction) return 'bg-gray-800/30';
    
    const isHomeTeam = match.homeTeam.id === teamId;
    
    switch (prediction.type) {
      case 'home':
        return isHomeTeam ? 'bg-green-800/30 border-l-4 border-green-400' : 'bg-red-800/30 border-l-4 border-red-400';
      case 'away':
        return isHomeTeam ? 'bg-red-800/30 border-l-4 border-red-400' : 'bg-green-800/30 border-l-4 border-green-400';
      case 'draw':
        return 'bg-yellow-700/20 border-l-4 border-yellow-300';
      case 'custom':
        if (prediction.homeGoals !== undefined && prediction.awayGoals !== undefined) {
          if (prediction.homeGoals > prediction.awayGoals) {
            return isHomeTeam ? 'bg-green-800/30 border-l-4 border-green-400' : 'bg-red-800/30 border-l-4 border-red-400';
          } else if (prediction.homeGoals < prediction.awayGoals) {
            return isHomeTeam ? 'bg-red-800/30 border-l-4 border-red-400' : 'bg-green-800/30 border-l-4 border-green-400';
          } else {
            return 'bg-yellow-700/20 border-l-4 border-yellow-300';
          }
        }
        return 'bg-yellow-700/20 border-l-4 border-yellow-300';
      default:
        return 'bg-gray-800/30';
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
  
  // Determine modal classes based on screen size
  const getModalClasses = () => {
    if (isMobileSConstrainedView) {
      return "fixed inset-0 bg-black/80 z-50 overflow-y-auto flex items-center justify-center p-2";
    }
    if (isMobileMConstrainedView) {
      return "fixed inset-0 bg-black/80 z-50 overflow-y-hidden flex items-center justify-center p-3";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "fixed inset-0 bg-black/80 z-50 overflow-y-auto flex items-center justify-center p-3";
    }
    if (isTabletSmallConstrainedView) {
      return "fixed inset-0 bg-black/80 z-50 overflow-y-auto flex items-center justify-center p-3";
    }
    if (isSpecificConstrainedView) {
      return "fixed inset-0 bg-black/80 z-50 overflow-y-auto flex items-center justify-center p-4";
    }
    // Default for larger screens
    return "fixed inset-0 bg-black/80 z-50 overflow-y-auto flex items-center justify-center p-4";
  };
  
  // Modal content classes
  const getModalContentClasses = () => {
    if (isMobileSConstrainedView) {
      return "bg-[#111111] rounded-lg p-2 w-auto border border-[#2a2a2a] shadow-lg max-h-[95vh] overflow-y-auto";
    }
    if (isMobileMConstrainedView) {
      return "bg-[#111111] rounded-lg p-3 w-full max-w-[100vw] border border-[#2a2a2a] shadow-lg max-h-[95vh] overflow-y-auto";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "bg-[#111111] rounded-lg p-4 w-auto border border-[#2a2a2a] shadow-lg max-h-[95vh] overflow-y-auto";
    }
    if (isTabletSmallConstrainedView) {
      return "bg-[#111111] rounded-lg p-4 w-full max-w-3xl border border-[#2a2a2a] shadow-lg max-h-[95vh] overflow-y-auto";
    }
    if (isMediumConstrainedView) {
      return "bg-[#111111] rounded-lg p-4 w-full max-w-4xl border border-[#2a2a2a] shadow-lg max-h-[95vh] overflow-y-auto";
    }
    if (isSpecificConstrainedView) {
      return "bg-[#111111] rounded-lg p-5 w-full max-w-5xl border border-[#2a2a2a] shadow-lg max-h-[92vh] overflow-y-auto";
    }
    // Default for larger screens
    return "bg-[#111111] rounded-lg p-6 w-full max-w-6xl border border-[#2a2a2a] shadow-lg max-h-[90vh] overflow-y-auto";
  };
  
  // Headings and title sizes
  const getTitleClasses = () => {
    if (isMobileSConstrainedView) {
      return "text-lg font-bold text-[#f7e479]";
    }
    if (isMobileMConstrainedView) {
      return "text-base font-bold text-[#f7e479]";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "text-xl font-bold text-[#f7e479]";
    }
    // Default for larger screens
    return "text-2xl font-bold text-[#f7e479]";
  };
  
  // Button classes
  const getButtonClasses = () => {
    if (isMobileSConstrainedView || isMobileMConstrainedView) {
      return "px-3 py-1.5 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 text-xs font-semibold";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "px-4 py-1.5 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 text-xs font-semibold";
    }
    if (isTabletSmallConstrainedView) {
      return "px-5 py-1.5 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 text-sm font-semibold";
    }
    // Default for larger screens
    return "px-8 py-2 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold";
  };
  
  // Close button classes
  const getCloseButtonClasses = () => {
    if (isMobileSConstrainedView || isMobileMConstrainedView) {
      return "px-4 py-1.5 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 text-xs font-semibold";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "px-5 py-1.5 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 text-sm font-semibold";
    }
    // Default for larger screens
    return "px-8 py-2 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold";
  };
  
  // Team logo size classes
  const getTeamLogoClasses = () => {
    if (isMobileSConstrainedView || isMobileMConstrainedView) {
      return "relative h-6 w-6 mb-1";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "relative h-6 w-6 mb-1";
    }
    // Default for larger screens
    return "relative h-8 w-8 mb-2";
  };
  
  // Match team logo size
  const getMatchTeamLogoClasses = () => {
    if (isMobileSConstrainedView || isMobileMConstrainedView) {
      return "relative h-4 w-4 mr-1";
    }
    // Default for larger screens
    return "relative h-5 w-5 mr-1";
  };
  
  // Header classes
  const getHeaderClasses = () => {
    if (isMobileSConstrainedView || isMobileMConstrainedView) {
      return "flex justify-between items-center mb-2";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "flex justify-between items-center mb-3";
    }
    // Default for larger screens
    return "flex justify-between items-center mb-4";
  };
  
  // Spacing for bottom buttons
  const getBottomMarginClasses = () => {
    if (isMobileSConstrainedView || isMobileMConstrainedView) {
      return "mt-3 flex justify-center";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "mt-4 flex justify-center";
    }
    // Default for larger screens
    return "mt-6 flex justify-center";
  };
  
  // Render mobile optimization for the forecast summary
  const renderMobileView = () => {
    // For all mobile sizes, show the summary table (remove the special message for isMobileSConstrainedView)
    return (
      <div className={`overflow-x-auto px-2${isMobileSConstrainedView ? ' mobile-s' : ''}`}>
        <table className="border-collapse min-w-0 w-auto">
          <thead>
            <tr>
              <th className={`px-1 py-2 text-center text-xs font-semibold text-[#f7e479] border-b border-[#2a2a2a] ${isTabletSmallConstrainedView ? 'w-[60px] min-w-[60px]' : isMobileSConstrainedView ? 'w-[24px] min-w-[24px] pr-1 p-0 border-r border-[#222] text-[9px]' : isMobileMConstrainedView ? 'w-[32px] min-w-[32px] pr-2 p-0 border-r border-[#222] text-xs' : (isMobileXLConstrainedView || isMobileLConstrainedView) ? 'w-[40px] min-w-[40px] pr-4 p-0 border-r border-[#222]' : 'min-w-[40px]'}`}>
                {isTabletSmallConstrainedView ? (
                  <div className="flex flex-col">
                    <span>Match</span>
                    <span>Day</span>
                  </div>
                ) : 'Matchday'}
              </th>
              {sortedTeamIds.map(teamId => {
                const team = getTeamDetails(teamId);
                if (!team) return null;
                
                return (
                  <th
                    key={teamId}
                    className={`px-1 py-2 text-center font-semibold text-primary border-b border-[#2a2a2a] ${isMobileSConstrainedView ? 'text-[8px]' : isMobileMConstrainedView ? 'text-xs' : 'text-[10px]'} ${isMobileSConstrainedView ? '' : isMobileMConstrainedView ? '' : (isMobileXLConstrainedView || isMobileLConstrainedView ? '' : 'min-w-[100px]')}`}
                  >
                    <div className="flex flex-col items-center">
                      <div className={isMobileSConstrainedView ? 'relative h-5 w-5 mb-0.5' : getTeamLogoClasses()}>
                        <Image
                          src={team.crest || "/placeholder-team.png"}
                          alt={team.name}
                          fill
                          className="object-contain"
                        />
                      </div>
                      <span className={isMobileSConstrainedView ? 'text-[8px]' : 'text-[10px]'}>{team.shortName || team.name || 'Unknown Team'}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allMatchdays.map(matchday => (
              <tr key={matchday} className="border-b border-[#2a2a2a]/50 last:border-b-0">
                <td
                  className={`px-1 py-2 text-center font-semibold text-white ${isMobileSConstrainedView ? 'text-xs w-[24px] min-w-[24px] pr-1 p-0 border-r border-[#222]' : isMobileMConstrainedView ? 'text-xs w-[32px] min-w-[32px] pr-2 p-0 border-r border-[#222]' : 'text-xs'} ${isTabletSmallConstrainedView ? 'w-[60px]' : (isMobileXLConstrainedView || isMobileLConstrainedView) ? 'w-[40px] min-w-[40px] pr-4 p-0 border-r border-[#222]' : ''}`}
                >
                  {matchday}
                </td>
                
                {sortedTeamIds.map(teamId => {
                  const teamMatches = matchesByMatchdayAndTeam.get(matchday)?.get(teamId) || [];
                  
                  return (
                    <td
                      key={`${matchday}-${teamId}`}
                      className={`px-1 py-2 align-top ${isMobileXLConstrainedView || isMobileLConstrainedView || isMobileMConstrainedView || isMobileSConstrainedView ? 'p-0' : ''}`}
                      style={isMobileXLConstrainedView || isMobileLConstrainedView || isMobileMConstrainedView || isMobileSConstrainedView ? {width: '1%'} : {}}
                    >
                      {teamMatches.length > 0 ? (
                        <div className="space-y-1">
                          {teamMatches.map(match => {
                            const prediction = predictions.get(match.id);
                            const isHome = match.homeTeam.id === teamId;
                            const opponent = isHome ? match.awayTeam : match.homeTeam;
                            const cellKey = `${match.id}-${teamId}`;
                            const isMobileTapExpand = isMobileSConstrainedView || isMobileMConstrainedView || isMobileLConstrainedView || isMobileXLConstrainedView;
                            return (
                              <div
                                key={match.id}
                                className={`flex items-center justify-between text-[10px] p-1.5 rounded ${getResultBgColorClass(match, prediction, teamId)} select-none relative`}
                                style={isMobileTapExpand ? {minWidth: 0, maxWidth: '100vw'} : {}}
                              >
                                <div className="flex items-center flex-1 relative">
                                  <span className="text-white text-[8px] font-medium mr-0.5 min-w-[16px]">
                                    {isHome ? 'H' : 'A'}
                                  </span>
                                  <div className={getMatchTeamLogoClasses()}>
                                    <Image
                                      src={opponent.crest || "/placeholder-team.png"}
                                      alt={opponent.name}
                                      fill
                                      className="object-contain"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center text-[9px] text-gray-400">-</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            
            {/* Total points row */}
            <tr className="border-t-2 border-[#2a2a2a]">
              <td className={`px-1 py-2 text-center font-semibold text-[#f7e479] text-xs ${isTabletSmallConstrainedView ? 'w-[60px]' : isMobileSConstrainedView ? 'w-[24px] min-w-[24px] pr-1 p-0 border-r border-[#222]' : isMobileMConstrainedView ? 'w-[32px] min-w-[32px] pr-2 p-0 border-r border-[#222]' : (isMobileXLConstrainedView || isMobileLConstrainedView) ? 'w-[40px] min-w-[40px] pr-4 p-0 border-r border-[#222]' : ''}`}>
                {'Points:'}
              </td>
              {sortedTeamIds.map(teamId => {
                const points = getTeamPoints(teamId);
                
                return (
                  <td key={`points-${teamId}`} className={`px-1 py-2 text-center ${isMobileSConstrainedView ? 'text-xs' : isMobileMConstrainedView ? 'text-base' : 'text-base'}`}>
                    <span className="text-base font-bold text-white">{points}</span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };
  
  return (
    <div className={getModalClasses()}>
      <div className={getModalContentClasses()}>
        {viewMode === 'table' ? (
          <>
            <div className={getHeaderClasses()}>
              <div className="flex-grow text-center">
                <h2 className={getTitleClasses()}>Final Table</h2>
              </div>
              <button
                onClick={() => setViewMode('summary')}
                className={getButtonClasses()}
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
            
            <div className={getBottomMarginClasses()}>
              <button
                onClick={onClose}
                className={`${getCloseButtonClasses()} ${isMobileMConstrainedView ? 'text-xs py-1 px-3' : ''}`}
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={getHeaderClasses()}>
              <div className="flex-grow text-center">
                <h2 className={`${isMobileSConstrainedView ? 'text-[15px]' : getTitleClasses()} font-bold text-[#f7e479]`}>Forecast Summary</h2>
              </div>
            </div>
            
            {/* Debug info */}
            {matchdayData.matchCount === 0 && (
              <div className="text-center text-red-400 mb-4">
                No matches found. Please make predictions first.
              </div>
            )}
            
            {/* Smaller screens get special treatment */}
            {(isMobileSConstrainedView || isMobileMConstrainedView || isMobileLConstrainedView || isMobileXLConstrainedView) ? (
              renderMobileView()
            ) : (
              // Regular desktop view remains untouched
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={`px-2 py-3 text-center text-sm font-semibold text-[#f7e479] border-b border-[#2a2a2a] ${isTabletSmallConstrainedView ? 'w-[70px] min-w-[70px]' : 'min-w-[90px]'}`}>
                        {isTabletSmallConstrainedView ? (
                          <div className="flex flex-col">
                            <span>Match</span>
                            <span>Day</span>
                          </div>
                        ) : 'Matchday'}
                      </th>
                      {sortedTeamIds.map(teamId => {
                        const team = getTeamDetails(teamId);
                        if (!team) return null;
                        
                        return (
                          <th
                            key={teamId}
                            className={`px-2 py-3 text-center text-sm font-semibold text-primary border-b border-[#2a2a2a] ${isMobileXLConstrainedView ? 'max-w-[70px] min-w-[50px]' : 'min-w-[100px]'}`}
                          >
                            <div className="flex flex-col items-center">
                              <div className="relative h-8 w-8 mb-2">
                                <Image
                                  src={team.crest || "/placeholder-team.png"}
                                  alt={team.name}
                                  fill
                                  className="object-contain"
                                />
                              </div>
                              <span className="text-xs">{team.shortName || team.name || 'Unknown Team'}</span>
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
                        <td className={`px-2 py-3 text-center font-semibold text-white ${isTabletSmallConstrainedView ? 'w-[70px]' : ''}`}>
                          {matchday}
                        </td>
                        
                        {sortedTeamIds.map(teamId => {
                          const teamMatches = matchesByMatchdayAndTeam.get(matchday)?.get(teamId) || [];
                          
                          return (
                            <td
                              key={`${matchday}-${teamId}`}
                              className={`px-2 py-3 align-top ${isMobileXLConstrainedView ? 'max-w-[70px] min-w-[50px]' : ''}`}
                            >
                              {teamMatches.length > 0 ? (
                                <div className="space-y-2">
                                  {teamMatches.map(match => {
                                    const prediction = predictions.get(match.id);
                                    const isHome = match.homeTeam.id === teamId;
                                    const opponent = isHome ? match.awayTeam : match.homeTeam;
                                    
                                    // Now use the colored box approach for all screen sizes
                                    return (
                                      <div key={match.id} className={`flex items-center text-sm p-2 rounded mb-2 ${getResultBgColorClass(match, prediction, teamId)}`}>
                                        <div className="flex items-center flex-1">
                                          <span className="text-gray-300 text-xs font-medium mr-1 min-w-[22px]">
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
                      <td className={`px-2 py-3 text-center font-semibold text-[#f7e479] ${isTabletSmallConstrainedView ? 'w-[70px]' : ''}`}>
                        {'Points:'}
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
            )}
            
            <div className={getBottomMarginClasses()}>
              <button
                onClick={onClose}
                className={`${getCloseButtonClasses()} ${isMobileMConstrainedView ? 'text-xs py-1 px-3' : ''}`}
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