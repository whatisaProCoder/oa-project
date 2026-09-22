import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import threading
import uvicorn
import asyncio
import time
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend_bridge.udp_receiver import start_receiver, LATEST_DATA

app = FastAPI()

# Allow CORS for the React dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def map_to_sensor_data(latest_data):
    now_ts = time.time()
    last_pkt_time = latest_data.get("timestamp") if latest_data else None
    is_connected = bool(last_pkt_time and (now_ts - last_pkt_time < 2.5))

    nodes = {}
    if latest_data and latest_data.get("raw_nodes"):
        nodes = { n["id"]: n for n in latest_data["raw_nodes"] }
        
    def extract_imu(node):
        if not node:
            return {"ax": 0, "ay": 0, "az": 0, "gx": 0, "gy": 0, "gz": 0}
        return {
            "ax": node["accelX"], "ay": node["accelY"], "az": node["accelZ"],
            "gx": node["gyroX"], "gy": node["gyroY"], "gz": node["gyroZ"]
        }
        
    def extract_foot_imu(node):
        if not node:
            return {"ax": 0, "ay": 0, "az": 0, "gx": 0, "gy": 0, "gz": 0}
        return {
            "ax": node.get("footAccelX", 0), "ay": node.get("footAccelY", 0), "az": node.get("footAccelZ", 0),
            "gx": node.get("footGyroX", 0), "gy": node.get("footGyroY", 0), "gz": node.get("footGyroZ", 0)
        }
        
    n0 = nodes.get(0) # Right Upper (Master)
    n1 = nodes.get(1) # Left Upper
    n2 = nodes.get(2) # Left Lower (Shank + Foot IMUs + FSRs)
    n3 = nodes.get(3) # Right Lower (Shank + Foot IMUs + FSRs)

    import math
    def raw_mic_to_db(raw_val):
        if not raw_val or raw_val <= 0:
            return 0.0
        try:
            # INMP441 raw 24-bit audio amplitude ranges from ~500 to ~1,000,000
            # Calibrated mapping to Sound Pressure Level (dB SPL):
            # Baseline ambient room ~45-55 dB, Crepitus/clunk peak ~70-90 dB
            db = 20.0 * math.log10(max(float(raw_val), 1.0)) - 55.0
            return round(max(30.0, min(100.0, db)), 1)
        except Exception:
            return 0.0

    left_pressure = {
        "heel": n2.get("fsrHeel", 0) if n2 else 0,
        "m5": n2.get("fsrM5", 0) if n2 else 0,
        "m1": n2.get("fsrM1", 0) if n2 else 0,
        "toe": n2.get("fsrToe", 0) if n2 else 0
    }
    
    left_leg = {
        "thighIMU": extract_imu(n1),
        "shankIMU": extract_imu(n2),
        "footIMU": extract_foot_imu(n2), 
        "pressure": left_pressure,
        "kneeTemp": n1.get("temperature", 0) if n1 else 0,
        "ankleTemp": n2.get("temperature", 0) if n2 else 0,
        "quadEMG": n1.get("emgValue", 0) if n1 else 0,
        "kneeAcoustic": raw_mic_to_db(n1.get("micData", 0)) if n1 else 0
    }

    right_pressure = {
        "heel": n3.get("fsrHeel", 0) if n3 else 0,
        "m5": n3.get("fsrM5", 0) if n3 else 0,
        "m1": n3.get("fsrM1", 0) if n3 else 0,
        "toe": n3.get("fsrToe", 0) if n3 else 0
    }

    right_leg = {
        "thighIMU": extract_imu(n0),
        "shankIMU": extract_imu(n3),
        "footIMU": extract_foot_imu(n3), 
        "pressure": right_pressure,
        "kneeTemp": n0.get("temperature", 0) if n0 else 0,
        "ankleTemp": n3.get("temperature", 0) if n3 else 0,
        "quadEMG": n0.get("emgValue", 0) if n0 else 0,
        "kneeAcoustic": raw_mic_to_db(n0.get("micData", 0)) if n0 else 0
    }
    
    latency = 0
    if last_pkt_time:
        latency = max(0, int((now_ts - last_pkt_time) * 1000))

    # Determine individual node active state based on packet receipt & sensor heartbeat
    is_n1_active = bool(n1 and (n1.get("temperature", 0) > 20.0 or n1.get("accelZ", 0) != 0))
    is_n2_active = bool(n2 and (n2.get("temperature", 0) > 20.0 or n2.get("accelZ", 0) != 0))
    is_n3_active = bool(n3 and (n3.get("temperature", 0) > 20.0 or n3.get("accelZ", 0) != 0))

    return {
        "timestamp": datetime.now().isoformat() + "Z",
        "leftLeg": left_leg,
        "rightLeg": right_leg,
        "isConnected": is_connected,
        "latencyMs": latency,
        "mlResult": latest_data.get("ml_result") if latest_data else None,
        "nodeStatus": {
            "R_LEG_THIGH": is_connected,
            "L_LEG_THIGH": is_connected and is_n1_active,
            "L_LEG_SHANK": is_connected and is_n2_active,
            "R_LEG_SHANK": is_connected and is_n3_active
        }
    }

