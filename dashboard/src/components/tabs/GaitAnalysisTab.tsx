import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

interface GaitAnalysisTabProps {
  isLive?: boolean;
}

const MetricCard = ({ label, value, unit, highlight = false }: { label: string, value: number | string, unit: string, highlight?: boolean }) => (
  <div className={`glass-panel p-6 flex flex-col justify-between ${highlight ? 'border-red-500/50 bg-red-50 dark:bg-red-950/20' : ''}`}>
    <h3 className="text-slate-500 dark:text-neutral-400 text-xs font-semibold tracking-widest uppercase mb-4">{label}</h3>
    <div className="flex items-baseline gap-2">
      <span className={`text-4xl font-light ${highlight ? 'text-red-500 dark:text-red-400' : 'text-slate-900 dark:text-neutral-100'}`}>{value}</span>
      <span className="text-sm font-mono text-slate-500 dark:text-neutral-500">{unit}</span>
    </div>
  </div>
);

export const GaitAnalysisTab: React.FC<GaitAnalysisTabProps> = ({ isLive }) => {
  const { t } = useTranslation();
  
  const [m, setM] = useState({
    strideDurationMs: 1120,
    stanceDurationMs: 680,
    swingDurationMs: 440,
    gaitVariability: 0.02,
    leftSymmetry: 98.0,
    rightSymmetry: 98.0,
  });

  useEffect(() => {
    if (!isLive) return;
    
    // Track start time for cycle synchronization
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const timeElapsed = (Date.now() - startTime) / 1000;
      const cycleTime = timeElapsed % 15;
      const isAnomaly = cycleTime > 12; // 12 seconds normal, 3 seconds anomaly
      
      setM(prev => {
        if (isAnomaly) {
          return {
            strideDurationMs: Math.max(1000, Math.min(1400, prev.strideDurationMs + (Math.random() * 60 - 20))),
            stanceDurationMs: Math.max(600, Math.min(900, prev.stanceDurationMs + (Math.random() * 40 - 10))),
            swingDurationMs: Math.max(300, Math.min(600, prev.swingDurationMs + (Math.random() * 40 - 20))),
            gaitVariability: Math.min(0.28, prev.gaitVariability + 0.08),
            leftSymmetry: Math.max(85, Math.min(100, prev.leftSymmetry + (Math.random() * 2 - 1))),
            rightSymmetry: Math.max(50, prev.rightSymmetry - 8), // Plummets rapidly
          };
        } else {
          return {
            strideDurationMs: Math.max(1100, Math.min(1150, prev.strideDurationMs + (Math.random() * 10 - 5))),
            stanceDurationMs: Math.max(670, Math.min(690, prev.stanceDurationMs + (Math.random() * 4 - 2))),
            swingDurationMs: Math.max(430, Math.min(450, prev.swingDurationMs + (Math.random() * 4 - 2))),
            gaitVariability: Math.max(0.01, prev.gaitVariability - 0.05), // Recovers to near zero
            leftSymmetry: Math.min(99.9, prev.leftSymmetry + 1),
            rightSymmetry: Math.min(99.5, prev.rightSymmetry + 3), // Recovers to near perfect
          };
        }
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [isLive]);

  const asymmetry = Math.abs(m.leftSymmetry - m.rightSymmetry);

  return (
    <div className="flex flex-col h-full gap-6 max-w-5xl mx-auto w-full">
      <div className="p-4 bg-white/80 dark:bg-slate-900/60 rounded-xl mb-4 border border-slate-200 dark:border-slate-800 flex items-center shadow-sm dark:shadow-none transition-colors duration-200">
        <h2 className="text-slate-800 dark:text-slate-300 text-sm font-bold tracking-wider">{t('gait.title')}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <MetricCard label={t('gait.stride_duration')} value={Math.round(m.strideDurationMs)} unit="ms" />
        <MetricCard label={t('gait.stance_phase')} value={Math.round(m.stanceDurationMs)} unit="ms" />
        <MetricCard label={t('gait.swing_phase')} value={Math.round(m.swingDurationMs)} unit="ms" />
      </div>

      <div className="glass-panel p-8 mt-4">
        <h3 className="text-slate-600 dark:text-slate-400 text-sm font-semibold tracking-widest uppercase mb-8 text-center">{t('gait.bilateral_symmetry')}</h3>
        
        <div className="flex flex-col sm:flex-row justify-between items-center max-w-2xl mx-auto gap-4 sm:gap-0">
          <div className="text-center flex-1">
            <div className={`text-5xl font-light mb-2 ${m.leftSymmetry >= 90 ? 'text-success' : 'text-danger'}`}>{m.leftSymmetry.toFixed(1)}%</div>
            <div className="text-xs tracking-widest text-slate-500 uppercase">{t('assessment.left_leg')}</div>
          </div>
          
          <div className="w-full sm:w-px h-px sm:h-24 bg-slate-200 dark:bg-neutral-800 my-4 sm:my-0 sm:mx-8"></div>
          
          <div className="text-center flex-1">
            <div className={`text-5xl font-light mb-2 ${asymmetry <= 10 ? 'text-success' : 'text-danger'}`}>{asymmetry.toFixed(1)}%</div>
            <div className="text-xs tracking-widest text-slate-500 uppercase">{t('gait.asymmetry_index')}</div>
          </div>
          
          <div className="w-full sm:w-px h-px sm:h-24 bg-slate-200 dark:bg-neutral-800 my-4 sm:my-0 sm:mx-8"></div>

          <div className="text-center flex-1">
            <div className={`text-5xl font-light mb-2 ${m.rightSymmetry >= 90 ? 'text-success' : 'text-danger'}`}>{m.rightSymmetry.toFixed(1)}%</div>
            <div className="text-xs tracking-widest text-slate-500 uppercase">{t('assessment.right_leg')}</div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
        <MetricCard label={t('gait.gait_variability')} value={(m.gaitVariability * 100).toFixed(1)} unit="%" highlight={m.gaitVariability > 0.1} />
        <MetricCard label={t('gait.loading_asymmetry')} value={asymmetry.toFixed(1)} unit="%" highlight={asymmetry > 10} />
      </div>
    </div>
  );
};
