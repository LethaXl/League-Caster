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
}

const PredictionContext = createContext<PredictionContextType | undefined>(undefined);

export function PredictionProvider({ children }: { children: React.ReactNode }) {
  const [currentMatchday, setCurrentMatchday] = useState(1);
  const [predictedStandings, setPredictedStandings] = useState<Standing[]>([]);
  const [isViewingStandings, setIsViewingStandings] = useState(false);
  const [isRaceMode, setIsRaceMode] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('predictionState');
    if (savedState) {
      const { matchday, standings, isRace, teamIds } = JSON.parse(savedState);
      setCurrentMatchday(matchday);
      setPredictedStandings(standings);
      if (isRace !== undefined) setIsRaceMode(isRace);
      if (teamIds !== undefined) setSelectedTeamIds(teamIds);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (predictedStandings.length > 0) {
      localStorage.setItem('predictionState', JSON.stringify({
        matchday: currentMatchday,
        standings: predictedStandings,
        isRace: isRaceMode,
        teamIds: selectedTeamIds,
      }));
    }
  }, [currentMatchday, predictedStandings, isRaceMode, selectedTeamIds]);

  const resetPredictions = () => {
    setCurrentMatchday(1);
    setPredictedStandings([]);
    setIsViewingStandings(false);
    setIsRaceMode(false);
    setSelectedTeamIds([]);
    localStorage.removeItem('predictionState');
    
    // Also clear completed matchdays for all leagues
    localStorage.removeItem('completedMatchdays');
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