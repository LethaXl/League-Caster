import { useState } from 'react';
import Image from 'next/image';
import { Match, PredictionType } from '@/types/predictions';

interface MatchPredictionProps {
  match: Match;
  onPredictionChange: (matchId: number, type: PredictionType, homeGoals?: number, awayGoals?: number) => void;
}

export default function MatchPrediction({ match, onPredictionChange }: MatchPredictionProps) {
  const [predictionType, setPredictionType] = useState<PredictionType>('draw');
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);

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

  return (
    <div className="bg-[#111111] rounded-lg p-4 border border-[#2a2a2a] hover:border-[#333333] transition-colors">
      <div className="flex flex-col h-full">
        <div className="flex-grow">
          {predictionType !== 'custom' ? (
            <>
              {/* Home Team */}
              <div className="flex items-center justify-center mb-2">
                <div className="flex items-center">
                  <div className="relative w-8 h-8 mr-2">
                    <Image
                      src={match.homeTeam.crest || "/placeholder-team.png"}
                      alt={match.homeTeam.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className="text-xs font-medium text-primary">{match.homeTeam.name}</span>
                </div>
              </div>

              {/* VS */}
              <div className="text-center text-xs font-medium text-secondary opacity-60 mb-2">VS</div>

              {/* Away Team */}
              <div className="flex items-center justify-center mb-3">
                <div className="flex items-center">
                  <span className="text-xs font-medium text-primary mr-2">{match.awayTeam.name}</span>
                  <div className="relative w-8 h-8">
                    <Image
                      src={match.awayTeam.crest || "/placeholder-team.png"}
                      alt={match.awayTeam.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Custom Score Layout
            <div className="flex flex-col items-center mb-3">
              <div className="flex justify-center items-center gap-6 mb-2">
                <div className="relative w-8 h-8">
                  <Image
                    src={match.homeTeam.crest || "/placeholder-team.png"}
                    alt={match.homeTeam.name}
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="text-xs font-medium text-secondary opacity-60">VS</span>
                <div className="relative w-8 h-8">
                  <Image
                    src={match.awayTeam.crest || "/placeholder-team.png"}
                    alt={match.awayTeam.name}
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  <div className="flex flex-col mr-2">
                    <button
                      className="w-6 h-6 flex items-center justify-center text-sm text-secondary hover:text-[#f7e479] transition-colors"
                      onClick={() => handleScoreChange('home', homeGoals + 1)}
                    >
                      +
                    </button>
                    <button
                      className="w-6 h-6 flex items-center justify-center text-sm text-secondary hover:text-[#f7e479] transition-colors"
                      onClick={() => handleScoreChange('home', homeGoals - 1)}
                    >
                      -
                    </button>
                  </div>
                  <span className="text-2xl text-primary w-6 text-center">{homeGoals}</span>
                </div>

                <span className="text-xl text-secondary">:</span>

                <div className="flex items-center">
                  <span className="text-2xl text-primary w-6 text-center">{awayGoals}</span>
                  <div className="flex flex-col ml-2">
                    <button
                      className="w-6 h-6 flex items-center justify-center text-sm text-secondary hover:text-[#f7e479] transition-colors"
                      onClick={() => handleScoreChange('away', awayGoals + 1)}
                    >
                      +
                    </button>
                    <button
                      className="w-6 h-6 flex items-center justify-center text-sm text-secondary hover:text-[#f7e479] transition-colors"
                      onClick={() => handleScoreChange('away', awayGoals - 1)}
                    >
                      -
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Prediction Buttons */}
        <div className="relative flex bg-[#111111]">
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