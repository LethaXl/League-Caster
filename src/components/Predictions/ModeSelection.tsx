import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Standing } from '@/services/football-api';

interface ModeSelectionProps {
  leagueCode: string;
  standings: Standing[];
  onModeSelect: (mode: 'normal' | 'race', selectedTeams?: number[], unfilteredMatchesMode?: 'auto' | 'draws', tableDisplayMode?: 'mini' | 'full') => void;
}

export default function ModeSelection({ standings, onModeSelect }: ModeSelectionProps) {
  const [mode, setMode] = useState<'normal' | 'race' | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [unfilteredMatchesMode, setUnfilteredMatchesMode] = useState<'auto' | 'draws'>('auto');
  const [tableDisplayMode, setTableDisplayMode] = useState<'mini' | 'full'>('mini');
  const [showUnfilteredOptions, setShowUnfilteredOptions] = useState(false);
  const [isMobileGrid, setIsMobileGrid] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobileGrid(window.innerWidth < 750);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const handleSelectTeam = (teamId: number) => {
    setSelectedTeams(prev => {
      // If team is already selected, remove it
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      }
      // Otherwise add it, but limit to 10 teams max
      if (prev.length < 10) {
        return [...prev, teamId];
      }
      return prev;
    });
  };
  
  const handleContinue = () => {
    if (mode === 'normal') {
      onModeSelect('normal');
    } else if (mode === 'race' && selectedTeams.length > 0) {
      setShowUnfilteredOptions(true);
    }
  };
  
  const handleSubmit = () => {
    if (mode === 'race' && selectedTeams.length > 0) {
      onModeSelect('race', selectedTeams, unfilteredMatchesMode, tableDisplayMode);
    }
  };

  return (
    <div className="bg-card rounded-lg p-4 sm:p-6 max-[750px]:py-6 max-[750px]:min-h-[450px] max-[750px]:mb-8 max-[750px]:mx-2">
      {!showUnfilteredOptions ? (
        <>
          <div className="flex justify-center items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-primary">Select Forecast Mode</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6 sm:mb-8 md:grid-cols-2">
            {/* Normal Mode */}
            <div 
              className={`bg-[#111111] rounded-lg p-4 sm:p-6 border-2 cursor-pointer transition-all duration-300 hover:border-[#f7e479] flex flex-col ${mode === 'normal' ? 'border-[#f7e479]' : 'border-[#2a2a2a]'}`}
              onClick={() => setMode('normal')}
            >
              <h3 className="text-lg sm:text-xl font-bold text-[#f7e479] mb-2 sm:mb-3 text-center">Classic Mode</h3>
              <p className="text-xs sm:text-base text-secondary mb-1 sm:mb-2">
                Forecast all fixtures for each matchday in the league, predicting every match outcome.
              </p>
              <p className="text-xs sm:text-base text-secondary mb-2 sm:mb-4">
                See how your predictions affect the entire league table throughout the season.
              </p>
            </div>
            
            {/* Race Mode */}
            <div 
              className={`bg-[#111111] rounded-lg p-4 sm:p-6 border-2 cursor-pointer transition-all duration-300 hover:border-[#f7e479] flex flex-col ${mode === 'race' ? 'border-[#f7e479]' : 'border-[#2a2a2a]'}`}
              onClick={() => setMode('race')}
            >
              <h3 className="text-lg sm:text-xl font-bold text-[#f7e479] mb-2 sm:mb-3 text-center">Race Mode</h3>
              <p className="text-xs sm:text-base text-secondary mb-1 sm:mb-2">
              Focus only on teams in the title race, European chase, or relegation battle.
              </p>
              <p className="text-xs sm:text-base text-secondary mb-2 sm:mb-4">
                See only fixtures involving your selected teams and get summarized results at the end.
              </p>
            </div>
          </div>
          
          {/* Race Mode Configuration - Team Selection */}
          <div className={`overflow-hidden transition-all duration-500 ease-in-out ${mode === 'race' ? 'max-h-[2000px] opacity-100 mt-4 sm:mt-6 mb-6 sm:mb-8' : 'max-h-0 opacity-0'}`}> 
            <div className="transform transition-transform duration-500 ease-in-out" style={{ transform: mode === 'race' ? 'translateY(0)' : 'translateY(-20px)' }}>
              {/* Team Selection */}
              <h3 className="text-base sm:text-lg font-semibold text-primary mb-3 sm:mb-4">Select teams to include (max 10):</h3>
              <div className="grid grid-cols-4 gap-2 sm:gap-4">
                {standings.map(standing => (
                  <div 
                    key={standing.team.id}
                    onClick={() => handleSelectTeam(standing.team.id)}
                    className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg cursor-pointer transition-all ${
                      selectedTeams.includes(standing.team.id) 
                        ? 'bg-[#f7e479]/10 border border-[#f7e479]' 
                        : 'bg-[#111111] border border-[#2a2a2a] hover:border-[#444444]'
                    }`}
                  >
                    <div className="relative w-8 h-8 sm:w-10 sm:h-10 mb-1 sm:mb-2">
                      <Image
                        src={standing.team.crest || "/placeholder-team.png"}
                        alt={standing.team.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <span className={`text-[9px] xs:text-xs sm:text-sm font-medium text-center ${
                      selectedTeams.includes(standing.team.id) ? 'text-[#f7e479]' : 'text-primary'
                    }`}>
                      {standing.team.shortName || standing.team.name}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-xs sm:text-sm text-secondary mt-1 sm:mt-2 mb-4 sm:mb-6">
                Selected: {selectedTeams.length}/10 teams
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-0 mt-6 sm:mt-8">
            <button
              onClick={handleContinue}
              disabled={mode === null || (mode === 'race' && selectedTeams.length === 0)}
              className={`w-full sm:w-auto px-8 py-3 sm:py-2 rounded-full font-semibold transition-all duration-300 ${
                mode === null || (mode === 'race' && selectedTeams.length === 0)
                  ? 'bg-[#333333] text-[#666666] cursor-not-allowed'
                  : 'bg-transparent text-[#f7e479] border-2 border-[#f7e479] hover:bg-[#f7e479] hover:text-black'
              }`}
            >
              {mode === 'normal' ? 'Start Predictions' : 'Continue'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-6 max-[750px]:mb-3">
            <h3 className="text-lg sm:text-xl font-bold text-[#f7e479] mb-4 sm:mb-6 max-[750px]:mb-4 text-center">Configure Race Mode</h3>
            <div className="mx-auto max-w-2xl max-[750px]:max-w-[98vw]">
              {/* Selected Teams Display */}
              <div className="mb-4 sm:mb-6 max-[750px]:mb-4">
                <div className="text-base sm:text-lg font-semibold text-primary mb-2 sm:mb-3 max-[750px]:mb-2">Selected Teams:</div>
                <div className="flex flex-wrap gap-1 sm:gap-2 max-[750px]:gap-[2px]">
                  {selectedTeams.map(teamId => {
                    const team = standings.find(s => s.team.id === teamId);
                    return team && (
                      <div key={teamId} className="flex items-center bg-[#1a1a1a] rounded-full px-2 py-1 sm:px-3 sm:py-1 max-[750px]:px-1 max-[750px]:py-[2px]">
                        <div className="relative w-5 h-5 sm:w-6 sm:h-6 mr-1 sm:mr-2 max-[750px]:w-4 max-[750px]:h-4 max-[750px]:mr-1">
                          <Image
                            src={team.team.crest || "/placeholder-team.png"}
                            alt={team.team.name}
                            fill
                            className="object-contain"
                          />
                        </div>
                        <span className="text-xs sm:text-sm max-[750px]:text-[10px] text-primary">{team.team.shortName || team.team.name}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="w-full h-[1px] bg-[#333333] mt-4 sm:mt-6 max-[750px]:mt-3"></div>
              </div>
              {/* Unfiltered Matches and Table Display sections with connecting lines */}
              {isMobileGrid ? (
                <div className="mb-4">
                  <div className="text-sm font-semibold text-primary mb-2 text-center">
                    Select Point Assignment Method:
                  </div>
                  
                  {/* Auto-assign option */}
                  <div 
                    className="bg-[#111111] rounded-lg p-3 mb-2 border border-[#2a2a2a] cursor-pointer"
                    onClick={() => setUnfilteredMatchesMode('auto')}
                  >
                    <div className="flex items-center mb-1">
                      <div className="flex items-center w-full">
                        <div className="relative mr-2 flex-shrink-0">
                          <input 
                            type="radio" 
                            id="auto-assign-mobile" 
                            name="unfiltered-matches" 
                            className="opacity-0 absolute h-4 w-4"
                            checked={unfilteredMatchesMode === 'auto'}
                            onChange={() => setUnfilteredMatchesMode('auto')}
                          />
                          <div className={`border-2 rounded-full h-4 w-4 flex justify-center items-center ${
                            unfilteredMatchesMode === 'auto' ? 'border-[#f7e479]' : 'border-gray-400'
                          }`}>
                            {unfilteredMatchesMode === 'auto' && (
                              <div className="rounded-full h-2 w-2 bg-[#f7e479]"></div>
                            )}
                          </div>
                        </div>
                        <label htmlFor="auto-assign-mobile" className="font-medium text-primary text-xs cursor-pointer">
                          Auto-assign based on position
                        </label>
                      </div>
                    </div>
                    <div className="text-[9px] text-secondary ml-6 leading-tight">
                      Matches between non-selected teams: Teams with &lt;2 position gap result in draws. 
                      Teams with larger gaps result in wins for the higher-placed team.
                    </div>
                  </div>
                  
                  {/* Auto-draw option */}
                  <div 
                    className="bg-[#111111] rounded-lg p-3 border border-[#2a2a2a] cursor-pointer"
                    onClick={() => setUnfilteredMatchesMode('draws')}
                  >
                    <div className="flex items-center mb-1">
                      <div className="flex items-center w-full">
                        <div className="relative mr-2 flex-shrink-0">
                          <input 
                            type="radio" 
                            id="draws-assign-mobile" 
                            name="unfiltered-matches" 
                            className="opacity-0 absolute h-4 w-4"
                            checked={unfilteredMatchesMode === 'draws'}
                            onChange={() => setUnfilteredMatchesMode('draws')}
                          />
                          <div className={`border-2 rounded-full h-4 w-4 flex justify-center items-center ${
                            unfilteredMatchesMode === 'draws' ? 'border-[#f7e479]' : 'border-gray-400'
                          }`}>
                            {unfilteredMatchesMode === 'draws' && (
                              <div className="rounded-full h-2 w-2 bg-[#f7e479]"></div>
                            )}
                          </div>
                        </div>
                        <label htmlFor="draws-assign-mobile" className="font-medium text-primary text-xs cursor-pointer">
                          Auto-draw unfiltered matches
                        </label>
                      </div>
                    </div>
                    <div className="text-[9px] text-secondary ml-6 leading-tight">
                      All matches between non-selected teams end in draws.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative flex flex-col sm:flex-row justify-between mb-6 sm:mb-8 gap-y-8 sm:gap-x-8 min-h-[220px] sm:min-h-0">
                  {/* Connecting lines for both mobile and desktop, but adjust position for mobile */}
                  <div className="absolute inset-0 pointer-events-none z-0">
                {/* Top horizontal line (auto -> mini) */}
                <div 
                      className="hidden sm:block"
                  style={{
                    position: 'absolute',
                    zIndex: 20,
                    top: '12px',
                    right: '43%',
                    width: '12%',
                    height: '3px',
                    backgroundColor: unfilteredMatchesMode === 'auto' && tableDisplayMode === 'mini' ? '#f7e479' : 'transparent',
                    transition: 'background-color 0.3s'
                  }}
                ></div>
                {/* Bottom horizontal line (draws -> full) */}
                <div 
                      className="hidden sm:block"
                  style={{
                    position: 'absolute',
                    zIndex: 20,
                    top: '136px',
                    right: '43%',
                    width: '12%',
                    height: '3px',
                    backgroundColor: unfilteredMatchesMode === 'draws' && tableDisplayMode === 'full' ? '#f7e479' : 'transparent',
                    transition: 'background-color 0.3s'
                  }}
                ></div>
                {/* Diagonal line (auto -> full) - top left to bottom right */}
                <div 
                      className="hidden sm:block"
                  style={{
                    position: 'absolute',
                    zIndex: 19,
                    top: '120px',
                    right: '42%',
                    width: '20%',
                    height: '3px',
                    backgroundColor: unfilteredMatchesMode === 'auto' && tableDisplayMode === 'full' ? '#f7e479' : 'transparent',
                    transition: 'background-color 0.3s',
                    transform: 'rotate(46deg)',
                    transformOrigin: 'right'
                  }}
                ></div>
                {/* Diagonal line (draws -> mini) - bottom left to top right */}
                <div 
                      className="hidden sm:block"
                  style={{
                    position: 'absolute',
                    zIndex: 19,
                    top: '23px',
                    right: '42%',
                    width: '20%',
                    height: '3px',
                    backgroundColor: unfilteredMatchesMode === 'draws' && tableDisplayMode === 'mini' ? '#f7e479' : 'transparent',
                    transition: 'background-color 0.3s',
                    transform: 'rotate(-46deg)',
                    transformOrigin: 'right'
                  }}
                ></div>
                  </div>
                  {/* Option containers */}
                  <div className="w-full sm:w-5/12 z-10 mb-4 sm:mb-0 max-[750px]:mb-2">
                    <div className="h-[70px] sm:h-[80px] max-[750px]:h-[40px]">
                      <div className="flex items-center mb-1 sm:mb-2 justify-between max-[750px]:mb-0" style={{paddingRight: '10px'}}>
                        <label htmlFor="auto-assign" className="font-medium text-primary text-center whitespace-nowrap mr-2 sm:mr-4 text-xs sm:text-base max-[750px]:text-[10px]">
                        Auto-assign based on position
                      </label>
                        <div className="relative" style={{paddingLeft: "20px"}}>
                        <input 
                          type="radio" 
                          id="auto-assign" 
                          name="unfiltered-matches" 
                          className="opacity-0 absolute h-5 w-5"
                          checked={unfilteredMatchesMode === 'auto'}
                          onChange={() => setUnfilteredMatchesMode('auto')}
                        />
                        <div className={`border-2 rounded-full h-5 w-5 flex justify-center items-center ${
                          unfilteredMatchesMode === 'auto' ? 'border-[#f7e479]' : 'border-gray-400'
                        }`}>
                          {unfilteredMatchesMode === 'auto' && (
                            <div className="rounded-full h-3 w-3 bg-[#f7e479]"></div>
                          )}
                        </div>
                      </div>
                    </div>
                      <div className="ml-0 text-xs sm:text-sm text-secondary max-[750px]:text-[9px]">
                      Unfiltered teams: ≤ 2-place gap → draw; larger gap → higher-placed wins.
                    </div>
                  </div>
                    <div className="h-[70px] sm:h-[80px] mt-4 sm:mt-[45px] max-[750px]:h-[40px] max-[750px]:mt-2">
                      <div className="flex items-center mb-1 sm:mb-2 justify-between max-[750px]:mb-0" style={{paddingRight: '10px'}}>
                        <label htmlFor="all-draws" className="font-medium text-primary text-center whitespace-nowrap mr-2 sm:mr-4 text-xs sm:text-base max-[750px]:text-[10px]">
                        Auto-draw unfiltered matches
                      </label>
                        <div className="relative" style={{paddingLeft: "20px"}}>
                        <input 
                          type="radio" 
                          id="all-draws" 
                          name="unfiltered-matches" 
                          className="opacity-0 absolute h-5 w-5"
                          checked={unfilteredMatchesMode === 'draws'}
                          onChange={() => setUnfilteredMatchesMode('draws')}
                        />
                        <div className={`border-2 rounded-full h-5 w-5 flex justify-center items-center ${
                          unfilteredMatchesMode === 'draws' ? 'border-[#f7e479]' : 'border-gray-400'
                        }`}>
                          {unfilteredMatchesMode === 'draws' && (
                            <div className="rounded-full h-3 w-3 bg-[#f7e479]"></div>
                          )}
                        </div>
                      </div>
                    </div>
                      <div className="ml-0 text-[10px] text-secondary leading-tight max-[750px]:leading-tight min-[751px]:leading-normal min-[751px]:text-sm">
                        <span className="block min-[751px]:inline">All unfiltered </span>
                        <span className="block min-[751px]:inline">matches that do </span>
                        <span className="block min-[751px]:inline">not involve your </span>
                        <span className="block min-[751px]:inline">selected teams </span>
                        <span className="block min-[751px]:inline">end in draws.</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full sm:w-5/12 z-10 max-[750px]:mt-2">
                    <div className="h-[70px] sm:h-[80px] max-[750px]:h-[40px]">
                      <div className="flex items-center mb-1 sm:mb-2 max-[750px]:mb-0">
                        <div className="relative mr-3 sm:mr-6 max-[750px]:mr-2">
                        <input 
                          type="radio" 
                          id="mini-table" 
                          name="table-display" 
                          className="opacity-0 absolute h-5 w-5"
                          checked={tableDisplayMode === 'mini'}
                          onChange={() => setTableDisplayMode('mini')}
                        />
                        <div className={`border-2 rounded-full h-5 w-5 flex justify-center items-center ${
                          tableDisplayMode === 'mini' ? 'border-[#f7e479]' : 'border-gray-400'
                        }`}>
                          {tableDisplayMode === 'mini' && (
                            <div className="rounded-full h-3 w-3 bg-[#f7e479]"></div>
                          )}
                        </div>
                      </div>
                        <label htmlFor="mini-table" className="font-medium text-primary text-center w-full text-xs sm:text-base max-[750px]:text-[10px]">
                        Mini table
                      </label>
                    </div>
                      <div className="ml-8 sm:ml-14 text-xs sm:text-sm text-secondary max-[750px]:text-[9px]">
                      Only show selected teams
                    </div>
                  </div>
                    <div className="h-[70px] sm:h-[80px] mt-4 sm:mt-[45px] max-[750px]:h-[40px] max-[750px]:mt-2">
                      <div className="flex items-center mb-1 sm:mb-2 max-[750px]:mb-0">
                        <div className="relative mr-3 sm:mr-6 max-[750px]:mr-2">
                        <input 
                          type="radio" 
                          id="full-table" 
                          name="table-display" 
                          className="opacity-0 absolute h-5 w-5"
                          checked={tableDisplayMode === 'full'}
                          onChange={() => setTableDisplayMode('full')}
                        />
                        <div className={`border-2 rounded-full h-5 w-5 flex justify-center items-center ${
                          tableDisplayMode === 'full' ? 'border-[#f7e479]' : 'border-gray-400'
                        }`}>
                          {tableDisplayMode === 'full' && (
                            <div className="rounded-full h-3 w-3 bg-[#f7e479]"></div>
                          )}
                        </div>
                      </div>
                        <label htmlFor="full-table" className="font-medium text-primary text-center w-full text-xs sm:text-base max-[750px]:text-[10px]">
                        Full table
                      </label>
                    </div>
                      <div className="ml-8 sm:ml-14 text-xs sm:text-sm text-secondary max-[750px]:text-[9px]">
                      Show all teams in standings
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mt-6 sm:mt-8 mr-0 sm:mr-1 max-[750px]:mt-2">
            <button
              onClick={() => setShowUnfilteredOptions(false)}
              className="w-full sm:w-auto px-8 py-3 sm:py-2 max-[750px]:px-4 max-[750px]:py-2 max-[750px]:text-sm bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              className="w-full sm:w-auto px-8 py-3 sm:py-2 max-[750px]:px-4 max-[750px]:py-2 max-[750px]:text-sm bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
            >
              Start Predictions
            </button>
          </div>
        </>
      )}
    </div>
  );
} 