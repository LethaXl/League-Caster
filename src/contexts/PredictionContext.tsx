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
      const state = {
        matchday: currentMatchday,
        standings: predictedStandings,
        isRace: isRaceMode,
        teamIds: selectedTeamIds,
        unfilteredMode: unfilteredMatchesMode,
        tableMode: tableDisplayMode,
      };
      
      localStorage.setItem('predictionState', JSON.stringify(state));
      console.log('Saved prediction state to localStorage', state);
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