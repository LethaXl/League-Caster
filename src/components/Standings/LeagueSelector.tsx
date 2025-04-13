import { League } from '@/types/standings';
import { useState, useEffect } from 'react';
import Image from 'next/image';

interface LeagueSelectorProps {
  onLeagueSelect: (leagueCode: string) => void;
}

const leagues: League[] = [
  { code: 'PL', name: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', image: '/premierleague.png' },
  { code: 'BL1', name: 'Bundesliga', country: 'Germany', flag: '🇩🇪', image: '/bundesliga.png' },
  { code: 'FL1', name: 'Ligue 1', country: 'France', flag: '🇫🇷', image: '/ligue1.png' },
  { code: 'SA', name: 'Serie A', country: 'Italy', flag: '🇮🇹', image: '/seriea.png' },
  { code: 'PD', name: 'La Liga', country: 'Spain', flag: '🇪🇸', image: '/laliga.png' },
];

export default function LeagueSelector({ onLeagueSelect }: LeagueSelectorProps) {
  const [activeIndex, setActiveIndex] = useState(2);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [rotation, setRotation] = useState(0);

  // Carousel configuration - reduced sizes
  const RADIUS_X = 300;
  const RADIUS_Y = 40;
  const Y_OFFSET = -20;
  const MIN_OPACITY = 0.2;
  const ITEM_COUNT = leagues.length;
  const ANGLE_STEP = (2 * Math.PI) / ITEM_COUNT;

  const handlePrevious = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setRotation(prev => prev + ANGLE_STEP);
    setActiveIndex((prev) => (prev === 0 ? leagues.length - 1 : prev - 1));
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const handleNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setRotation(prev => prev - ANGLE_STEP);
    setActiveIndex((prev) => (prev === leagues.length - 1 ? 0 : prev + 1));
    setTimeout(() => setIsTransitioning(false), 500);
  };

  const getItemStyle = (index: number) => {
    const angle = rotation + (index * ANGLE_STEP);
    const x = Math.sin(angle) * RADIUS_X;
    const z = Math.cos(angle) * RADIUS_X;
    
    // Modified Y position calculation to ensure symmetrical height for side logos
    const yOffset = Math.abs(Math.cos(angle)) < 0.5 ? RADIUS_Y : 0;
    const y = Y_OFFSET - yOffset;

    // Calculate opacity based on z position
    const opacity = Math.max(
      MIN_OPACITY,
      (z + RADIUS_X) / (2 * RADIUS_X)
    );

    // Calculate scale based on z position with enhanced center scale
    const baseScale = 0.5 + (z + RADIUS_X) / (2 * RADIUS_X) * 0.5;
    // Add 20% more scale for center position
    const scale = Math.abs(Math.cos(angle)) > 0.9 ? baseScale * 1.2 : baseScale;

    const zIndex = Math.round(z + RADIUS_X);

    // Return a clean object with all values converted to fixed numbers to avoid hydration errors
    return {
      position: 'absolute' as const,
      transform: `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, ${z.toFixed(0)}px) scale(${scale.toFixed(6)})`,
      opacity: opacity.toFixed(2),
      zIndex,
      transition: 'all 0.5s ease-out',
      transformOrigin: 'center center',
    };
  };

  const handleLogoClick = (index: number, league: League) => {
    // Hardcoded mapping - get the league to the left (subtract 2 in a circular manner)
    const targetIndex = (index - 2 + leagues.length) % leagues.length;
    const targetLeague = leagues[targetIndex];
    
    // Use the code of the target league instead of the clicked one
    onLeagueSelect(targetLeague.code);
  };

  useEffect(() => {
    // This will help ensure consistent rendering after initial load
    const timer = setTimeout(() => {
      setRotation(rotation => rotation + 0.0001); // Tiny change to force re-render
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-[400px] bg-black overflow-hidden">
      {/* Perspective container */}
      <div 
        className="relative w-full h-full"
        style={{
          perspective: '1000px',
          perspectiveOrigin: '50% 50%',
          transformStyle: 'preserve-3d'
        }}
      >
        {/* Carousel container */}
        <div 
          className="absolute w-full h-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {leagues.map((league, index) => {
            const isCenter = index === activeIndex;
            return (
              <div
                key={league.code}
                style={getItemStyle(index)}
                className={`w-[180px] h-[180px] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${isCenter ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={() => isCenter && handleLogoClick(index, league)}
              >
                <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
                  <Image
                    src={league.image}
                    alt={league.name}
                    width={180}
                    height={180}
                    className="w-full h-full object-contain pointer-events-auto"
                    style={{
                      filter: index === activeIndex ? 'drop-shadow(0 0 25px rgba(255, 255, 255, 0.8))' : 'none',
                      zIndex: isCenter ? 50 : 'auto',
                    }}
                    priority
                    onClick={isCenter ? (e) => {
                      e.stopPropagation();
                      handleLogoClick(index, league);
                    } : undefined}
                  />
                  {/* Reflection - reduced size and opacity */}
                  <div
                    className="absolute w-full h-full top-full left-0 transform-gpu scale-y-[-0.15] origin-top opacity-10"
                    style={{
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0.1), transparent)',
                      filter: 'blur(1px)',
                      pointerEvents: 'none',
                    }}
                  >
                    <Image
                      src={league.image}
                      alt=""
                      width={180}
                      height={180}
                      className="w-full h-full object-contain"
                      priority
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add a clickable overlay for the center logo */}
      {leagues.map((league, index) => {
        const isCenter = index === activeIndex;
        if (isCenter) {
          return (
            <div 
              key={`overlay-${league.code}`}
              className="absolute w-[180px] h-[180px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer z-[100]"
              onClick={() => handleLogoClick(index, league)}
              style={{
                pointerEvents: 'auto',
              }}
            />
          );
        }
        return null;
      })}

      {/* Navigation arrows */}
      <button
        onClick={handlePrevious}
        className="absolute left-[10%] top-1/2 transform -translate-y-1/2 text-white/80 hover:text-white transition-colors z-50"
        disabled={isTransitioning}
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={handleNext}
        className="absolute right-[10%] top-1/2 transform -translate-y-1/2 text-white/80 hover:text-white transition-colors z-50"
        disabled={isTransitioning}
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
} 