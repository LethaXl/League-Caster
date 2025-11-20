import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Match, Prediction } from '@/types/predictions';
import { Standing } from '@/services/football-api';
import StandingsTable from '../Standings/StandingsTable';
import { usePrediction } from '@/contexts/PredictionContext';

interface PredictionSummaryProps {
  predictions: Map<number, Prediction>;
  matches: Match[];
  selectedTeamIds: number[];
  standings: Standing[];
  standingsByMatchday?: Record<number, Standing[]>;
  onClose: () => void;
}

export default function PredictionSummary({ 
  predictions, 
  matches, 
  selectedTeamIds,
  standings,
  standingsByMatchday,
  onClose 
}: PredictionSummaryProps) {
  const { isRaceMode, tableDisplayMode, setTableDisplayMode } = usePrediction();
  const [viewMode, setViewMode] = useState<'table' | 'summary'>('summary');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showRightShadow, setShowRightShadow] = useState(false);
  
  // Animation states
  const [isEntering, setIsEntering] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  
  // Type for matchday values
  type MdValue = 'all' | number;
  
  // Applied filter states (these are what actually filter the table)
  const [appliedMatchdayMin, setAppliedMatchdayMin] = useState<MdValue>('all');
  const [appliedMatchdayMax, setAppliedMatchdayMax] = useState<MdValue>('all');
  const [appliedTeamIds, setAppliedTeamIds] = useState<number[]>(selectedTeamIds);
  
  // Temporary filter states (for the edit panel - these are what the user is editing)
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [tempMatchdayMin, setTempMatchdayMin] = useState<MdValue>('all');
  const [tempMatchdayMax, setTempMatchdayMax] = useState<MdValue>('all');
  const [tempTeamIds, setTempTeamIds] = useState<number[]>(selectedTeamIds);
  const [teamSelectionError, setTeamSelectionError] = useState(false);
  const [matchdayRangeError, setMatchdayRangeError] = useState(false);
  
  // Display options for standings
  const [appliedShowPosition, setAppliedShowPosition] = useState(true);
  const [appliedShowPoints, setAppliedShowPoints] = useState(true);
  const [tempShowPosition, setTempShowPosition] = useState(true);
  const [tempShowPoints, setTempShowPoints] = useState(true);
  const [displayOptionsError, setDisplayOptionsError] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'from' | 'to' | null>(null);
  const fromDropdownRef = useRef<HTMLDivElement>(null);
  const toDropdownRef = useRef<HTMLDivElement>(null);
  const fromButtonRef = useRef<HTMLButtonElement>(null);
  const toButtonRef = useRef<HTMLButtonElement>(null);
  
  // Sync appliedTeamIds when selectedTeamIds changes
  useEffect(() => {
    setAppliedTeamIds(selectedTeamIds);
    setTempTeamIds(selectedTeamIds);
  }, [selectedTeamIds]);
  
  // When panel opens, initialize temp state with current applied filters
  useEffect(() => {
    if (showEditPanel) {
      setTempMatchdayMin(appliedMatchdayMin);
      setTempMatchdayMax(appliedMatchdayMax);
      setTempTeamIds(appliedTeamIds);
      setTempShowPosition(appliedShowPosition);
      setTempShowPoints(appliedShowPoints);
      setTeamSelectionError(false);
      setMatchdayRangeError(false);
      setDisplayOptionsError(false);
      setOpenDropdown(null);
    }
  }, [showEditPanel, appliedMatchdayMin, appliedMatchdayMax, appliedTeamIds, appliedShowPosition, appliedShowPoints]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown === 'from' && fromDropdownRef.current && fromButtonRef.current && 
          !fromDropdownRef.current.contains(event.target as Node) && 
          !fromButtonRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
      if (openDropdown === 'to' && toDropdownRef.current && toButtonRef.current && 
          !toDropdownRef.current.contains(event.target as Node) && 
          !toButtonRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdown]);
  
  // Add state for screen width tracking
  const [screenWidth, setScreenWidth] = useState(0);
  
  // Add state to track expanded cell
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  
  // Track screen width for responsive layouts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };
    
    // Set initial value
    setScreenWidth(window.innerWidth);
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  // Handle enter animation
  useEffect(() => {
    // Trigger enter animation on mount
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsEntering(false);
      });
    });
  }, []);

  // Disable background scrolling when full screen is open
  useEffect(() => {
    // Save the current overflow value
    const originalOverflow = document.body.style.overflow;
    
    // Disable scrolling on the body
    document.body.style.overflow = 'hidden';
    
    // Re-enable scrolling when component unmounts
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Handle close with animation
  const handleClose = () => {
    setIsExiting(true);
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };
  
  const isCompactFilterLayout = screenWidth > 0 && screenWidth < 450;
  
  // Determine if we're in different constraint views
  const isMobileSConstrainedView = screenWidth >= 320 && screenWidth < 360;
  const isMobileMConstrainedView = screenWidth >= 360 && screenWidth < 390;
  const isMobileLConstrainedView = screenWidth >= 390 && screenWidth < 414;
  const isMobileXLConstrainedView = screenWidth >= 414 && screenWidth < 640;
  const isTabletSmallConstrainedView = screenWidth >= 640 && screenWidth < 768;
  const isMediumConstrainedView = screenWidth >= 768 && screenWidth <= 1024;
  const isSpecificConstrainedView = screenWidth >= 1024 && screenWidth <= 1080;
  const isConstrainedView = screenWidth <= 1080;
  
  // Add debugging to see what data we're getting
  const [matchdayData, setMatchdayData] = useState<{
    matchCount: number;
    matchdays: number[];
    predictionsCount: number;
  }>({
    matchCount: matches.length,
    matchdays: [...new Set(matches.map(m => m.matchday))],
    predictionsCount: predictions.size
  });
  
  useEffect(() => {
    // Debug log to console
    console.log("Matches:", matches);
    console.log("Matchdays available:", [...new Set(matches.map(m => m.matchday))]);
    console.log("Predictions:", Array.from(predictions.entries()));
    
    // Update state for debugging info
    setMatchdayData({
      matchCount: matches.length,
      matchdays: [...new Set(matches.map(m => m.matchday))],
      predictionsCount: predictions.size
    });
  }, [matches, predictions]);
  
  type TeamNameLike = {
    name?: string | null;
    shortName?: string | null;
  };
  
  // Get team details from standings
  const getTeamDetails = (teamId: number) => {
    return standings.find(s => s.team.id === teamId)?.team;
  };

  // Get league logo based on matches
  const getLeagueLogo = () => {
    if (matches.length === 0) return '/premierleague.png'; // default
    // Try to infer league from first match's competition if available
    // For now, use a default - can be enhanced later with leagueCode prop
    return '/premierleague.png';
  };

  const getFriendlyTeamName = (name: string | null | undefined): string => {
    if (!name) return 'Unknown Team';
    if (name === 'Wolverhampton Wanderers FC') return 'Wolves';
    if (name === 'RCD Espanyol de Barcelona') return 'RCD Espanyol';
    if (name === 'Club Atlético de Madrid') return 'Atletico Madrid';
    if (name === 'Brighton & Hove Albion FC') return 'Brighton & Hove Albion';
    if (name === 'Real Sociedad de Fútbol') return 'Real Sociedad';
    return name;
  };

  const getResponsiveTeamName = (team: TeamNameLike | undefined, showFullName = false) => {
    const baseName = team?.shortName || getFriendlyTeamName(team?.name) || 'Unknown Team';
    
    // If showFullName is true (e.g., when 3 teams selected), return full name
    if (showFullName) {
      return baseName;
    }
    
    if (!screenWidth || screenWidth >= 450) {
      return baseName;
    }

    if (screenWidth >= 320 && screenWidth < 340) {
      return baseName.length > 4 ? `${baseName.substring(0, 3)}...` : baseName;
    }
    if (screenWidth >= 340 && screenWidth < 375) {
      return baseName.length > 6 ? `${baseName.substring(0, 4)}...` : baseName;
    }
    if (screenWidth >= 375 && screenWidth < 450) {
      return baseName.length > 8 ? `${baseName.substring(0, 6)}...` : baseName;
    }

    return baseName;
  };
  
  const getOrdinalSuffix = (value: number | string) => {
    const num = Number(value);
    if (Number.isNaN(num)) return '';
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };
  
  // Helper function to get result text
  const getResultText = (match: Match, prediction: Prediction | undefined, teamId: number) => {
    if (!prediction) return 'Not predicted';
    
    const isHomeTeam = match.homeTeam.id === teamId;
    
    switch (prediction.type) {
      case 'home':
        return isHomeTeam ? 'Win' : 'Loss';
      case 'away':
        return isHomeTeam ? 'Loss' : 'Win';
      case 'draw':
        return 'Draw';
      case 'custom':
        if (prediction.homeGoals !== undefined && prediction.awayGoals !== undefined) {
          if (prediction.homeGoals > prediction.awayGoals) {
            return isHomeTeam ? 'Win' : 'Loss';
          } else if (prediction.homeGoals < prediction.awayGoals) {
            return isHomeTeam ? 'Loss' : 'Win';
          } else {
            return 'Draw';
          }
        }
        return 'Draw';
      default:
        return 'Not predicted';
    }
  };
  
  // Get result color class based on prediction
  const getResultColorClass = (match: Match, prediction: Prediction | undefined, teamId: number) => {
    if (!prediction) return 'text-gray-400';
    
    const isHomeTeam = match.homeTeam.id === teamId;
    
    switch (prediction.type) {
      case 'home':
        return isHomeTeam ? 'text-green-400' : 'text-red-400';
      case 'away':
        return isHomeTeam ? 'text-red-400' : 'text-green-400';
      case 'draw':
        return 'text-gray-300';
      case 'custom':
        if (prediction.homeGoals !== undefined && prediction.awayGoals !== undefined) {
          if (prediction.homeGoals > prediction.awayGoals) {
            return isHomeTeam ? 'text-green-400' : 'text-red-400';
          } else if (prediction.homeGoals < prediction.awayGoals) {
            return isHomeTeam ? 'text-red-400' : 'text-green-400';
          } else {
            return 'text-gray-300';
          }
        }
        return 'text-gray-300';
      default:
        return 'text-gray-400';
    }
  };
  
  // Get result background color class based on prediction - for tablet view
  const getResultBgColorClass = (match: Match, prediction: Prediction | undefined, teamId: number) => {
    if (!prediction) return 'bg-gray-800/30';
    
    const isHomeTeam = match.homeTeam.id === teamId;
    
    switch (prediction.type) {
      case 'home':
        return isHomeTeam ? 'bg-green-800/30 border-l-4 border-green-400' : 'bg-red-800/30 border-l-4 border-red-400';
      case 'away':
        return isHomeTeam ? 'bg-red-800/30 border-l-4 border-red-400' : 'bg-green-800/30 border-l-4 border-green-400';
      case 'draw':
        return 'bg-gray-600/50 border-l-4 border-gray-500';
      case 'custom':
        if (prediction.homeGoals !== undefined && prediction.awayGoals !== undefined) {
          if (prediction.homeGoals > prediction.awayGoals) {
            return isHomeTeam ? 'bg-green-800/30 border-l-4 border-green-400' : 'bg-red-800/30 border-l-4 border-red-400';
          } else if (prediction.homeGoals < prediction.awayGoals) {
            return isHomeTeam ? 'bg-red-800/30 border-l-4 border-red-400' : 'bg-green-800/30 border-l-4 border-green-400';
          } else {
            return 'bg-gray-600/50 border-l-4 border-gray-500';
          }
        }
        return 'bg-gray-600/50 border-l-4 border-gray-500';
      default:
        return 'bg-gray-800/30';
    }
  };
  
  // Show score for custom predictions
  const getScoreText = (prediction: Prediction | undefined) => {
    if (!prediction || prediction.type !== 'custom') return '';
    if (prediction.homeGoals === undefined || prediction.awayGoals === undefined) return '';
    
    return `${prediction.homeGoals}-${prediction.awayGoals}`;
  };
  
  // Get all matchdays from the matches
  const allAvailableMatchdays = [...new Set(matches.map(match => match.matchday || 0))].sort((a, b) => a - b);
  
  // Get min and max available matchdays
  const minMatchday = allAvailableMatchdays.length > 0 ? Math.min(...allAvailableMatchdays) : 1;
  const maxMatchday = allAvailableMatchdays.length > 0 ? Math.max(...allAvailableMatchdays) : 38;
  
  // Get effective numeric range from MdValue
  const getEffectiveFrom = (md: MdValue) => md === 'all' ? minMatchday : md;
  const getEffectiveTo = (md: MdValue) => md === 'all' ? maxMatchday : md;
  
  // Get the matchday whose table we want to show in Standings row - memoized
  const standingsSnapshot = useMemo(() => {
    const toMd = getEffectiveTo(appliedMatchdayMax);
    // fall back to current standings if we do not have a snapshot
    return standingsByMatchday?.[toMd] ?? standings;
  }, [appliedMatchdayMax, standingsByMatchday, standings, maxMatchday]);
  
  // Get team points from standings snapshot for the applied range - memoized
  const getTeamPoints = useCallback((teamId: number) => {
    return standingsSnapshot.find(s => s.team.id === teamId)?.points ?? 0;
  }, [standingsSnapshot]);

  const getTeamPosition = useCallback((teamId: number) => {
    return standingsSnapshot.find(s => s.team.id === teamId)?.position ?? '-';
  }, [standingsSnapshot]);
  
  // Sort teams by position in the standings snapshot for the applied range - memoized
  const allSortedTeamIds = useMemo(() => {
    return [...selectedTeamIds].sort((a, b) => {
      const posA = standingsSnapshot.find(s => s.team.id === a)?.position ?? 99;
      const posB = standingsSnapshot.find(s => s.team.id === b)?.position ?? 99;
      return posA - posB;
    });
  }, [selectedTeamIds, standingsSnapshot]);
  
  // Apply team filter (use appliedTeamIds, not tempTeamIds)
  const sortedTeamIds = allSortedTeamIds.filter(teamId => appliedTeamIds.includes(teamId));
  
  // Get effective numeric range (for validation - use temp values)
  const effectiveFrom = getEffectiveFrom(tempMatchdayMin);
  const effectiveTo = getEffectiveTo(tempMatchdayMax);
  
  // Check if filters are active (different from defaults) - use applied filters
  const hasActiveFilters = appliedTeamIds.length !== allSortedTeamIds.length || 
                           appliedMatchdayMin !== 'all' || 
                           appliedMatchdayMax !== 'all';
  
  // Validate filters (using temp values)
  const isFilterValid = () => {
    const hasTeams = tempTeamIds.length > 0;
    const hasValidRange = effectiveFrom <= effectiveTo;
    const hasDisplayOption = tempShowPosition || tempShowPoints;
    return hasTeams && hasValidRange && hasDisplayOption;
  };
  
  // Get available matchdays for "To" dropdown (must be >= From)
  const getAvailableToMatchdays = (): number[] => {
    const fromValue = getEffectiveFrom(tempMatchdayMin);
    return allAvailableMatchdays.filter(md => md >= fromValue);
  };
  
  // Get available matchdays for "From" dropdown (must be <= To)
  const getAvailableFromMatchdays = (): number[] => {
    const toValue = getEffectiveTo(tempMatchdayMax);
    return allAvailableMatchdays.filter(md => md <= toValue);
  };
  
  // Handle team selection change (using temp state)
  const handleTeamSelectionChange = (teamId: number, checked: boolean) => {
    if (checked) {
      setTempTeamIds([...tempTeamIds, teamId]);
      setTeamSelectionError(false);
    } else {
      const newTeamIds = tempTeamIds.filter(id => id !== teamId);
      setTempTeamIds(newTeamIds);
      // Show error if this was the last team
      if (newTeamIds.length === 0) {
        setTeamSelectionError(true);
      } else {
        setTeamSelectionError(false);
      }
    }
  };
  
  // Handle matchday change (using temp state)
  const handleMatchdayFromChange = (value: string) => {
    const newValue: MdValue = parseInt(value);
    setTempMatchdayMin(newValue);
    setMatchdayRangeError(false);
    // If new From > To, clamp To to From
    const newEffectiveFrom = getEffectiveFrom(newValue);
    const currentEffectiveTo = getEffectiveTo(tempMatchdayMax);
    if (newEffectiveFrom > currentEffectiveTo) {
      setTempMatchdayMax(newValue);
    }
  };
  
  const handleMatchdayToChange = (value: string) => {
    const newValue: MdValue = parseInt(value);
    setTempMatchdayMax(newValue);
    setMatchdayRangeError(false);
    // If new To < From, clamp From to To
    const newEffectiveTo = getEffectiveTo(newValue);
    const currentEffectiveFrom = getEffectiveFrom(tempMatchdayMin);
    if (newEffectiveTo < currentEffectiveFrom) {
      setTempMatchdayMin(newValue);
    }
  };
  
  // Handle increment/decrement for From
  const handleFromIncrement = () => {
    const currentValue = tempMatchdayMin === 'all' ? minMatchday : tempMatchdayMin;
    const availableFrom = getAvailableFromMatchdays();
    const currentIndex = availableFrom.indexOf(currentValue);
    if (currentIndex < availableFrom.length - 1) {
      handleMatchdayFromChange(availableFrom[currentIndex + 1].toString());
    }
  };
  
  const handleFromDecrement = () => {
    const currentValue = tempMatchdayMin === 'all' ? minMatchday : tempMatchdayMin;
    const availableFrom = getAvailableFromMatchdays();
    const currentIndex = availableFrom.indexOf(currentValue);
    if (currentIndex > 0) {
      handleMatchdayFromChange(availableFrom[currentIndex - 1].toString());
    }
  };
  
  // Handle increment/decrement for To
  const handleToIncrement = () => {
    const currentValue = tempMatchdayMax === 'all' ? maxMatchday : tempMatchdayMax;
    const availableTo = getAvailableToMatchdays();
    const currentIndex = availableTo.indexOf(currentValue);
    if (currentIndex < availableTo.length - 1) {
      handleMatchdayToChange(availableTo[currentIndex + 1].toString());
    }
  };
  
  const handleToDecrement = () => {
    const currentValue = tempMatchdayMax === 'all' ? maxMatchday : tempMatchdayMax;
    const availableTo = getAvailableToMatchdays();
    const currentIndex = availableTo.indexOf(currentValue);
    if (currentIndex > 0) {
      handleMatchdayToChange(availableTo[currentIndex - 1].toString());
    }
  };
  
  // Handle apply filters - apply temp values to applied values
  const handleApplyFilters = () => {
    if (!isFilterValid()) {
      // Scroll to error or shake
      if (tempTeamIds.length === 0) {
        setTeamSelectionError(true);
      }
      if (effectiveFrom > effectiveTo) {
        setMatchdayRangeError(true);
      }
      if (!tempShowPosition && !tempShowPoints) {
        setDisplayOptionsError(true);
      }
      return;
    }
    // Apply the temp filters to the actual filters
    setAppliedMatchdayMin(tempMatchdayMin);
    setAppliedMatchdayMax(tempMatchdayMax);
    setAppliedTeamIds([...tempTeamIds]);
    setAppliedShowPosition(tempShowPosition);
    setAppliedShowPoints(tempShowPoints);
    setShowEditPanel(false);
    setTeamSelectionError(false);
    setMatchdayRangeError(false);
    setDisplayOptionsError(false);
  };
  
  // Handle reset (reset temp values)
  const handleReset = () => {
    setTempTeamIds([...allSortedTeamIds]);
    setTempMatchdayMin('all');
    setTempMatchdayMax('all');
    setTempShowPosition(true);
    setTempShowPoints(true);
    setTeamSelectionError(false);
    setMatchdayRangeError(false);
  };
  
  // Handle close panel (discard changes)
  const handleClosePanel = () => {
    setShowEditPanel(false);
    // Reset temp values to current applied values (discard changes)
    setTempMatchdayMin(appliedMatchdayMin);
    setTempMatchdayMax(appliedMatchdayMax);
    setTempTeamIds([...appliedTeamIds]);
    setTempShowPosition(appliedShowPosition);
    setTempShowPoints(appliedShowPoints);
    setTeamSelectionError(false);
    setMatchdayRangeError(false);
    setDisplayOptionsError(false);
  };
  
  // Apply matchday filter (use appliedMatchdayMin/Max, not temp)
  const allMatchdays = allAvailableMatchdays.filter(matchday => {
    const effectiveFrom = getEffectiveFrom(appliedMatchdayMin);
    const effectiveTo = getEffectiveTo(appliedMatchdayMax);
    if (matchday < effectiveFrom) return false;
    if (matchday > effectiveTo) return false;
    return true;
  });
  // Don't center if there are many teams on mobile (<520px) to prevent overflow
  const isSmallMobileView = screenWidth > 0 && screenWidth < 520;
  const shouldCenterSummaryLayout = (sortedTeamIds.length <= 4 || allMatchdays.length < 7) && !(isTabletSmallConstrainedView || isMediumConstrainedView) && !(isSmallMobileView && sortedTeamIds.length > 6);
  
  // Determine if we should make the points row sticky (only if there are many matchdays)
  const shouldStickyPoints = allMatchdays.length >= 5;

  const tableScrollHeightClass = shouldStickyPoints
    ? 'max-h-[calc(100vh-115px)]'
    : 'max-h-[calc(100vh-280px)]';
  
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateShadow = () => {
      if (!container) return;
      const { scrollLeft, clientWidth, scrollWidth } = container;
      setShowRightShadow(scrollLeft + clientWidth < scrollWidth - 4);
    };

    updateShadow();
    container.addEventListener('scroll', updateShadow);
    return () => container.removeEventListener('scroll', updateShadow);
  }, [screenWidth, viewMode, shouldStickyPoints]);
  
  // Group matches by matchday and team
  const matchesByMatchdayAndTeam = new Map<number, Map<number, Match[]>>();
  
  // Initialize the structure
  allMatchdays.forEach(matchday => {
    matchesByMatchdayAndTeam.set(matchday, new Map<number, Match[]>());
    sortedTeamIds.forEach(teamId => {
      matchesByMatchdayAndTeam.get(matchday)!.set(teamId, []);
    });
  });
  
  // Populate the structure
  matches.forEach(match => {
    const matchday = match.matchday || 0;
    const homeTeamId = match.homeTeam.id;
    const awayTeamId = match.awayTeam.id;
    
    // Check if we're tracking this matchday
    if (!matchesByMatchdayAndTeam.has(matchday)) return;
    
    // Add to home team's matches if it's a selected team
    if (selectedTeamIds.includes(homeTeamId)) {
      const teamMatches = matchesByMatchdayAndTeam.get(matchday)!.get(homeTeamId) || [];
      matchesByMatchdayAndTeam.get(matchday)!.set(homeTeamId, [...teamMatches, match]);
    }
    
    // Add to away team's matches if it's a selected team
    if (selectedTeamIds.includes(awayTeamId)) {
      const teamMatches = matchesByMatchdayAndTeam.get(matchday)!.get(awayTeamId) || [];
      matchesByMatchdayAndTeam.get(matchday)!.set(awayTeamId, [...teamMatches, match]);
    }
  });
  
  // Full screen container classes with animation
  const getFullScreenClasses = () => {
    const baseClasses = "fixed inset-0 bg-[#0a0a0a] z-50 overflow-y-auto transition-all duration-300 ease-out will-change-transform";
    let animationClasses = "";
    
    if (isEntering) {
      animationClasses = "opacity-0 translate-y-full";
    } else if (isExiting) {
      animationClasses = "opacity-0 translate-y-full";
    } else {
      animationClasses = "opacity-100 translate-y-0";
    }
    
    return `${baseClasses} ${animationClasses}`;
  };
  
  // Content container classes
  const getContentClasses = () => {
    if (isMobileSConstrainedView) {
      return "min-h-screen bg-[#111111] p-2";
    }
    if (isMobileMConstrainedView) {
      return "min-h-screen bg-[#111111] p-3";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "min-h-screen bg-[#111111] p-4";
    }
    if (isTabletSmallConstrainedView) {
      return "min-h-screen bg-[#111111] p-4";
    }
    if (isMediumConstrainedView) {
      return "min-h-screen bg-[#111111] p-5";
    }
    if (isSpecificConstrainedView) {
      return "min-h-screen bg-[#111111] p-6";
    }
    // Default for larger screens
    return "min-h-screen bg-[#111111] p-6";
  };
  
  // Headings and title sizes
  const getTitleClasses = () => {
    if (isMobileSConstrainedView) {
      return "text-lg font-bold text-[#f7e479]";
    }
    if (isMobileMConstrainedView) {
      return "text-base font-bold text-[#f7e479]";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "text-xl font-bold text-[#f7e479]";
    }
    // Default for larger screens
    return "text-2xl font-bold text-[#f7e479]";
  };
  
  const shouldUseCompactActionButtons = false;
  
  // Button classes
  const getButtonClasses = () => {
    if (isMobileSConstrainedView || isMobileMConstrainedView) {
      return "px-3 py-1.5 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 text-xs font-semibold";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "px-4 py-1.5 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 text-xs font-semibold";
    }
    if (isTabletSmallConstrainedView) {
      return "px-5 py-1.5 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 text-sm font-semibold";
    }
    // Default for larger screens
    return "px-8 py-2 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold";
  };
  
  // Close button classes
  const getCloseButtonClasses = () => {
    if (isMobileSConstrainedView || isMobileMConstrainedView) {
      return "px-4 py-1.5 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 text-xs font-semibold";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "px-5 py-1.5 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 text-sm font-semibold";
    }
    // Default for larger screens
    return "px-8 py-2 bg-transparent text-[#f7e479] border border-[#f7e479] rounded-full hover:bg-[#f7e479] hover:text-black transition-all duration-300 font-semibold";
  };

  const getEditActionButtonClasses = () => `${getCloseButtonClasses()} ${isMobileMConstrainedView ? 'text-xs py-1 px-3' : ''}`;

  const getCloseActionButtonClasses = () => `${getCloseButtonClasses()} ${isMobileMConstrainedView ? 'text-xs py-1 px-3' : ''}`;

  const getActionButtonsWrapperClasses = () => "flex gap-2 justify-center";

  const renderMatchdayRangeSection = (isCompactLayout = false) => (
    <div className={`${isCompactLayout ? 'w-full' : 'flex-1'}`}>
      <label className="block text-sm font-semibold text-gray-300 mb-3">
        Matchday Range
      </label>
      <div className="flex gap-3">
        <div className="w-24">
          <label className="block text-xs text-gray-400 mb-1.5">From</label>
          <div className="relative" ref={fromDropdownRef}>
            <button
              ref={fromButtonRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenDropdown(prev => prev === 'from' ? null : 'from');
              }}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2.5 py-2 pr-7 text-white text-sm text-center focus:outline-none focus:border-[#2a2a2a] cursor-pointer"
            >
              {tempMatchdayMin === 'all' ? minMatchday : tempMatchdayMin}
            </button>
            <div className="absolute right-0.5 top-0 bottom-0 flex flex-col justify-center pointer-events-none">
              <button
                type="button"
                onClick={handleFromIncrement}
                className="pointer-events-auto p-0.5 text-gray-400 hover:text-white transition-colors"
                onMouseDown={(e) => e.preventDefault()}
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleFromDecrement}
                className="pointer-events-auto p-0.5 text-gray-400 hover:text-white transition-colors"
                onMouseDown={(e) => e.preventDefault()}
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {openDropdown === 'from' && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded z-50" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {getAvailableFromMatchdays().map(md => (
                  <button
                    key={md}
                    type="button"
                    onClick={() => {
                      handleMatchdayFromChange(md.toString());
                      setOpenDropdown(null);
                    }}
                    className={`w-full px-2.5 py-1 text-sm text-center transition-colors ${
                      (tempMatchdayMin === 'all' ? minMatchday : tempMatchdayMin) === md
                        ? 'bg-[#f7e479]/10 text-[#f7e479]'
                        : 'text-white hover:bg-[#f7e479] hover:text-black'
                    }`}
                  >
                    {md}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="w-24">
          <label className="block text-xs text-gray-400 mb-1.5">To</label>
          <div className="relative" ref={toDropdownRef}>
            <button
              ref={toButtonRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenDropdown(prev => prev === 'to' ? null : 'to');
              }}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2.5 py-2 pr-7 text-white text-sm text-center focus:outline-none focus:border-[#2a2a2a] cursor-pointer"
            >
              {tempMatchdayMax === 'all' ? maxMatchday : tempMatchdayMax}
            </button>
            <div className="absolute right-0.5 top-0 bottom-0 flex flex-col justify-center pointer-events-none">
              <button
                type="button"
                onClick={handleToIncrement}
                className="pointer-events-auto p-0.5 text-gray-400 hover:text-white transition-colors"
                onMouseDown={(e) => e.preventDefault()}
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleToDecrement}
                className="pointer-events-auto p-0.5 text-gray-400 hover:text-white transition-colors"
                onMouseDown={(e) => e.preventDefault()}
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {openDropdown === 'to' && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded z-50" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {getAvailableToMatchdays().map(md => (
                  <button
                    key={md}
                    type="button"
                    onClick={() => {
                      handleMatchdayToChange(md.toString());
                      setOpenDropdown(null);
                    }}
                    className={`w-full px-2.5 py-1 text-sm text-center transition-colors ${
                      (tempMatchdayMax === 'all' ? maxMatchday : tempMatchdayMax) === md
                        ? 'bg-[#f7e479]/10 text-[#f7e479]'
                        : 'text-white hover:bg-[#f7e479] hover:text-black'
                    }`}
                  >
                    {md}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {matchdayRangeError && (
        <p className="text-xs text-red-400 mt-2">Invalid range: From cannot be greater than To.</p>
      )}
    </div>
  );

  const renderDisplayOptionsSection = (isCompactLayout = false) => (
    <div className={`${isCompactLayout ? 'w-full' : 'flex-1'}`}>
      <label className="block text-sm font-semibold text-gray-300 mb-3">
        Display Options
      </label>
      <div className={`space-y-2 ${displayOptionsError ? 'border-l-2 border-red-500 pl-4 -ml-6' : ''}`}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={tempShowPosition}
            onChange={(e) => {
              const newValue = e.target.checked;
              if (!newValue && !tempShowPoints) { return; }
              if (tempShowPosition === newValue) return; // Prevent unnecessary update
              setTempShowPosition(newValue);
              setDisplayOptionsError(false);
            }}
            className={`w-5 h-5 border-0 rounded appearance-none focus:ring-0 focus:ring-offset-0 cursor-pointer relative ${tempShowPosition ? 'bg-[#f7e479]' : 'bg-[#1a1a1a] border border-[#2a2a2a]'}`}
            style={{
              backgroundImage: tempShowPosition ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z' fill='%23000000'/%3E%3C/svg%3E")` : 'none',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center'
            }}
          />
          <span className={`text-sm ${displayOptionsError ? 'text-red-400' : 'text-gray-300'}`}>Position (1st)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={tempShowPoints}
            onChange={(e) => {
              const newValue = e.target.checked;
              if (!newValue && !tempShowPosition) { return; }
              if (tempShowPoints === newValue) return; // Prevent unnecessary update
              setTempShowPoints(newValue);
              setDisplayOptionsError(false);
            }}
            className={`w-5 h-5 border-0 rounded appearance-none focus:ring-0 focus:ring-offset-0 cursor-pointer relative ${tempShowPoints ? 'bg-[#f7e479]' : 'bg-[#1a1a1a] border border-[#2a2a2a]'}`}
            style={{
              backgroundImage: tempShowPoints ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z' fill='%23000000'/%3E%3C/svg%3E")` : 'none',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center'
            }}
          />
          <span className={`text-sm ${displayOptionsError ? 'text-red-400' : 'text-gray-300'}`}>Points (17 Pts)</span>
        </label>
        {displayOptionsError && (
          <p className="text-xs text-red-400 mt-2">Select at least one display option.</p>
        )}
      </div>
    </div>
  );

  const renderTeamSelectionSection = (isCompactLayout = false) => (
    <div className={`${isCompactLayout ? 'pb-4' : 'pb-6'} ${teamSelectionError ? 'border-l-2 border-red-500 pl-4 -ml-6' : ''}`}>
      <div className={`flex justify-between items-center ${isCompactLayout ? 'mb-3' : 'mb-4'}`}>
        <div className="flex items-center gap-2">
          <label className={`block text-sm font-semibold ${teamSelectionError ? 'text-red-400' : 'text-gray-300'}`}>
            Select Teams:
          </label>
          <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-xs text-gray-300">
            {tempTeamIds.length}/{allSortedTeamIds.length}
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => {
              setTempTeamIds([...allSortedTeamIds]);
              setTeamSelectionError(false);
            }}
            className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
          >
            Select All
          </button>
          <span className="text-gray-600">·</span>
          <button
            onClick={() => {
              setTempTeamIds([]);
              setTeamSelectionError(true);
            }}
            className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5 max-h-96 overflow-y-auto">
        {allSortedTeamIds.map(teamId => {
          const team = getTeamDetails(teamId);
          if (!team) return null;
          const isSelected = tempTeamIds.includes(teamId);
          return (
            <label
              key={teamId}
              className={`flex flex-col items-center p-1.5 rounded cursor-pointer transition-all ${
                isSelected
                  ? 'bg-[#f7e479]/5 border border-[#f7e479]/50'
                  : 'bg-transparent border border-white/10 hover:border-white/20'
              }`}
            >
              <div className="relative w-8 h-8 mb-1">
                <Image src={team.crest || "/placeholder-team.png"} alt={team.name} fill className="object-contain" />
              </div>
              <span className={`text-[9px] text-center leading-tight ${isSelected ? 'text-[#f7e479]/80' : 'text-white'}`}>
                {getResponsiveTeamName(team)}
              </span>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => handleTeamSelectionChange(teamId, e.target.checked)}
                className="sr-only"
              />
            </label>
          );
        })}
      </div>
      {teamSelectionError && (
        <p className="text-xs text-red-400 mt-2">Select at least one team to update the summary.</p>
      )}
    </div>
  );
  
  // Team logo size classes
  const getTeamLogoClasses = () => {
    if (isMobileSConstrainedView || isMobileMConstrainedView) {
      return "relative h-6 w-6 mb-1";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "relative h-6 w-6 mb-1";
    }
    // Default for larger screens
    return "relative h-8 w-8 mb-2";
  };
  
  // Match team logo size
  const getMatchTeamLogoClasses = () => {
    if (isMobileSConstrainedView || isMobileMConstrainedView) {
      return "relative h-4 w-4 mr-1";
    }
    // Default for larger screens
    return "relative h-5 w-5 mr-1";
  };
  
  // Header classes
  const getHeaderClasses = () => {
    if (isMobileSConstrainedView || isMobileMConstrainedView) {
      return "flex justify-between items-center mb-2";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "flex justify-between items-center mb-3";
    }
    // Default for larger screens
    return "flex justify-between items-center mb-4";
  };
  
  // Spacing for bottom buttons
  const getBottomMarginClasses = () => {
    if (isMobileSConstrainedView || isMobileMConstrainedView) {
      return "mt-3 flex justify-center";
    }
    if (isMobileLConstrainedView || isMobileXLConstrainedView) {
      return "mt-4 flex justify-center";
    }
    // Default for larger screens
    return "mt-6 flex justify-center";
  };
  
  // Ensure scroll container is at left position when 4-6 teams are selected
  useEffect(() => {
    if ((sortedTeamIds.length === 4 || sortedTeamIds.length === 5 || sortedTeamIds.length === 6) && (isTabletSmallConstrainedView || isMediumConstrainedView)) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = 0;
      }
    }
  }, [sortedTeamIds.length, isTabletSmallConstrainedView, isMediumConstrainedView]);

  // Helper function to get tablet width (auto-adjusts based on screen width and team count)
  const getTabletWidth = (teamCount: number): number | null => {
    if (!(isTabletSmallConstrainedView || isMediumConstrainedView) || !screenWidth) {
      return null;
    }
    
    // MD column width (sticky left column)
    const mdColumnWidth = isTabletSmallConstrainedView ? 70 : 75;
    
    // Account for padding and margins (left + right padding, scrollbar, etc.)
    const horizontalPadding = 32; // 16px on each side
    const scrollbarWidth = 8;
    
    // Calculate available width for team columns
    const availableWidth = screenWidth - mdColumnWidth - horizontalPadding - scrollbarWidth;
    
    // Calculate base width per team
    const baseWidth = availableWidth / teamCount;
    
    // Apply min/max constraints for readability
    // Min: 35px (too small and content won't fit)
    // Max: 90px (too wide and looks stretched)
    const minWidth = 35;
    const maxWidth = 90;
    
    // Clamp the width
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, baseWidth));
    
    // Round to nearest pixel
    return Math.round(clampedWidth);
  };
  
  // Render mobile optimization for the forecast summary
  const renderMobileView = () => {
    return (
      <div className={shouldCenterSummaryLayout ? 'flex flex-col items-center justify-center w-full min-h-[80vh]' : ''}>
        {/* Forecast Summary Heading */}
        <h2 className={`text-center font-bold text-[#f7e479] mb-4 ${isMobileSConstrainedView ? 'text-base' : isMobileMConstrainedView ? 'text-lg' : 'text-xl'}`}>
          Forecast Summary
        </h2>
        <div
          ref={scrollContainerRef}
          className={`overflow-x-auto overflow-y-auto bg-[#111111] ${tableScrollHeightClass}${isMobileSConstrainedView ? ' mobile-s' : ''} ${(isTabletSmallConstrainedView || isMediumConstrainedView) && sortedTeamIds.length > 3 && allMatchdays.length < 7 ? 'w-full' : ''} ${isSmallMobileView && sortedTeamIds.length > 6 && allMatchdays.length < 7 ? 'w-full' : ''}`}
          style={showRightShadow ? { boxShadow: 'inset -20px 0 25px -25px rgba(0,0,0,0.9)' } : undefined}
        >
        <div className="pl-0 pr-2">
        <table className="border-separate border-spacing-0 w-auto bg-[#111111]">
          <thead className="sticky top-0 z-20 bg-[#111111]">
            <tr>
              <th className={`sticky left-0 z-30 bg-[#111111] px-0 py-1.5 border-r border-[#2a2a2a] border-b border-[#2a2a2a] ${isTabletSmallConstrainedView ? 'w-[70px] min-w-[70px] max-w-[70px]' : isMediumConstrainedView ? 'w-[75px] min-w-[75px] max-w-[75px]' : isMobileSConstrainedView ? 'w-[40px] min-w-[40px] max-w-[40px]' : isMobileMConstrainedView ? 'w-[42px] min-w-[42px] max-w-[42px]' : (isMobileXLConstrainedView || isMobileLConstrainedView) ? 'w-[45px] min-w-[45px] max-w-[45px]' : 'min-w-[45px] max-w-[45px]'}`} style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.8), 2px 0 4px rgba(0,0,0,0.6)' }}>
                <div className="flex items-center justify-center">
                  <div className={`${isMobileSConstrainedView ? 'relative h-8 w-8' : isMobileMConstrainedView ? 'relative h-9 w-9' : 'relative h-10 w-10'}`}>
                    <Image
                      src={getLeagueLogo()}
                      alt="League"
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              </th>
              {sortedTeamIds.map((teamId, index) => {
                const team = getTeamDetails(teamId);
                if (!team) return null;
                const isFirstTeam = index === 0 && (sortedTeamIds.length === 4 || sortedTeamIds.length === 5 || sortedTeamIds.length === 6);
                const tabletWidth = getTabletWidth(sortedTeamIds.length);
                const isMobileView = isMobileSConstrainedView || isMobileMConstrainedView || isMobileLConstrainedView || isMobileXLConstrainedView;
                
                return (
                  <th
                    key={teamId}
                    className={`sticky top-0 ${isFirstTeam && (isTabletSmallConstrainedView || isMediumConstrainedView) ? 'z-31' : 'z-25'} bg-[#111111] px-1 py-1.5 text-center border-b border-[#2a2a2a] whitespace-nowrap ${isMobileView ? '' : sortedTeamIds.length <= 2 ? (isTabletSmallConstrainedView || isMediumConstrainedView ? 'min-w-[85px]' : 'min-w-[130px]') : sortedTeamIds.length === 3 ? (isTabletSmallConstrainedView || isMediumConstrainedView ? 'min-w-[70px]' : 'min-w-[110px]') : sortedTeamIds.length >= 4 && sortedTeamIds.length <= 10 ? '' : sortedTeamIds.length > 10 ? (isTabletSmallConstrainedView || isMediumConstrainedView ? 'w-[28px] min-w-[28px] max-w-[28px]' : 'min-w-[60px] max-w-[70px]') : (isTabletSmallConstrainedView || isMediumConstrainedView ? 'w-[28px] min-w-[28px] max-w-[28px]' : 'min-w-[60px] max-w-[70px]')}`}
                    style={{
                      ...(isFirstTeam && (isTabletSmallConstrainedView || isMediumConstrainedView) ? { zIndex: 31 } : {}),
                      ...(isMobileView && isSmallMobileView && sortedTeamIds.length > 6 && allMatchdays.length < 7 ? { maxWidth: '60px' } : {}),
                      ...(!isMobileView && tabletWidth ? { width: `${tabletWidth}px`, minWidth: `${tabletWidth}px`, maxWidth: `${tabletWidth}px` } : {})
                    }}
                  >
                    <div className={`flex flex-col items-center justify-center ${(isTabletSmallConstrainedView || isMediumConstrainedView) && sortedTeamIds.length >= 4 && !isMobileView ? 'w-full min-w-0' : ''} ${isMobileView && isSmallMobileView && sortedTeamIds.length > 6 && allMatchdays.length < 7 ? 'w-full min-w-0' : ''}`}>
                      <div className={isMobileSConstrainedView ? 'relative h-6 w-6 mb-0.5' : isMobileMConstrainedView ? 'relative h-7 w-7 mb-0.5' : 'relative h-8 w-8 mb-1'}>
                        <Image
                          src={team.crest || "/placeholder-team.png"}
                          alt={team.name}
                          fill
                          className="object-contain"
                        />
                      </div>
                      <span className={`${isMobileSConstrainedView ? 'text-[8px]' : isMobileMConstrainedView ? 'text-[9px]' : 'text-[10px]'} ${(isTabletSmallConstrainedView || isMediumConstrainedView) && sortedTeamIds.length >= 4 && !isMobileView ? 'truncate w-full text-center' : ''} ${isMobileView && isSmallMobileView && sortedTeamIds.length > 6 && allMatchdays.length < 7 ? 'truncate w-full text-center' : ''}`} style={{
                        ...((isTabletSmallConstrainedView || isMediumConstrainedView) && sortedTeamIds.length >= 4 && !isMobileView && tabletWidth ? { maxWidth: `${tabletWidth - 8}px` } : {}),
                        ...(isMobileView && isSmallMobileView && sortedTeamIds.length > 6 && allMatchdays.length < 7 ? { maxWidth: '52px' } : {})
                      }}>{getResponsiveTeamName(team, sortedTeamIds.length <= 2)}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allMatchdays.map(matchday => (
              <tr key={matchday}>
                <td
                  className={`sticky left-0 z-10 bg-[#111111] px-0 py-1 text-center font-semibold text-white border-r border-[#2a2a2a] border-b border-[#2a2a2a] ${isMobileSConstrainedView ? 'text-[9px] w-[40px] min-w-[40px] max-w-[40px]' : isMobileMConstrainedView ? 'text-[10px] w-[42px] min-w-[42px] max-w-[42px]' : 'text-xs'} ${isTabletSmallConstrainedView ? 'w-[70px] min-w-[70px] max-w-[70px]' : isMediumConstrainedView ? 'w-[75px] min-w-[75px] max-w-[75px]' : (isMobileXLConstrainedView || isMobileLConstrainedView) ? 'w-[45px] min-w-[45px] max-w-[45px]' : 'min-w-[45px] max-w-[45px]'}`}
                  style={{ boxShadow: '4px 0 8px rgba(0,0,0,0.8), 2px 0 4px rgba(0,0,0,0.6)' }}
                >
                  MD{matchday}
                </td>
                
                {sortedTeamIds.map((teamId, index) => {
                  const teamMatches = matchesByMatchdayAndTeam.get(matchday)?.get(teamId) || [];
                  const isFirstTeam = index === 0 && (sortedTeamIds.length === 4 || sortedTeamIds.length === 5 || sortedTeamIds.length === 6);
                  const tabletWidth = getTabletWidth(sortedTeamIds.length);
                  const isMobileView = isMobileSConstrainedView || isMobileMConstrainedView || isMobileLConstrainedView || isMobileXLConstrainedView;
                  
                  return (
                    <td
                      key={`${matchday}-${teamId}`}
                      className={`px-1 py-1 align-top border-b border-[#2a2a2a] ${isMobileView ? 'p-0' : ''} ${isMobileView ? '' : sortedTeamIds.length <= 2 ? (isTabletSmallConstrainedView || isMediumConstrainedView ? 'min-w-[85px]' : 'min-w-[130px]') : sortedTeamIds.length === 3 ? (isTabletSmallConstrainedView || isMediumConstrainedView ? 'min-w-[70px]' : 'min-w-[110px]') : sortedTeamIds.length >= 4 && sortedTeamIds.length <= 10 ? '' : sortedTeamIds.length > 10 ? (isTabletSmallConstrainedView || isMediumConstrainedView ? 'w-[28px] min-w-[28px] max-w-[28px]' : 'min-w-[60px] max-w-[70px]') : (isTabletSmallConstrainedView || isMediumConstrainedView ? 'w-[28px] min-w-[28px] max-w-[28px]' : 'min-w-[60px] max-w-[70px]')}`}
                      style={{
                        ...(isMobileView ? { width: '1%' } : {}),
                        ...(isMobileView && isSmallMobileView && sortedTeamIds.length > 6 && allMatchdays.length < 7 ? { maxWidth: '60px' } : {}),
                        ...(isFirstTeam && (isTabletSmallConstrainedView || isMediumConstrainedView) ? { zIndex: 11 } : {}),
                        ...(!isMobileView && tabletWidth ? { width: `${tabletWidth}px`, minWidth: `${tabletWidth}px`, maxWidth: `${tabletWidth}px` } : {})
                      }}
                    >
                      {teamMatches.length > 0 ? (
                        <div className="space-y-0.5">
                          {teamMatches.map(match => {
                            const prediction = predictions.get(match.id);
                            const isHome = match.homeTeam.id === teamId;
                            const opponent = isHome ? match.awayTeam : match.homeTeam;
                            const isMobileTapExpand = isMobileSConstrainedView || isMobileMConstrainedView || isMobileLConstrainedView || isMobileXLConstrainedView;
                            return (
                              <div
                                key={match.id}
                                className={`flex items-center justify-center gap-0.5 p-1 rounded ${getResultBgColorClass(match, prediction, teamId)} select-none relative`}
                                style={isMobileTapExpand ? {minWidth: 0, maxWidth: '100vw'} : {}}
                              >
                                <div className="flex items-center justify-center relative gap-0.5">
                                  <span className={`text-white font-medium ${isMobileSConstrainedView ? 'text-[7px]' : isMobileMConstrainedView ? 'text-[8px]' : 'text-[9px]'}`}>
                                    {isHome ? 'H' : 'A'}
                                  </span>
                                  <div className={`${isMobileSConstrainedView ? 'relative h-5 w-5' : isMobileMConstrainedView ? 'relative h-6 w-6' : 'relative h-7 w-7'}`}>
                                    <Image
                                      src={opponent.crest || "/placeholder-team.png"}
                                      alt={opponent.name}
                                      fill
                                      className="object-contain"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-left text-[9px] text-gray-400">-</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            
            {/* Total points row */}
            <tr className={`${shouldStickyPoints ? 'sticky bottom-0 z-20 bg-[#111111]' : ''}`} style={shouldStickyPoints ? { boxShadow: '0 -4px 10px rgba(0,0,0,0.8)' } : undefined}>
              <td className={`${shouldStickyPoints ? 'sticky left-0 bottom-0 z-30' : 'sticky left-0 z-10'} bg-[#111111] px-0 py-2 text-center font-semibold text-[#f7e479] text-xs border-r border-[#2a2a2a] border-t border-[#2a2a2a] ${isTabletSmallConstrainedView ? 'w-[70px] min-w-[70px] max-w-[70px]' : isMediumConstrainedView ? 'w-[75px] min-w-[75px] max-w-[75px]' : isMobileSConstrainedView ? 'w-[40px] min-w-[40px] max-w-[40px]' : isMobileMConstrainedView ? 'w-[42px] min-w-[42px] max-w-[42px]' : (isMobileXLConstrainedView || isMobileLConstrainedView) ? 'w-[45px] min-w-[45px] max-w-[45px]' : 'min-w-[45px] max-w-[45px]'}`} style={shouldStickyPoints ? { boxShadow: '4px -2px 8px rgba(0,0,0,0.8), 2px -2px 4px rgba(0,0,0,0.6), 4px 0 8px rgba(0,0,0,0.8), 2px 0 4px rgba(0,0,0,0.6)' } : { boxShadow: '4px 0 8px rgba(0,0,0,0.8), 2px 0 4px rgba(0,0,0,0.6)' }}>
                <div className="flex items-center justify-center w-full h-full">
                  <span className={`${isMobileSConstrainedView ? 'text-[6px]' : isMobileMConstrainedView ? 'text-[7px]' : 'text-[8px]'} whitespace-nowrap`}>Standings:</span>
                </div>
              </td>
              {sortedTeamIds.map((teamId, index) => {
                const points = getTeamPoints(teamId);
                const position = getTeamPosition(teamId);
                const isFirstTeam = index === 0 && (sortedTeamIds.length === 4 || sortedTeamIds.length === 5 || sortedTeamIds.length === 6);
                const tabletWidth = getTabletWidth(sortedTeamIds.length);
                const isMobileView = isMobileSConstrainedView || isMobileMConstrainedView || isMobileLConstrainedView || isMobileXLConstrainedView;
                
                return (
                  <td key={`points-${teamId}`} className={`${shouldStickyPoints ? 'sticky bottom-0 z-20' : ''} bg-[#111111] px-1 py-2 text-center border-t border-[#2a2a2a] ${isMobileSConstrainedView ? 'text-[10px]' : 'text-sm'} ${isMobileView ? '' : sortedTeamIds.length <= 2 ? (isTabletSmallConstrainedView || isMediumConstrainedView ? 'min-w-[85px]' : 'min-w-[130px]') : sortedTeamIds.length === 3 ? (isTabletSmallConstrainedView || isMediumConstrainedView ? 'min-w-[70px]' : 'min-w-[110px]') : sortedTeamIds.length >= 4 && sortedTeamIds.length <= 10 ? '' : sortedTeamIds.length > 10 ? (isTabletSmallConstrainedView || isMediumConstrainedView ? 'w-[28px] min-w-[28px] max-w-[28px]' : 'min-w-[60px] max-w-[70px]') : (isTabletSmallConstrainedView || isMediumConstrainedView ? 'w-[28px] min-w-[28px] max-w-[28px]' : 'min-w-[60px] max-w-[70px]')}`} style={{
                    ...(shouldStickyPoints ? { boxShadow: '0 -2px 4px rgba(0,0,0,0.5)' } : {}),
                    ...(isMobileView && isSmallMobileView && sortedTeamIds.length > 6 && allMatchdays.length < 7 ? { maxWidth: '60px' } : {}),
                    ...(isFirstTeam && (isTabletSmallConstrainedView || isMediumConstrainedView) ? { zIndex: shouldStickyPoints ? 31 : 11 } : {}),
                    ...(!isMobileView && tabletWidth ? { width: `${tabletWidth}px`, minWidth: `${tabletWidth}px`, maxWidth: `${tabletWidth}px` } : {})
                  }}>
                    {appliedShowPosition && appliedShowPoints ? (
                      <div className="flex flex-col items-center justify-center gap-0 leading-tight">
                        <span className={`font-mono font-semibold text-gray-100 ${isMobileSConstrainedView ? 'text-[8px]' : isMobileMConstrainedView ? 'text-[9px]' : (isTabletSmallConstrainedView || isMediumConstrainedView) ? 'text-[9px]' : 'text-[10px]'}`}>
                          {position !== '-' ? `${position}${getOrdinalSuffix(position)}` : '-'}
                        </span>
                        <span className={`text-gray-400 ${isMobileSConstrainedView ? 'text-[10px]' : isMobileMConstrainedView ? 'text-[11px]' : (isTabletSmallConstrainedView || isMediumConstrainedView) ? 'text-[11px]' : 'text-[12px]'}`}>·</span>
                        <span className={`font-mono font-semibold text-gray-100 ${isMobileSConstrainedView ? 'text-[8px]' : isMobileMConstrainedView ? 'text-[9px]' : (isTabletSmallConstrainedView || isMediumConstrainedView) ? 'text-[9px]' : 'text-[10px]'}`}>
                          {points} Pts
                        </span>
                      </div>
                    ) : appliedShowPosition ? (
                      <span className={`font-mono font-semibold text-gray-100 ${isMobileSConstrainedView ? 'text-[8px]' : isMobileMConstrainedView ? 'text-[9px]' : (isTabletSmallConstrainedView || isMediumConstrainedView) ? 'text-[9px]' : 'text-[10px]'}`}>
                        {position !== '-' ? `${position}${getOrdinalSuffix(position)}` : '-'}
                      </span>
                    ) : appliedShowPoints ? (
                      <span className={`font-mono font-semibold text-gray-100 ${isMobileSConstrainedView ? 'text-[8px]' : isMobileMConstrainedView ? 'text-[9px]' : (isTabletSmallConstrainedView || isMediumConstrainedView) ? 'text-[9px]' : 'text-[10px]'}`}>
                        {points} Pts
                      </span>
                    ) : (
                      <span className={`font-mono font-semibold text-gray-100 ${isMobileSConstrainedView ? 'text-[8px]' : isMobileMConstrainedView ? 'text-[9px]' : (isTabletSmallConstrainedView || isMediumConstrainedView) ? 'text-[9px]' : 'text-[10px]'}`}>-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className={getFullScreenClasses()}>
      <div className={getContentClasses()}>
        {viewMode === 'table' ? (
          <>
            <div className={getHeaderClasses()}>
              <div className="flex-grow text-center">
                <h2 className={getTitleClasses()}>Final Table</h2>
              </div>
              <button
                onClick={() => setViewMode('summary')}
                className={getButtonClasses()}
              >
                Show Matches
              </button>
            </div>
            
            {/* Standings table */}
            <StandingsTable 
              standings={standings} 
              loading={false} 
              selectedTeamIds={selectedTeamIds} 
            />
            
            <div className={getBottomMarginClasses()}>
              <div className={getActionButtonsWrapperClasses()}>
              <button
                  onClick={handleClose}
                  className={getCloseActionButtonClasses()}
              >
                Close
              </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Debug info */}
            {matchdayData.matchCount === 0 && (
              <div className="text-center text-red-400 mb-4">
                No matches found. Please make predictions first.
              </div>
            )}
            
            {/* Smaller screens and tablets get special treatment */}
            {(isMobileSConstrainedView || isMobileMConstrainedView || isMobileLConstrainedView || isMobileXLConstrainedView || isTabletSmallConstrainedView || isMediumConstrainedView) ? (
              renderMobileView()
            ) : (
              // Regular desktop view - original layout
              <div className={shouldCenterSummaryLayout ? 'flex flex-col items-center justify-center w-full min-h-[80vh]' : ''}>
                <div
                  ref={scrollContainerRef}
                  className={`overflow-x-auto overflow-y-auto bg-[#111111] ${tableScrollHeightClass} ${sortedTeamIds.length < 7 ? 'flex justify-center' : ''} ${shouldCenterSummaryLayout ? 'flex-shrink-0' : ''}`}
                  style={showRightShadow ? { boxShadow: 'inset -25px 0 25px -25px rgba(0,0,0,0.9)' } : undefined}
                >
                  <table className={`${sortedTeamIds.length < 7 ? 'mx-auto' : 'w-full'} border-separate border-spacing-0 bg-[#111111]`}>
                  <thead className="sticky top-0 z-20 bg-[#111111]">
                    <tr>
                      <th className={`sticky left-0 z-30 bg-[#111111] px-2 py-1.5 border-r border-[#2a2a2a] border-b border-[#2a2a2a] ${isTabletSmallConstrainedView ? 'w-[110px] min-w-[110px]' : 'min-w-[120px]'}`} style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.5)' }}>
                        <div className={`flex flex-col items-center text-center font-bold text-[#f7e479] leading-tight ${isTabletSmallConstrainedView ? 'text-sm' : 'text-base'}`}>
                          <span>Forecast</span>
                          <span>Summary</span>
                          </div>
                      </th>
                      {sortedTeamIds.map(teamId => {
                        const team = getTeamDetails(teamId);
                        if (!team) return null;
                        
                        return (
                          <th
                            key={teamId}
                            className={`sticky top-0 z-25 bg-[#111111] px-2 py-1.5 text-center text-sm font-semibold text-primary border-b border-[#2a2a2a] whitespace-nowrap ${sortedTeamIds.length < 7 ? 'min-w-[150px] max-w-[200px]' : ''}`}
                          >
                            <div className="flex flex-col items-center">
                              <div className="relative h-8 w-8 mb-1">
                                <Image
                                  src={team.crest || "/placeholder-team.png"}
                                  alt={team.name}
                                  fill
                                  className="object-contain"
                                />
                              </div>
                              <span className="text-xs">{getResponsiveTeamName(team)}</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {allMatchdays.map(matchday => (
                      <tr key={matchday}>
                        <td className={`sticky left-0 z-10 bg-[#111111] px-2 py-1.5 text-center font-semibold text-white border-r border-[#2a2a2a] border-b border-[#2a2a2a] text-xs ${isTabletSmallConstrainedView ? 'w-[110px] min-w-[110px]' : 'min-w-[120px]'}`} style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.5)' }}>
                          Matchday {matchday}
                        </td>
                        
                        {sortedTeamIds.map(teamId => {
                          const teamMatches = matchesByMatchdayAndTeam.get(matchday)?.get(teamId) || [];
                          
                          return (
                            <td
                              key={`${matchday}-${teamId}`}
                              className={`px-2 py-1.5 align-top border-b border-[#2a2a2a] ${isMobileXLConstrainedView ? 'max-w-[70px] min-w-[50px]' : ''} ${sortedTeamIds.length < 7 ? 'min-w-[150px] max-w-[200px]' : ''}`}
                            >
                              {teamMatches.length > 0 ? (
                                <div className="space-y-1">
                                  {teamMatches.map(match => {
                                    const prediction = predictions.get(match.id);
                                    const isHome = match.homeTeam.id === teamId;
                                    const opponent = isHome ? match.awayTeam : match.homeTeam;
                                    
                                    // Now use the colored box approach for all screen sizes
                                    return (
                                      <div key={match.id} className={`flex items-center justify-start text-sm p-1.5 rounded ${getResultBgColorClass(match, prediction, teamId)}`}>
                                        <div className="flex items-center justify-start">
                                          <span className="text-gray-300 text-xs font-medium mr-1 min-w-[22px]">
                                            {isHome ? '(H)' : '(A)'}
                                          </span>
                                          <div className="relative h-5 w-5 mr-1">
                                            <Image
                                              src={opponent.crest || "/placeholder-team.png"}
                                              alt={opponent.name}
                                              fill
                                              className="object-contain"
                                            />
                                          </div>
                                          {!(isTabletSmallConstrainedView || isMediumConstrainedView) && (
                                            <span className="text-xs text-primary truncate" title={opponent.name}>
                                              {getResponsiveTeamName(opponent)}
                                          </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-left text-xs text-gray-400">-</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    
                    {/* Total points row */}
                    <tr className={`${shouldStickyPoints ? 'sticky bottom-0 z-20 bg-[#111111]' : ''}`} style={shouldStickyPoints ? { boxShadow: '0 -2px 4px rgba(0,0,0,0.5)' } : undefined}>
                      <td className={`${shouldStickyPoints ? 'sticky left-0 bottom-0 z-30' : 'sticky left-0 z-10'} bg-[#111111] px-2 py-3 text-center font-semibold text-[#f7e479] border-r border-[#2a2a2a] border-t border-[#2a2a2a] ${isTabletSmallConstrainedView ? 'w-[110px] min-w-[110px]' : 'min-w-[120px]'}`} style={shouldStickyPoints ? { boxShadow: '2px -2px 4px rgba(0,0,0,0.5)' } : { boxShadow: '2px 0 4px rgba(0,0,0,0.5)' }}>
                        {'Standings:'}
                      </td>
                      {sortedTeamIds.map(teamId => {
                        const points = getTeamPoints(teamId);
                        const position = getTeamPosition(teamId);
                        
                        let displayText = '';
                        if (appliedShowPosition && appliedShowPoints) {
                          displayText = `${position}${position !== '-' ? getOrdinalSuffix(position) : ''} • ${points} Pts`;
                        } else if (appliedShowPosition) {
                          displayText = `${position}${position !== '-' ? getOrdinalSuffix(position) : ''}`;
                        } else if (appliedShowPoints) {
                          displayText = `${points} Pts`;
                        } else {
                          displayText = '-';
                        }
                        
                        return (
                          <td key={`points-${teamId}`} className={`${shouldStickyPoints ? 'sticky bottom-0 z-20' : ''} bg-[#111111] px-2 py-3 text-center border-t border-[#2a2a2a] ${sortedTeamIds.length < 7 ? 'min-w-[150px] max-w-[200px]' : ''}`} style={shouldStickyPoints ? { boxShadow: '0 -2px 4px rgba(0,0,0,0.5)' } : undefined}>
                            <span className="font-mono text-base font-semibold text-gray-100">{displayText}</span>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
                </div>
              </div>
            )}
            
            <div className={getBottomMarginClasses()}>
              <div className={getActionButtonsWrapperClasses()}>
              <button
                  onClick={() => setShowEditPanel(!showEditPanel)}
                  className={getEditActionButtonClasses()}
                >
                  Edit
                </button>
                <button
                  onClick={handleClose}
                  className={getCloseActionButtonClasses()}
              >
                Close
              </button>
              </div>
            </div>
            
            {/* Edit/Filter Panel */}
            {showEditPanel && (
              <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg max-w-[720px] w-full max-h-[90vh] flex flex-col mx-auto">
                  {/* Header */}
                  <div className="relative flex justify-center items-center p-6 pb-4">
                    <h3 className="text-lg font-bold text-white">Filter Summary</h3>
                    <button
                      onClick={handleClosePanel}
                      className="absolute right-6 text-gray-400 hover:text-white text-2xl leading-none"
                    >
                      ×
                    </button>
                  </div>
                  
                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto px-6">
                    {/* Matchday Range, Teams, Display */}
                    {isCompactFilterLayout ? (
                      <>
                        <div className="pb-4">
                          {renderMatchdayRangeSection(true)}
                        </div>
                        <div className="border-b border-white/8 my-4"></div>
                        {renderTeamSelectionSection(true)}
                        <div className="border-b border-white/8 my-4"></div>
                        <div className="pb-4 mb-6">
                          {renderDisplayOptionsSection(true)}
            </div>
                      </>
                    ) : (
                      <>
                        <div className="pb-6 flex gap-6">
                          {renderMatchdayRangeSection()}
                          <div className="w-px bg-white/8"></div>
                          {renderDisplayOptionsSection()}
                        </div>
                        <div className="border-b border-white/8 mb-6"></div>
                        {renderTeamSelectionSection()}
                      </>
                    )}
                  </div>
                  
                  {/* Bottom Action Bar */}
                  <div className="border-t border-white/8 p-4 flex gap-3">
                    <button
                      onClick={handleReset}
                      className="flex-1 px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md text-white text-sm font-medium hover:bg-[#2a2a2a] transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      onClick={handleApplyFilters}
                      disabled={!isFilterValid()}
                      className={`flex-1 px-4 py-2.5 rounded-md font-semibold text-sm transition-colors ${
                        isFilterValid()
                          ? 'bg-[#f7e479] text-black hover:bg-yellow-400'
                          : 'bg-[#2a2a2a] text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 