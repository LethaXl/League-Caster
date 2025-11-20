import { Standing } from '@/services/football-api';
import Image from 'next/image';
import { usePrediction } from '@/contexts/PredictionContext';
import { useState, useEffect } from 'react';

interface StandingsTableProps {
  standings: Standing[];
  initialStandings?: Standing[];
  loading: boolean;
  leagueCode?: string;
  selectedTeamIds?: number[];
  compareToCurrent?: boolean; // When true, compares historical standings to current (reverses the calculation)
  isForecastMode?: boolean; // When true, we're in forecast mode
  isComparingToPast?: boolean; // When true, comparing to a past matchday (looking back)
  teamForms?: Map<number, ('W' | 'D' | 'L')[]>; // Pre-fetched team forms
  formsLoading?: boolean; // Whether forms are still loading
}

// Helper function to get position change
function getPositionChange(
  team: Standing, 
  initialStandings?: Standing[], 
  compareToCurrent?: boolean,
  isForecastMode?: boolean,
  isComparingToPast?: boolean
) {
  if (!initialStandings) return null;
  
  const initialPosition = initialStandings.find(s => s.team.name === team.team.name)?.position;
  if (!initialPosition) return null;
  

  
  if (isForecastMode && !isComparingToPast) {
    // Scenario 1: Comparing forecast to current (predicted vs actual)
    // Formula: currentPos - forecastPos (actual - predicted)
    // Example: predicted 1, actual 7 → 7 - 1 = 6 (positive = green ↑ = need to move up 6)
    return initialPosition - team.position; // actual - predicted
  } else if (isForecastMode && isComparingToPast) {
    // Scenario 2: Comparing predicted at past matchday to predicted at current matchday
    // Formula: pastPos - currentPos
    // Example: past predicted 1, current predicted 8 → 1 - 8 = -7 (negative = red ↓ = has fallen)
    return team.position - initialPosition; // past predicted - current predicted
  } else if (compareToCurrent) {
    // Scenario 3: Regular mode, comparing historical to current
    // Formula: pastPos - currentPos
    // Example: past 1, current 8 → 1 - 8 = -7 (negative = red ↓ = has fallen)
    return team.position - initialPosition; // past - current
  }
  
  // Default: initial - current
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
    case 'CL': // Champions League - no logos shown
      return null;
    default:
      return null;
  }
}

