import React from 'react';
import { Settings, Wifi, Battery, Activity } from 'lucide-react';
import type { DeviceStatus, CalibrationOffsets } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';

interface DeviceDiagnosticsTabProps {
  deviceStatus: DeviceStatus;
  calibrationOffsets?: CalibrationOffsets | null;
  onCalibrate?: () => void;
  onResetCalibration?: () => void;
}

export const DeviceDiagnosticsTab: React.FC<DeviceDiagnosticsTabProps> = ({ 
  deviceStatus,
}) => {
  const { t } = useTranslation();

  const avgBattery = deviceStatus.nodes.length 
    ? Math.round(deviceStatus.nodes.reduce((sum, n) => sum + n.batteryLevel, 0) / deviceStatus.nodes.length)
    : 0;

  return (
    <div className="flex flex-col h-full gap-6 max-w-5xl mx-auto w-full">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-3">
          <Settings className="w-6 h-6 text-red-500" />
          {t('diag.title')}
        </h2>
        <p className="text-slate-500 dark:text-neutral-400 mt-1 text-sm">{t('diag.subtitle')}</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 border border-slate-200 dark:border-neutral-800/50 bg-white/70 dark:bg-black/40 rounded-xl shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3 mb-2">
            <Wifi className="w-5 h-5 text-red-500 dark:text-red-400" />
            <h3 className="text-sm font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">{t('diag.network')}</h3>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-neutral-100">{deviceStatus.network}</div>
          <p className="text-xs text-slate-500 dark:text-neutral-500 mt-1">{deviceStatus.packetsPerSecond} {t('diag.packets')}</p>
        </div>
        
        <div className="glass-panel p-6 border border-slate-200 dark:border-neutral-800/50 bg-white/70 dark:bg-black/40 rounded-xl shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="text-sm font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">{t('diag.health')}</h3>
          </div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">{t('diag.optimal')}</div>
          <p className="text-xs text-slate-500 dark:text-neutral-500 mt-1">{t('diag.health_desc')}</p>
        </div>
        
        <div className="glass-panel p-6 border border-slate-200 dark:border-neutral-800/50 bg-white/70 dark:bg-black/40 rounded-xl shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3 mb-2">
            <Battery className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
            <h3 className="text-sm font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">{t('diag.power')}</h3>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-neutral-100">{avgBattery}%</div>
          <p className="text-xs text-slate-500 dark:text-neutral-500 mt-1">{t('diag.power_desc')}</p>
        </div>
      </div>


      <div className="glass-panel flex-1 min-h-[400px] overflow-hidden flex flex-col p-6 border border-slate-200 dark:border-neutral-800/50 bg-white/70 dark:bg-black/40 rounded-xl shadow-sm dark:shadow-none">
        <h3 className="text-lg font-bold text-slate-900 dark:text-neutral-100 mb-4 border-b border-slate-200 dark:border-neutral-800 pb-2">{t('diag.node_status')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse sm:min-w-[600px]">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500 dark:text-neutral-500 border-b border-slate-200 dark:border-neutral-800/50 whitespace-nowrap">
                <th className="pb-3 font-medium px-2">{t('diag.node_id')}</th>
                <th className="pb-3 font-medium px-2 hidden sm:table-cell">{t('diag.role')}</th>
                <th className="pb-3 font-medium px-2">{t('diag.status')}</th>
                <th className="pb-3 font-medium px-2 hidden sm:table-cell">{t('diag.latency')}</th>
                <th className="pb-3 font-medium px-2">{t('diag.battery')}</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-200/60 dark:divide-neutral-800/30">
              {deviceStatus.nodes.map((node, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 px-2 font-mono text-slate-500 dark:text-neutral-500 whitespace-nowrap">{node.id}</td>
                  <td className="py-4 px-2 text-slate-700 dark:text-neutral-400 whitespace-nowrap hidden sm:table-cell">{node.role}</td>
                  <td className="py-4 px-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] sm:text-xs font-medium border ${
                      node.status === 'ONLINE' 
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' 
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full hidden sm:block ${node.status === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      {node.status}
                    </span>
                  </td>
                  <td className="py-4 px-2 text-slate-600 dark:text-neutral-400 font-mono whitespace-nowrap hidden sm:table-cell">
                    {node.status === 'ONLINE' ? '12ms' : '-'}
                  </td>
                  <td className="py-4 px-2 font-mono whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs ${
                      node.batteryLevel > 80 ? 'text-green-600 dark:text-green-400 bg-green-500/10' :
                      node.batteryLevel > 20 ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10' :
                      'text-red-600 dark:text-red-400 bg-red-500/10'
                    }`}>
                      {node.batteryLevel}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
