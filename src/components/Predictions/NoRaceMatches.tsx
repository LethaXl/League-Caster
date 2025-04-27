import React from 'react';

interface NoRaceMatchesProps {
  onNextMatchday: () => void;
}

export default function NoRaceMatches({ onNextMatchday }: NoRaceMatchesProps) {
  return (
    <div className="bg-[#111111] rounded-lg p-8 border border-[#2a2a2a] text-center">
      <h3 className="text-xl font-bold text-primary mb-4">No Matches for Selected Teams</h3>
      <p className="text-secondary mb-6">
        None of your selected teams have matches scheduled for this matchday.
      </p>
      <button
        onClick={onNextMatchday}
        className="px-8 py-2 bg-transparent text-[#f7e479] border-2 border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold"
      >
        Skip to Next Matchday
      </button>
    </div>
  );
} 