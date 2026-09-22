import React from 'react';
import type { SensorData } from '../../types';
import { PlantarHeatmap } from '../visualizations/PlantarHeatmap';
import { SignalChart } from '../visualizations/SignalChart';
import { useTranslation } from '../../i18n/LanguageContext';

interface LiveFeedsTabProps {
  data: SensorData | null;
}

const toFahrenheit = (celsius?: number): number | undefined => {
  if (celsius == null) return undefined;
  return Number(((celsius * 9) / 5 + 32).toFixed(1));
};

export const LiveFeedsTab: React.FC<LiveFeedsTabProps> = ({ data }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="p-4 bg-white/80 dark:bg-slate-900/60 rounded-t-xl border-b border-slate-200 dark:border-slate-800 flex items-center shadow-sm dark:shadow-none transition-colors duration-200">
        <h2 className="text-slate-800 dark:text-slate-300 text-sm font-bold tracking-wider">{t('live.title')}</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-2 flex-1 overflow-y-auto">
        
        {/* Plantar Pressure Array */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2">{t('live.plantar_array')}</h3>
          <div className="flex flex-col sm:flex-row gap-4 h-auto sm:h-64">
            <div className="flex-1 min-h-[250px] sm:min-h-0">
              <PlantarHeatmap data={data?.leftLeg?.pressure} isLeft={true} />
            </div>
            <div className="flex-1 min-h-[250px] sm:min-h-0">
              <PlantarHeatmap data={data?.rightLeg?.pressure} isLeft={false} />
            </div>
          </div>
        </div>

        {/* Myoelectric Array */}
        <div className="lg:col-span-4 flex flex-col gap-4 mt-4 lg:mt-0">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2">{t('live.myoelectric')}</h3>
          <div className="flex flex-col gap-4 flex-1">
            <SignalChart 
              title={t('live.left_quad')} 
              dataPoint={data?.leftLeg?.quadEMG} 
              color="#3b82f6" 
              yMax={1024} 
              unit=" mV"
            />
            <SignalChart 
              title={t('live.right_quad')} 
              dataPoint={data?.rightLeg?.quadEMG} 
              color="#f59e0b" 
              yMax={1024} 
              unit=" mV"
            />
          </div>
        </div>

        {/* Environmental Array */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2">{t('live.environmental')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <SignalChart 
              title={t('live.l_knee_temp')} 
              dataPoint={toFahrenheit(data?.leftLeg?.kneeTemp)} 
              color="#3b82f6" 
              yMin={88} yMax={106} 
              unit="°F"
              precision={1}
            />
            <SignalChart 
              title={t('live.r_knee_temp')} 
              dataPoint={toFahrenheit(data?.rightLeg?.kneeTemp)} 
              color="#f59e0b" 
              yMin={88} yMax={106} 
              unit="°F"
              precision={1}
            />
            <SignalChart 
              title={t('live.l_acoustic')} 
              dataPoint={data?.leftLeg?.kneeAcoustic} 
              color="#3b82f6" 
              yMin={20}
              yMax={100} 
              unit=" dB"
            />
            <SignalChart 
              title={t('live.r_acoustic')} 
              dataPoint={data?.rightLeg?.kneeAcoustic} 
              color="#f59e0b" 
              yMin={20}
              yMax={100} 
              unit=" dB"
            />
          </div>
        </div>

      </div>
    </div>
  );
};
