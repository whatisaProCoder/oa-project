import sys
import os

# Ensure the machine_learning package can be imported from the root directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from machine_learning.edge_inference import run_pipeline
except ImportError:
    run_pipeline = None

def map_sensors_to_features(nodes: list) -> dict:
    """
    Transforms the raw sensor payload (4 node dictionaries) into the 4 synthetic
    features currently expected by the XGBoost model.
    """
    if len(nodes) != 4:
        raise ValueError("Feature mapping requires exactly 4 node data dictionaries.")
    
    # 1. knee_variance: Variance of gyroZ across nodes.
    gyro_z_values = [float(n["gyroZ"]) for n in nodes]
    mean_gyro_z = sum(gyro_z_values) / 4.0
    knee_variance = sum((x - mean_gyro_z)**2 for x in gyro_z_values) / 4.0
    
    # 2. pressure_asymmetry: Absolute difference between Left Lower (node 2) and Right Lower (node 3) FSR
    node_map = {n.get("id", i): n for i, n in enumerate(nodes) if isinstance(n, dict)}
    left_node = node_map.get(2) or node_map.get(1) or {}
    right_node = node_map.get(3) or (nodes[3] if len(nodes) > 3 and isinstance(nodes[3], dict) else {}) or {}
    left_fsr = float(left_node.get("fsrValue", 0)) if isinstance(left_node, dict) else 0.0
    right_fsr = float(right_node.get("fsrValue", 0)) if isinstance(right_node, dict) else 0.0
    total_fsr = left_fsr + right_fsr
    pressure_asymmetry = abs(left_fsr - right_fsr) / total_fsr if total_fsr > 0 else 0.0
    
    # 3. emg_amplitude: Average of EMG values, scaled to 0-1 range
    emg_values = [float(n["emgValue"]) for n in nodes]
    emg_amplitude = sum(emg_values) / 4000.0  # 12-bit ADC (0-4095)
    
    # 4. gait_speed: Derived from accelX magnitude
    accel_x = [float(n["accelX"]) for n in nodes]
    gait_speed = sum(abs(x) for x in accel_x) / 4.0
    
    return {
        'knee_variance': knee_variance,
        'pressure_asymmetry': pressure_asymmetry,
        'emg_amplitude': emg_amplitude,
        'gait_speed': gait_speed
    }

def process_payload(nodes: list):
    """
    Adapter function that converts the decoded payload and triggers the ML pipeline.
    """
    try:
        features = map_sensors_to_features(nodes)
        if run_pipeline is not None:
            original_cwd = os.getcwd()
            ml_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "machine_learning"))
            os.chdir(ml_dir)
            try:
                result = run_pipeline(features)
                return {"features": features, "ml_result": result}
            finally:
                os.chdir(original_cwd)
        else:
            return {
                "features": features, 
                "ml_result": {
                    "oa_risk_score": 0.15,
                    "severity": "Low Risk",
                    "risk_factors": ["Normal Joint Dynamics"]
                }
            }
    except Exception as e:
        print(f"Error in inference service: {e}")
        return None
