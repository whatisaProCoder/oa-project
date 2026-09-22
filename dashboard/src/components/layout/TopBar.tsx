import React, { useState } from 'react';
import { Activity, Wifi, Clock, User, Crosshair, Sun, Moon } from 'lucide-react';
import type { DeviceStatus, AssessmentSession } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';
import { LanguageSelect } from '../ui/LanguageSelect';
import { useTheme } from '../../context/ThemeContext';

interface TopBarProps {
  session: AssessmentSession;
  deviceStatus: DeviceStatus;
  isLive: boolean;
  onToggleLive: () => void;
  onStartAssessment?: () => void;
  onPatientClick?: () => void;
  onCalibrate?: () => void;
  isCalibrated?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  session, 
  deviceStatus, 
  isLive, 
  onToggleLive, 
  onStartAssessment, 
  onPatientClick,
  onCalibrate,
  isCalibrated 
}) => {
  const { t, language, setLanguage } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const allConnected = deviceStatus.nodes.every(n => n.status === 'ONLINE');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  return (
    <header className="h-16 bg-surface/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/50 flex items-center justify-between px-4 lg:px-6 shrink-0 relative z-[100] transition-colors duration-200">
      
      {toastMessage && (
        <div className="absolute top-14 right-4 sm:hidden bg-white/95 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 text-xs px-3 py-1.5 rounded shadow-glass z-50 border border-slate-200 dark:border-slate-700">
          {toastMessage}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 shadow-neon-cyan">
          <Activity className="w-5 h-5 text-primary" />
        </div>
        <div className="hidden sm:block">
          <h1 className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent font-bold tracking-wide text-sm">{t('topbar.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs tracking-wider font-medium">{t('topbar.subtitle')}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-5">
        <LanguageSelect value={language} onChange={setLanguage} />

        <button 
          onClick={toggleTheme}
          title={theme === 'dark' ? t('topbar.theme_light') : t('topbar.theme_dark')}
          className="p-2 rounded-full glass-button cursor-pointer group flex items-center justify-center transition-all duration-300"
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600 group-hover:-rotate-12 transition-transform duration-300" />
          )}
        </button>

        <button 
          onClick={onPatientClick}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-button cursor-pointer group"
        >
          <User className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
          <span className="hidden lg:inline text-sm text-slate-700 dark:text-slate-300 font-medium">{session.patientId}</span>
        </button>

        <button 
          onClick={() => showToast(t('topbar.session_start'))}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass-button"
        >
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="hidden lg:inline text-sm text-slate-700 dark:text-slate-300 font-mono">
            {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </button>

        <button 
          onClick={() => showToast(allConnected ? t('topbar.system_online') : t('topbar.node_offline'))}
          className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${allConnected ? 'bg-success/10 border-success/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-danger/10 border-danger/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]'}`}
        >
          <Wifi className={`w-4 h-4 ${allConnected ? 'text-success' : 'text-danger'}`} />
          <span className={`hidden lg:inline text-sm font-medium ${allConnected ? 'text-success' : 'text-danger'}`}>
            {allConnected ? t('topbar.system_online') : t('topbar.node_offline')}
          </span>
        </button>

        {onCalibrate && (
          <button
            onClick={onCalibrate}
            title="Stand upright still and click to calibrate neutral 0° baseline"
            className={`px-3 py-1.5 rounded-full border text-xs font-bold tracking-wider transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
              isCalibrated
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'glass-button text-slate-300 hover:text-white hover:border-primary/50'
            }`}
          >
            <Crosshair className={`w-3.5 h-3.5 ${isCalibrated ? 'text-emerald-400' : 'text-primary'}`} />
            <span className="hidden sm:inline">{isCalibrated ? 'NEUTRAL SET (0°)' : 'CALIBRATE'}</span>
            <span className="sm:hidden">{isCalibrated ? '0°' : 'CALIB'}</span>
          </button>
        )}

        <button
          onClick={onToggleLive}
          className={`px-3 py-1.5 rounded-full border text-xs font-bold tracking-wider transition-all duration-300 ${
            !isLive 
              ? 'bg-primary/20 border-primary text-primary shadow-neon-cyan animate-pulse-slow' 
              : 'glass-button text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="hidden sm:inline">{!isLive ? t('topbar.live_data') : t('topbar.mock_data')}</span>
          <span className="sm:hidden">{!isLive ? t('topbar.live') : t('topbar.mock')}</span>
        </button>

        {onStartAssessment && (
          <button 
            onClick={onStartAssessment}
            className="sm:ml-4 px-4 py-1.5 bg-primary hover:bg-primary-dark text-slate-950 font-bold text-sm rounded-full transition-all duration-300 flex items-center gap-2 shadow-neon-red hover:shadow-[0_0_20px_rgba(255,51,51,0.6)] hover:scale-105"
          >
            <span className="hidden sm:inline">{t('topbar.start_test')}</span>
            <span className="sm:hidden">{t('topbar.start')}</span>
          </button>
        )}
      </div>
    </header>
  );
};
