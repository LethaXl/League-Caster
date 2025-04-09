import { Standing } from '@/services/football-api';
import Image from 'next/image';

interface StandingsTableProps {
  standings: Standing[];
  loading: boolean;
}

export default function StandingsTable({ standings, loading }: StandingsTableProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }
  
  // Sort the standings by position to ensure correct display order
  const sortedStandings = [...standings].sort((a, b) => a.position - b.position);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pos</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">P</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">W</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">L</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GD</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pts</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedStandings.map((standing) => (
            <tr key={standing.team.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{standing.position}</td>
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
                    <div className="text-sm font-medium text-gray-900">{standing.team.name}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{standing.playedGames}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{standing.won}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{standing.draw}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">{standing.lost}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                {standing.goalDifference > 0 ? `+${standing.goalDifference}` : standing.goalDifference}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-center">{standing.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 