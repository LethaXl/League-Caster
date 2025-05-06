import { League } from '@/types/standings';
import { useState, useEffect, useRef } from 'react';
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
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isSmallDesktop, setIsSmallDesktop] = useState(false);
  const [isVerySmallScreen, setIsVerySmallScreen] = useState(false);
  const [isMediumSmallScreen, setIsMediumSmallScreen] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  // Detect screen sizes
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      setIsSmallDesktop(width >= 1024 && width < 1280);
      setIsVerySmallScreen(width < 370);
      setIsMediumSmallScreen(width >= 320 && width <= 450);
    };
    
    // Check on mount and whenever window is resized
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Carousel configuration based on screen size
  const getCarouselParams = () => {
    if (isVerySmallScreen) {
      return {
        RADIUS_X: 110,
        RADIUS_Y: 15,
        Y_OFFSET: -5,
        LOGO_SIZE: 90,
      };
    } else if (isMobile) {
      return {
        RADIUS_X: 150,
        RADIUS_Y: 20,
        Y_OFFSET: -10,
        LOGO_SIZE: 120,
      };
    }
    return {
      RADIUS_X: 300,
      RADIUS_Y: 40,
      Y_OFFSET: -20,
      LOGO_SIZE: 180,
    };
  };

  const { RADIUS_X, RADIUS_Y, Y_OFFSET, LOGO_SIZE } = getCarouselParams();
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

  const handleLogoClick = (index: number) => {
    // Hardcoded mapping - get the league to the left (subtract 2 in a circular manner)
    // This should be consistent for both mobile and desktop
    const targetIndex = (index - 2 + leagues.length) % leagues.length;
    const targetLeague = leagues[targetIndex];
    
    // Use the code of the target league instead of the clicked one
    onLeagueSelect(targetLeague.code);
  };

  // Touch handlers for swipe functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartX.current;
    
    // Threshold - require at least 50px of swipe distance
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        // Swipe right - go to previous
        handlePrevious();
      } else {
        // Swipe left - go to next
        handleNext();
      }
    }
  };

  useEffect(() => {
    // This will help ensure consistent rendering after initial load
    const timer = setTimeout(() => {
      setRotation(rotation => rotation + 0.0001); // Tiny change to force re-render
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Fixed container styles for medium-small screens
  const containerStyle = isMediumSmallScreen 
    ? { 
        marginTop: 'calc(30vh - 125px)' // Moved higher (30vh instead of 50vh)
      } 
    : {};

  // Arrow position based on screen size
  const getArrowPosition = () => {
    if (isMobile) {
      return 'bottom-[15%]';
    } else if (isTablet) {
      return 'bottom-[25%]';
    } else if (isSmallDesktop) {
      return 'bottom-[25%]';
    } else {
      return 'top-1/2 transform -translate-y-1/2';
    }
  };

  const arrowPosition = getArrowPosition();

  return (
    <div className="relative w-full" style={containerStyle}>
      <div 
        className="relative w-full h-[200px] xs:h-[250px] sm:h-[300px] md:h-[400px] bg-black overflow-hidden"
        ref={carouselRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
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
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                  onClick={() => isCenter && handleLogoClick(index)}
                >
                  <div 
                    className="relative w-full h-full" 
                    style={{ 
                      transformStyle: 'preserve-3d',
                      width: `${LOGO_SIZE}px`,
                      height: `${LOGO_SIZE}px`,
                    }}
                  >
                    <Image
                      src={league.image}
                      alt={league.name}
                      width={LOGO_SIZE}
                      height={LOGO_SIZE}
                      className="w-full h-full object-contain pointer-events-auto"
                      style={{
                        filter: index === activeIndex ? 'drop-shadow(0 0 25px rgba(255, 255, 255, 0.8))' : 'none',
                        zIndex: isCenter ? 50 : 'auto',
                      }}
                      priority
                      onClick={isCenter ? (e) => {
                        e.stopPropagation();
                        handleLogoClick(index);
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
                        width={LOGO_SIZE}
                        height={LOGO_SIZE}
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
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer z-[100]"
                onClick={() => handleLogoClick(index)}
                style={{
                  pointerEvents: 'auto',
                  width: `${LOGO_SIZE}px`,
                  height: `${LOGO_SIZE}px`,
                }}
              />
            );
          }
          return null;
        })}

        {/* Navigation arrows - positioned differently based on screen size */}
        <button
          onClick={handlePrevious}
          className={`absolute left-1 xs:left-2 sm:left-[5%] md:left-[10%] ${arrowPosition} text-white/80 hover:text-white transition-colors z-50 p-2 sm:p-3`}
          disabled={isTransitioning}
          aria-label="Previous league"
        >
          <svg className="w-5 h-5 xs:w-6 xs:h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={handleNext}
          className={`absolute right-1 xs:right-2 sm:right-[5%] md:right-[10%] ${arrowPosition} text-white/80 hover:text-white transition-colors z-50 p-2 sm:p-3`}
          disabled={isTransitioning}
          aria-label="Next league"
        >
          <svg className="w-5 h-5 xs:w-6 xs:h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
} 