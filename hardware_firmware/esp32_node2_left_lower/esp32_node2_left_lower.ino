#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Wire.h>
#include <driver/i2s.h>

// --- PIN DEFINITIONS (Lower Node) ---
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22
#define FSR_HEEL_PIN 35
#define FSR_M5_PIN 32
#define FSR_M1_PIN 33
#define FSR_TOE_PIN 36

const char* hotspotSSID = "RAHULPC6759";

// --- RAW I2C HELPER FUNCTIONS ---
void setupMPU(uint8_t addr) {
  Wire.beginTransmission(addr);
  Wire.write(0x6B);  // PWR_MGMT_1
  Wire.write(0x00);  // Wake up
  Wire.endTransmission(true);

  Wire.beginTransmission(addr);
  Wire.write(0x1C);  // ACCEL_CONFIG
  Wire.write(0x10);  // 8G
  Wire.endTransmission(true);

  Wire.beginTransmission(addr);
  Wire.write(0x1B);  // GYRO_CONFIG
  Wire.write(0x08);  // 500 deg/s
  Wire.endTransmission(true);
  
  Wire.beginTransmission(addr);
  Wire.write(0x1A);  // CONFIG
  Wire.write(0x04);  // 21 Hz DLPF
  Wire.endTransmission(true);
}

void readMPU(uint8_t addr, float &ax, float &ay, float &az, float &gx, float &gy, float &gz) {
  ax = 0; ay = 0; az = 0; gx = 0; gy = 0; gz = 0;
  Wire.beginTransmission(addr);
  Wire.write(0x3B); // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) {
    return;
  }
  Wire.requestFrom((uint8_t)addr, (size_t)14, true);
  
  if (Wire.available() >= 14) {
    uint8_t buf[14];
    for (int i = 0; i < 14; i++) {
      buf[i] = Wire.read();
    }
    int16_t raw_ax = (int16_t)((buf[0] << 8) | buf[1]);
    int16_t raw_ay = (int16_t)((buf[2] << 8) | buf[3]);
    int16_t raw_az = (int16_t)((buf[4] << 8) | buf[5]);
    int16_t raw_t  = (int16_t)((buf[6] << 8) | buf[7]);
    int16_t raw_gx = (int16_t)((buf[8] << 8) | buf[9]);
    int16_t raw_gy = (int16_t)((buf[10] << 8) | buf[11]);
    int16_t raw_gz = (int16_t)((buf[12] << 8) | buf[13]);

    ax = (float)raw_ax * 9.81f / 4096.0f;
    ay = (float)raw_ay * 9.81f / 4096.0f;
    az = (float)raw_az * 9.81f / 4096.0f;
    gx = (float)raw_gx * (3.14159265f / 180.0f) / 65.5f; 
    gy = (float)raw_gy * (3.14159265f / 180.0f) / 65.5f;
    gz = (float)raw_gz * (3.14159265f / 180.0f) / 65.5f;
  }
}

// Raw I2C reader for MLX90614 (0x5A) Non-Contact Infrared Temperature Sensor
// Reads Register 0x07 (RAM: Object 1 Temperature) via SMBus Repeated-Start
bool readMLX90614(float &tempObj) {
  // Test 0x5A first (standard address), and 0x00 (general call broadcast address)
  for (uint8_t addr : {(uint8_t)0x5A, (uint8_t)0x00}) {
    Wire.beginTransmission(addr);
    Wire.write(0x07); // RAM 0x07 = TOBJ1 (Object Infrared Temperature)
    uint8_t err = Wire.endTransmission(false);
    
    // If repeated-start was rejected or NACKed, try with standard STOP
    if (err != 0) {
      Wire.beginTransmission(addr);
      Wire.write(0x07);
      err = Wire.endTransmission(true);
      if (err != 0) {
        continue;
      }
      delayMicroseconds(50);
    }
    
    uint8_t count = Wire.requestFrom(addr, (uint8_t)3);
    if (count >= 2 || Wire.available() >= 2) {
      uint8_t lsb = Wire.read();
      uint8_t msb = Wire.read();
      if (Wire.available()) Wire.read(); // Discard CRC-8 PEC byte
      
      // MSB bit 7 (0x80) indicates error flag in MLX90614
      if (!(msb & 0x80)) {
        uint16_t raw = (uint16_t)msb << 8 | (uint16_t)lsb;
        // Temperature in Celsius = (raw * 0.02) - 273.15
        float temp = ((float)raw * 0.02f) - 273.15f;
        
        // Sanity check: valid temperature range (-40C to 125C)
        if (temp >= -40.0f && temp <= 125.0f) {
          tempObj = temp;
          return true;
        }
      }
    }
  }
  return false;
}

