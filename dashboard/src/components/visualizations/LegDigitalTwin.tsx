import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Trail } from '@react-three/drei';
import * as THREE from 'three';
import type { SensorData, LegSensors, CalibrationOffsets } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { Crosshair, RotateCcw } from 'lucide-react';
import { computeKinematicsFrom3D } from '../../utils/alignment';

interface LegDigitalTwinProps {
  sensorData: SensorData | null;
  calibrationOffsets?: CalibrationOffsets | null;
  onCalibrate?: () => void;
  onResetCalibration?: () => void;
}

const SolidBone = ({ length, topRadius, bottomRadius }: { length: number, topRadius: number, bottomRadius: number }) => (
  <group position={[0, -length / 2, 0]}>
    <mesh>
      <cylinderGeometry args={[topRadius, bottomRadius, length, 32]} />
      <meshPhysicalMaterial 
        color="#e2e8f0" 
        metalness={0.1} 
        roughness={0.3} 
        clearcoat={0.8} 
        clearcoatRoughness={0.2} 
      />
    </mesh>
    {/* Subtle wireframe overlay for digital twin feel */}
    <mesh>
      <cylinderGeometry args={[topRadius * 1.01, bottomRadius * 1.01, length, 16]} />
      <meshBasicMaterial color="#94a3b8" wireframe transparent opacity={0.1} />
    </mesh>
  </group>
);

const CalfBone = ({ length }: { length: number }) => (
  <group position={[0, -length / 2, 0]}>
    {/* Upper calf (thickens) */}
    <mesh position={[0, length * 0.25, 0]}>
      <cylinderGeometry args={[0.45, 0.55, length * 0.5, 32]} />
      <meshPhysicalMaterial color="#e2e8f0" metalness={0.1} roughness={0.3} clearcoat={0.8} />
    </mesh>
    {/* Lower calf (tapers to ankle) */}
    <mesh position={[0, -length * 0.25, 0]}>
      <cylinderGeometry args={[0.55, 0.25, length * 0.5, 32]} />
      <meshPhysicalMaterial color="#e2e8f0" metalness={0.1} roughness={0.3} clearcoat={0.8} />
    </mesh>
  </group>
);

const SolidJoint = ({ size, color }: { size: number, color: string }) => (
  <mesh>
    <sphereGeometry args={[size, 32, 32]} />
    <meshPhysicalMaterial 
      color={color} 
      emissive={color} 
      emissiveIntensity={0.4} 
      metalness={0.4} 
      roughness={0.2} 
      clearcoat={1.0} 
    />
  </mesh>
);

const Foot = () => (
  <group position={[0.4, -0.3, 0]}>
    {/* Heel */}
    <mesh position={[-0.5, 0, 0]}>
      <sphereGeometry args={[0.3, 32, 32]} />
      <meshPhysicalMaterial color="#e2e8f0" metalness={0.1} roughness={0.3} />
    </mesh>
    
    {/* Midfoot bridge */}
    <mesh position={[0, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.2, 0.3, 1.0, 32]} />
      <meshPhysicalMaterial color="#e2e8f0" metalness={0.1} roughness={0.3} />
    </mesh>
    
    {/* Ball of foot */}
    <mesh position={[0.5, -0.15, 0]}>
      <sphereGeometry args={[0.2, 32, 32]} />
      <meshPhysicalMaterial color="#e2e8f0" metalness={0.1} roughness={0.3} />
    </mesh>

    {/* Carbon Fiber Sole Plate */}
    <mesh position={[0, -0.3, 0]}>
      <boxGeometry args={[1.3, 0.08, 0.5]} />
      <meshPhysicalMaterial color="#0f172a" metalness={0.9} roughness={0.6} />
    </mesh>
  </group>
);

