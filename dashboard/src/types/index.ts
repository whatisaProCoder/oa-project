export interface IMUData {
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

export interface FSRData {
  heel: number;
  m1: number;
  m5: number;
  toe: number;
}

export interface LegSensors {
  thighIMU: IMUData;
  shankIMU: IMUData;
  footIMU: IMUData;
  pressure: FSRData;
  kneeTemp: number;
  ankleTemp: number;
  quadEMG: number;
  kneeAcoustic: number;
}

export interface SensorData {
  timestamp: string;
  leftLeg: LegSensors;
  rightLeg: LegSensors;
  isConnected: boolean;
  latencyMs: number;
  mlResult?: any;
  nodeStatus?: Record<string, boolean>;
}

export interface GaitMetrics {
  strideDurationMs: number;
  stanceDurationMs: number;
  swingDurationMs: number;
  gaitVariability: number; // 0-1
  leftSymmetry: number; // 0-100%
  rightSymmetry: number; // 0-100%
  asymmetry: number; // Difference
}

export interface LiteratureEvidence {
  id: string;
  title: string;
  url: string;
}

export interface AIInsight {
  primaryObservation: string;
  detectedAnomalies: string[];
  recommendation: string;
  evidence: LiteratureEvidence[];
  shapExplanations?: { feature: string; impact: number }[];
}

export interface RiskAssessment {
  score: number; // 0-100
  level: 'LOW' | 'MODERATE' | 'HIGH';
  factors: { name: string; impact: number }[];
}

export interface DeviceNode {
  id: string;
  role: 'SLAVE' | 'MASTER';
  status: 'ONLINE' | 'OFFLINE';
  lastPacketMs: number;
  batteryLevel: number;
}

export interface DeviceStatus {
  nodes: DeviceNode[];
  network: 'UDP' | 'WIFI';
  packetsPerSecond: number;
}

export interface AssessmentSession {
  patientId: string;
  startTime: string;
  currentStep: number;
  isActive: boolean;
}

export interface IMUCalibration3D {
  gravity: { x: number; y: number; z: number };
  basis: {
    x: [number, number, number];
    y: [number, number, number];
    z: [number, number, number];
  };
}

export interface CalibrationOffsets {
  // 3D Boresighted neutral frames for each physical sensor location
  leftThigh?: IMUCalibration3D;
  leftShank?: IMUCalibration3D;
  leftFoot?: IMUCalibration3D;
  rightThigh?: IMUCalibration3D;
  rightShank?: IMUCalibration3D;
  rightFoot?: IMUCalibration3D;

  // Fallback 1D scalar angles (radians)
  leftHip: number;
  leftKnee: number;
  leftAnkle: number;
  rightHip: number;
  rightKnee: number;
  rightAnkle: number;
}

