# OsteoSync Dashboard

A modern clinical web application and 3D digital twin interface for real-time Osteoarthritis (OA) risk detection, biomechanical analysis, and clinical reporting.

Built with **React 19**, **TypeScript**, **Vite**, **TailwindCSS**, **Three.js** (`@react-three/fiber`), and **Recharts**.

---

## Key Features

### 1. 3D Digital Twin Kinematic Visualizer
- Powered by `@react-three/fiber` and `@react-three/drei`.
- Renders a biomechanical 3D twin of both legs responding live to thigh, shank, and foot IMU angles.
- Color-coded joint stress indicators and live angle metrics.

### 2. Dual-Mode Telemetry Stream
- **Live Mode**: Establishes a 60Hz WebSocket connection (`ws://localhost:8000/ws`) with automatic reconnection to the Python backend bridge. Displays live telemetry from physical ESP32 wearable hardware.
- **Mock Mode**: Built-in physiological gait simulation engine generating synchronized natural cadence walking cycles, heel-to-toe plantar pressure waves, and EMG activation curves for offline demos and testing.

### 3. Comprehensive Clinical Views
- **Assessment Tab**:
  - Multi-phase 30-second Clinical Test Wizard (Calibrate ➔ Walk ➔ Squat).
  - OA Risk Gauge (Low / Moderate / High) powered by edge XGBoost inference.
  - Explainable AI (SHAP) feature contribution factors.
  - Multilingual AI insight recommendations backed by medical literature.
- **Live Feeds Tab**:
  - Real-time kinematic graphs (Accelerometer & Gyroscope waveforms for thigh, shank, and foot).
  - Calibrated acoustic joint crepitus waveforms in decibels (dB SPL).
  - Quadriceps EMG muscle activation graphs.
  - Interactive 4-zone plantar pressure heatmaps (Heel, M5, M1, Toe).
  - Skin temperature monitoring (°C).
- **Gait Analysis Tab**:
  - Stride time, cadence, stance vs. swing phase percentage, and symmetry indices.
  - Sagittal and frontal plane joint range of motion (ROM).
- **Clinical Report Tab**:
  - Formal diagnostic summary table with patient demographics.
  - Automated one-click PDF export using `jsPDF` for patient medical records.

### 4. Per-Node Hardware Status & TopBar
- Monitors connection health, latency, battery levels, and online/offline status for all 4 physical wearable nodes:
  - `R_LEG_THIGH` (Master Node 0)
  - `L_LEG_THIGH` (Slave Node 1)
  - `L_LEG_SHANK` (Slave Node 2)
  - `R_LEG_SHANK` (Slave Node 3)
- Editable patient demographic dialog.
- Multilingual interface supporting **English**, **Hindi (हिंदी)**, **Assamese (অসমীয়া)**, and **Bengali (বাংলা)**.

### 5. One-Click Neutral Pose Calibration (Zero Control)
- **Upright Neutral Baseline**: Accessible directly from the **TopBar** and **3D Digital Twin** viewport. When the patient stands upright and still, clicking `[CALIBRATE POSE]` records the current strap angles as the $0^\circ$ neutral baseline.
- **Zero Firmware Changes Required**: Software tare subtracts neutral offsets ($\theta = \theta_{\text{raw}} - \theta_{\text{neutral}}$), eliminating the need to modify, re-tune, or re-flash ESP32 firmware whenever straps or mounting angles change.
- **Persistent Storage**: Baseline offsets are saved to browser `localStorage` (`oa_calibration_offsets`) so calibration persists across browser refreshes.
- **Clinical Wizard Auto-Calibration**: Step 2 of the Clinical Assessment Wizard automatically locks in this neutral baseline after a 10-second upright standing countdown while broadcasting a UDP zero-drift command to the ESP32 network.

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
```bash
cd dashboard
npm install
```

### Running Locally
```bash
npm run dev
```
The application will start locally at `http://localhost:5173`.

### Production Build
```bash
npm run build
npm run preview
```

---

## Directory Structure

```
dashboard/
├── src/
│   ├── components/
│   │   ├── 3d/                 # Three.js / R3F Leg Digital Twin
│   │   ├── assessment/         # Test Wizard and AI Insights Panel
│   │   ├── cards/              # Metric cards, status badges, risk meters
│   │   ├── layout/             # Navigation, TopBar, Patient Dialog
│   │   ├── tabs/               # Assessment, LiveFeeds, GaitAnalysis, ClinicalReport
│   │   └── visualizations/     # SignalChart (Recharts), PressureHeatmap
│   ├── hooks/                  # useSensorStream (WebSocket + auto-reconnect)
│   ├── i18n/                   # Multi-language translation dictionaries
│   ├── types/                  # TypeScript data contracts & sensor interfaces
│   ├── App.tsx                 # Root application state & router
│   └── main.tsx                # React entry point
├── public/                     # Static assets & 3D models
└── package.json
```
