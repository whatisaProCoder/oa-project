# AI-Assisted Early Detection System for Osteoarthritis (OA) Risk Markers

## 📌 Project Overview
This project is an advanced, standalone wearable hardware-software platform designed to assist healthcare practitioners and clinical researchers in identifying early risk markers and symptoms of Osteoarthritis (OA).

The solution utilizes an array of edge sensors to capture gait, joint movement, acoustic, and pressure data. It uses an **XGBoost model** for risk scoring and a **lightweight LLM with a BM25 Knowledge Base** running on a Raspberry Pi 3 to generate actionable insights based on medical literature.

---


## 🏗️ Hardware Architecture
The device is a standalone wearable system attached across both legs, divided into 4 physical nodes communicating via **ESP-NOW** and **UDP over Wi-Fi**:

*   **Node 0 (Right Upper / Thigh - Master Hub):**
    *   ESP32 Microcontroller (Wi-Fi + ESP-NOW coordinator)
    *   MPU6050 IMU (Thigh movement/kinematics)
    *   INMP441 I2S Digital Microphone (Knee acoustic emissions)
    *   EMG Muscle Sensor V3.0 (Quadriceps activation via B0505S dual-rail power)
    *   Simulated physiological temperature fallback (~37.0°C)
*   **Node 1 (Left Upper / Thigh - Slave):**
    *   ESP32 Microcontroller
    *   MPU6050 IMU (Dual I2C auto-detect `0x68`/`0x69`)
    *   INMP441 I2S Digital Microphone
    *   EMG Muscle Sensor V3.0 (Left Quadriceps activation)
    *   Simulated physiological temperature fallback (~37.0°C)
*   **Node 2 (Left Lower / Shank & Foot - Slave):**
    *   ESP32 Microcontroller
    *   MPU6050 IMU × 2 (Shank at `0x68`, Foot at `0x69`)
    *   4x FSR402 Insole Pressure Array (Heel, M5, M1, Toe)
    *   Optional MLX90614 Infrared Temp (with simulated ~37.0°C fallback)
*   **Node 3 (Right Lower / Shank & Foot - Slave):**
    *   ESP32 Microcontroller
    *   MPU6050 IMU × 2 (Shank at `0x68`, Foot at `0x69`)
    *   4x FSR402 Insole Pressure Array (Heel, M5, M1, Toe)
    *   Optional MLX90614 Infrared Temp (with simulated ~37.0°C fallback)

> **Network Flow:** The 3 Slave nodes auto-sync their Wi-Fi channel with the Master and stream via **ESP-NOW**. The Master aggregates all 4 limbs into a standardized **320-byte binary packet** and broadcasts it via **UDP on port 12345** to the local Edge Server (PC/Raspberry Pi).

---

## 🧠 Software & AI Pipeline

### 1. Sensor Fusion & Auto-Calibration (ESP32)
The ESP32s collect raw data from the IMUs, FSRs, EMGs, etc. To ensure clinical data fidelity, the system enforces a strict 10-second auto-calibration routine at the start of a test to calculate and zero out hardware drift. This hardware data is fused with a digital **WOMAC Clinical Survey** taken at the start of the assessment. Instead of streaming high-frequency raw data to the Pi for processing, the ESP32s compute summary statistics over a rolling window and send these feature vectors.

### 2. Risk Assessment Model (XGBoost)
We will train an XGBoost model using publicly available gait and OA datasets to map our sensor features to an OA Risk Score. The XGBoost model is extremely lightweight and will run seamlessly on the Pi.

*   **Statistical Data Augmentation:** To ensure a balanced and robust model, statistical augmentation techniques (like SMOTE and synthetic feature variance generation) are applied to the baseline datasets to overcome real-world class imbalances.

### 3. Edge LLM & Knowledge Base (Raspberry Pi 3)
*   **Explainable AI (SHAP):** We use a lightweight SHAP (SHapley Additive exPlanations) TreeExplainer on the XGBoost model to instantly identify exactly which biomechanical factors (e.g., pressure asymmetry vs knee crepitus) are driving the patient's risk score.
*   **Constraint:** The Raspberry Pi 3 has only 1GB RAM, meaning standard RAG (Vector Databases + large LLMs) will crash.
*   **Knowledge Base:** We will build an inverted index using **BM25** (via the `rank_bm25` Python library) on the literature list. It is fast and requires almost zero memory.
*   **LLM Engine (Multilingual):** We will run a heavily quantized, sub-1-billion parameter model (like `Qwen2-0.5B-Instruct.Q4_K_M.gguf`) using `llama.cpp`. The Qwen2 architecture is natively pretrained on multiple regional languages. It synthesizes the XGBoost sensor score with the subjective WOMAC survey score and seamlessly translates highly localized clinical advice into the healthcare worker's native vernacular (Hindi, Assamese, Bengali, etc.).
*   **Flow:** XGBoost outputs a risk score -> BM25 searches the literature for relevant insights based on the anomalies -> The LLM formulates a brief, actionable recommendation for the healthcare worker.

