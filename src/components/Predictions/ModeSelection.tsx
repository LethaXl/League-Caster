import { useState } from 'react';
import Image from 'next/image';
import { Standing } from '@/services/football-api';

interface ModeSelectionProps {
  leagueCode: string;
  standings: Standing[];
  onModeSelect: (mode: 'normal' | 'race', selectedTeams?: number[]) => void;
}

export default function ModeSelection({ leagueCode, standings, onModeSelect }: ModeSelectionProps) {
  const [mode, setMode] = useState<'normal' | 'race' | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  
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
  
  const handleSubmit = () => {
    if (mode === 'normal') {
      onModeSelect('normal');
    } else if (mode === 'race' && selectedTeams.length > 0) {
      onModeSelect('race', selectedTeams);
    }
  };

  return (
    <div className="bg-card rounded-lg p-6">
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
            See only fixtures involving your selected teams.
          </p>
        </div>
      </div>
      
      {/* Team Selection for Race Mode */}
      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${mode === 'race' ? 'max-h-[2000px] opacity-100 mt-6 mb-8' : 'max-h-0 opacity-0'}`}>
        <div className="transform transition-transform duration-500 ease-in-out" style={{ transform: mode === 'race' ? 'translateY(0)' : 'translateY(-20px)' }}>
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
          <div className="text-sm text-secondary mt-2">
            Selected: {selectedTeams.length}/10 teams
          </div>
        </div>
      </div>
      
      <div className="flex justify-center mt-8">
        <button
          onClick={handleSubmit}
          disabled={mode === null || (mode === 'race' && selectedTeams.length === 0)}
          className={`px-8 py-2 rounded-full font-semibold transition-all duration-300 ${
            mode === null || (mode === 'race' && selectedTeams.length === 0)
              ? 'bg-[#333333] text-[#666666] cursor-not-allowed'
              : 'bg-transparent text-[#f7e479] border-2 border-[#f7e479] hover:bg-[#f7e479] hover:text-black'
          }`}
        >
          Start Predictions
        </button>
      </div>
    </div>
  );
} 