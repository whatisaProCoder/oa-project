/*
  EMG Muscle Sensor V3.0 Test Sketch
  Configured to match wearable node wiring (Node 0 Master & Node 1 Left Upper)

  Pin Connections (Identical to Node):
    - EMG SIG  -> ESP32 GPIO 34 (ADC1_CH6)
    - EMG +Vs  -> +5V (From ±5V Dual-Rail Boost Converter)
    - EMG -Vs  -> -5V (From ±5V Dual-Rail Boost Converter)
    - EMG GND  -> ESP32 GND (Common Ground tied to Boost GND)

  Serial Monitor / Serial Plotter: 115200 baud
*/

// Connect the SIG pin of the EMG sensor to GPIO 34 (matching node firmware)
#define EMG_PIN 34 

void setup() {
  Serial.begin(115200);
  
  // Power-up stabilization delay (matching node firmware boot fix)
  delay(2000);
  
  // Set ADC resolution to 12 bits (0-4095) for ESP32 ADC1
  analogReadResolution(12);
  
  Serial.println("\n\n==========================================");
  Serial.println("   EMG Muscle Sensor V3.0 Testing Suite   ");
  Serial.println("==========================================");
  Serial.println("Node-matched pinout: SIG -> GPIO 34 | +Vs -> +5V | -Vs -> -5V | GND -> Common GND");
  Serial.println("Observe resting baseline, then flex target muscle to verify activation response.\n");
}

void loop() {
  // 1. Read the raw 12-bit analog signal (0 - 4095)
  int rawEMG = analogRead(EMG_PIN);

  // 2. Dynamic baseline tracking & rectified activation envelope
  static float baseline = 0;
  static float smoothedEnvelope = 0;

  // Slowly converge to DC baseline offset
  if (baseline == 0) {
    baseline = rawEMG;
  } else {
    baseline = (0.01f * rawEMG) + (0.99f * baseline);
  }

  // Rectify signal around baseline
  float rectified = abs(rawEMG - baseline);

  // Exponential Moving Average (EMA) envelope (0.1 = fast, 0.9 = smooth)
  smoothedEnvelope = (0.1f * rectified) + (0.9f * smoothedEnvelope);

  // 3. Serial Plotter and Monitor friendly output
  // Open Tools > Serial Plotter to see real-time graph of all 3 traces
  Serial.print("Raw_ADC:");
  Serial.print(rawEMG);
  Serial.print(" ");
  Serial.print("Envelope:");
  Serial.print((int)smoothedEnvelope);
  Serial.print(" ");
  Serial.print("Baseline:");
  Serial.println((int)baseline);

  delay(20); // 50 Hz sampling rate (matches node loop rate)
}
