import React, { useState } from 'react';
import { Play, ChevronRight, Check } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

interface TestWizardProps {
  sensorData: any;
  onComplete: (capturedData: any[], mlResult: any) => void;
  onCancel: () => void;
  onCalibrate?: () => void;
}

export const TestWizard: React.FC<TestWizardProps> = ({ sensorData, onComplete, onCancel, onCalibrate }) => {
  const { t, language } = useTranslation();
  
  const steps = [
    { id: 1, title: t('wizard.step_prepare'), desc: 'Patient self-reported WOMAC scores.' },
    { id: 2, title: t('wizard.step_vitals'), desc: 'Stand upright and still. System will calibrate 0° neutral control (10s).' },
    { id: 3, title: t('wizard.step_sit_stand'), desc: 'Ask patient to walk normally for 10 steps.' },
    { id: 4, title: t('wizard.step_walking'), desc: 'Single-leg stand on left foot (10s).' },
    { id: 5, title: t('wizard.step_rom'), desc: 'Single-leg stand on right foot (10s).' },
    { id: 6, title: t('wizard.step_sync'), desc: 'AI is processing kinematic data...' },
    { id: 7, title: t('wizard.finish'), desc: 'Report generated.' },
  ];

  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedData, setCapturedData] = useState<any[]>([]);
  const [mlResult, setMlResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [womacScore, setWomacScore] = useState({ pain: 0, stiffness: 0, function: 0 });

  // Auto-capture data when on clinical test steps
  React.useEffect(() => {
    if (sensorData && [3, 4, 5].includes(currentStep)) {
      setCapturedData(prev => [...prev, { ...sensorData, phase: currentStep }]);
    }
  }, [sensorData, currentStep]);

  // 10-second strict countdown timer for each clinical test step
  React.useEffect(() => {
    if (currentStep === 2) {
      // Trigger Calibration
      fetch('http://localhost:8000/api/calibrate', { method: 'POST' }).catch(console.error);
    }

    if ([2, 3, 4, 5].includes(currentStep)) {
      setTimeLeft(10);
      const timer = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timer);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setTimeLeft(0);
    }
  }, [currentStep]);

  // Auto-advance calibration step
  React.useEffect(() => {
    if (currentStep === 2 && timeLeft === 0) {
      if (onCalibrate) onCalibrate();
      setTimeout(() => {
         setCurrentStep(3);
      }, 500);
    }
  }, [currentStep, timeLeft, onCalibrate]);

  const nextStep = async () => {
    if (currentStep === 5) {
      setCurrentStep(6);
      setIsProcessing(true);
      try {
        const response = await fetch('http://localhost:8000/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            captured_data: capturedData,
            womac_score: womacScore,
            language: language
          })
        });
        const data = await response.json();
        setMlResult({ ...data.ml_result, features: data.features });
      } catch (e) {
        console.error("Analysis failed", e);
      } finally {
        setIsProcessing(false);
        setCurrentStep(7);
      }
    } else if (currentStep < 7) {
      setCurrentStep(c => c + 1);
    } else {
      onComplete(capturedData, mlResult);
    }
  };

  return (
    <div className="glass-panel h-full flex flex-col rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-100/60 dark:bg-slate-900/30 backdrop-blur-md">
        <h2 className="text-primary font-bold flex items-center gap-2 tracking-widest">
          <Play className="w-4 h-4 text-primary" />
          {t('wizard.title')}
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-danger transition-colors cursor-pointer">{t('generic.close')} ✕</button>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-center">
        <div className="flex justify-between relative mb-8">
          <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -z-10"></div>
          <div 
            className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-500 -z-10 shadow-neon-red" 
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          ></div>

          {steps.map(step => (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300 text-sm ${
                currentStep > step.id ? 'bg-primary border-primary text-slate-900 shadow-[0_0_10px_rgba(255,51,51,0.5)]' :
                currentStep === step.id ? 'bg-white dark:bg-slate-900 border-primary text-primary shadow-[0_0_15px_rgba(255,51,51,0.4)]' :
                'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500'
              }`}>
                {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">
          {currentStep === 1 ? (
            <div className="space-y-6">
              <h3 className="text-xl font-light text-slate-900 dark:text-slate-100 text-center mb-6">Patient Survey (WOMAC)</h3>
              
              <div className="space-y-4 bg-slate-50 dark:bg-slate-900/30 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-700 dark:text-slate-300">Joint Pain Level</span>
                    <span className="text-primary font-mono">{womacScore.pain}/10</span>
                  </div>
                  <input type="range" min="0" max="10" value={womacScore.pain} onChange={e => setWomacScore({...womacScore, pain: parseInt(e.target.value)})} className="w-full accent-primary" />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-700 dark:text-slate-300">Joint Stiffness</span>
                    <span className="text-primary font-mono">{womacScore.stiffness}/10</span>
                  </div>
                  <input type="range" min="0" max="10" value={womacScore.stiffness} onChange={e => setWomacScore({...womacScore, stiffness: parseInt(e.target.value)})} className="w-full accent-primary" />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-700 dark:text-slate-300">Physical Function Loss</span>
                    <span className="text-primary font-mono">{womacScore.function}/10</span>
                  </div>
                  <input type="range" min="0" max="10" value={womacScore.function} onChange={e => setWomacScore({...womacScore, function: parseInt(e.target.value)})} className="w-full accent-primary" />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center h-40 flex flex-col justify-center">
              <h3 className="text-xl font-light text-slate-900 dark:text-slate-100 mb-2">{steps[currentStep - 1].title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 px-4">{steps[currentStep - 1].desc}</p>
              
              {isProcessing && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce shadow-neon-red"></span>
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce shadow-neon-red" style={{ animationDelay: '0.1s' }}></span>
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce shadow-neon-red" style={{ animationDelay: '0.2s' }}></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-300 cursor-pointer">
          {t('generic.cancel')}
        </button>
        
        <button 
          onClick={nextStep}
          disabled={isProcessing || timeLeft > 0}
          className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-accent text-slate-950 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-[0_0_10px_rgba(255,51,51,0.3)] hover:shadow-[0_0_15px_rgba(255,51,51,0.5)] cursor-pointer"
        >
          {timeLeft > 0 ? `${t('wizard.recording')} (${timeLeft}s)` : currentStep === 7 ? t('wizard.finish') : t('wizard.next')}
          {currentStep < 7 && timeLeft === 0 && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