---

## 📂 Datasets for Training
To train the XGBoost model, the AI extracts corresponding features (kinematics, plantar pressure, muscle activity) from these datasets to simulate our hardware outputs. Features from one-legged datasets and specialized plantar foot pressure databases are actively extracted and fused into the training pipeline via Statistical Data Augmentation.

1.  [Osteoarthritis Initiative (OAI) Dataset](https://www.kaggle.com/datasets/jeftaadriel/osteoarthritis-initiative-oai-dataset) *(Baseline clinical data)*
2.  [Modulation of Plantar Pressure and Muscle During Gait v1.0.0](https://physionet.org/content/plantar/1.0.0/) *(FSR and EMG data mapping)*
3.  [Gait in Parkinson's Disease v1.0.0](https://www.physionet.org/content/gaitpdb/1.0.0/)
4.  [Gait in Neurodegenerative Disease Database v1.0.0](https://physionet.org/content/gaitndd/1.0.0/)
5.  [Gait in Aging and Disease Database v1.0.0](https://physionet.org/content/gaitdb/1.0.0/) *(Highly relevant for baseline gait kinematics)*
6.  [Long Term Movement Monitoring Database v1.0.0](https://physionet.org/content/ltmm/1.0.0/LabWalks/) *(IMU mapping)*
7.  [A multimodal gait dataset of brain activity... v1.0.0](https://physionet.org/content/multimodal-gait-dataset/1.0.0/Dataset/) *(Kinematics, muscle, ground forces)*

---

## 📚 Literature for the BM25 Knowledge Base
The text from these papers must be scraped/parsed into text chunks to feed the BM25 algorithm.

*   [Wearable Inertial Sensors for Gait Analysis in Adults with OA — PDF](https://pdfs.semanticscholar.org/58d0/db5bf55ce79d8f77ceace9536d0ee1fa697a.pdf)
*   [Wearable Inertial Sensors for Gait Analysis in Adults with OA — Article](https://www.mdpi.com/1424-8220/20/24/7143)
*   [Independent Gait Parameters for Knee and Hip OA Using Wearable Sensors](https://pmc.ncbi.nlm.nih.gov/articles/PMC7931541/)
*   [IMUs for Remote Healthcare in Hip and Knee OA — Article](https://rehab.jmir.org/2022/2/e33521)
*   [Sensor-Based Monitoring of Knee OA Symptoms — PDF](https://www.jmir.org/2026/1/e84262/PDF)
*   [Tracking Osteoarthritic Gait Using Wearable Sensors — PDF](https://macsphere.mcmaster.ca/bitstreams/7dc3e617-dc68-4e3f-bb9c-856103eb1c46/download)
*   [Plantar Pressure Distribution in Early-Stage Knee OA](https://pubmed.ncbi.nlm.nih.gov/39939097/)
*   [Relationship Between Plantar Foot Pressure and Knee OA](https://www.ors.org/transactions/51/1435.pdf)
*   [Wearable Sensors and AI for Ecological Knee OA Assessment — PDF](https://documentserver.uhasselt.be/bitstream/1942/49487/1/sensors-26-03563-v2.pdf)
*   [Wearable Sensors for Parkinson’s Gait Assessment](https://www.nature.com/articles/s41746-024-01163-z)
*   [Wearable Sensors for Fall-Risk Assessment in Neurological Conditions](https://pmc.ncbi.nlm.nih.gov/articles/PMC12402735/)
*   [Gait Sensors for Neurodegenerative Diseases — PhysioNet overview](https://physionet.org/content/?topic=gait)

---

## ⚡ Quickstart & Running the System

To start the full end-to-end system:

1. **Start Backend & Edge AI Service:**
   ```bash
   python -m backend_bridge.api_server
   ```
2. **Start Clinical Dashboard:**
   ```bash
   cd dashboard && npm run dev
   ```
3. **Open Visualizer:**
   Navigate to `http://localhost:5173` to see the live 3D Digital Twin and gait telemetry.
