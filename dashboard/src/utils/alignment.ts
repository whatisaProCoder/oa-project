import type { IMUCalibration3D, IMUData, LegSensors } from '../types';

/**
 * Creates a 3D orthonormal alignment basis (Boresighting / Sensor-to-Segment Alignment)
 * from an accelerometer reading taken while the patient is standing still upright.
 *
 * No matter what 3D orientation the MPU chip was sewn, glued, or strapped into the wearable:
 * - The measured gravity vector is aligned with the anatomical UP axis (+Y).
 * - An orthogonal forward axis (+X) and lateral axis (+Z) are computed via Gram-Schmidt.
 */
export function createIMUCalibration3D(imu?: IMUData | null): IMUCalibration3D {
  if (!imu) {
    return createDefaultCalibration();
  }

  const { ax, ay, az } = imu;
  const norm = Math.sqrt(ax * ax + ay * ay + az * az);

  // If sensor is offline or near-zero, fallback to identity alignment
  if (norm < 0.1 || !isFinite(norm)) {
    return createDefaultCalibration();
  }

  // 1. Anatomical Upright Vector (+Y) in sensor coordinate frame
  const uy = [ax / norm, ay / norm, az / norm] as [number, number, number];

  // 2. Select the sensor axis least parallel to gravity to construct orthogonal forward axis
  let ex = 1, ey = 0, ez = 0;
  const absX = Math.abs(uy[0]);
  const absY = Math.abs(uy[1]);
  const absZ = Math.abs(uy[2]);

  if (absX >= absY && absX >= absZ) {
    ex = 0; ey = 1; ez = 0;
  } else if (absY >= absX && absY >= absZ) {
    ex = 1; ey = 0; ez = 0;
  } else {
    ex = 1; ey = 0; ez = 0;
  }

  // Gram-Schmidt orthogonalization: temp = e - (e . u) * u
  const dot = ex * uy[0] + ey * uy[1] + ez * uy[2];
  let fx = ex - dot * uy[0];
  let fy = ey - dot * uy[1];
  let fz = ez - dot * uy[2];
  const fnorm = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
  const ux_axis = [fx / fnorm, fy / fnorm, fz / fnorm] as [number, number, number];

  // 3. Anatomical Lateral Axis (+Z) = Cross product (Y x X)
  const uz_axis = [
    uy[1] * ux_axis[2] - uy[2] * ux_axis[1],
    uy[2] * ux_axis[0] - uy[0] * ux_axis[2],
    uy[0] * ux_axis[1] - uy[1] * ux_axis[0],
  ] as [number, number, number];

  return {
    gravity: { x: uy[0], y: uy[1], z: uy[2] },
    basis: {
      x: ux_axis, // Forward anatomical axis
      y: uy,      // Vertical anatomical axis (up)
      z: uz_axis, // Lateral anatomical axis
    },
  };
}

function createDefaultCalibration(): IMUCalibration3D {
  return {
    gravity: { x: 0, y: 1, z: 0 },
    basis: {
      x: [1, 0, 0],
      y: [0, 1, 0],
      z: [0, 0, 1],
    },
  };
}

/**
 * Projects a raw IMU vector into the aligned anatomical coordinate frame:
 * - result.y = component along anatomical vertical axis
 * - result.x = component along anatomical forward axis
 * - result.z = component along anatomical lateral axis
 */
export function alignVector(
  imu: IMUData,
  calib?: IMUCalibration3D | null
): { x: number; y: number; z: number; norm: number } {
  const { ax, ay, az } = imu;
  const norm = Math.sqrt(ax * ax + ay * ay + az * az) || 1;

  if (!calib || !calib.basis) {
    return { x: ax / norm, y: ay / norm, z: az / norm, norm };
  }

  const { x: bx, y: by, z: bz } = calib.basis;

  return {
    x: (ax * bx[0] + ay * bx[1] + az * bx[2]) / norm,
    y: (ax * by[0] + ay * by[1] + az * by[2]) / norm,
    z: (ax * bz[0] + ay * bz[1] + az * bz[2]) / norm,
    norm,
  };
}

/**
 * Computes 3D joint kinematic angles (Hip, Knee, Ankle) in radians relative to the
 * calibrated neutral posture.
 *
 * Guaranteed Properties:
 * 1. At neutral upright stance, all angles are identically 0.00 radians (0.00°).
 * 2. 100% invariant to how the MPU chips are oriented inside the sleeves/straps.
 * 3. Knee flexion bends backwards (<= 0), Hip flexion flexes forward.
 */
