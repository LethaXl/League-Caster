import { League } from '@/types/standings';

interface LeagueSelectorProps {
  onLeagueSelect: (leagueCode: string) => void;
}

const leagues: League[] = [
  { code: 'PL', name: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'BL1', name: 'Bundesliga', country: 'Germany', flag: '🇩🇪' },
  { code: 'FL1', name: 'Ligue 1', country: 'France', flag: '🇫🇷' },
  { code: 'SA', name: 'Serie A', country: 'Italy', flag: '🇮🇹' },
  { code: 'PD', name: 'La Liga', country: 'Spain', flag: '🇪🇸' },
];

export default function LeagueSelector({ onLeagueSelect }: LeagueSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {leagues.map((league) => (
        <button
          key={league.code}
          onClick={() => onLeagueSelect(league.code)}
          className="flex items-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 hover:border-blue-500"
        >
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{league.flag}</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{league.name}</h3>
                <p className="text-sm text-gray-500">{league.country}</p>
              </div>
            </div>
          </div>
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      ))}
    </div>
  );
} 