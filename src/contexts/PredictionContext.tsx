'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Standing } from '@/services/football-api';

interface PredictionContextType {
  currentMatchday: number;
  setCurrentMatchday: (matchday: number) => void;
  predictedStandings: Standing[];
  setPredictedStandings: (standings: Standing[]) => void;
  isViewingStandings: boolean;
  setIsViewingStandings: (viewing: boolean) => void;
  resetPredictions: () => void;
  isRaceMode: boolean;
  setIsRaceMode: (isRace: boolean) => void;
  selectedTeamIds: number[];
  setSelectedTeamIds: (teamIds: number[]) => void;
  unfilteredMatchesMode: 'auto' | 'draws';
  setUnfilteredMatchesMode: (mode: 'auto' | 'draws') => void;
  tableDisplayMode: 'mini' | 'full';
  setTableDisplayMode: (mode: 'mini' | 'full') => void;
}

const PredictionContext = createContext<PredictionContextType | undefined>(undefined);

export function PredictionProvider({ children }: { children: React.ReactNode }) {
  const [currentMatchday, setCurrentMatchday] = useState(1);
  const [predictedStandings, setPredictedStandings] = useState<Standing[]>([]);
  const [isViewingStandings, setIsViewingStandings] = useState(false);
  const [isRaceMode, setIsRaceMode] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [unfilteredMatchesMode, setUnfilteredMatchesMode] = useState<'auto' | 'draws'>('auto');
  const [tableDisplayMode, setTableDisplayMode] = useState<'mini' | 'full'>('mini');

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('predictionState');
    if (savedState) {
      try {
        const { 
          matchday, 
          standings, 
          isRace, 
          teamIds, 
          unfilteredMode, 
          tableMode 
        } = JSON.parse(savedState);
        
        if (matchday !== undefined) setCurrentMatchday(matchday);
        if (standings !== undefined) setPredictedStandings(standings);
        if (isRace !== undefined) setIsRaceMode(isRace);
        if (teamIds !== undefined) setSelectedTeamIds(teamIds);
        if (unfilteredMode !== undefined) setUnfilteredMatchesMode(unfilteredMode);
        if (tableMode !== undefined) setTableDisplayMode(tableMode);
      } catch (e) {
        console.error('Error parsing prediction state:', e);
        localStorage.removeItem('predictionState');
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    // Only save when we have actual prediction data
    if (predictedStandings.length > 0) {
      // For race mode, we want to fully persist the state
      if (isRaceMode) {
        const state = {
          matchday: currentMatchday,
          standings: predictedStandings,
          isRace: isRaceMode,
          teamIds: selectedTeamIds,
          unfilteredMode: unfilteredMatchesMode,
          tableMode: tableDisplayMode,
        };
        
        localStorage.setItem('predictionState', JSON.stringify(state));
        console.log('Saved complete prediction state to localStorage (race mode)');
      } else {
        // For classic mode, only save standings and matchday, not race settings
        const state = {
          matchday: currentMatchday,
          standings: predictedStandings,
          isRace: false,
          teamIds: [],
          unfilteredMode: 'auto', 
          tableMode: 'mini'
        };
        
        localStorage.setItem('predictionState', JSON.stringify(state));
        console.log('Saved minimal prediction state to localStorage (classic mode)');
      }
    }
  }, [currentMatchday, predictedStandings, isRaceMode, selectedTeamIds, unfilteredMatchesMode, tableDisplayMode]);

  const resetPredictions = () => {
    setCurrentMatchday(1);
    setPredictedStandings([]);
    setIsViewingStandings(false);
    setIsRaceMode(false);
    setSelectedTeamIds([]);
    setUnfilteredMatchesMode('auto');
    setTableDisplayMode('mini');
    localStorage.removeItem('predictionState');
    
    // Also clear completed matchdays for all leagues
    localStorage.removeItem('completedMatchdays');
    localStorage.removeItem('completedMatches');
    
    // Clear matchday cache for all leagues to ensure fresh data load
    ['PL', 'BL1', 'FL1', 'SA', 'PD', 'CL'].forEach(league => {
      localStorage.removeItem(`${league}_initialFetchDone`);
      localStorage.removeItem(`matchdayCache_${league}`);
      localStorage.removeItem(`cacheLastRefreshed_${league}`);
      localStorage.removeItem(`teamNameMappingCleared_${league}`);
      console.log(`Cleared cache for ${league} during reset`);
    });
    
    console.log("All prediction data and cache cleared");
  };

  return (
    <PredictionContext.Provider
      value={{
        currentMatchday,
        setCurrentMatchday,
        predictedStandings,
        setPredictedStandings,
        isViewingStandings,
        setIsViewingStandings,
        resetPredictions,
        isRaceMode,
        setIsRaceMode,
        selectedTeamIds,
        setSelectedTeamIds,
        unfilteredMatchesMode,
        setUnfilteredMatchesMode,
        tableDisplayMode,
        setTableDisplayMode,
      }}
    >
      {children}
    </PredictionContext.Provider>
  );
}

export function usePrediction() {
  const context = useContext(PredictionContext);
  if (context === undefined) {
    throw new Error('usePrediction must be used within a PredictionProvider');
  }
  return context;
} 