// Helper function to determine UCL status
function getUCLStatus(position: number, leagueCode?: string): { status: 'qualified' | 'playoff' | null } {
  if (leagueCode === 'CL') {
    if (position <= 8) return { status: 'qualified' };
    if (position >= 9 && position <= 24) return { status: 'playoff' };
  }
  return { status: null };
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
function PositionChangeIndicator({ change, size = 'default' }: { change: number | null, size?: 'default' | 'small' }) {
  if (change === null || change === 0) return null;

  const isPositive = change > 0;
  const color = isPositive ? 'text-green-400' : 'text-red-400';
  const arrow = isPositive ? '↑' : '↓';
  const fontSize = size === 'small' ? 'text-[9px]' : 'text-sm';
  const marginLeft = size === 'small' ? 'ml-0.5' : 'ml-2';

  return (
    <span className={`${color} ${fontSize} ${marginLeft} font-bold`} style={{ lineHeight: 1 }}>
      {arrow} {Math.abs(change)}
    </span>
  );
}

// Helper component for competition logo
function CompetitionLogo({ logo, size }: { logo: string | null, size: number }) {
  if (!logo) return null;
  return (
    <Image
      src={`/${logo}`}
      alt="European competition"
      width={size}
      height={size}
      className="object-contain"
      style={{ minWidth: size, minHeight: size }}
    />
  );
}

// Helper component for relegation indicator
function RelegationIndicator({ status, color, size }: { status: 'relegated' | 'playoff' | null; color: string, size: number }) {
  if (!status) return null;
  return (
    <span
      className={`${color} font-bold text-sm ml-1 flex items-center justify-center`}
      style={{ width: size, height: size, minWidth: size, minHeight: size, display: 'inline-flex', fontSize: size - 2 }}
    >
      ℝ
    </span>
  );
}

export default function StandingsTable({ standings, initialStandings, loading, leagueCode, selectedTeamIds, compareToCurrent, isForecastMode, isComparingToPast, teamForms: propTeamForms, formsLoading = false }: StandingsTableProps) {
  const { isRaceMode, tableDisplayMode, currentMatchday } = usePrediction();
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileM, setIsMobileM] = useState(false);
  const [visibleStandings, setVisibleStandings] = useState<Standing[]>(standings);
  const [formsReady, setFormsReady] = useState(false);
  
  // Use forms from prop if provided, otherwise use empty map
  const displayForms = propTeamForms || new Map<number, ('W' | 'D' | 'L')[]>();
  
  // Track when forms become available to trigger fade-in - no delay
  useEffect(() => {
    if (!formsLoading && displayForms.size > 0) {
      // Immediately trigger fade-in when forms are ready
      setFormsReady(true);
    } else if (formsLoading) {
      setFormsReady(false);
    }
  }, [displayForms, formsLoading]);
  
  // Update visible standings immediately without animation to prevent flicker
  // This single useEffect handles all cases and updates synchronously
  useEffect(() => {
    if (isRaceMode && tableDisplayMode === 'mini' && selectedTeamIds && selectedTeamIds.length > 0) {
      // Filter to show only selected teams
      const filtered = standings.filter(standing => 
        selectedTeamIds.includes(standing.team.id)
      );
      setVisibleStandings(filtered);
    } else {
      // Show all teams for full table or non-race mode
      setVisibleStandings(standings);
    }
  }, [standings, isRaceMode, tableDisplayMode, selectedTeamIds]);
  
  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsMobileM(window.innerWidth < 376);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Set badge size based on screen size
  const badgeSize = isMobile ? 9 : 15;
  
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
  
  // Filter and sort standings
  
  // Sort the standings by position to ensure correct display order
  let sortedStandings: Standing[];
  if (
    visibleStandings.length > 0 &&
    visibleStandings.every(s => s.position === 1)
  ) {
    // All teams are at position 1, so sort alphabetically by team name and assign positions 1-N
    sortedStandings = [...visibleStandings]
      .sort((a, b) => a.team.name.localeCompare(b.team.name))
      .map((standing, idx) => ({ ...standing, position: idx + 1 }));
  } else {
    // Normal sorting by position
    sortedStandings = [...visibleStandings].sort((a, b) => a.position - b.position);
  }

  // Set column widths based on screen size
  const getColumnClass = (index: number) => {
    if (isMobile) {
      // Specific widths for mobile
      switch(index) {
        case 0: return "w-10"; // Position
        case 1: return "w-32 sm:w-40 min-w-[120px] sm:min-w-[160px]"; // Team (flexible)
        case 2: return "w-8"; // P
        case 3: return "w-8"; // W
        case 4: return "w-8"; // D
        case 5: return "w-8"; // L
        case 6: return "w-10"; // GD
        case 7: return "w-10"; // Pts
        case 8: return "w-16"; // Form
        default: return "";
      }
    }
    return ""; // Default (auto)
  };

  // Dynamic styles for highlighting and transitions
  const getRowStyle = (standing: Standing, index: number) => {
    const isSelectedTeam = selectedTeamIds?.includes(standing.team.id);
    const highlightRow = isRaceMode && tableDisplayMode === 'full' && isSelectedTeam;
    
    // UCL-specific border indicators with alternating row colors
    let uclBorderClass = '';
    let uclBackgroundClass = '';
    if (leagueCode === 'CL') {
      // Add alternating row colors
      uclBackgroundClass = index % 2 === 1 ? 'bg-transparent' : 'bg-[#2A2A2A]';
      
      // Add border indicators
      if (standing.position <= 8) {
        uclBorderClass = 'border-l-4 border-green-500'; // Green border for positions 1-8 (Champions League)
      } else if (standing.position >= 9 && standing.position <= 24) {
        uclBorderClass = 'border-l-4 border-blue-500'; // Blue border for positions 9-24 (Playoffs)
      }
    }
    
    // If UCL has specific styling, use it; otherwise use default styling
    if (leagueCode === 'CL') {
      return `${highlightRow ? `bg-[#ebcd28]/20 ${uclBorderClass}` : `${uclBackgroundClass} ${uclBorderClass}`} 
              ${highlightRow ? 'hover:bg-[#ebcd28]/30' : 'hover:bg-black/10'} transition-all duration-300 ease-in-out`;
    }
    
    return `${highlightRow ? 'bg-[#ebcd28]/20' : index % 2 === 1 ? 'bg-transparent' : 'bg-[#2A2A2A]'} 
            ${highlightRow ? 'hover:bg-[#ebcd28]/30' : 'hover:bg-black/10'} transition-all duration-300 ease-in-out`;
  };

  return (
    <div className={`rounded-lg w-full max-w-full box-border ${isMobile ? 'overflow-x-auto' : 'overflow-x-hidden'} ${isMobile ? 'px-0' : 'px-2'}`}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (min-width: 359px) {
          .form-header-text {
            white-space: nowrap;
          }
        }
      `}} />
      <div>
        <table className={`w-full max-w-full bg-transparent ${!isMobile ? 'table-fixed' : ''}`} style={{ tableLayout: !isMobile ? 'fixed' : 'auto' }}>
          <thead>
            <tr>
              <th className="w-16 text-center px-0 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50">
                <span className="block w-full text-center">POS</span>
              </th>
              <th className={`px-0.5 sm:px-6 py-2 sm:py-3 text-left w-32 sm:w-40 min-w-[120px] sm:min-w-[160px] md:w-56 md:min-w-[220px] md:pr-8 text-[10px] sm:text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50 ${getColumnClass(1)}`}>Team</th>
              <th className={`px-0.5 sm:px-6 pl-3 sm:pl-10 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50 ${getColumnClass(2)}`}>P</th>
              <th className={`px-0.5 sm:px-6 pl-1 sm:pl-2 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50 ${getColumnClass(3)}`}>W</th>
              <th className={`px-0.5 sm:px-6 pl-1 sm:pl-2 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50 ${getColumnClass(4)}`}>D</th>
              <th className={`px-0.5 sm:px-6 pl-1 sm:pl-2 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50 ${getColumnClass(5)}`}>L</th>
              <th className={`px-1 sm:px-6 pl-1 sm:pl-2 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50 ${getColumnClass(6)}`}>GD</th>
              <th className={`px-1 sm:px-6 pl-1 sm:pl-2 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50 ${getColumnClass(7)}`}>Pts</th>
              <th className={`px-1 sm:px-6 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-secondary uppercase tracking-wider border-b border-card-border/50 ${getColumnClass(8)}`}>
                <span className="form-header-text" style={{ display: 'inline-block' }}>Form →</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedStandings.map((standing, index) => {
              const positionChange = getPositionChange(standing, initialStandings, compareToCurrent, isForecastMode, isComparingToPast);
              const euroCompetition = getEuropeanCompetition(standing.position, leagueCode);
              const relegationStatus = getRelegationStatus(standing.position, leagueCode);
              const uclStatus = getUCLStatus(standing.position, leagueCode);
              const isSelectedTeam = isRaceMode && tableDisplayMode === 'full' && selectedTeamIds?.includes(standing.team.id);
              
              return (
                <tr 
                  key={standing.team.id} 
                  className={getRowStyle(standing, index)}
                >
                  <td className="w-16 px-0 py-1 sm:py-2 whitespace-nowrap text-[10px] sm:text-sm text-primary relative">
                    {/* Yellow bar on left for regular leagues in race mode */}
                    {isSelectedTeam && leagueCode !== 'CL' && (
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#ebcd28' }} />
                    )}
                    {/* Yellow bar for UCL in race mode - right of green/blue bar if in playoff/qualified position, otherwise on left */}
                    {isSelectedTeam && leagueCode === 'CL' && (
                      <div className="absolute top-0 bottom-0 w-1" style={{ 
                        left: (standing.position <= 24) ? '4px' : '0px', 
                        backgroundColor: '#ebcd28' 
                      }} />
                    )}
                    <div className={`flex flex-row items-center justify-center h-full ${isMobileM ? 'gap-0' : 'gap-0'}`}>
                      <span className="block w-6 text-center">{standing.position}</span>
                      <span className="flex flex-row items-center" style={{ minWidth: badgeSize, minHeight: badgeSize }}>
                        {relegationStatus.status && <RelegationIndicator status={relegationStatus.status} color={relegationStatus.color} size={badgeSize} />}
                        {euroCompetition && <CompetitionLogo logo={euroCompetition} size={badgeSize} />}
                        {!relegationStatus.status && !euroCompetition && <span style={{ width: badgeSize, height: badgeSize, display: 'inline-block' }} />}
                      </span>
                    </div>
                  </td>
                  <td className={`px-0.5 sm:px-6 py-1 sm:py-2 whitespace-nowrap w-32 sm:w-40 min-w-[120px] sm:min-w-[160px] md:w-56 md:min-w-[220px] md:pr-8 ${getColumnClass(1)}`}>
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-4 w-4 sm:h-6 sm:w-6 relative">
                        <Image
                          src={standing.team.crest || "/placeholder-team.png"}
                          alt={standing.team.name}
                          fill
                          className="object-contain"
                        />
                      </div>
                      <div className="ml-2 sm:ml-4 flex items-center">
                        <div className="text-[10px] sm:text-sm font-medium text-primary truncate max-w-[80px] sm:max-w-full">
                          {isMobile ? standing.team.shortName || standing.team.tla || standing.team.name.split(' ')[0] : standing.team.name}
                        </div>
                        <PositionChangeIndicator change={positionChange} size={isMobile || (typeof window !== 'undefined' && window.innerWidth < 1024) ? 'small' : 'default'} />
                      </div>
                    </div>
                  </td>
                  <td className={`px-0.5 sm:px-6 pl-3 sm:pl-10 py-1 sm:py-2 whitespace-nowrap text-[10px] sm:text-sm text-primary text-center ${getColumnClass(2)}`}>{standing.playedGames}</td>
                  <td className={`px-0.5 sm:px-6 pl-1 sm:pl-2 py-1 sm:py-2 whitespace-nowrap text-[10px] sm:text-sm text-primary text-center ${getColumnClass(3)}`}>{standing.won}</td>
                  <td className={`px-0.5 sm:px-6 pl-1 sm:pl-2 py-1 sm:py-2 whitespace-nowrap text-[10px] sm:text-sm text-primary text-center ${getColumnClass(4)}`}>{standing.draw}</td>
                  <td className={`px-0.5 sm:px-6 pl-1 sm:pl-2 py-1 sm:py-2 whitespace-nowrap text-[10px] sm:text-sm text-primary text-center ${getColumnClass(5)}`}>{standing.lost}</td>
                  <td className={`px-0.5 sm:px-6 pl-1 sm:pl-2 py-1 sm:py-2 whitespace-nowrap text-[10px] sm:text-sm text-primary text-center ${getColumnClass(6)}`}>
                    {standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference}
                  </td>
                  <td className={`px-0.5 sm:px-6 pl-1 sm:pl-2 py-1 sm:py-2 whitespace-nowrap text-[10px] sm:text-sm font-bold text-primary text-center ${getColumnClass(7)}`}>{standing.points}</td>
                  <td className={`px-0.5 sm:px-6 py-1 sm:py-2 whitespace-nowrap text-center ${getColumnClass(8)}`}>
                    <div className="flex items-center justify-center gap-0 sm:gap-0.5">
                      {(() => {
                        const form = displayForms.get(standing.team.id) || [];
                        
                        // Always build exactly 5 slots - reverse form so most recent is on the right
                        // This is the "full form" - we keep all 5 for calculations
                        const reversedForm = [...form].reverse();
                        const fullSlots = Array.from({ length: 5 }, (_, i) => reversedForm[i] ?? null);
                        
                        // VISUAL ONLY: On mobile, show up to 4 form bubbles
                        // If there are 4 or fewer results, show all of them (from the start)
                        // If there are 5 results, show the last 4 (most recent)
                        // On desktop, show all 5
                        // This is purely a display decision - the full form data remains unchanged
                        const visibleSlots = isMobile 
                          ? (() => {
                              // Count non-null results
                              const resultCount = fullSlots.filter(slot => slot !== null).length;
                              // If 4 or fewer results, show from the start (leftmost results)
                              // If 5 results, show the last 4 (most recent)
                              return resultCount <= 4 
                                ? fullSlots.filter(slot => slot !== null).slice(0, 4)
                                : fullSlots.slice(-4);
                            })()
                          : fullSlots; // All 5 on desktop
                        
                        // Unified loading condition for all bubbles
                        const isLoading = formsLoading || !formsReady;
                        
                        return visibleSlots.map((result, index) => {
                          // Same loading check for all circles
                          const isLoadingBubble = isLoading || result === null;
                          
                          // Determine color - same logic for all
                          let bgColor = 'bg-gray-600/30'; // Default placeholder color
                          if (!isLoadingBubble && result) {
                            if (result === 'W') bgColor = 'bg-green-500';
                            else if (result === 'D') bgColor = 'bg-gray-500';
                            else if (result === 'L') bgColor = 'bg-red-500';
                          }
                          
                          // Same transition and opacity for all circles
                          const opacity = isLoadingBubble ? 0.6 : 1;
                          
                          return (
                            <div
                              key={index}
                              className={`${isMobile ? '' : 'rounded-full'} ${bgColor} flex items-center justify-center text-white text-[8px] sm:text-[10px] font-bold transition-opacity duration-300 ease-in-out`}
                              style={{ 
                                width: isMobile ? '0.75rem' : '1.25rem', 
                                height: isMobile ? '0.75rem' : '1.25rem', 
                                minWidth: isMobile ? '0.75rem' : '1.25rem', 
                                minHeight: isMobile ? '0.75rem' : '1.25rem',
                                maxWidth: isMobile ? '0.75rem' : '1.25rem',
                                maxHeight: isMobile ? '0.75rem' : '1.25rem',
                                borderRadius: isMobile ? '0' : '50%', // Perfect squares on mobile, circles on desktop
                                opacity: opacity
                              }}
                            >
                              {!isLoadingBubble && result ? result : ''}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
} 