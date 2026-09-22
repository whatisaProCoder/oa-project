import { useState, useEffect } from 'react';
import type { SensorData, LegSensors } from '../types';

export const useSensorStream = (isLive: boolean = false) => {
  const [data, setData] = useState<SensorData | null>(null);

  useEffect(() => {
    let mockInterval: number | null = null;
    let isMounted = true;

    const generateMockData = () => {
      if (!isMounted) return;
      // Natural walking cadence (~1.35s per full stride cycle)
      const t = (performance.now() / 1000) * 4.6;

      const createLegData = (isLeft: boolean): LegSensors => {
        // Left and right are 180 degrees (0.5 cycle) out of phase
        const phaseOffset = isLeft ? 0 : 0.5;
        // Normalized gait phase p in [0, 1) where 0 = heel strike
        const rawPhase = (t / (2 * Math.PI)) + phaseOffset;
        const p = rawPhase - Math.floor(rawPhase);

        // --- 1. BIOMECHANICAL JOINT KINEMATICS (Sagittal Plane) ---
        // Hip Angle (rad): +flexion (forward), -extension (backward)
        // Heel-strike has forward flexion (+0.38 rad ~22°), toe-off has extension (-0.18 rad ~ -10°)
        const hipAngle = 0.30 * Math.cos(2 * Math.PI * p) + 0.08;

        // Knee Angle (rad): strictly <= 0 (backward bending in Three.js)
        // Two physiological flexion waves:
        // Wave A: Stance loading shock absorption around p=0.14 (~ -0.24 rad / -14°)
        // Wave B: Swing foot clearance around p=0.72 (~ -0.98 rad / -56°)
        const stanceFlexion = Math.exp(-Math.pow((p - 0.14) / 0.08, 2)) * -0.24;
        const swingFlexion = Math.exp(-Math.pow((p - 0.72) / 0.11, 2)) * -0.98;
        const baseKnee = -0.05; // Resting anatomical knee flexion
        const kneeAngle = Math.min(0, baseKnee + stanceFlexion + swingFlexion);

        // Ankle Angle (rad): +dorsiflexion (toes up), -plantarflexion (toes down)
        // - Foot flat loading response: slight plantarflexion (-0.08 rad)
        // - Midstance forward roll: dorsiflexion (+0.16 rad)
        // - Push-off / toe-off: sharp plantarflexion (-0.28 rad)
        // - Swing toe clearance: slight dorsiflexion (+0.06 rad)
        const ankleAngle =
          -0.08 * Math.exp(-Math.pow((p - 0.08) / 0.05, 2)) +
           0.16 * Math.exp(-Math.pow((p - 0.38) / 0.10, 2)) +
          -0.28 * Math.exp(-Math.pow((p - 0.56) / 0.06, 2)) +
           0.06 * Math.exp(-Math.pow((p - 0.80) / 0.12, 2));

        // Absolute segment angles in world sagittal plane
        const absoluteThighAngle = hipAngle;
        const absoluteKneeAngle = hipAngle + kneeAngle;
        const absoluteAnkleAngle = absoluteKneeAngle + ankleAngle;

        // Gravitational acceleration (g = 9.81 m/s^2) projected along segment orientation
        const G = 9.81;
        // Subtle lateral coronal swaying
        const lateralSway = Math.sin(t * 0.5) * 0.25;

        // Angular velocities (gz derivative approximation for realistic gyroscope signals)
        const gzThigh = -0.30 * 2 * Math.PI * Math.sin(2 * Math.PI * p) * (4.6 / (2 * Math.PI));
        const gzShank = gzThigh + (p > 0.6 && p < 0.85 ? -3.5 : 0.8);
        const gzFoot = gzShank + (p > 0.5 && p < 0.65 ? -5.0 : 1.0);

        const thighIMU = {
          ax: Math.sin(absoluteThighAngle) * G,
          ay: Math.cos(absoluteThighAngle) * G,
          az: lateralSway,
          gx: 0,
          gy: 0,
          gz: gzThigh
        };

        const shankIMU = {
          ax: Math.sin(absoluteKneeAngle) * G,
          ay: Math.cos(absoluteKneeAngle) * G,
          az: lateralSway * 1.2,
          gx: 0,
          gy: 0,
          gz: gzShank
        };

        const footIMU = {
          ax: Math.sin(absoluteAnkleAngle) * G,
          ay: Math.cos(absoluteAnkleAngle) * G,
          az: lateralSway * 1.4,
          gx: 0,
          gy: 0,
          gz: gzFoot
        };

        // --- 2. PLANTAR PRESSURE (FSRs) SYNCHRONIZED WITH GAIT ---
        // Stance phase is p in [0.0, 0.60], Swing phase is p in [0.60, 1.0)
        let heel = 0;
        let m5 = 0;
        let m1 = 0;
        let toe = 0;

        if (p < 0.60) {
          // Heel strike: p in [0.0, 0.22]
          if (p < 0.22) {
            heel = Math.sin((p / 0.22) * Math.PI) * 950;
          }
          // Lateral metatarsal (M5) weight bearing: p in [0.12, 0.44]
          if (p >= 0.12 && p < 0.44) {
            m5 = Math.sin(((p - 0.12) / 0.32) * Math.PI) * 780;
          }
          // Medial metatarsal (M1) weight transfer: p in [0.18, 0.50]
          if (p >= 0.18 && p < 0.50) {
            m1 = Math.sin(((p - 0.18) / 0.32) * Math.PI) * 860;
          }
          // Toe push-off: p in [0.36, 0.60]
          if (p >= 0.36 && p < 0.60) {
            toe = Math.sin(((p - 0.36) / 0.24) * Math.PI) * 1020;
          }
        }

        // Add subtle natural sensor noise
        if (heel > 10) heel += (Math.random() - 0.5) * 30;
        if (m5 > 10) m5 += (Math.random() - 0.5) * 25;
        if (m1 > 10) m1 += (Math.random() - 0.5) * 25;
        if (toe > 10) toe += (Math.random() - 0.5) * 30;

        // Quad EMG: Active in loading response (knee stabilization) and early swing (hip flexion)
        let quadEMG = 40 + Math.random() * 30;
        if (p >= 0.05 && p <= 0.20) {
          // Stance shock absorption burst
          quadEMG = 450 + Math.random() * 250;
        } else if (p >= 0.60 && p <= 0.78) {
          // Swing acceleration burst
          quadEMG = 750 + Math.random() * 300;
        }

        // Acoustic: Micro-acoustic clicks during deep swing flexion
        const isFlexingFast = p >= 0.65 && p <= 0.75;
        const kneeAcoustic = isFlexingFast ? 35 + Math.random() * 45 : 12 + Math.random() * 8;

        return {
          thighIMU,
          shankIMU,
          footIMU,
          pressure: {
            heel: Math.max(0, Math.round(heel)),
            m1: Math.max(0, Math.round(m1)),
            m5: Math.max(0, Math.round(m5)),
            toe: Math.max(0, Math.round(toe))
          },
          kneeTemp: 36.5 + Math.sin(t * 0.1) * 0.15 + Math.random() * 0.05,
          ankleTemp: 36.2 + Math.cos(t * 0.1) * 0.12 + Math.random() * 0.05,
          quadEMG: Math.round(quadEMG),
          kneeAcoustic: Math.round(kneeAcoustic)
        };
      };

      setData({
        timestamp: new Date().toISOString(),
        leftLeg: createLegData(true),
        rightLeg: createLegData(false),
        isConnected: false,
        latencyMs: Math.floor(Math.random() * 20 + 10)
      });
    };

    if (!isLive) {
      // MOCK DATA MODE: Generate fake data, do not attempt WebSocket connection
      mockInterval = window.setInterval(generateMockData, 50);
      return () => {
        isMounted = false;
        if (mockInterval) window.clearInterval(mockInterval);
      };
    }

    // LIVE SENSORS MODE: Connect to WebSocket with auto-reconnect
    let ws: WebSocket | null = null;
    let reconnectTimeout: number | null = null;

    const connectWebSocket = () => {
      if (!isMounted) return;

      ws = new WebSocket('ws://localhost:8000/ws');

      ws.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          if (isMounted) {
            setData(parsedData);
          }
        } catch (e) {
          console.error("Failed to parse WebSocket data", e);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected. Reconnecting in 1.5s...");
        if (isMounted) {
          reconnectTimeout = window.setTimeout(connectWebSocket, 1500);
        }
      };
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [isLive]);

  return data;
};
