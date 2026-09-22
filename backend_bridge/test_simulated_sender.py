import socket
import struct
import time
from backend_bridge.config import UDP_HOST, UDP_PORT
from backend_bridge.protocol import STRUCT_FMT

import math

def generate_synthetic_payload(time_elapsed: float = 0.0) -> bytes:
    """
    Generates a 320-byte binary payload identical to what the ESP32 Master sends (4 nodes x 80 bytes).
    Format per node: <B3x13f6i
    """
    payload = b""
    speed = 2.0
    
    for i in range(4):
        node_id = i
        
        # Mapping: 
        # 0 = Right Upper (Master), 1 = Left Upper
        # 2 = Left Lower (Shank + Foot + FSRs), 3 = Right Lower (Shank + Foot + FSRs)
        is_left = (node_id == 1 or node_id == 2)
        is_lower = (node_id == 2 or node_id == 3)
        
        phase = 0 if is_left else math.pi
        
        # Cycle of 15 seconds: 12 seconds normal, 3 seconds anomaly
        cycle_time = time_elapsed % 15
        is_anomaly = (cycle_time > 12)
        
        asymmetry_factor = 1.0
        if is_anomaly and not is_left:
            asymmetry_factor = 0.2 # Sudden drop in pressure/EMG
            
        swing_phase = math.sin(time_elapsed * speed + phase)
        
        # Hip swing: ~15 degrees forward (flexion), 5 degrees backward (extension)
        hip_angle_deg = swing_phase * 15 + 5 
        theta = hip_angle_deg * (math.pi / 180)
        
        # Thigh / Shank kinematics
        accelX = math.sin(theta)
        accelY = math.cos(theta)
        accelZ = 9.81 + math.sin(time_elapsed * 2) * 0.1
        
        gyroX = math.cos(time_elapsed * speed + phase) * 20
        gyroY = math.sin(time_elapsed * speed + phase) * 20
        gyroZ = math.sin(time_elapsed * 0.5) * 5
        
        # Foot IMU (only active on lower nodes 2 and 3)
        if is_lower:
            foot_theta = theta + math.cos(time_elapsed * speed + phase) * (math.pi / 12)
            footAccelX = math.sin(foot_theta)
            footAccelY = math.cos(foot_theta)
            footAccelZ = 9.81 + math.sin(time_elapsed * 2) * 0.1
            footGyroX = math.cos(time_elapsed * speed + phase) * 25
            footGyroY = math.sin(time_elapsed * speed + phase) * 25
            footGyroZ = math.sin(time_elapsed * 0.5) * 6
        else:
            footAccelX = 0.0
            footAccelY = 0.0
            footAccelZ = 0.0
            footGyroX = 0.0
            footGyroY = 0.0
            footGyroZ = 0.0
        
        temperature = 36.9 + math.sin(time_elapsed * 0.1 + node_id) * 0.15
        
        # Pressure / EMG / Mic
        pressurePhase = max(0, math.sin(time_elapsed * speed + phase))
        
        if not is_lower:
            # Upper nodes have EMG and Mic
            emgValue = int(max(0, math.sin(time_elapsed * speed * 2 + phase)) * 800 * asymmetry_factor)
            fsrHeel = 0
            fsrM5 = 0
            fsrM1 = 0
            fsrToe = 0
            micData = int(math.sin(time_elapsed * 10) * 150)
        else:
            # Lower nodes have FSRs
            emgValue = 0
            fsrVal = int(pressurePhase * 1023 * asymmetry_factor)
            fsrHeel = int(fsrVal * 0.4)
            fsrM5 = int(fsrVal * 0.2)
            fsrM1 = int(fsrVal * 0.2)
            fsrToe = int(fsrVal * 0.2)
            micData = 0
        
        chunk = struct.pack(
            STRUCT_FMT,
            node_id,
            accelX, accelY, accelZ,
            gyroX, gyroY, gyroZ,
            footAccelX, footAccelY, footAccelZ,
            footGyroX, footGyroY, footGyroZ,
            temperature,
            emgValue,
            fsrHeel, fsrM5, fsrM1, fsrToe,
            micData
        )
        payload += chunk
        
    return payload

def start_sender():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    host = UDP_HOST if UDP_HOST != "0.0.0.0" else "127.0.0.1"
    
    print(f"Simulating ESP32 Master... streaming data to {host}:{UDP_PORT} at 60Hz")
    print("Press CTRL+C to stop.")
    
    start_time = time.time()
    try:
        while True:
            time_elapsed = time.time() - start_time
            payload = generate_synthetic_payload(time_elapsed)
            sock.sendto(payload, (host, UDP_PORT))
            time.sleep(0.016) # ~60fps
    except KeyboardInterrupt:
        print("\nStopping simulated sender.")
    finally:
        sock.close()

if __name__ == "__main__":
    start_sender()
