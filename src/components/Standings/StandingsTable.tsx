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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pos</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">W</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">L</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GF</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GA</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pts</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {standings.map((standing) => (
            <tr key={standing.team.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{standing.position}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-8 w-8 relative">
                    <Image
                      src={standing.team.crest}
                      alt={standing.team.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{standing.team.name}</div>
                    <div className="text-sm text-gray-500">{standing.team.tla}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{standing.playedGames}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{standing.won}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{standing.draw}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{standing.lost}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{standing.goalsFor}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{standing.goalsAgainst}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{standing.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 