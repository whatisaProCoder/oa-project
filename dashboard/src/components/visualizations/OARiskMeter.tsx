import React from 'react';
import { Activity, Brain } from 'lucide-react';
import type { RiskAssessment } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';

interface OARiskMeterProps {
  assessment: RiskAssessment | null;
}

export const OARiskMeter: React.FC<OARiskMeterProps> = ({ assessment }) => {
  const { t } = useTranslation();

  const getBarColor = (impact: number) => {
    if (impact > 75) return 'bg-danger shadow-neon-red';
    if (impact > 50) return 'bg-warning shadow-[0_0_10px_rgba(245,158,11,0.5)]';
    return 'bg-primary shadow-neon-red';
  };

  if (!assessment) {
    return (
      <div className="glass-panel rounded-xl p-6 flex-1 flex flex-col items-center justify-center min-h-[300px]">
        <Brain className="w-12 h-12 text-slate-400 dark:text-slate-700 animate-pulse mb-4" />
        <p className="text-slate-500 font-mono text-sm tracking-widest">{t('assessment.computing')}</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-6 flex-1 flex flex-col h-full">
      <h2 className="text-primary text-xs font-bold tracking-[0.2em] mb-6 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-neon-red"></span>
        {t('assessment.risk_meter')}
      </h2>

      <div className="flex flex-col items-center justify-center flex-1 relative mb-8">
        <div className="relative w-48 h-48 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="96" cy="96" r="88" className="stroke-slate-200 dark:stroke-slate-800/50" strokeWidth="8" fill="none" />
            <circle cx="96" cy="96" r="88" 
              className={`transition-all duration-1000 ${
                assessment.level === 'HIGH' ? 'stroke-danger shadow-neon-red' : 
                assessment.level === 'MODERATE' ? 'stroke-warning' : 'stroke-success'
              }`}
              strokeWidth="8" fill="none"
              strokeDasharray={`${(assessment.score / 100) * 553} 553`}
            />
          </svg>
          <div className="flex flex-col items-center z-10">
            <span className={`text-5xl font-black tracking-tighter ${
              assessment.level === 'HIGH' ? 'text-danger drop-shadow-[0_0_15px_rgba(255,51,51,0.5)]' : 
              assessment.level === 'MODERATE' ? 'text-warning' : 'text-success'
            }`}>
              {assessment.score}
            </span>
            <span className="text-slate-500 text-[10px] font-bold tracking-widest uppercase mt-1">{t('assessment.overall_score')}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 mt-auto">
        <h3 className="text-[10px] font-bold tracking-[0.2em] text-slate-500 flex items-center gap-2">
          <Activity className="w-3 h-3" />
          {t('assessment.risk_factors')}
        </h3>
        <div className="space-y-3">
          {assessment.factors.map((factor, idx) => (
            <div key={idx} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium">{factor.name}</span>
                <span className="text-primary font-mono">{factor.impact}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800/50 h-1.5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700/30">
                <div className={`h-full rounded-full transition-all duration-1000 ${getBarColor(factor.impact)}`} style={{ width: `${factor.impact}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
