import { Standing } from '@/services/football-api';
import Image from 'next/image';

interface StandingsTableProps {
  standings: Standing[];
  initialStandings?: Standing[];
  loading: boolean;
  leagueCode?: string;
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

export default function StandingsTable({ standings, initialStandings, loading, leagueCode }: StandingsTableProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="h-12 bg-card-border rounded"></div>
        ))}
      </div>
    );
  }
  
  // Sort the standings by position to ensure correct display order
  const sortedStandings = [...standings].sort((a, b) => a.position - b.position);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-card-border">
        <thead className="bg-card-border">
          <tr>
            <th className="px-6 py-3 text-xs font-medium text-secondary uppercase tracking-wider w-24">
              <div className="flex">
                <span className="w-8 text-center">Pos</span>
                <span className="w-10"></span>
              </div>
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Team</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">P</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">W</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">D</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">L</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">GD</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">Pts</th>
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-card-border">
          {sortedStandings.map((standing) => {
            const positionChange = getPositionChange(standing, initialStandings);
            const euroCompetition = getEuropeanCompetition(standing.position, leagueCode);
            
            return (
              <tr key={standing.team.id} className="hover:bg-card-border">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-primary w-24">
                  <div className="flex">
                    <span className="w-8 text-center">{standing.position}</span>
                    <span className="w-10 flex items-center">
                      {euroCompetition && <CompetitionLogo logo={euroCompetition} />}
                      <PositionChangeIndicator change={positionChange} />
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8 relative">
                      <Image
                        src={standing.team.crest || "/placeholder-team.png"}
                        alt={standing.team.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-primary">{standing.team.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-center">{standing.playedGames}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-center">{standing.won}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-center">{standing.draw}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-center">{standing.lost}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-center">
                  {standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary text-center">{standing.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
} 