import React, { useRef } from 'react';
import { FileText, Download, Printer, Activity, Zap } from 'lucide-react';
import { AIInsightsPanel } from '../visualizations/AIInsightsPanel';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { generateClinicalPDF } from '../../utils/generateClinicalPDF';
import type { PatientDetails } from '../ui/PatientDialog';
import { useTranslation } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

interface ClinicalReportTabProps {
  mlResult: any;
  capturedData?: any[];
  testStatus: 'NOT_STARTED' | 'COMPLETED';
  patientDetails: PatientDetails;
  onStartTest: () => void;
}

const RISK_COLORS: Record<string, string> = {
  'Healthy':      '#22c55e',
  'Moderate Risk':'#f59e0b',
  'Severe Risk':  '#ef4444',
};

export const ClinicalReportTab: React.FC<ClinicalReportTabProps> = ({ mlResult, capturedData, testStatus, patientDetails, onStartTest }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const reportRef = useRef<HTMLDivElement>(null);

  const exportPDF = () => {
    generateClinicalPDF(capturedData ?? [], mlResult ?? null, patientDetails);
  };

  // Downsample to at most 300 points for chart performance
  const stride = Math.max(1, Math.floor((capturedData?.length || 1) / 300));
  const chartData = (capturedData || [])
    .filter((_, i) => i % stride === 0)
    .map((d, i) => ({
      time: i,
      leftPressure:  d?.leftLeg?.pressure?.heel  ?? 0,
      rightPressure: d?.rightLeg?.pressure?.heel ?? 0,
      leftEMG:       d?.leftLeg?.quadEMG          ?? 0,
      rightEMG:      d?.rightLeg?.quadEMG         ?? 0,
    }));

  const riskClass   = mlResult?.risk_class ?? 'Unknown';
  const confidence  = Math.round((mlResult?.risk_confidence ?? 0) * 100);
  const riskColor   = RISK_COLORS[riskClass] ?? '#94a3b8';

  return (
    <div className="flex flex-col h-full gap-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-3">
            <FileText className="w-6 h-6 text-red-500" />
            {t('report.title')}
          </h2>
          <p className="text-slate-500 dark:text-neutral-400 mt-1 text-sm">{t('report.subtitle')}</p>
        </div>
        {testStatus === 'COMPLETED' && (
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-400 rounded-lg transition-colors border border-slate-200 dark:border-neutral-700 text-sm font-medium shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" /> {t('report.print')}
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)] text-sm font-medium cursor-pointer"
            >
              <Download className="w-4 h-4" /> {t('report.export')}
            </button>
          </div>
        )}
      </div>

      {testStatus === 'NOT_STARTED' ? (
        <div className="flex flex-col items-center justify-center h-[600px] glass-panel border-dashed border-slate-300 dark:border-neutral-700 bg-white/40 dark:bg-neutral-900/20 text-center rounded-xl">
          <FileText className="w-16 h-16 text-slate-400 dark:text-neutral-700 mb-4" />
          <h2 className="text-xl font-bold text-slate-700 dark:text-neutral-400 mb-2">{t('report.no_report')}</h2>
          <p className="text-slate-500 mb-6 max-w-md">{t('report.no_report_desc')}</p>
          <button
            onClick={onStartTest}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)] font-bold cursor-pointer"
          >
            {t('report.start_test')}
          </button>
        </div>
      ) : (
        <div ref={reportRef} className="flex flex-col gap-6 bg-white dark:bg-neutral-950 p-6 rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm dark:shadow-none transition-colors duration-200">

          {/* Risk Badge */}
          {mlResult && (
            <div className="flex items-center gap-4 p-4 rounded-xl border" style={{ borderColor: riskColor + '44', background: riskColor + '11' }}>
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: riskColor }} />
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-widest">{t('report.risk_class')}</p>
                <p className="text-2xl font-bold" style={{ color: riskColor }}>{riskClass}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-neutral-400">{t('report.confidence')}</p>
                <p className="text-xl font-bold text-neutral-100">{confidence}%</p>
              </div>
            </div>
          )}

          {/* AI Insights + Physician Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AIInsightsPanel insight={
              mlResult ? {
                primaryObservation: `Detected Class: ${riskClass} (Confidence: ${confidence}%)`,
                detectedAnomalies: ['Pressure asymmetry', 'Altered EMG amplitude'],
                recommendation: mlResult?.insight,
                evidence: [{ id: 'BM25-SEARCH', title: `Query: ${mlResult?.query ?? 'N/A'}`, url: '#' }]
              } : null
            } />
            <div className="glass-panel p-6 flex flex-col border border-slate-200 dark:border-neutral-800/50 bg-slate-50/50 dark:bg-black/40 rounded-xl">
              <h3 className="text-lg font-bold text-slate-800 dark:text-neutral-100 mb-4 border-b border-slate-200 dark:border-neutral-800 pb-2">{t('report.physician_notes')}</h3>
              <textarea
                className="flex-1 min-h-[120px] bg-white dark:bg-black/50 border border-slate-200 dark:border-neutral-800 rounded-lg p-4 text-slate-800 dark:text-neutral-300 resize-none focus:outline-none focus:border-red-500/50 shadow-inner"
                placeholder={t('report.notes_placeholder')}
              />
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Pressure Chart */}
            <div className="glass-panel p-6 rounded-xl border border-slate-200 dark:border-neutral-800/50 bg-white/70 dark:bg-neutral-900/40">
              <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-300 mb-1 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" /> {t('report.heel_pressure')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-500 mb-4">{chartData.length} {t('report.samples')}</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gLeft" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gRight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e2e8f0"} />
                    <XAxis dataKey="time" hide />
                    <YAxis stroke={isDark ? "#4b5563" : "#94a3b8"} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: isDark ? '#0a0a0a' : '#ffffff', 
                        borderColor: isDark ? '#1f2937' : '#e2e8f0', 
                        borderRadius: '8px', 
                        fontSize: '12px',
                        color: isDark ? '#f8fafc' : '#0f172a',
                        boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.08)'
                      }}
                      labelFormatter={() => ''}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Area isAnimationActive={false} type="monotone" dataKey="leftPressure"  name="Left (FSR)" stroke="#3b82f6" fill="url(#gLeft)"  strokeWidth={2} dot={false} />
                    <Area isAnimationActive={false} type="monotone" dataKey="rightPressure" name="Right (FSR)" stroke="#f59e0b" fill="url(#gRight)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* EMG Chart */}
            <div className="glass-panel p-6 rounded-xl border border-slate-200 dark:border-neutral-800/50 bg-white/70 dark:bg-neutral-900/40">
              <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-300 mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> {t('report.quad_emg')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-500 mb-4">{chartData.length} {t('report.samples')}</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gLeftEmg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gRightEmg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1f2937" : "#e2e8f0"} />
                    <XAxis dataKey="time" hide />
                    <YAxis stroke={isDark ? "#4b5563" : "#94a3b8"} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: isDark ? '#0a0a0a' : '#ffffff', 
                        borderColor: isDark ? '#1f2937' : '#e2e8f0', 
                        borderRadius: '8px', 
                        fontSize: '12px',
                        color: isDark ? '#f8fafc' : '#0f172a',
                        boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.08)'
                      }}
                      labelFormatter={() => ''}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Area isAnimationActive={false} type="monotone" dataKey="leftEMG"  name="Left (EMG)" stroke="#3b82f6" fill="url(#gLeftEmg)"  strokeWidth={2} dot={false} />
                    <Area isAnimationActive={false} type="monotone" dataKey="rightEMG" name="Right (EMG)" stroke="#f59e0b" fill="url(#gRightEmg)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-slate-500 dark:text-neutral-600 border-t border-slate-200 dark:border-neutral-800 pt-4 flex justify-between">
            <span>{t('report.footer')}</span>
            <span>{new Date().toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};
