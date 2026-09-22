import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from '../../context/ThemeContext';

interface SignalChartProps {
  dataPoint: number | undefined;
  title: string;
  color: string;
  yMin?: number;
  yMax?: number;
  unit?: string;
  windowSize?: number;
  precision?: number;
}

interface ChartData {
  time: number;
  value: number;
}

export const SignalChart: React.FC<SignalChartProps> = ({ 
  dataPoint, 
  title, 
  color, 
  yMin = 0, 
  yMax = 1024,
  unit = '',
  windowSize = 50,
  precision
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [history, setHistory] = useState<ChartData[]>([]);

  useEffect(() => {
    if (dataPoint === undefined) return;
    
    setHistory(prev => {
      const next = [...prev, { time: Date.now(), value: dataPoint }];
      if (next.length > windowSize) {
        return next.slice(next.length - windowSize);
      }
      return next;
    });
  }, [dataPoint, windowSize]);

  return (
    <div className="w-full h-full min-h-[120px] flex flex-col bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800/80 p-3 shadow-sm dark:shadow-none transition-colors duration-200">
      <div className="flex justify-between items-end mb-2 px-1">
        <h3 className="text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-widest">{title}</h3>
        <span className="text-xs font-mono font-medium" style={{ color }}>
          {dataPoint !== undefined 
            ? (precision !== undefined ? dataPoint.toFixed(precision) : Math.round(dataPoint)) 
            : '--'}{unit}
        </span>
      </div>
      <div className="flex-1 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <YAxis domain={[yMin, yMax]} hide />
            <XAxis dataKey="time" hide />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: isDark ? '#18181b' : '#ffffff', 
                border: isDark ? '1px solid #27272a' : '1px solid #e2e8f0', 
                borderRadius: '8px',
                boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.08)'
              }}
              labelStyle={{ display: 'none' }}
              itemStyle={{ color: color, fontSize: '12px', fontFamily: 'monospace' }}
              formatter={(val: any) => {
                const numericVal = typeof val === 'number' ? val : (Array.isArray(val) && typeof val[0] === 'number' ? val[0] : 0);
                const displayVal = precision !== undefined ? numericVal.toFixed(precision) : Math.round(numericVal);
                return [`${displayVal}${unit}`, title];
              }}
              isAnimationActive={false}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              strokeWidth={2}
              dot={false}
              isAnimationActive={false} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
