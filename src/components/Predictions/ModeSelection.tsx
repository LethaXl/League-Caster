import { useState } from 'react';
import Image from 'next/image';
import { Standing } from '@/services/football-api';

interface ModeSelectionProps {
  leagueCode: string;
  standings: Standing[];
  onModeSelect: (mode: 'normal' | 'race', selectedTeams?: number[], unfilteredMatchesMode?: 'auto' | 'draws', tableDisplayMode?: 'mini' | 'full') => void;
}

export default function ModeSelection({ leagueCode, standings, onModeSelect }: ModeSelectionProps) {
  const [mode, setMode] = useState<'normal' | 'race' | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [unfilteredMatchesMode, setUnfilteredMatchesMode] = useState<'auto' | 'draws'>('auto');
  const [tableDisplayMode, setTableDisplayMode] = useState<'mini' | 'full'>('mini');
  const [showUnfilteredOptions, setShowUnfilteredOptions] = useState(false);
  
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
    <div className="bg-card rounded-lg p-6">
      {!showUnfilteredOptions ? (
        <>
          <div className="flex justify-center items-center mb-6">
            <h2 className="text-2xl font-bold text-primary">Select Prediction Mode</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Normal Mode */}
            <div 
              className={`bg-[#111111] rounded-lg p-6 border-2 cursor-pointer transition-all duration-300 hover:border-[#f7e479] flex flex-col ${mode === 'normal' ? 'border-[#f7e479]' : 'border-[#2a2a2a]'}`}
              onClick={() => setMode('normal')}
            >
              <h3 className="text-xl font-bold text-[#f7e479] mb-3 text-center">Classic Mode</h3>
              <p className="text-secondary mb-2">
                Forecast all fixtures for each matchday in the league, predicting every match outcome.
              </p>
              <p className="text-secondary mb-4">
                See how your predictions affect the entire league table throughout the season.
              </p>
            </div>
            
            {/* Race Mode */}
            <div 
              className={`bg-[#111111] rounded-lg p-6 border-2 cursor-pointer transition-all duration-300 hover:border-[#f7e479] flex flex-col ${mode === 'race' ? 'border-[#f7e479]' : 'border-[#2a2a2a]'}`}
              onClick={() => setMode('race')}
            >
              <h3 className="text-xl font-bold text-[#f7e479] mb-3 text-center">Race Mode</h3>
              <p className="text-secondary mb-2">
              Focus only on teams in the title race, European chase, or relegation battle.
              </p>
              <p className="text-secondary mb-4">
                See only fixtures involving your selected teams and get summarized results at the end.
              </p>
            </div>
          </div>
          
          {/* Race Mode Configuration - Team Selection */}
          <div className={`overflow-hidden transition-all duration-500 ease-in-out ${mode === 'race' ? 'max-h-[2000px] opacity-100 mt-6 mb-8' : 'max-h-0 opacity-0'}`}>
            <div className="transform transition-transform duration-500 ease-in-out" style={{ transform: mode === 'race' ? 'translateY(0)' : 'translateY(-20px)' }}>
              {/* Team Selection */}
              <h3 className="text-lg font-semibold text-primary mb-4">Select teams to include (max 10):</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {standings.map(standing => (
                  <div 
                    key={standing.team.id}
                    onClick={() => handleSelectTeam(standing.team.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg cursor-pointer transition-all ${
                      selectedTeams.includes(standing.team.id) 
                        ? 'bg-[#f7e479]/10 border border-[#f7e479]' 
                        : 'bg-[#111111] border border-[#2a2a2a] hover:border-[#444444]'
                    }`}
                  >
                    <div className="relative w-10 h-10 mb-2">
                      <Image
                        src={standing.team.crest || "/placeholder-team.png"}
                        alt={standing.team.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <span className={`text-sm font-medium text-center ${
                      selectedTeams.includes(standing.team.id) ? 'text-[#f7e479]' : 'text-primary'
                    }`}>
                      {standing.team.shortName || standing.team.name}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-sm text-secondary mt-2 mb-6">
                Selected: {selectedTeams.length}/10 teams
              </div>
            </div>
          </div>
          
          <div className="flex justify-center mt-8">
            <button
              onClick={handleContinue}
              disabled={mode === null || (mode === 'race' && selectedTeams.length === 0)}
              className={`px-8 py-2 rounded-full font-semibold transition-all duration-300 ${
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
          <div className="mb-6">
            <h3 className="text-xl font-bold text-[#f7e479] mb-6 text-center">Configure Race Mode</h3>
            <div className="mx-auto max-w-2xl">
              {/* Selected Teams Display */}
              <div className="mb-6">
                <div className="text-lg font-semibold text-primary mb-3">Selected Teams:</div>
                <div className="flex flex-wrap gap-2">
                  {selectedTeams.map(teamId => {
                    const team = standings.find(s => s.team.id === teamId);
                    return team && (
                      <div key={teamId} className="flex items-center bg-[#1a1a1a] rounded-full px-3 py-1">
                        <div className="relative w-6 h-6 mr-2">
                          <Image
                            src={team.team.crest || "/placeholder-team.png"}
                            alt={team.team.name}
                            fill
                            className="object-contain"
                          />
                        </div>
                        <span className="text-sm text-primary">{team.team.shortName || team.team.name}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="w-full h-[1px] bg-[#333333] mt-6"></div>
              </div>
              
              {/* Unfiltered Matches and Table Display sections with connecting lines */}
              <div className="flex justify-between mb-8 relative gap-x-8">
                {/* Horizontal lines */}
                {/* Top horizontal line (auto -> mini) */}
                <div 
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

                <div className="w-5/12 z-10">
                  <div className="h-[80px]">
                    <div className="flex items-center mb-2 justify-between" style={{paddingRight: '10px'}}>
                      <label htmlFor="auto-assign" className="font-medium text-primary text-center whitespace-nowrap mr-4">
                        Auto-assign based on position
                      </label>
                      <div className="relative" style={{paddingLeft: "25px"}}>
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
                    <div className="ml-0 text-sm text-secondary">
                      Unfiltered teams: ≤ 2-place gap → draw; larger gap → higher-placed wins.
                    </div>
                  </div>
                  
                  <div className="h-[80px] mt-[45px]">
                    <div className="flex items-center mb-2 justify-between" style={{paddingRight: '10px'}}>
                      <label htmlFor="all-draws" className="font-medium text-primary text-center whitespace-nowrap mr-4">
                        Auto-draw unfiltered matches
                      </label>
                      <div className="relative" style={{paddingLeft: "27px"}}>
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
                    <div className="ml-0 text-sm text-secondary">
                      All unfiltered matches not involving your selected teams end in draws.
                    </div>
                  </div>
                </div>
                
                <div className="w-5/12 z-10">
                  <div className="h-[80px]">
                    <div className="flex items-center mb-2">
                      <div className="relative mr-6">
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
                      <label htmlFor="mini-table" className="font-medium text-primary text-center w-full">
                        Mini table
                      </label>
                    </div>
                    <div className="ml-14 text-sm text-secondary">
                      Only show selected teams
                    </div>
                  </div>
                  
                  <div className="h-[80px] mt-[45px]">
                    <div className="flex items-center mb-2">
                      <div className="relative mr-6">
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
                      <label htmlFor="full-table" className="font-medium text-primary text-center w-full">
                        Full table
                      </label>
                    </div>
                    <div className="ml-14 text-sm text-secondary">
                      Show all teams in standings
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center space-x-4 mt-8 mr-1">
            <button
              onClick={() => setShowUnfilteredOptions(false)}
              className="px-8 py-2 bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              className="px-8 py-2 bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
            >
              Start Predictions
            </button>
          </div>
        </>
      )}
    </div>
  );
} 