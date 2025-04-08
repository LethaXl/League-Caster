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
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div className="relative w-12 h-12">
            <Image
              src={match.homeTeam.crest}
              alt={match.homeTeam.name}
              fill
              className="object-contain"
            />
          </div>
          <span className="font-medium">{match.homeTeam.name}</span>
        </div>
        <span className="text-xl font-bold">VS</span>
        <div className="flex items-center space-x-4">
          <span className="font-medium">{match.awayTeam.name}</span>
          <div className="relative w-12 h-12">
            <Image
              src={match.awayTeam.crest}
              alt={match.awayTeam.name}
              fill
              className="object-contain"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-center space-x-4 mb-4">
        <button
          className={`px-4 py-2 rounded-full transition-colors ${
            predictionType === 'win_home'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          onClick={() => handlePredictionChange('win_home')}
        >
          Home Win
        </button>
        <button
          className={`px-4 py-2 rounded-full transition-colors ${
            predictionType === 'draw'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          onClick={() => handlePredictionChange('draw')}
        >
          Draw
        </button>
        <button
          className={`px-4 py-2 rounded-full transition-colors ${
            predictionType === 'win_away'
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          onClick={() => handlePredictionChange('win_away')}
        >
          Away Win
        </button>
        <button
          className={`px-4 py-2 rounded-full transition-colors ${
            predictionType === 'custom'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          onClick={() => handlePredictionChange('custom')}
        >
          Custom
        </button>
      </div>

      {predictionType === 'custom' && (
        <div className="flex items-center justify-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Home</span>
            <div className="flex items-center">
              <button
                className="px-2 py-1 bg-gray-100 rounded-l hover:bg-gray-200"
                onClick={() => handleScoreChange('home', homeGoals - 1)}
              >
                -
              </button>
              <input
                type="number"
                min="0"
                value={homeGoals}
                onChange={(e) => handleScoreChange('home', parseInt(e.target.value) || 0)}
                className="w-12 text-center border-y border-gray-200"
              />
              <button
                className="px-2 py-1 bg-gray-100 rounded-r hover:bg-gray-200"
                onClick={() => handleScoreChange('home', homeGoals + 1)}
              >
                +
              </button>
            </div>
          </div>
          <span className="text-xl font-bold">:</span>
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <button
                className="px-2 py-1 bg-gray-100 rounded-l hover:bg-gray-200"
                onClick={() => handleScoreChange('away', awayGoals - 1)}
              >
                -
              </button>
              <input
                type="number"
                min="0"
                value={awayGoals}
                onChange={(e) => handleScoreChange('away', parseInt(e.target.value) || 0)}
                className="w-12 text-center border-y border-gray-200"
              />
              <button
                className="px-2 py-1 bg-gray-100 rounded-r hover:bg-gray-200"
                onClick={() => handleScoreChange('away', awayGoals + 1)}
              >
                +
              </button>
            </div>
            <span className="text-sm font-medium">Away</span>
          </div>
        </div>
      )}
    </div>
  );
} 