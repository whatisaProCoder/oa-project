import React from 'react';
import type { AIInsight } from '../../types';
import { Brain, FileText, Activity } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

interface AIInsightsPanelProps {
  insight: AIInsight | null;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ insight }) => {
  const { t } = useTranslation();
  
  // Mock data if none provided
  const i = insight || {
    primaryObservation: 'Left plantar loading is consistently higher than right during stance phase, with delayed toe-off.',
    detectedAnomalies: [
      'Pressure asymmetry (>14%)',
      'Increased gait variability',
      'Right knee valgus angle'
    ],
    recommendation: 'Recommend clinical evaluation for potential unilateral medial compartment loading. Consider offloading orthotics.',
    evidence: [
      { id: 'PMID:3129841', title: 'Gait asymmetry in early knee osteoarthritis', url: '#' },
      { id: 'PMID:4910292', title: 'Plantar pressure distribution as a biomarker', url: '#' }
    ],
    shapExplanations: [
      { feature: 'knee_variance', impact: 0.85 },
      { feature: 'pressure_asymmetry', impact: 0.62 },
      { feature: 'emg_amplitude', impact: -0.45 }
    ]
  };

  if (!insight) {
    return (
      <div className="glass-panel rounded-xl p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
        <Brain className="w-10 h-10 text-slate-400 dark:text-slate-700 animate-pulse mb-3" />
        <p className="text-slate-500 font-mono text-sm tracking-widest">{t('assessment.computing')}</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl flex flex-col h-full relative overflow-hidden transition-colors duration-200">
      {/* Background Icon */}
      <Brain className="absolute -bottom-10 -right-10 w-64 h-64 text-primary/5 -rotate-12 pointer-events-none" />

      <div className="flex items-center justify-between p-4 border-b border-slate-200/80 dark:border-slate-700/50 bg-slate-100/60 dark:bg-slate-900/30 backdrop-blur-md">
        <h2 className="text-primary text-xs font-bold tracking-[0.2em] flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          {t('assessment.ai_insights')}
        </h2>
        <span className="text-[9px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800">
          Local LLM
        </span>
      </div>
      
      <div className="p-5 space-y-6 flex-1 overflow-y-auto z-10 relative">
        
        {/* Primary Observation */}
        <div>
          <h3 className="text-[10px] text-primary font-bold mb-2 uppercase tracking-widest flex items-center gap-2">
            {t('assessment.primary_observation')}
          </h3>
          <p className="text-sm text-slate-800 dark:text-slate-300 leading-relaxed bg-primary/10 p-3 rounded-lg border border-primary/20 shadow-[inset_0_0_10px_rgba(255,51,51,0.05)]">
            {i.primaryObservation}
          </p>
        </div>

        {/* Anomalies */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <Activity className="w-3 h-3 text-danger" />
            {t('assessment.key_anomalies')}
          </h3>
          <ul className="space-y-2">
            {i.detectedAnomalies.map((anomaly: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="text-warning mt-1">•</span>
                {anomaly}
              </li>
            ))}
          </ul>
        </div>

        {/* SHAP XAI Drivers */}
        {i.shapExplanations && i.shapExplanations.length > 0 && (
          <div>
            <h3 className="text-[10px] text-accent font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
              <Brain className="w-3 h-3" />
              Edge XAI Risk Drivers (SHAP)
            </h3>
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-200 dark:border-slate-700/30">
              {i.shapExplanations.map((exp: any, idx: number) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-600 dark:text-slate-400">{exp.feature}</span>
                    <span className={exp.impact > 0 ? "text-danger" : "text-success"}>
                      {exp.impact > 0 ? '+' : ''}{exp.impact.toFixed(3)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-300 dark:border-slate-700/50">
                    <div 
                       className={`h-full ${exp.impact > 0 ? 'bg-danger shadow-neon-red' : 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} 
                       style={{ width: `${Math.min(Math.abs(exp.impact) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold tracking-[0.2em] text-slate-500 flex items-center gap-2">
            <FileText className="w-3 h-3" />
            {t('assessment.supporting_evidence')}
          </h3>
          <div className="space-y-2">
            {i.evidence.map((ev, idx) => (
              <a key={idx} href={ev.url} className="block p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors">
                <div className="text-[10px] text-primary mb-1 font-mono">{ev.id}</div>
                <div className="text-xs text-slate-700 dark:text-slate-300 line-clamp-1">{ev.title}</div>
              </a>
            ))}
          </div>
        </div>

        {/* Recommendation */}
        <div>
          <h3 className="text-[10px] text-slate-500 font-bold mb-2 uppercase tracking-widest">
            {t('assessment.clinical_recommendation')}
          </h3>
          <p className="text-sm text-slate-700 dark:text-slate-400 italic">
            "{i.recommendation}"
          </p>
        </div>

      </div>

      <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-700/50 text-center backdrop-blur-md">
        <p className="text-[9px] text-slate-500 uppercase tracking-widest">
          {t('assessment.warning')}
        </p>
      </div>
    </div>
  );
};