@app.get("/api/status")
def get_status():
    return LATEST_DATA

from pydantic import BaseModel
from typing import List, Dict, Any
import statistics
import os

class AnalyzeRequest(BaseModel):
    captured_data: List[Dict[Any, Any]]
    womac_score: Dict[str, int] = None
    language: str = "English"

@app.post("/api/analyze")
def analyze_data(req: AnalyzeRequest):
    data = req.captured_data
    if not data:
        return {"error": "No data"}
        
    try:
        # Segment data by phase if available (Phase 2 = Walk)
        phase2_data = [d for d in data if d.get("phase") == 2]
        walk_data = phase2_data if phase2_data else data
        
        # Calculate kinematics ONLY during the Walking phase
        gz_values = []
        for d in walk_data:
            gz_values.append(d["leftLeg"]["shankIMU"]["gz"])
            gz_values.append(d["rightLeg"]["shankIMU"]["gz"])
        knee_variance = statistics.variance(gz_values) if len(gz_values) > 1 else 0

        left_ax = [d["leftLeg"]["thighIMU"]["ax"] for d in walk_data]
        right_ax = [d["rightLeg"]["thighIMU"]["ax"] for d in walk_data]
        gait_speed = (sum(abs(x) for x in left_ax) + sum(abs(x) for x in right_ax)) / (len(left_ax) + len(right_ax)) if (left_ax or right_ax) else 0

        # Calculate clinical load distribution over the ENTIRE 30-second assessment
        left_fsrs = [d["leftLeg"]["pressure"]["heel"] for d in data]
        right_fsrs = [d["rightLeg"]["pressure"]["heel"] for d in data]
        avg_left = sum(left_fsrs) / len(left_fsrs) if left_fsrs else 0
        avg_right = sum(right_fsrs) / len(right_fsrs) if right_fsrs else 0
        total_fsr = avg_left + avg_right
        pressure_asymmetry = abs(avg_left - avg_right) / total_fsr if total_fsr > 0 else 0

        left_emg = [d["leftLeg"]["quadEMG"] for d in data]
        right_emg = [d["rightLeg"]["quadEMG"] for d in data]
        avg_emg = (sum(left_emg) + sum(right_emg)) / (len(left_emg) + len(right_emg)) if (left_emg or right_emg) else 0
        emg_amplitude = avg_emg / 4000.0

        features = {
            'knee_variance': knee_variance,
            'pressure_asymmetry': pressure_asymmetry,
            'emg_amplitude': emg_amplitude,
            'gait_speed': gait_speed,
            'womac_score': req.womac_score,
            'language': req.language
        }
    except Exception as e:
        return {"error": f"Failed to parse features: {str(e)}"}

    original_cwd = os.getcwd()
    ml_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "machine_learning"))
    os.chdir(ml_dir)
    
    try:
        import sys
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
        from machine_learning.edge_inference import run_pipeline
        result = run_pipeline(features)
        
        from machine_learning.edge_inference import _current_insight, _llm_thread
        if _llm_thread:
            _llm_thread.join() # Wait indefinitely for the LLM to finish generating
            
        # Re-import to get the final generated string
        from machine_learning.edge_inference import _current_insight
        result["insight"] = _current_insight

        return {"features": features, "ml_result": result}
    except Exception as e:
        print(f"Error in inference service: {e}")
        return {"error": str(e)}
    finally:
        os.chdir(original_cwd)

@app.post("/api/calibrate")
def trigger_calibration():
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    try:
        # Broadcast to both Windows PC Hotspot (192.168.137.x) and Pi Hotspot (192.168.4.x)
        for bcast_ip in ("192.168.137.255", "192.168.4.255", "255.255.255.255"):
            try:
                sock.sendto(b"CALIBRATE", (bcast_ip, 12345))
            except Exception:
                pass
        return {"status": "calibration_triggered"}
    except Exception as e:
        return {"error": str(e)}
    finally:
        sock.close()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = map_to_sensor_data(LATEST_DATA)
            if data:
                await websocket.send_json(data)
            await asyncio.sleep(0.016) # ~60fps
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")

def main():
    print("Starting UDP receiver thread...")
    udp_thread = threading.Thread(target=start_receiver, daemon=True)
    udp_thread.start()
    
    print("Starting FastAPI server on port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    main()
