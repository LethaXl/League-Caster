import { Standing } from '@/services/football-api';
import Image from 'next/image';
import { usePrediction } from '@/contexts/PredictionContext';

interface StandingsTableProps {
  standings: Standing[];
  initialStandings?: Standing[];
  loading: boolean;
  leagueCode?: string;
  selectedTeamIds?: number[];
}

// Helper function to get position change
function getPositionChange(team: Standing, initialStandings?: Standing[]) {
  if (!initialStandings) return null;
  
  const initialPosition = initialStandings.find(s => s.team.name === team.team.name)?.position;
  if (!initialPosition) return null;
  
  return initialPosition - team.position;
}

// Helper function to determine European competition qualification
function getEuropeanCompetition(position: number, leagueCode?: string) {
  if (!leagueCode) return null;
  
  // Check league code and position to return the appropriate logo
  switch(leagueCode) {
    case 'PL': // Premier League (England)
      if (position <= 5) return 'ucl_logo.png';
      if (position === 6) return 'uel_logo.png';
      if (position === 7) return 'uecl_logo.png';
      return null;
    case 'PD': // La Liga (Spain)
      if (position <= 5) return 'ucl_logo.png';
      if (position >= 6 && position <= 7) return 'uel_logo.png';
      if (position === 8) return 'uecl_logo.png';
      return null;
    case 'SA': // Serie A (Italy)
    case 'BL1': // Bundesliga (Germany)
    case 'FL1': // Ligue 1 (France)
      if (position <= 4) return 'ucl_logo.png';
      if (position === 5) return 'uel_logo.png';
      if (position === 6) return 'uecl_logo.png';
      return null;
    default:
      return null;
  }
}

// Helper function to determine relegation status
function getRelegationStatus(position: number, leagueCode?: string): { status: 'relegated' | 'playoff' | null; color: string } {
  if (!leagueCode) return { status: null, color: '' };
  
  switch(leagueCode) {
    case 'PL': // Premier League (England)
    case 'PD': // La Liga (Spain)
    case 'SA': // Serie A (Italy)
      if (position >= 18) return { status: 'relegated', color: 'text-red-500' };
      return { status: null, color: '' };
    case 'BL1': // Bundesliga (Germany)
    case 'FL1': // Ligue 1 (France)
      if (position === 16) return { status: 'playoff', color: 'text-yellow-500' };
      if (position >= 17) return { status: 'relegated', color: 'text-red-500' };
      return { status: null, color: '' };
    default:
      return { status: null, color: '' };
  }
}

// Helper component for position change indicator
function PositionChangeIndicator({ change }: { change: number | null }) {
  if (change === null || change === 0) return null;

  const isPositive = change > 0;
  const color = isPositive ? 'text-green-400' : 'text-red-400';
  const arrow = isPositive ? '↑' : '↓';
  
  return (
    <span className={`${color} ml-2`}>
      {arrow} {Math.abs(change)}
    </span>
  );
}

// Helper component for competition logo
function CompetitionLogo({ logo }: { logo: string | null }) {
  if (!logo) return null;
  
  return (
    <Image
      src={`/${logo}`}
      alt="European competition"
      width={18}
      height={18}
      className="object-contain"
    />
  );
}

// Helper component for relegation indicator
function RelegationIndicator({ status, color }: { status: 'relegated' | 'playoff' | null; color: string }) {
  if (!status) return null;
  
  return (
    <span className={`${color} font-bold text-sm ml-6`}>
      ℝ
    </span>
  );
}

