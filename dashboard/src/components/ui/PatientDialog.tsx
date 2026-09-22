import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

export interface PatientDetails {
  id: string;
  name: string;
  age: string;
  gender: string;
  address: string;
}

interface PatientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  patientData: PatientDetails;
  onSave: (data: PatientDetails) => void;
}

export const PatientDialog: React.FC<PatientDialogProps> = ({ isOpen, onClose, patientData, onSave }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<PatientDetails>(patientData);

  useEffect(() => {
    if (isOpen) {
      setFormData(patientData);
    }
  }, [isOpen, patientData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-2xl bg-white/95 dark:bg-neutral-900/90 overflow-hidden flex flex-col transition-colors duration-200">
        <div className="p-5 border-b border-slate-200 dark:border-neutral-800 flex justify-between items-center bg-slate-50/80 dark:bg-neutral-950/50">
          <h2 className="text-slate-900 dark:text-neutral-100 font-bold text-lg">{t('patient.title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-400 uppercase tracking-widest mb-1">{t('patient.id')}</label>
            <input 
              type="text" 
              value={formData.id} 
              onChange={e => setFormData({...formData, id: e.target.value})}
              className="w-full bg-slate-50 dark:bg-black/50 border border-slate-300 dark:border-neutral-800 rounded-lg px-3 py-2 text-slate-900 dark:text-neutral-200 focus:outline-none focus:border-red-500/50 transition-colors"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-400 uppercase tracking-widest mb-1">{t('patient.name')}</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-slate-50 dark:bg-black/50 border border-slate-300 dark:border-neutral-800 rounded-lg px-3 py-2 text-slate-900 dark:text-neutral-200 focus:outline-none focus:border-red-500/50 transition-colors"
              required
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-400 uppercase tracking-widest mb-1">{t('patient.age')}</label>
              <input 
                type="number" 
                value={formData.age} 
                onChange={e => setFormData({...formData, age: e.target.value})}
                className="w-full bg-slate-50 dark:bg-black/50 border border-slate-300 dark:border-neutral-800 rounded-lg px-3 py-2 text-slate-900 dark:text-neutral-200 focus:outline-none focus:border-red-500/50 transition-colors"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-400 uppercase tracking-widest mb-1">{t('patient.gender')}</label>
              <select 
                value={formData.gender}
                onChange={e => setFormData({...formData, gender: e.target.value})}
                className="w-full bg-slate-50 dark:bg-black/50 border border-slate-300 dark:border-neutral-800 rounded-lg px-3 py-2 text-slate-900 dark:text-neutral-200 focus:outline-none focus:border-red-500/50 transition-colors appearance-none"
                required
              >
                <option value="">{t('patient.select')}</option>
                <option value="Male">{t('patient.male')}</option>
                <option value="Female">{t('patient.female')}</option>
                <option value="Other">{t('patient.other')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-neutral-400 uppercase tracking-widest mb-1">{t('patient.address')}</label>
            <textarea 
              value={formData.address} 
              onChange={e => setFormData({...formData, address: e.target.value})}
              className="w-full bg-slate-50 dark:bg-black/50 border border-slate-300 dark:border-neutral-800 rounded-lg px-3 py-2 text-slate-900 dark:text-neutral-200 focus:outline-none focus:border-red-500/50 transition-colors resize-none h-20"
            />
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-neutral-300 font-medium transition-colors cursor-pointer"
            >
              {t('patient.cancel')}
            </button>
            <button 
              type="submit"
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-bold text-sm shadow-[0_0_15px_rgba(239,68,68,0.2)] cursor-pointer"
            >
              {t('patient.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
