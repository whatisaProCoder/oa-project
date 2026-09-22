# Backend Bridge

This directory contains the Python integration layer connecting the ESP32 UDP network stream to the Machine Learning pipeline and the React dashboard.

## Architecture

1. **`udp_receiver.py`**: Binds to a local port (default `0.0.0.0:12345`) and listens for UDP packets streamed from the Master ESP32.
2. **`protocol.py`**: Translates the raw C++ binary `struct_message` array into Python dictionaries.
3. **`inference_service.py`**: Adapter connecting telemetry to the ML pipeline. Computes continuous gait features (`knee_variance`, `pressure_asymmetry`, `gait_speed`) and invokes `machine_learning.edge_inference` (XGBoost + SHAP + BM25 + localized LLM).
4. **`api_server.py`**: FastAPI server running on port `8000`. Exposes:
   - **`/ws` (WebSocket)**: Pushes real-time 60Hz sensor streams, 3D kinematic orientations, per-node connection health (`nodeStatus`), and ML insights directly to the dashboard.
   - **`/api/status` (GET)**: Current raw telemetry snapshot and node states.
   - **`/api/analyze` (POST)**: Batch kinematic & clinical load analysis over 30-second assessment sessions.
   - **`/api/calibrate` (POST)**: Broadcasts UDP `CALIBRATE` packet to ESP32s to zero IMU drift.

## UDP Protocol

The ESP32 Master broadcasts a **320-byte payload** representing an array of 4 nodes:
- Node 0: Right Upper (Master - Thigh IMU, Quadriceps EMG, INMP441 Acoustic Mic)
- Node 1: Left Upper (Slave - Thigh IMU, Quadriceps EMG, INMP441 Acoustic Mic)
- Node 2: Left Lower (Slave - Shank IMU, Foot IMU, 4x FSR Insole Array)
- Node 3: Right Lower (Slave - Shank IMU, Foot IMU, 4x FSR Insole Array)

Each node is packed in little-endian format as an 80-byte C++ struct (`<B3x13f6i`):

| Field | Type | Size | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uint8_t` | 1 byte (+ 3 bytes pad) | Node ID (0 = R Upper, 1 = L Upper, 2 = L Lower, 3 = R Lower) |
| `accelX`, `accelY`, `accelZ` | `float` (x3) | 12 bytes | Primary (Thigh or Shank) Accelerometer ($m/s^2$) |
| `gyroX`, `gyroY`, `gyroZ` | `float` (x3) | 12 bytes | Primary (Thigh or Shank) Gyroscope ($rad/s$) |
| `footAccelX`, `footAccelY`, `footAccelZ` | `float` (x3) | 12 bytes | Foot Accelerometer (Nodes 2 & 3; 0 on upper nodes) |
| `footGyroX`, `footGyroY`, `footGyroZ` | `float` (x3) | 12 bytes | Foot Gyroscope (Nodes 2 & 3; 0 on upper nodes) |
| `temperature` | `float` | 4 bytes | Skin/joint temperature (°C, simulated ~37.0°C fallback) |
| `emgValue` | `int32_t` | 4 bytes | Quadriceps Muscle Activation (12-bit ADC, 0–4095) |
| `fsrHeel` | `int32_t` | 4 bytes | Plantar Pressure - Heel |
| `fsrM5` | `int32_t` | 4 bytes | Plantar Pressure - 5th Metatarsal (Outer edge) |
| `fsrM1` | `int32_t` | 4 bytes | Plantar Pressure - 1st Metatarsal (Ball of foot) |
| `fsrToe` | `int32_t` | 4 bytes | Plantar Pressure - Hallux / Big Toe |
| `micData` | `int32_t` | 4 bytes | INMP441 I2S Digital Acoustic Audio Amplitude |
| `fsrValue` | `int32_t` | 4 bytes | Reserved / Backward compatibility |

### Acoustic Calibration (dB SPL)
The INMP441 samples raw 24-bit audio PCM integers (`micData` ~10,000 to 1,000,000). The bridge converts this to calibrated Sound Pressure Level decibels:
$$\text{dB SPL} = 20 \times \log_{10}(\text{raw amplitude}) - 55$$
This yields realistic room ambient levels (~50–55 dB) and crepitus peaks (~70–85 dB), clamped cleanly between 30 dB and 100 dB.

## Usage

**1. Install Prerequisites:**
```bash
pip install -r backend_bridge/requirements.txt
pip install websockets uvicorn[standard]
```

**2. Start the Full Backend Bridge & API Server:**
```bash
python -m backend_bridge.api_server
```
*(Server listens for UDP packets on `0.0.0.0:12345` and serves FastAPI/WebSockets on `http://localhost:8000`)*

**3. Run Simulated Hardware (No ESP32 Required):**
If testing without physical hardware, launch the simulated packet generator in another terminal:
```bash
python -m backend_bridge.test_simulated_sender
```

**4. Run Automated Protocol & Integration Tests:**
```bash
python -m unittest discover backend_bridge
```