export default function StandingsTable({ standings, initialStandings, loading, leagueCode, selectedTeamIds }: StandingsTableProps) {
  const { isRaceMode, tableDisplayMode } = usePrediction();
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="hourglassBackground">
          <div className="hourglassContainer">
            <div className="hourglassCurves"></div>
            <div className="hourglassCapTop"></div>
            <div className="hourglassGlassTop"></div>
            <div className="hourglassSand"></div>
            <div className="hourglassSandStream"></div>
            <div className="hourglassCapBottom"></div>
            <div className="hourglassGlass"></div>
          </div>
          <style jsx>{`
            .hourglassBackground {
              position: relative;
              background-color: rgb(71, 60, 60);
              height: 130px;
              width: 130px;
              border-radius: 50%;
              margin: 30px auto;
            }

            .hourglassContainer {
              position: absolute;
              top: 30px;
              left: 40px;
              width: 50px;
              height: 70px;
              -webkit-animation: hourglassRotate 2s ease-in 0s infinite;
              animation: hourglassRotate 2s ease-in 0s infinite;
              transform-style: preserve-3d;
              perspective: 1000px;
            }

            .hourglassContainer div,
            .hourglassContainer div:before,
            .hourglassContainer div:after {
              transform-style: preserve-3d;
            }

            @-webkit-keyframes hourglassRotate {
              0% {
                transform: rotateX(0deg);
              }

              50% {
                transform: rotateX(180deg);
              }

              100% {
                transform: rotateX(180deg);
              }
            }

            @keyframes hourglassRotate {
              0% {
                transform: rotateX(0deg);
              }

              50% {
                transform: rotateX(180deg);
              }

              100% {
                transform: rotateX(180deg);
              }
            }

            .hourglassCapTop {
              top: 0;
            }

            .hourglassCapTop:before {
              top: -25px;
            }

            .hourglassCapTop:after {
              top: -20px;
            }

            .hourglassCapBottom {
              bottom: 0;
            }

            .hourglassCapBottom:before {
              bottom: -25px;
            }

            .hourglassCapBottom:after {
              bottom: -20px;
            }

            .hourglassGlassTop {
              transform: rotateX(90deg);
              position: absolute;
              top: -16px;
              left: 3px;
              border-radius: 50%;
              width: 44px;
              height: 44px;
              background-color: #999999;
            }

            .hourglassGlass {
              perspective: 100px;
              position: absolute;
              top: 32px;
              left: 20px;
              width: 10px;
              height: 6px;
              background-color: #999999;
              opacity: 0.5;
            }

            .hourglassGlass:before,
            .hourglassGlass:after {
              content: '';
              display: block;
              position: absolute;
              background-color: #999999;
              left: -17px;
              width: 44px;
              height: 28px;
            }

            .hourglassGlass:before {
              top: -27px;
              border-radius: 0 0 25px 25px;
            }

            .hourglassGlass:after {
              bottom: -27px;
              border-radius: 25px 25px 0 0;
            }

            .hourglassCurves:before,
            .hourglassCurves:after {
              content: '';
              display: block;
              position: absolute;
              top: 32px;
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background-color: #333;
              animation: hideCurves 2s ease-in 0s infinite;
            }

            .hourglassCurves:before {
              left: 15px;
            }

            .hourglassCurves:after {
              left: 29px;
            }

            @-webkit-keyframes hideCurves {
              0% {
                opacity: 1;
              }

              25% {
                opacity: 0;
              }

              30% {
                opacity: 0;
              }

              40% {
                opacity: 1;
              }

              100% {
                opacity: 1;
              }
            }

            @keyframes hideCurves {
              0% {
                opacity: 1;
              }

              25% {
                opacity: 0;
              }

              30% {
                opacity: 0;
              }

              40% {
                opacity: 1;
              }

              100% {
                opacity: 1;
              }
            }

            .hourglassSandStream:before {
              content: '';
              display: block;
              position: absolute;
              left: 24px;
              width: 3px;
              background-color: white;
              -webkit-animation: sandStream1 2s ease-in 0s infinite;
              animation: sandStream1 2s ease-in 0s infinite;
            }

            .hourglassSandStream:after {
              content: '';
              display: block;
              position: absolute;
              top: 36px;
              left: 19px;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-bottom: 6px solid #fff;
              animation: sandStream2 2s ease-in 0s infinite;
            }

            @-webkit-keyframes sandStream1 {
              0% {
                height: 0;
                top: 35px;
              }

              50% {
                height: 0;
                top: 45px;
              }

              60% {
                height: 35px;
                top: 8px;
              }

              85% {
                height: 35px;
                top: 8px;
              }

              100% {
                height: 0;
                top: 8px;
              }
            }

            @keyframes sandStream1 {
              0% {
                height: 0;
                top: 35px;
              }

              50% {
                height: 0;
                top: 45px;
              }

              60% {
                height: 35px;
                top: 8px;
              }

              85% {
                height: 35px;
                top: 8px;
              }

              100% {
                height: 0;
                top: 8px;
              }
            }

            @-webkit-keyframes sandStream2 {
              0% {
                opacity: 0;
              }

              50% {
                opacity: 0;
              }

              51% {
                opacity: 1;
              }

              90% {
                opacity: 1;
              }

              91% {
                opacity: 0;
              }

              100% {
                opacity: 0;
              }
            }

            @keyframes sandStream2 {
              0% {
                opacity: 0;
              }

              50% {
                opacity: 0;
              }

              51% {
                opacity: 1;
              }

              90% {
                opacity: 1;
              }

              91% {
                opacity: 0;
              }

              100% {
                opacity: 0;
              }
            }

            .hourglassSand:before,
            .hourglassSand:after {
              content: '';
              display: block;
              position: absolute;
              left: 6px;
              background-color: white;
              perspective: 500px;
            }

            .hourglassSand:before {
              top: 8px;
              width: 39px;
              border-radius: 3px 3px 30px 30px;
              animation: sandFillup 2s ease-in 0s infinite;
            }

            .hourglassSand:after {
              border-radius: 30px 30px 3px 3px;
              animation: sandDeplete 2s ease-in 0s infinite;
            }

            @-webkit-keyframes sandFillup {
              0% {
                opacity: 0;
                height: 0;
              }

              60% {
                opacity: 1;
                height: 0;
              }

              100% {
                opacity: 1;
                height: 17px;
              }
            }

            @keyframes sandFillup {
              0% {
                opacity: 0;
                height: 0;
              }

              60% {
                opacity: 1;
                height: 0;
              }

              100% {
                opacity: 1;
                height: 17px;
              }
            }

            @-webkit-keyframes sandDeplete {
              0% {
                opacity: 0;
                top: 45px;
                height: 17px;
                width: 38px;
                left: 6px;
              }

              1% {
                opacity: 1;
                top: 45px;
                height: 17px;
                width: 38px;
                left: 6px;
              }

              24% {
                opacity: 1;
                top: 45px;
                height: 17px;
                width: 38px;
                left: 6px;
              }

              25% {
                opacity: 1;
                top: 41px;
                height: 17px;
                width: 38px;
                left: 6px;
              }

              50% {
                opacity: 1;
                top: 41px;
                height: 17px;
                width: 38px;
                left: 6px;
              }

              90% {
                opacity: 1;
                top: 41px;
                height: 0;
                width: 10px;
                left: 20px;
              }
            }

            @keyframes sandDeplete {
              0% {
                opacity: 0;
                top: 45px;
                height: 17px;
                width: 38px;
                left: 6px;
              }

              1% {
                opacity: 1;
                top: 45px;
                height: 17px;
                width: 38px;
                left: 6px;
              }

              24% {
                opacity: 1;
                top: 45px;
                height: 17px;
                width: 38px;
                left: 6px;
              }

              25% {
                opacity: 1;
                top: 41px;
                height: 17px;
                width: 38px;
                left: 6px;
              }

              50% {
                opacity: 1;
                top: 41px;
                height: 17px;
                width: 38px;
                left: 6px;
              }

              90% {
                opacity: 1;
                top: 41px;
                height: 0;
                width: 10px;
                left: 20px;
              }
            }
          `}</style>
        </div>
      </div>
    );
  }
  
  // Filter standings if in race mode with mini table mode AND selectedTeamIds are provided
  console.log("StandingsTable - Race mode state:", isRaceMode, "TableDisplayMode:", tableDisplayMode, "SelectedTeamIds:", selectedTeamIds?.length || 0);

  let filteredStandings = [...standings];
  // Only filter if ALL conditions are met:
  // 1. Race mode is explicitly enabled
  // 2. Table display mode is set to mini
  // 3. We have selected team IDs
  // 4. There are actually teams selected
  if (isRaceMode === true && 
      tableDisplayMode === 'mini' && 
      selectedTeamIds && 
      selectedTeamIds.length > 0) {
    console.log("Filtering standings to show only selected teams");
    filteredStandings = filteredStandings.filter(standing => 
      selectedTeamIds.includes(standing.team.id)
    );
  } else {
    // Always use full standings when not in race mode or conditions aren't met
    console.log("Showing full standings table");
    filteredStandings = [...standings];
  }
  
  // Sort the standings by position to ensure correct display order
  const sortedStandings = filteredStandings.sort((a, b) => a.position - b.position);

  return (
    <div className="overflow-x-auto rounded-lg">
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="px-6 py-3 text-xs font-semibold text-secondary uppercase tracking-wider w-24 border-b border-card-border/50">
              <div className="flex">
                <span className="w-8 text-center">Pos</span>
                <span className="w-2"></span>
                <span className="w-8"></span>
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50">Team</th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50">P</th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50">W</th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50">D</th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50">L</th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50">GD</th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sortedStandings.map((standing, index) => {
            const positionChange = getPositionChange(standing, initialStandings);
            const euroCompetition = getEuropeanCompetition(standing.position, leagueCode);
            const relegationStatus = getRelegationStatus(standing.position, leagueCode);
            
            // Highlight selected teams in race mode with full table display
            const isSelectedTeam = selectedTeamIds?.includes(standing.team.id);
            const highlightRow = isRaceMode && tableDisplayMode === 'full' && isSelectedTeam;
            
            return (
              <tr 
                key={standing.team.id} 
                className={`${highlightRow ? 'bg-[#f7e479]/10' : index % 2 === 1 ? 'bg-transparent' : 'bg-[#2A2A2A]'} hover:bg-black/5 transition-colors duration-75`}
              >
                <td className="px-6 py-2 whitespace-nowrap text-sm text-primary w-24">
                  <div className="flex">
                    <span className="w-8 text-center">{standing.position}</span>
                    <span className="w-2 flex items-center justify-center">
                      {relegationStatus.status && <RelegationIndicator status={relegationStatus.status} color={relegationStatus.color} />}
                    </span>
                    <span className="w-8 flex items-center">
                      {euroCompetition && <CompetitionLogo logo={euroCompetition} />}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-2 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-6 w-6 relative">
                      <Image
                        src={standing.team.crest || "/placeholder-team.png"}
                        alt={standing.team.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <div className="ml-4 flex items-center">
                      <div className="text-sm font-medium text-primary">{standing.team.name}</div>
                      <PositionChangeIndicator change={positionChange} />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-2 whitespace-nowrap text-sm text-primary text-center">{standing.playedGames}</td>
                <td className="px-6 py-2 whitespace-nowrap text-sm text-primary text-center">{standing.won}</td>
                <td className="px-6 py-2 whitespace-nowrap text-sm text-primary text-center">{standing.draw}</td>
                <td className="px-6 py-2 whitespace-nowrap text-sm text-primary text-center">{standing.lost}</td>
                <td className="px-6 py-2 whitespace-nowrap text-sm text-primary text-center">
                  {standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference}
                </td>
                <td className="px-6 py-2 whitespace-nowrap text-sm font-bold text-primary text-center">{standing.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
} 