
import React from 'react';
import { LayoutDashboard, Activity, HeartPulse, FileText, Settings, Stethoscope } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

export type TabId = 'ASSESSMENT' | 'LIVE' | 'GAIT' | 'REPORT' | 'DIAGNOSTICS';

interface NavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();

  const navItems: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'ASSESSMENT', label: t('nav.assessment'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'LIVE', label: t('nav.live_feeds'), icon: <Activity className="w-4 h-4" /> },
    { id: 'GAIT', label: t('nav.gait_analysis'), icon: <HeartPulse className="w-4 h-4" /> },
    { id: 'REPORT', label: t('nav.clinical_report'), icon: <FileText className="w-4 h-4" /> },
    { id: 'DIAGNOSTICS', label: t('nav.diagnostics'), icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-full lg:w-64 bg-surface/80 backdrop-blur-md border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-slate-800/50 flex flex-row lg:flex-col p-2 lg:p-4 gap-2 shrink-0 overflow-x-auto lg:overflow-visible no-scrollbar z-40 transition-colors duration-200">
      <div className="mb-6 px-4 hidden lg:flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <Stethoscope className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold tracking-widest uppercase text-slate-500 dark:text-slate-400">Workspace</span>
      </div>
      
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onTabChange(item.id)}
          className={`group flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-sm font-medium transition-all duration-300 text-left whitespace-nowrap border cursor-pointer ${
            activeTab === item.id 
              ? 'bg-primary/10 text-primary border-l-2 border-l-primary border-y-transparent border-r-transparent font-semibold shadow-[inset_4px_0_15px_rgba(255,51,51,0.1)]' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-200 border-transparent hover:border-slate-200 dark:hover:border-slate-700/50'
          }`}
        >
          {item.icon}
          <span className="hidden sm:inline">{item.label}</span>
        </button>
      ))}
    </aside>
  );
};
