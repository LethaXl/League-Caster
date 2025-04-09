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
}

const PredictionContext = createContext<PredictionContextType | undefined>(undefined);

export function PredictionProvider({ children }: { children: React.ReactNode }) {
  const [currentMatchday, setCurrentMatchday] = useState(1);
  const [predictedStandings, setPredictedStandings] = useState<Standing[]>([]);
  const [isViewingStandings, setIsViewingStandings] = useState(false);

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('predictionState');
    if (savedState) {
      const { matchday, standings } = JSON.parse(savedState);
      setCurrentMatchday(matchday);
      setPredictedStandings(standings);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (predictedStandings.length > 0) {
      localStorage.setItem('predictionState', JSON.stringify({
        matchday: currentMatchday,
        standings: predictedStandings,
      }));
    }
  }, [currentMatchday, predictedStandings]);

  const resetPredictions = () => {
    setCurrentMatchday(1);
    setPredictedStandings([]);
    setIsViewingStandings(false);
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