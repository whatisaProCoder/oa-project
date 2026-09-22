import React from 'react';
import type { FSRData } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface PlantarHeatmapProps {
  data: FSRData | undefined;
  isLeft: boolean;
}

// Map 0-1023 ADC values to an opacity 0.2 - 1.0
const getOpacity = (val: number | undefined) => {
  if (val === undefined) return 0.2;
  return 0.2 + (val / 1023) * 0.8;
};

// Map 0-1023 to a color shift (Blue -> Yellow -> Red)
// For simplicity in SVG, we'll just use scale transformation or opacity of a pre-colored radial gradient.
export const PlantarHeatmap: React.FC<PlantarHeatmapProps> = ({ data, isLeft }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const heelO = getOpacity(data?.heel);
  const m1O = getOpacity(data?.m1);
  const m5O = getOpacity(data?.m5);
  const toeO = getOpacity(data?.toe);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800/80 p-4 shadow-sm dark:shadow-none transition-colors duration-200">
      <div className="text-slate-500 dark:text-neutral-500 text-[10px] font-bold tracking-widest uppercase absolute top-3 left-4">
        {isLeft ? 'Left Foot' : 'Right Foot'}
      </div>
      
      {/* SVG Footprint Map */}
      <svg viewBox="0 0 100 200" className="w-full h-full max-w-[120px]" style={{ transform: isLeft ? 'scaleX(-1)' : 'none' }}>
        <defs>
          <radialGradient id="heat" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="1" />
            <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Abstract Foot Outline */}
        <path 
          d="M 50 190 C 20 190, 30 140, 35 110 C 40 80, 20 60, 25 30 C 30 0, 70 0, 75 30 C 80 60, 60 80, 65 110 C 70 140, 80 190, 50 190 Z" 
          fill="transparent" 
          stroke={isDark ? "#3f3f46" : "#cbd5e1"} 
          strokeWidth="2" 
          strokeDasharray="4 4"
        />

        {/* Sensor Points (Mirrored structurally based on isLeft toggle on SVG transform) */}
        
        {/* Heel */}
        <circle cx="50" cy="160" r="20" fill="url(#heat)" opacity={heelO} style={{ transition: 'opacity 0.1s ease-out' }} />
        <circle cx="50" cy="160" r="2" fill={isDark ? "#d4d4d8" : "#94a3b8"} />

        {/* Outer Ball (M5) */}
        <circle cx="35" cy="80" r="15" fill="url(#heat)" opacity={m5O} style={{ transition: 'opacity 0.1s ease-out' }} />
        <circle cx="35" cy="80" r="2" fill="#d4d4d8" />

        {/* Inner Ball (M1) */}
        <circle cx="70" cy="70" r="18" fill="url(#heat)" opacity={m1O} style={{ transition: 'opacity 0.1s ease-out' }} />
        <circle cx="70" cy="70" r="2" fill="#d4d4d8" />

        {/* Toe */}
        <circle cx="65" cy="25" r="15" fill="url(#heat)" opacity={toeO} style={{ transition: 'opacity 0.1s ease-out' }} />
        <circle cx="65" cy="25" r="2" fill="#d4d4d8" />

      </svg>
      
      {/* Live Data Text Overlay */}
      <div className="absolute bottom-3 left-0 w-full px-4 flex justify-between text-[10px] font-mono text-neutral-400">
        <div className="flex flex-col">
          <span>H: {Math.round(data?.heel || 0)}</span>
          <span>M5: {Math.round(data?.m5 || 0)}</span>
        </div>
        <div className="flex flex-col text-right">
          <span>T: {Math.round(data?.toe || 0)}</span>
          <span>M1: {Math.round(data?.m1 || 0)}</span>
        </div>
      </div>
    </div>
  );
};
