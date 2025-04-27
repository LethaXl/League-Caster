import { useState } from 'react';
import Image from 'next/image';
import { Match, PredictionType } from '@/types/predictions';

interface MatchPredictionProps {
  match: Match;
  onPredictionChange: (matchId: number, type: PredictionType, homeGoals?: number, awayGoals?: number) => void;
}

// Team name mapping for display purposes
const getDisplayName = (name: string): string => {
  if (name === 'Wolverhampton Wanderers FC') return 'Wolves';
  if (name === 'RCD Espanyol de Barcelona') return 'RCD Espanyol';
  if (name === 'Club Atlético de Madrid') return 'Atletico Madrid';
  if (name === 'Brighton & Hove Albion FC') return 'Brighton & Hove Albion';
  return name;
};

export default function MatchPrediction({ match, onPredictionChange }: MatchPredictionProps) {
  const [predictionType, setPredictionType] = useState<PredictionType>('draw');
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  
  // Get display names for teams
  const homeTeamName = getDisplayName(match.homeTeam.name);
  const awayTeamName = getDisplayName(match.awayTeam.name);

  // Only use truncation for custom score view
  const truncateTeamName = (name: string) => {
    if (name.length > 20) {
      return name.substring(0, 17) + '...';
    }
    return name;
  };

  const handlePredictionChange = (type: PredictionType) => {
    setPredictionType(type);
    if (type === 'custom') {
      onPredictionChange(match.id, type, homeGoals, awayGoals);
    } else {
      onPredictionChange(match.id, type);
    }
  };

  const handleScoreChange = (team: 'home' | 'away', value: number) => {
    const newValue = Math.max(0, value);
    if (team === 'home') {
      setHomeGoals(newValue);
      onPredictionChange(match.id, 'custom', newValue, awayGoals);
    } else {
      setAwayGoals(newValue);
      onPredictionChange(match.id, 'custom', homeGoals, newValue);
    }
  };

  // Determine if this is a head-to-head match in race mode
  const isHeadToHead = match.isHeadToHead;

  return (
    <div 
      className={`bg-[#111111] rounded-lg p-4 border ${
        isHeadToHead 
          ? 'border-[#f7e479] shadow-[0_0_8px_rgba(247,228,121,0.3)]' 
          : 'border-[#2a2a2a] hover:border-[#333333]'
      } transition-colors h-full w-full`}
    >
      <div className="flex flex-col h-full">
        {isHeadToHead && (
          <div className="text-[#f7e479] text-xs font-medium mb-2 text-center">
            Head-to-Head Match
          </div>
        )}
        
        {/* Fixed height content area */}
        <div className="flex-grow flex items-center justify-center h-[115px]">
          {predictionType !== 'custom' ? (
            <div className="flex flex-col w-full">
              {/* Home Team */}
              <div className="flex items-center justify-center mb-2">
                <div className="flex items-center max-w-full">
                  <div className="relative w-8 h-8 min-w-8 mr-2">
                    <Image
                      src={match.homeTeam.crest || "/placeholder-team.png"}
                      alt={homeTeamName}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className="text-xs font-medium text-primary overflow-x-auto scrollbar-hide">{homeTeamName}</span>
                </div>
              </div>

              {/* VS */}
              <div className="text-center text-xs font-medium text-secondary opacity-60 mb-2">VS</div>

              {/* Away Team */}
              <div className="flex items-center justify-center">
                <div className="flex items-center max-w-full">
                  <span className="text-xs font-medium text-primary mr-2 overflow-x-auto scrollbar-hide">{awayTeamName}</span>
                  <div className="relative w-8 h-8 min-w-8">
                    <Image
                      src={match.awayTeam.crest || "/placeholder-team.png"}
                      alt={awayTeamName}
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full h-[115px] justify-center">
              <div className="flex justify-center items-center gap-6 mb-3">
                <div className="text-center w-16">
                  <div className="relative w-8 h-8 mx-auto mb-2">
                    <Image
                      src={match.homeTeam.crest || "/placeholder-team.png"}
                      alt={homeTeamName}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className="text-[10px] font-medium text-primary line-clamp-1">{truncateTeamName(homeTeamName)}</span>
                </div>
                <span className="text-xs font-medium text-secondary opacity-60">VS</span>
                <div className="text-center w-16">
                  <div className="relative w-8 h-8 mx-auto mb-2">
                    <Image
                      src={match.awayTeam.crest || "/placeholder-team.png"}
                      alt={awayTeamName}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className="text-[10px] font-medium text-primary line-clamp-1">{truncateTeamName(awayTeamName)}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  <div className="flex flex-col mr-1">
                    <button
                      className="w-5 h-5 flex items-center justify-center text-xs text-gray-400 hover:text-[#f7e479] transition-colors"
                      onClick={() => handleScoreChange('home', homeGoals + 1)}
                    >
                      +
                    </button>
                    <button
                      className="w-5 h-5 flex items-center justify-center text-xs text-gray-400 hover:text-[#f7e479] transition-colors"
                      onClick={() => handleScoreChange('home', homeGoals - 1)}
                    >
                      −
                    </button>
                  </div>
                  <span className="text-xl text-primary w-5 text-center">{homeGoals}</span>
                </div>

                <span className="text-lg text-primary mx-0">:</span>

                <div className="flex items-center">
                  <span className="text-xl text-primary w-5 text-center">{awayGoals}</span>
                  <div className="flex flex-col ml-1">
                    <button
                      className="w-5 h-5 flex items-center justify-center text-xs text-gray-400 hover:text-[#f7e479] transition-colors"
                      onClick={() => handleScoreChange('away', awayGoals + 1)}
                    >
                      +
                    </button>
                    <button
                      className="w-5 h-5 flex items-center justify-center text-xs text-gray-400 hover:text-[#f7e479] transition-colors"
                      onClick={() => handleScoreChange('away', awayGoals - 1)}
                    >
                      −
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Prediction Buttons */}
        <div className="relative flex bg-[#111111] mt-auto">
          {/* Sliding Indicator */}
          <div 
            className="absolute h-[1px] bg-[#f7e479] shadow-[0_0_8px_#f7e479] transition-all duration-300 ease-in-out"
            style={{
              width: '25%',
              left: predictionType === 'home' ? '0%' :
                    predictionType === 'draw' ? '25%' :
                    predictionType === 'away' ? '50%' :
                    '75%',
              top: '-1px'
            }}
          />
          <button
            className={`w-1/4 text-xs leading-6 transition-colors duration-300 ${
              predictionType === 'home' ? 'text-[#f7e479]' : 'text-secondary hover:text-[#f7e479]'
            }`}
            onClick={() => handlePredictionChange('home')}
          >
            Home
          </button>
          <button
            className={`w-1/4 text-xs leading-6 transition-colors duration-300 ${
              predictionType === 'draw' ? 'text-[#f7e479]' : 'text-secondary hover:text-[#f7e479]'
            }`}
            onClick={() => handlePredictionChange('draw')}
          >
            Draw
          </button>
          <button
            className={`w-1/4 text-xs leading-6 transition-colors duration-300 ${
              predictionType === 'away' ? 'text-[#f7e479]' : 'text-secondary hover:text-[#f7e479]'
            }`}
            onClick={() => handlePredictionChange('away')}
          >
            Away
          </button>
          <button
            className={`w-1/4 text-xs leading-6 transition-colors duration-300 ${
              predictionType === 'custom' ? 'text-[#f7e479]' : 'text-secondary hover:text-[#f7e479]'
            }`}
            onClick={() => handlePredictionChange('custom')}
          >
            Custom
          </button>
        </div>
      </div>
    </div>
  );
} 