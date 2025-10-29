import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Match, PredictionType } from '@/types/predictions';

interface MatchPredictionProps {
  match: Match;
  onPredictionChange: (matchId: number, type: PredictionType, homeGoals?: number, awayGoals?: number) => void;
}

// Team name mapping for display purposes
const getDisplayName = (name: string | null | undefined): string => {
  if (!name) {
    return 'Unknown Team';
  }
  
  if (name === 'Wolverhampton Wanderers FC') return 'Wolves';
  if (name === 'RCD Espanyol de Barcelona') return 'RCD Espanyol';
  if (name === 'Club Atlético de Madrid') return 'Atletico Madrid';
  if (name === 'Brighton & Hove Albion FC') return 'Brighton & Hove Albion';
  if (name === 'Real Sociedad de Fútbol') return 'Real Sociedad';
  return name;
};

export default function MatchPrediction({ match, onPredictionChange }: MatchPredictionProps) {
  const [predictionType, setPredictionType] = useState<PredictionType>('draw');
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isTinyScreen, setIsTinyScreen] = useState(false);
  const [isVeryTinyScreen, setIsVeryTinyScreen] = useState(false);
  
  // Check if we're on a small screen
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth >= 375 && window.innerWidth < 450);
      setIsTinyScreen(window.innerWidth >= 340 && window.innerWidth < 375);
      setIsVeryTinyScreen(window.innerWidth >= 320 && window.innerWidth < 340);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  // Get team names with preference for shortName
  const homeTeamName = match.homeTeam?.shortName || getDisplayName(match.homeTeam?.name) || 'Home Team';
  const awayTeamName = match.awayTeam?.shortName || getDisplayName(match.awayTeam?.name) || 'Away Team';

  // Only use truncation for custom score view
  const truncateTeamName = (name: string | null | undefined) => {
    // Handle null/undefined values
    if (!name) {
      return 'Unknown Team';
    }
    
    if (isVeryTinyScreen && predictionType === 'custom') {
      // Super strict truncation for custom mode on very tiny screens
      if (name.length > 4) {
        return name.substring(0, 3) + '...';
      }
    } else if (isTinyScreen && predictionType === 'custom') {
      // Even stricter truncation for custom mode on tiny screens
      if (name.length > 6) {
        return name.substring(0, 4) + '...';
      }
    } else if (isSmallScreen && predictionType === 'custom') {
      // Stricter truncation for custom mode on small screens
      if (name.length > 8) {
        return name.substring(0, 6) + '...';
      }
    } else if (name.length > 12) {
      return name.substring(0, 10) + '...';
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
      className={`bg-[#111111] rounded-lg ${isVeryTinyScreen ? 'p-2' : 'p-4'} border ${
        isHeadToHead 
          ? 'border-[#f7e479] shadow-[0_0_8px_rgba(247,228,121,0.3)]' 
          : 'border-[#2a2a2a] hover:border-[#333333]'
      } transition-colors h-full w-full max-w-full`}
    >
      <div className="flex flex-col h-full">
        {isHeadToHead && (
          <div className={`text-[#f7e479] ${isVeryTinyScreen ? 'text-[8px]' : 'text-xs'} font-medium mb-2 text-center`}>
            Head-to-Head Match
          </div>
        )}
        
        {/* Fixed height content area */}
        <div className={`flex-grow flex items-center justify-center ${isVeryTinyScreen ? 'h-[105px]' : 'h-[115px]'}`}>
          {predictionType !== 'custom' ? (
            <div className="flex flex-col w-full">
              {/* Home Team */}
              <div className={`flex items-center justify-center ${isVeryTinyScreen ? 'mb-0.5' : (isSmallScreen || isTinyScreen) ? 'mb-1' : 'mb-2'}`}>
                <div className="flex items-center max-w-full overflow-hidden">
                  <div className={`relative ${isVeryTinyScreen ? 'w-6 h-6 min-w-6 mr-1' : 'w-8 h-8 min-w-8 mr-2'}`}>
                    <Image
                      src={match.homeTeam.crest || "/placeholder-team.png"}
                      alt={homeTeamName}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className={`${isVeryTinyScreen ? 'text-[9px]' : 'text-xs'} font-medium text-primary overflow-hidden whitespace-nowrap text-ellipsis ${isVeryTinyScreen ? 'max-w-[65px]' : 'max-w-[80px]'} block`}>
                    {truncateTeamName(homeTeamName)}
                  </span>
                </div>
              </div>

              {/* VS */}
              <div className={`text-center ${isVeryTinyScreen ? 'text-[9px]' : 'text-xs'} font-medium text-secondary opacity-60 ${isVeryTinyScreen ? 'mb-0.5' : (isSmallScreen || isTinyScreen) ? 'mb-1' : 'mb-2'}`}>VS</div>

              {/* Away Team */}
              <div className="flex items-center justify-center">
                <div className="flex items-center max-w-full overflow-hidden">
                  <span className={`${isVeryTinyScreen ? 'text-[9px]' : 'text-xs'} font-medium text-primary ${isVeryTinyScreen ? 'mr-1' : 'mr-2'} overflow-hidden whitespace-nowrap text-ellipsis ${isVeryTinyScreen ? 'max-w-[65px]' : 'max-w-[80px]'} block`}>
                    {truncateTeamName(awayTeamName)}
                  </span>
                  <div className={`relative ${isVeryTinyScreen ? 'w-6 h-6 min-w-6' : 'w-8 h-8 min-w-8'}`}>
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
            <div className={`flex flex-col items-center w-full ${isVeryTinyScreen ? 'h-[105px]' : 'h-[115px]'} justify-center`}>
              <div className={`flex justify-center items-center ${isVeryTinyScreen ? 'gap-2 mb-1' : (isSmallScreen || isTinyScreen) ? 'gap-4 mb-2' : 'gap-6 mb-3'}`}>
                <div className={`text-center ${isVeryTinyScreen ? 'w-12' : isTinyScreen ? 'w-14' : 'w-16'}`}>
                  <div className={`relative ${isVeryTinyScreen ? 'w-6 h-6' : 'w-8 h-8'} mx-auto ${isVeryTinyScreen ? 'mb-1' : 'mb-2'}`}>
                    <Image
                      src={match.homeTeam.crest || "/placeholder-team.png"}
                      alt={homeTeamName}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className={`${isVeryTinyScreen ? 'text-[8px]' : 'text-[10px]'} font-medium text-primary line-clamp-1 ${isVeryTinyScreen ? 'max-w-[28px] mx-auto' : isTinyScreen ? 'max-w-[32px] mx-auto' : isSmallScreen ? 'max-w-[40px] mx-auto' : ''}`}>
                    {match.homeTeam.shortName || truncateTeamName(homeTeamName)}
                  </span>
                </div>
                <span className={`${isVeryTinyScreen ? 'text-[9px]' : 'text-xs'} font-medium text-secondary opacity-60`}>VS</span>
                <div className={`text-center ${isVeryTinyScreen ? 'w-12' : isTinyScreen ? 'w-14' : 'w-16'}`}>
                  <div className={`relative ${isVeryTinyScreen ? 'w-6 h-6' : 'w-8 h-8'} mx-auto ${isVeryTinyScreen ? 'mb-1' : 'mb-2'}`}>
                    <Image
                      src={match.awayTeam.crest || "/placeholder-team.png"}
                      alt={awayTeamName}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span className={`${isVeryTinyScreen ? 'text-[8px]' : 'text-[10px]'} font-medium text-primary line-clamp-1 ${isVeryTinyScreen ? 'max-w-[28px] mx-auto' : isTinyScreen ? 'max-w-[32px] mx-auto' : isSmallScreen ? 'max-w-[40px] mx-auto' : ''}`}>
                    {match.awayTeam.shortName || truncateTeamName(awayTeamName)}
                  </span>
                </div>
              </div>
              
              <div className={`flex items-center ${isVeryTinyScreen ? 'gap-2' : 'gap-4'}`}>
                <div className="flex items-center">
                  <div className="flex flex-col mr-1">
                    <button
                      className={`${isVeryTinyScreen ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center ${isVeryTinyScreen ? 'text-[9px]' : 'text-xs'} text-gray-400 hover:text-[#f7e479] transition-colors`}
                      onClick={() => handleScoreChange('home', homeGoals + 1)}
                    >
                      +
                    </button>
                    <button
                      className={`${isVeryTinyScreen ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center ${isVeryTinyScreen ? 'text-[9px]' : 'text-xs'} text-gray-400 hover:text-[#f7e479] transition-colors`}
                      onClick={() => handleScoreChange('home', homeGoals - 1)}
                    >
                      −
                    </button>
                  </div>
                  <span className={`${isVeryTinyScreen ? 'text-lg' : 'text-xl'} text-primary ${isVeryTinyScreen ? 'w-4' : 'w-5'} text-center`}>{homeGoals}</span>
                </div>

                <span className={`${isVeryTinyScreen ? 'text-base' : 'text-lg'} text-primary mx-0`}>:</span>

                <div className="flex items-center">
                  <span className={`${isVeryTinyScreen ? 'text-lg' : 'text-xl'} text-primary ${isVeryTinyScreen ? 'w-4' : 'w-5'} text-center`}>{awayGoals}</span>
                  <div className="flex flex-col ml-1">
                    <button
                      className={`${isVeryTinyScreen ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center ${isVeryTinyScreen ? 'text-[9px]' : 'text-xs'} text-gray-400 hover:text-[#f7e479] transition-colors`}
                      onClick={() => handleScoreChange('away', awayGoals + 1)}
                    >
                      +
                    </button>
                    <button
                      className={`${isVeryTinyScreen ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center ${isVeryTinyScreen ? 'text-[9px]' : 'text-xs'} text-gray-400 hover:text-[#f7e479] transition-colors`}
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
              width: (isVeryTinyScreen) ? '20%' : (isSmallScreen || isTinyScreen) ? '23%' : '25%',
              left: predictionType === 'home' ? '0%' :
                    predictionType === 'draw' ? ((isVeryTinyScreen) ? '25%' : (isSmallScreen || isTinyScreen) ? '25%' : '25%') :
                    predictionType === 'away' ? ((isVeryTinyScreen) ? '50%' : (isSmallScreen || isTinyScreen) ? '50%' : '50%') :
                    ((isVeryTinyScreen) ? '75%' : (isSmallScreen || isTinyScreen) ? '82%' : '75%'),
              top: '-1px'
            }}
          />
          <button
            className={`${(isSmallScreen || isTinyScreen || isVeryTinyScreen) ? 'w-1/4' : 'w-1/4'} ${isVeryTinyScreen ? 'text-[7px] px-0.5 py-1' : isTinyScreen ? 'text-[8px]' : 'text-[10px]'} xs:text-xs leading-6 transition-colors duration-300 ${
              predictionType === 'home' ? 'text-[#f7e479]' : 'text-secondary hover:text-[#f7e479]'
            }`}
            onClick={() => handlePredictionChange('home')}
          >
            Home
          </button>
          <button
            className={`${(isSmallScreen || isTinyScreen || isVeryTinyScreen) ? 'w-1/4' : 'w-1/4'} ${isVeryTinyScreen ? 'text-[7px] px-0.5 py-1' : isTinyScreen ? 'text-[8px]' : 'text-[10px]'} xs:text-xs leading-6 transition-colors duration-300 ${
              predictionType === 'draw' ? 'text-[#f7e479]' : 'text-secondary hover:text-[#f7e479]'
            }`}
            onClick={() => handlePredictionChange('draw')}
          >
            Draw
          </button>
          <button
            className={`${(isSmallScreen || isTinyScreen || isVeryTinyScreen) ? 'w-1/4' : 'w-1/4'} ${isVeryTinyScreen ? 'text-[7px] px-0.5 py-1' : isTinyScreen ? 'text-[8px]' : 'text-[10px]'} xs:text-xs leading-6 transition-colors duration-300 ${
              predictionType === 'away' ? 'text-[#f7e479]' : 'text-secondary hover:text-[#f7e479]'
            }`}
            onClick={() => handlePredictionChange('away')}
          >
            Away
          </button>
          <button
            className={`${(isSmallScreen || isTinyScreen || isVeryTinyScreen) ? 'w-1/4 pl-0.5' : 'w-1/4'} ${isVeryTinyScreen ? 'text-[7px] px-0.5 py-1' : isTinyScreen ? 'text-[8px]' : 'text-[10px]'} xs:text-xs leading-6 transition-colors duration-300 ${
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