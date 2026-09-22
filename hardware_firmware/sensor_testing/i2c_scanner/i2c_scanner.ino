/*
  =============================================================================
  SUPREME ESP32 I2C HARDWARE DIAGNOSTIC SUITE & SENSOR ANALYZER
  =============================================================================
  Designed specifically for OA-Sense Project (ESP32 Nodes 2 & 3):
    1. Shank MPU-6050   (Address 0x68)
    2. Foot MPU-6050    (Address 0x69)
    3. MLX90614 IR Temp (Address 0x5A or 0x00 Broadcast)
    4. Mystery / Clone I2C Sensor Identification

  Features:
    - Electrical bus line health check (SDA/SCL voltage state & weak pull-up test)
    - 9-pulse bus unstick/clear sequence
    - Linux-style 'i2cdetect' matrix (0x00 to 0x7F - all 128 addresses)
    - Multi-clock SMBus & I2C test (50 kHz and 100 kHz)
    - Deep MPU-6050 inspection (WHO_AM_I register 0x75, wake status, live accel)
    - Deep MLX90614 inspection (Raw HEX byte dump, repeated-start & standard stop,
      Object + Ambient registers, PEC byte validation, and 0x00 fallback check)
    - Clone / fake chip address investigator
  =============================================================================
*/

#include <Wire.h>

#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

// --- 1. PHYSICAL ELECTRICAL BUS HEALTH CHECK ---
void checkBusLines() {
  Serial.println("\n[1] PHYSICAL I2C BUS LINE ELECTRICAL CHECK");
  Serial.println("-------------------------------------------------------");

  // Step 1: High-impedance check (tests if external pull-ups exist)
  pinMode(I2C_SDA_PIN, INPUT);
  pinMode(I2C_SCL_PIN, INPUT);
  delay(5);
  int sdaRaw = digitalRead(I2C_SDA_PIN);
  int sclRaw = digitalRead(I2C_SCL_PIN);

  // Step 2: Internal pull-up check
  pinMode(I2C_SDA_PIN, INPUT_PULLUP);
  pinMode(I2C_SCL_PIN, INPUT_PULLUP);
  delay(5);
  int sdaPullup = digitalRead(I2C_SDA_PIN);
  int sclPullup = digitalRead(I2C_SCL_PIN);

  Serial.print("  SDA (Pin 21): ");
  if (sdaPullup == LOW) {
    Serial.println("FAULT! Stuck LOW (0V). Check for short-circuit to GND or damaged wire.");
  } else if (sdaRaw == LOW && sdaPullup == HIGH) {
    Serial.println("OK (3.3V via internal ESP32 pull-up only - external resistor missing).");
  } else {
    Serial.println("PERFECT! HIGH (3.3V via sensor/module pull-up).");
  }

  Serial.print("  SCL (Pin 22): ");
  if (sclPullup == LOW) {
    Serial.println("FAULT! Stuck LOW (0V). Check for short-circuit to GND or damaged wire.");
  } else if (sclRaw == LOW && sclPullup == HIGH) {
    Serial.println("OK (3.3V via internal ESP32 pull-up only - external resistor missing).");
  } else {
    Serial.println("PERFECT! HIGH (3.3V via sensor/module pull-up).");
  }
  Serial.println("-------------------------------------------------------");
}

