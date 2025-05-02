'use client';

import { useEffect } from 'react';
import { usePrediction } from '@/contexts/PredictionContext';

export default function InitialStateCleaner() {
  const { 
    setIsRaceMode, 
    setSelectedTeamIds, 
    setUnfilteredMatchesMode, 
    setTableDisplayMode 
  } = usePrediction();

  useEffect(() => {
    console.log('InitialStateCleaner - Clearing race mode settings on app initialization');
    
    // Reset race mode settings on app initialization
    setIsRaceMode(false);
    setSelectedTeamIds([]);
    setUnfilteredMatchesMode('auto');
    setTableDisplayMode('mini');
    
    // Clear any stored prediction state
    localStorage.removeItem('predictionState');
    
    // Clear cache for all leagues
    ['PL', 'BL1', 'FL1', 'SA', 'PD'].forEach(league => {
      localStorage.removeItem(`${league}_initialFetchDone`);
    });
    
    // This is a one-time effect on app initialization
  }, [setIsRaceMode, setSelectedTeamIds, setUnfilteredMatchesMode, setTableDisplayMode]);

  // This component doesn't render anything
  return null;
} 