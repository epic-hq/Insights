/**
 * JourneyBackground - Stars, mountains, and terrain SVGs for the journey map.
 * Uses absolute positioning within the journey container (not fixed).
 */

import { useMemo } from "react";

function Stars() {
  const stars = useMemo(() => {
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 60}%`,
      delay: `${Math.random() * 3}s`,
      size: `${Math.random() * 2 + 1}px`,
    }));
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {stars.map((star) => (
        <span
          key={star.id}
          className="absolute rounded-full bg-white animate-[twinkle_3s_ease-in-out_infinite]"
          style={{
            left: star.left,
            top: star.top,
            animationDelay: star.delay,
            width: star.size,
            height: star.size,
          }}
        />
      ))}
    </div>
  );
}

function Mountains() {
  return (
    <svg
      className="pointer-events-none absolute bottom-[60px] left-0 right-0 z-0 h-[300px]"
      viewBox="0 0 1920 300"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Far mountains */}
      <path
        d="M0,300 L0,180 Q120,80 240,150 Q360,60 480,130 Q600,40 720,120 Q840,30 960,100 Q1080,20 1200,90 Q1320,50 1440,110 Q1560,30 1680,100 Q1800,60 1920,140 L1920,300Z"
        fill="rgba(30, 41, 59, 0.5)"
      />
      {/* Near mountains */}
      <path
        d="M0,300 L0,220 Q160,140 320,200 Q480,120 640,180 Q800,100 960,170 Q1120,90 1280,160 Q1440,110 1600,180 Q1760,130 1920,200 L1920,300Z"
        fill="rgba(30, 41, 59, 0.8)"
      />
      {/* Summit flag */}
      <g transform="translate(960, 80)">
        <line x1="0" y1="0" x2="0" y2="-30" stroke="#fbbf24" strokeWidth="2" />
        <path d="M0,-30 L18,-24 L0,-18Z" fill="#f59e0b" opacity="0.8" />
        <text
          x="24"
          y="-20"
          fill="#fbbf24"
          fontSize="10"
          fontWeight="700"
          fontFamily="Inter, sans-serif"
          opacity="0.6"
        >
          SUMMIT
        </text>
      </g>
    </svg>
  );
}

function Terrain() {
  return (
    <svg
      className="pointer-events-none absolute bottom-0 left-0 right-0 z-0 h-[200px]"
      viewBox="0 0 1920 200"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <path
        d="M0,60 Q240,20 480,40 Q720,60 960,30 Q1200,50 1440,35 Q1680,55 1920,45 L1920,200 L0,200Z"
        fill="url(#ground)"
      />
      {/* Grass tufts */}
      <g opacity="0.15">
        <path
          d="M100,55 Q105,30 110,55"
          stroke="#22c55e"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M300,40 Q305,15 310,40"
          stroke="#22c55e"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M500,45 Q505,20 510,45"
          stroke="#22c55e"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M700,50 Q705,25 710,50"
          stroke="#22c55e"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M900,35 Q905,10 910,35"
          stroke="#22c55e"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M1100,42 Q1105,17 1110,42"
          stroke="#22c55e"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M1300,38 Q1305,13 1310,38"
          stroke="#22c55e"
          strokeWidth="2"
          fill="none"
        />
        <path
          d="M1500,48 Q1505,23 1510,48"
          stroke="#22c55e"
          strokeWidth="2"
          fill="none"
        />
      </g>
    </svg>
  );
}

export function JourneyBackground() {
  return (
    <>
      <Stars />
      <Mountains />
      <Terrain />
    </>
  );
}