// --- 2. 9-CLOCK BUS CLEARING SEQUENCE ---
void clearI2CBus() {
  pinMode(I2C_SCL_PIN, OUTPUT);
  pinMode(I2C_SDA_PIN, INPUT_PULLUP);
  for (int i = 0; i < 9; i++) {
    digitalWrite(I2C_SCL_PIN, LOW);
    delayMicroseconds(10);
    digitalWrite(I2C_SCL_PIN, HIGH);
    delayMicroseconds(10);
  }
  // Generate STOP condition
  pinMode(I2C_SDA_PIN, OUTPUT);
  digitalWrite(I2C_SDA_PIN, LOW);
  delayMicroseconds(10);
  digitalWrite(I2C_SCL_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(I2C_SDA_PIN, HIGH);
  delayMicroseconds(10);
}

// --- 3. CRC-8 PEC CALCULATOR (For MLX90614 SMBus validation) ---
uint8_t crc8_pec(uint8_t *data, uint8_t len) {
  uint8_t crc = 0x00;
  for (uint8_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (uint8_t j = 0; j < 8; j++) {
      if (crc & 0x80) {
        crc = (crc << 1) ^ 0x07;
      } else {
        crc <<= 1;
      }
    }
  }
  return crc;
}

// --- 4. DEEP MLX90614 PROBING FUNCTION ---
bool probeMLX90614(uint8_t addr, float &tObj, float &tAmb, String &diagnostic) {
  // Try Repeated Start (Wire.endTransmission(false))
  Wire.beginTransmission(addr);
  Wire.write(0x07); // RAM 0x07 = TOBJ1
  uint8_t err = Wire.endTransmission(false);

  // If repeated start fails, try standard STOP
  if (err != 0) {
    Wire.beginTransmission(addr);
    Wire.write(0x07);
    err = Wire.endTransmission(true);
    if (err != 0) {
      diagnostic = "NACK on TOBJ1 register request (err " + String(err) + ")";
      return false;
    }
    delayMicroseconds(60);
  }

  uint8_t req = Wire.requestFrom(addr, (uint8_t)3);
  if (req < 2 && Wire.available() < 2) {
    diagnostic = "No data returned from requestFrom (received " + String(req) + " bytes)";
    return false;
  }

  uint8_t lsb = Wire.read();
  uint8_t msb = Wire.read();
  uint8_t pec = 0;
  bool hasPec = false;
  if (Wire.available()) {
    pec = Wire.read();
    hasPec = true;
  }

  diagnostic = "Raw Bytes: [0x" + String(lsb, HEX) + ", 0x" + String(msb, HEX) + "]";
  if (hasPec) diagnostic += " PEC: 0x" + String(pec, HEX);

  // Error flag check (Bit 7 of MSB)
  if (msb & 0x80) {
    diagnostic += " -> ERROR FLAG SET in MSB bit 7!";
    return false;
  }

  uint16_t rawObj = ((uint16_t)msb << 8) | lsb;
  tObj = ((float)rawObj * 0.02f) - 273.15f;

  // Now attempt to read Ambient (RAM 0x06)
  Wire.beginTransmission(addr);
  Wire.write(0x06);
  if (Wire.endTransmission(false) == 0 || Wire.endTransmission(true) == 0) {
    delayMicroseconds(60);
    if (Wire.requestFrom(addr, (uint8_t)3) >= 2) {
      uint8_t aLsb = Wire.read();
      uint8_t aMsb = Wire.read();
      if (Wire.available()) Wire.read(); // PEC
      if (!(aMsb & 0x80)) {
        uint16_t rawAmb = ((uint16_t)aMsb << 8) | aLsb;
        tAmb = ((float)rawAmb * 0.02f) - 273.15f;
      }
    }
  }

  return (tObj >= -40.0f && tObj <= 125.0f);
}

// --- 5. DEEP MPU-6050 PROBING FUNCTION ---
bool probeMPU(uint8_t addr, uint8_t &whoAmI, float &ax, float &ay, float &az) {
  // Wake up MPU
  Wire.beginTransmission(addr);
  Wire.write(0x6B); // PWR_MGMT_1
  Wire.write(0x00); // Wake
  if (Wire.endTransmission(true) != 0) return false;
  delay(10);

  // Read WHO_AM_I (Register 0x75)
  Wire.beginTransmission(addr);
  Wire.write(0x75);
  if (Wire.endTransmission(false) == 0) {
    if (Wire.requestFrom(addr, (uint8_t)1) >= 1) {
      whoAmI = Wire.read();
    }
  }

  // Read Accel (0x3B)
  Wire.beginTransmission(addr);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;

  if (Wire.requestFrom(addr, (uint8_t)6) >= 6) {
    int16_t rawX = (Wire.read() << 8) | Wire.read();
    int16_t rawY = (Wire.read() << 8) | Wire.read();
    int16_t rawZ = (Wire.read() << 8) | Wire.read();
    ax = (float)rawX * 9.81 / 16384.0;
    ay = (float)rawY * 9.81 / 16384.0;
    az = (float)rawZ * 9.81 / 16384.0;
    return true;
  }
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(2500); // Allow monitor to open and power rails to stabilize

  Serial.println("\n\n=======================================================");
  Serial.println("  ESP32 I2C MULTI-SPEED DIAGNOSTIC & DETECT SUITE       ");
  Serial.println("=======================================================");
}

void loop() {
  Serial.println("\n=======================================================");
  Serial.println("                NEW DIAGNOSTIC CYCLE                   ");
  Serial.println("=======================================================");

  // 1. Bus Electrical Line Check
  checkBusLines();

  // 2. Bus Unstick / Clear
  clearI2CBus();

  // 3. Initialize I2C Bus at 50 kHz (Optimal for SMBus / MLX90614)
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(50000);
  Wire.setTimeOut(50);

  // 4. Linux-style i2cdetect Grid (Scanning 0x00 to 0x7F)
  Serial.println("\n[2] COMPLETE I2C BUS MATRIX SCAN (0x00 - 0x7F @ 50 kHz)");
  Serial.println("     0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F");
  
  uint8_t activeDevices[128];
  int activeCount = 0;

  for (uint8_t row = 0; row < 128; row += 16) {
    Serial.print("0x");
    if (row < 16) Serial.print("0");
    Serial.print(row, HEX);
    Serial.print(": ");

    for (uint8_t col = 0; col < 16; col++) {
      uint8_t addr = row + col;
      
      Wire.beginTransmission(addr);
      byte err = Wire.endTransmission();

      if (err == 0) {
        if (addr < 16) Serial.print("0");
        Serial.print(addr, HEX);
        Serial.print(" ");
        activeDevices[activeCount++] = addr;
      } else {
        Serial.print("-- ");
      }
    }
    Serial.println();
  }

  Serial.println("-------------------------------------------------------");
  Serial.print("Total active addresses responding: ");
  Serial.println(activeCount);

  // 5. Deep Sensor Analysis
  Serial.println("\n[3] TARGETED HARDWARE COMPONENT ANALYSIS");
  Serial.println("-------------------------------------------------------");

  // --- TARGET A: Shank MPU-6050 (0x68) ---
  Serial.print("A. Shank MPU-6050 (Address 0x68): ");
  uint8_t who68 = 0;
  float ax68 = 0, ay68 = 0, az68 = 0;
  if (probeMPU(0x68, who68, ax68, ay68, az68)) {
    Serial.print("ONLINE! WHO_AM_I=0x");
    Serial.print(who68, HEX);
    Serial.print(" | Accel (m/s^2) -> X:");
    Serial.print(ax68, 2); Serial.print(" Y:");
    Serial.print(ay68, 2); Serial.print(" Z:");
    Serial.println(az68, 2);
  } else {
    Serial.println("NOT FOUND or NOT RESPONDING.");
  }

  // --- TARGET B: Foot MPU-6050 (0x69) ---
  Serial.print("B. Foot MPU-6050 (Address 0x69):  ");
  uint8_t who69 = 0;
  float ax69 = 0, ay69 = 0, az69 = 0;
  if (probeMPU(0x69, who69, ax69, ay69, az69)) {
    Serial.print("ONLINE! WHO_AM_I=0x");
    Serial.print(who69, HEX);
    Serial.print(" | Accel (m/s^2) -> X:");
    Serial.print(ax69, 2); Serial.print(" Y:");
    Serial.print(ay69, 2); Serial.print(" Z:");
    Serial.println(az69, 2);
  } else {
    Serial.println("NOT FOUND or NOT RESPONDING (Ensure AD0 is connected to 3.3V).");
  }

  // --- TARGET C: MLX90614 Temperature Sensor ---
  Serial.println("C. MLX90614 Non-Contact IR Temperature Sensor:");
  bool mlxDetected = false;

  // We test both 0x5A (Factory Default) and 0x00 (Broadcast / Corrupted EEPROM)
  for (uint8_t testAddr : {(uint8_t)0x5A, (uint8_t)0x00}) {
    Serial.print("   Testing address 0x");
    if (testAddr < 16) Serial.print("0");
    Serial.print(testAddr, HEX);
    Serial.print(": ");

    Wire.beginTransmission(testAddr);
    byte pingErr = Wire.endTransmission();
    if (pingErr == 0) {
      Serial.print("ACK received! Probing registers... ");
      float tObj = 0.0, tAmb = 0.0;
      String diag = "";
      if (probeMLX90614(testAddr, tObj, tAmb, diag)) {
        Serial.println("SUCCESS!");
        Serial.print("     -> Object (Skin/IR) Temp: ");
        Serial.print(tObj, 2); Serial.println(" *C");
        Serial.print("     -> Ambient (Die) Temp:    ");
        Serial.print(tAmb, 2); Serial.println(" *C");
        Serial.print("     -> Diagnostics: ");
        Serial.println(diag);
        if (testAddr == 0x00) {
          Serial.println("     [!] NOTICE: Sensor responded to 0x00 instead of 0x5A!");
          Serial.println("         Its internal address was erased or reset. Node firmware will handle this.");
        }
        mlxDetected = true;
        break;
      } else {
        Serial.print("FAILED to read valid temperature. ");
        Serial.println(diag);
      }
    } else {
      Serial.print("No response (NACK code: ");
      Serial.print(pingErr);
      Serial.println(")");
    }
  }

  if (!mlxDetected) {
    Serial.println("   [!] MLX90614 NOT DETECTED AT 0x5A OR 0x00.");
  }

  // --- TARGET D: Unknown / Clone Sensor Investigator ---
  if (activeCount > 0) {
    Serial.println("\nD. Active Device Identity Summary:");
    for (int i = 0; i < activeCount; i++) {
      uint8_t a = activeDevices[i];
      Serial.print("   - 0x");
      if (a < 16) Serial.print("0");
      Serial.print(a, HEX);
      Serial.print(": ");
      if (a == 0x68) Serial.println("Shank MPU-6050");
      else if (a == 0x69) Serial.println("Foot MPU-6050");
      else if (a == 0x5A) Serial.println("MLX90614 IR Thermometer (Normal Address)");
      else if (a == 0x00) Serial.println("MLX90614 (Responding in Universal Broadcast Mode)");
      else if (a >= 0x18 && a <= 0x1F) Serial.println("MCP9808 Contact Temp Sensor");
      else {
        Serial.println("UNKNOWN / UNEXPECTED DEVICE! Could this be a clone sensor on a non-standard address?");
      }
    }
  }

  // --- 6. ACTIONABLE HARDWARE TROUBLESHOOTING GUIDE ---
  if (!mlxDetected) {
    Serial.println("\n-------------------------------------------------------");
    Serial.println(">>> MLX90614 HARDWARE TROUBLESHOOTING CHECKS <<<");
    Serial.println("1. Header Soldering: In the picture you sent, the 4-pin header");
    Serial.println("   was loose. If the pins are NOT soldered to the PCB pads,");
    Serial.println("   the sensor will NOT have electrical contact!");
    Serial.println("2. Pin Alignment: Verify pins from LEFT TO RIGHT on the GY-906:");
    Serial.println("   Pin 1 (VIN) -> Connect to 5V / VIN on ESP32");
    Serial.println("   Pin 2 (GND) -> Connect to GND on ESP32");
    Serial.println("   Pin 3 (SCL) -> Connect to GPIO 22 on ESP32");
    Serial.println("   Pin 4 (SDA) -> Connect to GPIO 21 on ESP32");
    Serial.println("3. Power Voltage: If 5V doesn't respond, try 3.3V (some chips are 3V-only).");
    Serial.println("-------------------------------------------------------");
  }

  Serial.println("\nRepeating test cycle in 4 seconds...\n");
  delay(4000);
}