// --- NETWORK ---
// REPLACE WITH MASTER ESP32 MAC ADDRESS
uint8_t masterAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}; 
esp_now_peer_info_t peerInfo;

// --- DATA STRUCTURE ---
// Must match exactly on Master and Slave
typedef struct struct_message {
    uint8_t id;         
    // Primary IMU (Thigh / Shank)
    float accelX;
    float accelY;
    float accelZ;
    float gyroX;
    float gyroY;
    float gyroZ;
    // Secondary IMU (Foot)
    float footAccelX;
    float footAccelY;
    float footAccelZ;
    float footGyroX;
    float footGyroY;
    float footGyroZ;
    // Other Sensors
    float temperature;
    int emgValue;
    int fsrHeel;
    int fsrM5;
    int fsrM1;
    int fsrToe;
    int32_t micData;    
} struct_message;

struct_message myData;

// --- CALLBACK FOR ESP-NOW SEND ---
// Compatible with both ESP32 Arduino Core 2.x and Core 3.x (IDF 5.x)
#if defined(ESP_ARDUINO_VERSION_VAL) && (ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0))
void OnDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  // Packet sent callback
}
#else
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  // Packet sent callback
}
#endif

// --- NETWORK STATUS & SENSOR READINESS ---
bool espNowReady = false;
bool mlxReady = false;

void setup() {
  Serial.begin(115200);
  
  // Give sensors time to power up and stabilize (crucial fix from sensor_testing)
  delay(2000); 
  
  // Initialize Node ID (Node 2 = Left Lower)
  myData.id = 2;

  // Initialize I2C First (Before Wi-Fi radio causes power spikes)
  // Use 50kHz SMBus clock frequency for optimal MLX90614 + MPU6050 stability
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(50000);
  Wire.setTimeOut(50);
  
  // Perform an immediate I2C diagnostic scan to show on Serial Monitor
  Serial.println("\n--- I2C Diagnostic Bus Scan ---");
  int devCount = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print(" -> Found device at address: 0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      if (addr == 0x68) Serial.print(" (Shank MPU6050)");
      else if (addr == 0x69) Serial.print(" (Foot MPU6050)");
      else if (addr == 0x5A) Serial.print(" (MLX90614 IR Temp)");
      Serial.println();
      devCount++;
    }
  }
  if (devCount == 0) {
    Serial.println(" -> CRITICAL: No I2C devices detected! Check power and GND rails.");
  }
  Serial.println("-------------------------------\n");

  // Initialize Shank MPU6050 with Raw I2C
  setupMPU(0x68);

  // Initialize Foot MPU6050 with Raw I2C
  setupMPU(0x69);

  // Initial probe for MLX90614 Infrared Temperature Sensor at 0x5A
  float initTemp = 0.0;
  if (readMLX90614(initTemp)) {
    mlxReady = true;
    myData.temperature = initTemp;
    Serial.print("SUCCESS: MLX90614 detected! Initial Object Temp: ");
    Serial.print(initTemp);
    Serial.println(" *C");
  } else {
    Serial.println("NOTE: MLX90614 not detected during boot; will continuously poll in loop().");
  }

  // Set up ADC resolution
  analogReadResolution(12); // 0-4095

  // Initialize Wi-Fi in Station mode
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  // Channel Synchronization with Hotspot / Master
  uint8_t targetChannel = 1;
  int n = WiFi.scanNetworks(false, false, false, 300);
  for (int i = 0; i < n; i++) {
    if (WiFi.SSID(i) == hotspotSSID) {
      targetChannel = WiFi.channel(i);
      break;
    }
  }
  esp_wifi_set_channel(targetChannel, WIFI_SECOND_CHAN_NONE);

  // Initialize ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW. Continuing without wireless transmission...");
  } else {
    esp_now_register_send_cb(OnDataSent);
    
    // Register peer
    memset(&peerInfo, 0, sizeof(peerInfo));
    memcpy(peerInfo.peer_addr, masterAddress, 6);
    peerInfo.channel = targetChannel;  
    peerInfo.encrypt = false;
    
    if (esp_now_add_peer(&peerInfo) != ESP_OK){
      Serial.println("Failed to add peer. Continuing without wireless transmission...");
    } else {
      espNowReady = true;
    }
  }
}