const BiomechanicalLeg = ({ 
  isLeft, 
  data,
  position,
  calibrationOffsets
}: { 
  isLeft: boolean, 
  data: LegSensors | undefined,
  position: [number, number, number],
  calibrationOffsets?: CalibrationOffsets | null
}) => {
  const hipRef = useRef<THREE.Group>(null);
  const kneeRef = useRef<THREE.Group>(null);
  const ankleRef = useRef<THREE.Group>(null);

  const THIGH_L = 4.5;
  const SHANK_L = 4.5;
  
  const color = isLeft ? '#3b82f6' : '#f59e0b';

  useFrame(() => {
    let hipAngle = 0;
    let kneeAngle = 0;
    let ankleAngle = 0;

    if (data) {
      const angles = computeKinematicsFrom3D(data, {
        thigh: isLeft ? calibrationOffsets?.leftThigh : calibrationOffsets?.rightThigh,
        shank: isLeft ? calibrationOffsets?.leftShank : calibrationOffsets?.rightShank,
        foot: isLeft ? calibrationOffsets?.leftFoot : calibrationOffsets?.rightFoot,
        fallbackHipOffset: isLeft ? (calibrationOffsets?.leftHip ?? 0) : (calibrationOffsets?.rightHip ?? 0),
        fallbackKneeOffset: isLeft ? (calibrationOffsets?.leftKnee ?? 0) : (calibrationOffsets?.rightKnee ?? 0),
        fallbackAnkleOffset: isLeft ? (calibrationOffsets?.leftAnkle ?? 0) : (calibrationOffsets?.rightAnkle ?? 0),
      });

      hipAngle = angles.hipAngle;
      kneeAngle = angles.kneeAngle;
      ankleAngle = angles.ankleAngle;
    }
    
    if (hipRef.current) {
      hipRef.current.rotation.z = THREE.MathUtils.lerp(hipRef.current.rotation.z, hipAngle, 0.2);
    }
    if (kneeRef.current) {
      kneeRef.current.rotation.z = THREE.MathUtils.lerp(kneeRef.current.rotation.z, Math.min(0, kneeAngle), 0.2);
    }
    if (ankleRef.current) {
      ankleRef.current.rotation.z = THREE.MathUtils.lerp(ankleRef.current.rotation.z, ankleAngle, 0.2);
    }
  });

  return (
    <group position={position}>
      {/* Hip Joint */}
      <SolidJoint size={0.7} color={color} />
      
      <group ref={hipRef}>
        {/* Thigh */}
        <SolidBone length={THIGH_L} topRadius={0.6} bottomRadius={0.45} />
        
        {/* Knee */}
        <group position={[0, -THIGH_L, 0]}>
          <SolidJoint size={0.55} color={color} />
          
          <group ref={kneeRef}>
            {/* Calf */}
            <CalfBone length={SHANK_L} />

            {/* Ankle and Foot */}
            <group ref={ankleRef} position={[0, -SHANK_L, 0]}>
              <Trail width={2} color={color} length={15} decay={1} attenuation={(t) => t * t}>
                <mesh><sphereGeometry args={[0.01]}/><meshBasicMaterial /></mesh>
              </Trail>
              
              <SolidJoint size={0.35} color={color} />
              <Foot />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};

const CyberGrid = ({ isDark }: { isDark: boolean }) => (
  <group position={[0, -9, 0]}>
    <gridHelper args={[40, 40, '#ff3333', isDark ? '#1a0000' : '#cbd5e1']} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial color={isDark ? "#000000" : "#f8fafc"} transparent opacity={isDark ? 0.8 : 0.85} depthWrite={false} />
    </mesh>
  </group>
);

export const LegDigitalTwin: React.FC<LegDigitalTwinProps> = ({ 
  sensorData,
  calibrationOffsets,
  onCalibrate,
  onResetCalibration
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isCalibrated = !!calibrationOffsets;

  return (
    <div className="glass-panel w-full h-full relative rounded-xl overflow-hidden shadow-inner transition-colors duration-200">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h2 className="text-slate-800 dark:text-slate-100 text-sm font-bold tracking-[0.2em] flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${isCalibrated ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-primary animate-pulse shadow-neon-red'}`}></span>
          {t('assessment.live_kinematics')}
        </h2>
        <p className={`text-xs font-mono mt-1 ${isCalibrated ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
          {isCalibrated ? '3D BORESIGHTING ACTIVE (0° NEUTRAL TARE)' : t('assessment.tracking_active')}
        </p>
      </div>

      {/* Calibration Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {onCalibrate && (
          <button
            onClick={onCalibrate}
            title="Stand upright still and click to calibrate neutral 0° baseline"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wider backdrop-blur transition-all duration-300 ${
              isCalibrated
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-white/85 dark:bg-slate-900/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-primary/50 cursor-pointer shadow-sm dark:shadow-none'
            }`}
          >
            <Crosshair className={`w-3.5 h-3.5 ${isCalibrated ? 'text-emerald-500 dark:text-emerald-400' : 'text-primary'}`} />
            <span>{isCalibrated ? 'NEUTRAL SET (0°)' : 'CALIBRATE POSE'}</span>
          </button>
        )}
        {isCalibrated && onResetCalibration && (
          <button
            onClick={onResetCalibration}
            title="Reset neutral calibration"
            className="p-1.5 rounded-lg bg-white/85 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:border-red-500/40 transition-colors cursor-pointer shadow-sm dark:shadow-none"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="absolute bottom-4 left-4 z-10 pointer-events-none flex gap-6">
        <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/50 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700/50 backdrop-blur shadow-sm dark:shadow-none">
          <div className="w-2 h-2 rounded-full bg-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
          <span className="text-xs text-slate-600 dark:text-slate-400 tracking-wider font-mono">LEFT LEG</span>
        </div>
        <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/50 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700/50 backdrop-blur shadow-sm dark:shadow-none">
          <div className="w-2 h-2 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
          <span className="text-xs text-slate-600 dark:text-slate-400 tracking-wider font-mono">RIGHT LEG</span>
        </div>
      </div>

      <Canvas camera={{ position: [12, 2, 18], fov: 40 }} className="bg-transparent">
        <ambientLight intensity={isDark ? 0.5 : 0.8} />
        <directionalLight position={[10, 20, 10]} intensity={isDark ? 1.5 : 1.8} color="#ffffff" />
        <directionalLight position={[-10, 0, -10]} intensity={isDark ? 0.5 : 0.4} color="#ff3333" />
        <pointLight position={[0, 0, 0]} intensity={1} color={isDark ? "#f8fafc" : "#ffffff"} distance={20} />
        
        <CyberGrid isDark={isDark} />
        
        <BiomechanicalLeg 
          isLeft={true} 
          data={sensorData?.leftLeg} 
          position={[0, 5, 1.5]} 
          calibrationOffsets={calibrationOffsets} 
        />
        <BiomechanicalLeg 
          isLeft={false} 
          data={sensorData?.rightLeg} 
          position={[0, 5, -1.5]} 
          calibrationOffsets={calibrationOffsets} 
        />
        
        <OrbitControls 
          enablePan={false}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={10}
          maxDistance={35}
          autoRotate={false}
        />
      </Canvas>
    </div>
  );
};
