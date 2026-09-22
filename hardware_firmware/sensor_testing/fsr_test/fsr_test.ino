/*
  FSR402 Single Sensor Test
  
  Reads the analog voltage from an FSR (Force Sensitive Resistor) 
  and converts it to an approximate force/weight value.
  
  Set your Serial Monitor to 115200 baud.
*/

// Connect the FSR voltage divider output to this pin
#define FSR_PIN 35 

void setup() {
  Serial.begin(115200);
  
  // Set ADC resolution to 12 bits (0-4095) for ESP32
  analogReadResolution(12);
  
  Serial.println("FSR Test Started...");
  Serial.println("Press on the FSR to see values change.");
}

void loop() {
  int rawADC = analogRead(FSR_PIN);
  
  // Map the raw ADC value (0-4095) to a rough percentage (0-100%)
  // Note: FSRs are non-linear, so this is just for basic testing/visualization
  int forcePercentage = map(rawADC, 0, 4095, 0, 100);

  Serial.print("Raw ADC: ");
  Serial.print(rawADC);
  Serial.print(" | Approximate Force: ");
  Serial.print(forcePercentage);
  Serial.println("%");

  delay(200); // Read 5 times a second
}
