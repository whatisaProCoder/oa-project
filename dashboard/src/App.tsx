import { useState } from 'react';
import { useSensorStream } from './hooks/useSensorStream';
import { TopBar } from './components/layout/TopBar';
import { Navigation } from './components/layout/Navigation';
import type { TabId } from './components/layout/Navigation';
import { LegDigitalTwin } from './components/visualizations/LegDigitalTwin';
import { LiveFeedsTab } from './components/tabs/LiveFeedsTab';
import { GaitAnalysisTab } from './components/tabs/GaitAnalysisTab';
import { OARiskMeter } from './components/visualizations/OARiskMeter';
import { AIInsightsPanel } from './components/visualizations/AIInsightsPanel';
import { TestWizard } from './components/TestWizard';
import { ClinicalReportTab } from './components/tabs/ClinicalReportTab';
import { DeviceDiagnosticsTab } from './components/tabs/DeviceDiagnosticsTab';
import { PatientDialog, type PatientDetails } from './components/ui/PatientDialog';
import type { AssessmentSession, DeviceStatus, CalibrationOffsets } from './types';
import { createIMUCalibration3D } from './utils/alignment';

// Temporarily mock AssessmentSession & DeviceStatus until state management is fully implemented
const mockSession: AssessmentSession = {
  patientId: 'PT-89104',
  startTime: new Date().toISOString(),
  currentStep: 2,
  isActive: true,
};

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('ASSESSMENT');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [testStatus, setTestStatus] = useState<'NOT_STARTED' | 'COMPLETED'>('NOT_STARTED');
  const [frozenMlResult, setFrozenMlResult] = useState<any>(null);
  const [capturedData, setCapturedData] = useState<any[]>([]);
  
  const [patientDetails, setPatientDetails] = useState<PatientDetails>({
    id: 'PT-89104',
    name: 'John Doe',
    age: '62',
    gender: 'Male',
    address: '123 Medical Center Dr.'
  });
  const [isPatientDialogOpen, setIsPatientDialogOpen] = useState(false);
  
  const sensorData = useSensorStream(isLive);

  // Calibration offsets state persisted across page reloads
  const [calibrationOffsets, setCalibrationOffsets] = useState<CalibrationOffsets | null>(() => {
    try {
      const saved = localStorage.getItem('oa_calibration_offsets');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleCalibrate = () => {
    if (!sensorData) return;
    
    // Also trigger ESP32 hardware bias zeroing over UDP
    fetch('http://localhost:8000/api/calibrate', { method: 'POST' }).catch(() => {});

    const getAngle = (ax: number, ay: number, offset: number = 0) => Math.atan2(ax, ay) + offset;
    
    const leftThigh = sensorData.leftLeg?.thighIMU;
    const leftShank = sensorData.leftLeg?.shankIMU;
    const leftFoot = sensorData.leftLeg?.footIMU;
    
    const rightThigh = sensorData.rightLeg?.thighIMU;
    const rightShank = sensorData.rightLeg?.shankIMU;
    const rightFoot = sensorData.rightLeg?.footIMU;

    // Full 3D Boresighting / Sensor-to-Segment Alignment
    // Learns the true anatomical vertical and forward vectors regardless of MPU mount angle
    const calibLeftThigh = createIMUCalibration3D(leftThigh);
    const calibLeftShank = createIMUCalibration3D(leftShank);
    const calibLeftFoot = createIMUCalibration3D(leftFoot);

    const calibRightThigh = createIMUCalibration3D(rightThigh);
    const calibRightShank = createIMUCalibration3D(rightShank);
    const calibRightFoot = createIMUCalibration3D(rightFoot);

    const rawLHip = leftThigh ? getAngle(leftThigh.ax, leftThigh.ay) : 0;
    const rawLKnee = leftShank ? getAngle(leftShank.ax, leftShank.ay, -rawLHip) : 0;
    const rawLAnkle = leftFoot ? getAngle(leftFoot.ax, leftFoot.ay, -(rawLHip + rawLKnee)) : 0;

    const rawRHip = rightThigh ? getAngle(rightThigh.ax, rightThigh.ay) : 0;
    const rawRKnee = rightShank ? getAngle(rightShank.ax, rightShank.ay, -rawRHip) : 0;
    const rawRAnkle = rightFoot ? getAngle(rightFoot.ax, rightFoot.ay, -(rawRHip + rawRKnee)) : 0;

    const offsets: CalibrationOffsets = {
      leftThigh: calibLeftThigh,
      leftShank: calibLeftShank,
      leftFoot: calibLeftFoot,
      rightThigh: calibRightThigh,
      rightShank: calibRightShank,
      rightFoot: calibRightFoot,

      leftHip: rawLHip,
      leftKnee: rawLKnee,
      leftAnkle: rawLAnkle,
      rightHip: rawRHip,
      rightKnee: rawRKnee,
      rightAnkle: rawRAnkle
    };

    setCalibrationOffsets(offsets);
    localStorage.setItem('oa_calibration_offsets', JSON.stringify(offsets));
  };

  const handleResetCalibration = () => {
    setCalibrationOffsets(null);
    localStorage.removeItem('oa_calibration_offsets');
  };

  const mockDeviceStatus: DeviceStatus = {
    nodes: [
      { 
        id: 'R_LEG_THIGH', 
        role: 'MASTER', 
        status: (!isLive || (sensorData?.nodeStatus?.['R_LEG_THIGH'] ?? sensorData?.isConnected)) ? 'ONLINE' : 'OFFLINE', 
        lastPacketMs: Date.now(), 
        batteryLevel: 94 
      },
      { 
        id: 'L_LEG_THIGH', 
        role: 'SLAVE', 
        status: (!isLive || (sensorData?.nodeStatus ? sensorData.nodeStatus['L_LEG_THIGH'] : sensorData?.isConnected)) ? 'ONLINE' : 'OFFLINE', 
        lastPacketMs: Date.now(), 
        batteryLevel: 88 
      },
      { 
        id: 'L_LEG_SHANK', 
        role: 'SLAVE', 
        status: (!isLive || (sensorData?.nodeStatus ? sensorData.nodeStatus['L_LEG_SHANK'] : sensorData?.isConnected)) ? 'ONLINE' : 'OFFLINE', 
        lastPacketMs: Date.now(), 
        batteryLevel: 91 
      },
      { 
        id: 'R_LEG_SHANK', 
        role: 'SLAVE', 
        status: (!isLive || (sensorData?.nodeStatus ? sensorData.nodeStatus['R_LEG_SHANK'] : sensorData?.isConnected)) ? 'ONLINE' : 'OFFLINE', 
        lastPacketMs: Date.now(), 
        batteryLevel: 85 
      },
    ],
    network: 'UDP',
    packetsPerSecond: isLive ? (sensorData?.isConnected ? 50 : 0) : 142,
  };

  return (
    <div className="flex flex-col h-dvh w-screen pb-8 lg:pb-0 overflow-hidden bg-background relative text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Subtle animated background grid */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoNiwgMTgyLCAyMTIsIDAuMikiLz48L3N2Zz4=')] opacity-10 dark:opacity-20 pointer-events-none z-0"></div>
      <div className="z-10 flex flex-col h-full w-full">
      <TopBar 
        session={{ ...mockSession, patientId: patientDetails.id }} 
        deviceStatus={mockDeviceStatus} 
        onStartAssessment={() => {
          setIsLive(true);
          setIsWizardOpen(true);
        }} 
        isLive={isLive}
        onToggleLive={() => setIsLive(!isLive)}
        onPatientClick={() => setIsPatientDialogOpen(true)}
        onCalibrate={handleCalibrate}
        isCalibrated={!!calibrationOffsets}
      />
      
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Content Area */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {activeTab === 'ASSESSMENT' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
              
              {/* LEFT: OA Risk Meter & Stats */}
              {testStatus === 'COMPLETED' && !isWizardOpen && (
                <div className="lg:col-span-3 flex flex-col gap-6 lg:h-full order-3 lg:order-1">
                  <OARiskMeter assessment={
                    frozenMlResult ? {
                      score: Math.round(frozenMlResult.risk_confidence * 100),
                      level: frozenMlResult.risk_class === 'Severe OA' ? 'HIGH' : 
                             frozenMlResult.risk_class === 'Early OA Risk' ? 'MODERATE' : 'LOW',
                      factors: [
                        { name: 'Loading Asymmetry', impact: 85 },
                        { name: 'Gait Variability', impact: 60 },
                        { name: 'Knee Mobility', impact: 40 },
                      ]
                    } : null
                  } />
                </div>
              )}

              {/* CENTER: 3D Leg Digital Twin */}
              <div className={`flex flex-col min-h-[400px] lg:h-full order-1 lg:order-2 ${isWizardOpen ? 'lg:col-span-8' : testStatus === 'COMPLETED' ? 'lg:col-span-6' : 'lg:col-span-8 lg:col-start-3'}`}>
                <LegDigitalTwin 
                  sensorData={sensorData} 
                  calibrationOffsets={calibrationOffsets}
                  onCalibrate={handleCalibrate}
                  onResetCalibration={handleResetCalibration}
                />
              </div>

              {/* RIGHT: AI Insights or Test Wizard */}
              {(testStatus === 'COMPLETED' || isWizardOpen) && (
                <div className={`${isWizardOpen ? 'lg:col-span-4' : 'lg:col-span-3'} flex flex-col order-2 lg:order-3`}>
                  {isWizardOpen ? (
                    <TestWizard 
                      sensorData={sensorData}
                      onCalibrate={handleCalibrate}
                      onCancel={() => setIsWizardOpen(false)} 
                      onComplete={(data, ml) => { 
                        setIsWizardOpen(false); 
                        setTestStatus('COMPLETED');
                        setCapturedData(data);
                        setFrozenMlResult(ml);
                      }} 
                    />
                  ) : (
                    <AIInsightsPanel insight={
                      frozenMlResult ? {
                        primaryObservation: `Detected Class: ${frozenMlResult.risk_class} (Confidence: ${Math.round(frozenMlResult.risk_confidence * 100)}%)`,
                        detectedAnomalies: [
                          'Pressure asymmetry',
                          'Altered EMG amplitude'
                        ],
                        shapExplanations: frozenMlResult.shap_explanations,
                        recommendation: frozenMlResult.insight,
                        evidence: [
                          { id: 'BM25-SEARCH', title: `Query: ${frozenMlResult.query || 'N/A'}`, url: '#' }
                        ]
                      } : null
                    } />
                  )}
                </div>
              )}

            </div>
          )}

          {activeTab === 'LIVE' && (
            <LiveFeedsTab data={sensorData} />
          )}

          {activeTab === 'GAIT' && (
            <GaitAnalysisTab isLive={!isLive || !!sensorData?.isConnected} />
          )}

          {activeTab === 'REPORT' && (
            <ClinicalReportTab 
              mlResult={frozenMlResult} 
              capturedData={capturedData} 
              testStatus={testStatus}
              patientDetails={patientDetails}
              onStartTest={() => {
                setIsLive(true);
                setActiveTab('ASSESSMENT');
                setIsWizardOpen(true);
              }} 
            />
          )}

          {activeTab === 'DIAGNOSTICS' && (
            <DeviceDiagnosticsTab 
              deviceStatus={mockDeviceStatus} 
              calibrationOffsets={calibrationOffsets}
              onCalibrate={handleCalibrate}
              onResetCalibration={handleResetCalibration}
            />
          )}

        </main>
      </div>
      </div>
      <PatientDialog 
        isOpen={isPatientDialogOpen} 
        onClose={() => setIsPatientDialogOpen(false)} 
        patientData={patientDetails} 
        onSave={setPatientDetails} 
      />
    </div>
  );
}

export default App;