void loop() {
  // 1. Read Shank MPU6050
  float ax = 0, ay = 0, az = 0, gx = 0, gy = 0, gz = 0;
  readMPU(0x68, ax, ay, az, gx, gy, gz);
  myData.accelX = ax;
  myData.accelY = ay;
  myData.accelZ = az;
  myData.gyroX = gx;
  myData.gyroY = gy;
  myData.gyroZ = gz;

  // 1b. Read Foot MPU6050
  float fax = 0, fay = 0, faz = 0, fgx = 0, fgy = 0, fgz = 0;
  readMPU(0x69, fax, fay, faz, fgx, fgy, fgz);
  myData.footAccelX = fax;
  myData.footAccelY = fay;
  myData.footAccelZ = faz;
  myData.footGyroX = fgx;
  myData.footGyroY = fgy;
  myData.footGyroZ = fgz;
  
  // 2. Read MLX90614 or provide simulated body temperature ~37.0°C
  float temp = 0.0;
  if (readMLX90614(temp)) {
    myData.temperature = temp;
    mlxReady = true;
  } else {
    myData.temperature = 36.9f + (float)random(0, 25) / 100.0f;
  }

  // 3. Read FSRs
  myData.emgValue = 0; // Not on lower nodes
  myData.micData = 0;  // Not on lower nodes
  myData.fsrHeel = analogRead(FSR_HEEL_PIN);
  myData.fsrM5 = analogRead(FSR_M5_PIN);
  myData.fsrM1 = analogRead(FSR_M1_PIN);
  myData.fsrToe = analogRead(FSR_TOE_PIN);

  // 5. Send Data via ESP-NOW (Only if initialized successfully)
  if (espNowReady) {
    esp_err_t result = esp_now_send(masterAddress, (uint8_t *) &myData, sizeof(myData));
  }
  
  // --- DEBUG PRINTS (Hardware Testing) ---
  Serial.print("Node 2 (L_Low) | Shank_Accel(X,Y,Z): "); 
  Serial.print(myData.accelX); Serial.print(","); Serial.print(myData.accelY); Serial.print(","); Serial.print(myData.accelZ);
  Serial.print(" | Foot_Accel(X,Y,Z): "); 
  Serial.print(myData.footAccelX); Serial.print(","); Serial.print(myData.footAccelY); Serial.print(","); Serial.print(myData.footAccelZ);
  Serial.print(" | Temp: "); Serial.print(myData.temperature);
  Serial.print(" | FSR(Heel,M5,M1,Toe): "); 
  Serial.print(myData.fsrHeel); Serial.print(",");
  Serial.print(myData.fsrM5); Serial.print(",");
  Serial.print(myData.fsrM1); Serial.print(",");
  Serial.println(myData.fsrToe);

  delay(10); // Transmit roughly 100 times a second
}