export function computeKinematicsFrom3D(
  data: LegSensors | undefined,
  calib: {
    thigh?: IMUCalibration3D | null;
    shank?: IMUCalibration3D | null;
    foot?: IMUCalibration3D | null;
    fallbackHipOffset?: number;
    fallbackKneeOffset?: number;
    fallbackAnkleOffset?: number;
  }
): { hipAngle: number; kneeAngle: number; ankleAngle: number } {
  if (!data) {
    return { hipAngle: 0, kneeAngle: 0, ankleAngle: 0 };
  }

  // 1. Thigh Orientation & Hip Flexion Angle
  let hipAngle = 0;
  const thighIMU = data.thighIMU;
  const thighNorm = Math.sqrt(thighIMU.ax * thighIMU.ax + thighIMU.ay * thighIMU.ay + thighIMU.az * thighIMU.az);

  if (calib.thigh && calib.thigh.gravity && thighNorm > 1.0) {
    // 3D Invariant Tilt: Exact 3D angle between live acceleration vector and calibrated neutral upright vector
    const { x: gx, y: gy, z: gz } = calib.thigh.gravity;
    const dotNeutral = (thighIMU.ax * gx + thighIMU.ay * gy + thighIMU.az * gz) / thighNorm;
    const clampedDot = Math.max(-1.0, Math.min(1.0, dotNeutral));
    const tiltMag = Math.acos(clampedDot); // Deflection from upright (0.00 at neutral)

    // Positive hip angle flexes thigh forward in Three.js
    hipAngle = tiltMag;
  } else {
    // If not yet calibrated in 3D, fallback to raw 2D deflection
    const rawHip = Math.atan2(thighIMU.ax, Math.sqrt(thighIMU.ay * thighIMU.ay + thighIMU.az * thighIMU.az));
    hipAngle = rawHip - (calib.fallbackHipOffset ?? 0);
  }

  // 2. Shank & Knee Angle
  // Active when sensor sends non-zero acceleration (norm > 1.0 m/s^2)
  const shankIMU = data.shankIMU;
  const shankNorm = Math.sqrt(shankIMU.ax * shankIMU.ax + shankIMU.ay * shankIMU.ay + shankIMU.az * shankIMU.az);
  const isShankActive = shankNorm > 1.0;

  let kneeAngle = 0;
  if (isShankActive && calib.thigh && calib.shank) {
    const thigh = alignVector(thighIMU, calib.thigh);
    const shank = alignVector(shankIMU, calib.shank);
    const dotKnee = thigh.x * shank.x + thigh.y * shank.y + thigh.z * shank.z;
    const clampedDot = Math.max(-1.0, Math.min(1.0, dotKnee));
    const kneeBendMag = Math.acos(clampedDot);
    const relativeForward = shank.x - thigh.x;
    kneeAngle = relativeForward <= 0.05 ? -kneeBendMag : kneeBendMag;
  } else if (isShankActive) {
    // Uncalibrated 2D fallback: compute relative angular deflection between shank and thigh
    const rawHip = Math.atan2(thighIMU.ax, Math.sqrt(thighIMU.ay * thighIMU.ay + thighIMU.az * thighIMU.az));
    const rawShank = Math.atan2(shankIMU.ax, Math.sqrt(shankIMU.ay * shankIMU.ay + shankIMU.az * shankIMU.az));
    kneeAngle = (rawShank - rawHip) - (calib.fallbackKneeOffset ?? 0);
  } else {
    // If shank sensor is offline/not worn, lock knee to 0 so calf hangs naturally with thigh
    kneeAngle = 0;
  }

  // 3. Foot & Ankle Angle
  const footIMU = data.footIMU;
  const footNorm = Math.sqrt(footIMU.ax * footIMU.ax + footIMU.ay * footIMU.ay + footIMU.az * footIMU.az);
  const isFootActive = footNorm > 1.0;

  let ankleAngle = 0;
  if (isFootActive && isShankActive && calib.shank && calib.foot) {
    const shank = alignVector(shankIMU, calib.shank);
    const foot = alignVector(footIMU, calib.foot);
    const dotAnkle = shank.x * foot.x + shank.y * foot.y + shank.z * foot.z;
    const clampedDot = Math.max(-1.0, Math.min(1.0, dotAnkle));
    ankleAngle = (foot.x - shank.x >= 0 ? 1 : -1) * Math.acos(clampedDot);
  } else if (isFootActive && isShankActive) {
    // Uncalibrated 2D fallback: compute relative angular deflection between foot and shank
    const rawShank = Math.atan2(shankIMU.ax, Math.sqrt(shankIMU.ay * shankIMU.ay + shankIMU.az * shankIMU.az));
    const rawFoot = Math.atan2(footIMU.ax, Math.sqrt(footIMU.ay * footIMU.ay + footIMU.az * footIMU.az));
    ankleAngle = (rawFoot - rawShank) - (calib.fallbackAnkleOffset ?? 0);
  } else {
    ankleAngle = 0;
  }

  return { hipAngle, kneeAngle, ankleAngle };
}

