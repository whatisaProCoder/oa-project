#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <WiFiUdp.h>
#include <Wire.h>

#if __has_include(<driver/i2s_std.h>)
#include <driver/i2s_std.h>
#define USE_NEW_I2S 1
static i2s_chan_handle_t rx_handle = NULL;
#else
#include <driver/i2s.h>
#define USE_NEW_I2S 0
#endif

// --- PIN DEFINITIONS (Master - Right Upper / Thigh) ---
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22
#define EMG_PIN 34
#define I2S_WS 15
#define I2S_SD 35
#define I2S_SCK 14

// --- WI-FI CREDENTIALS ---
const char* ssid = "RAHULPC6759";         // Change to RPi Hotspot SSID
const char* password = "985R9g}3";    // Change to RPi Hotspot Password
const char* udpAddress = "192.168.137.1";  // PC Hotspot IP Address (Windows default)
const int udpPort = 12345;

WiFiUDP udp;
bool wifiConnected = false;

// --- RAW I2C HELPER FUNCTIONS ---
bool setupMPU(uint8_t addr) {
  Wire.beginTransmission(addr);
  Wire.write(0x6B);  // PWR_MGMT_1
  Wire.write(0x00);  // Wake up
  if (Wire.endTransmission(true) != 0) {
    return false; // MPU not connected, skip remaining writes
  }

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
  return true;
}

void readMPU(uint8_t addr, float &ax, float &ay, float &az, float &gx, float &gy, float &gz) {
  ax = 0; ay = 0; az = 0; gx = 0; gy = 0; gz = 0;
  Wire.beginTransmission(addr);
  Wire.write(0x3B); // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) {
    return; // MPU not connected/loose; exit instantly so loop is not delayed
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


// --- DATA STRUCTURES ---
// Must match exactly on Master and Slaves
typedef struct struct_message {
    uint8_t id;         // Node ID
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

// Arrays to hold data from 4 nodes (0=Master, 1=Slave1 Left Upper, 2=Slave2 Left Lower, 3=Slave3 Right Lower)
struct_message nodeData[4];
uint32_t lastSlavePacketTime[4] = {0, 0, 0, 0};

// --- CALIBRATION STATE ---
bool isCalibrating = false;
int calibSampleCount = 0;
const int CALIB_SAMPLES_REQUIRED = 200; // ~4 seconds at 50Hz
float accelX_offset[4] = {0,0,0,0};
float accelY_offset[4] = {0,0,0,0};
float accelZ_offset[4] = {0,0,0,0};
float gyroX_offset[4] = {0,0,0,0};
float gyroY_offset[4] = {0,0,0,0};
float gyroZ_offset[4] = {0,0,0,0};

float footAccelX_offset[4] = {0,0,0,0};
float footAccelY_offset[4] = {0,0,0,0};
float footAccelZ_offset[4] = {0,0,0,0};
float footGyroX_offset[4] = {0,0,0,0};
float footGyroY_offset[4] = {0,0,0,0};
float footGyroZ_offset[4] = {0,0,0,0};

// --- ESP-NOW RECEIVE CALLBACK ---
// Compatible with both ESP32 Arduino Core 2.x and 3.x
#if defined(ESP_ARDUINO_VERSION_VAL) && (ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0))
void OnDataRecv(const esp_now_recv_info_t *recv_info, const uint8_t *incomingData, int len) {
#else
void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
#endif
  if (len == sizeof(struct_message)) {
    struct_message payload;
    memcpy(&payload, incomingData, sizeof(payload));
    
    if (payload.id >= 1 && payload.id <= 3) {
      nodeData[payload.id] = payload; // Store the latest raw payload from this slave
      lastSlavePacketTime[payload.id] = millis(); // Update live heartbeat timestamp
    }
  }
}

int32_t getI2SChannelData() {
  int32_t sample = 0;
  size_t bytesRead = 0;
  // Non-blocking 2ms timeout: reads instantly if mic is active, never stalls if mic is disconnected
#if USE_NEW_I2S
  if (rx_handle != NULL) {
    i2s_channel_read(rx_handle, &sample, sizeof(sample), &bytesRead, pdMS_TO_TICKS(2));
  }
#else
  i2s_read(I2S_NUM_0, &sample, sizeof(sample), &bytesRead, pdMS_TO_TICKS(2));
#endif
  
  if (bytesRead > 0) {
    sample = sample >> 8; 
    int32_t abs_sample = abs(sample);
    static float smoothed_amplitude = 0;
    smoothed_amplitude = (0.05 * abs_sample) + (0.95 * smoothed_amplitude);
    return (int32_t)smoothed_amplitude;
  }
  return 0;
}

void setup() {
  Serial.begin(115200);

  // Give sensors time to power up and stabilize (crucial fix from lower node testing)
  delay(2000);

  // Initialize Master Node ID & clean default node structures
  for (int i = 0; i < 4; i++) {
    nodeData[i].id = i;
  }

  // 1. Initialize I2C FIRST (Before Wi-Fi radio causes power spikes)
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(50000);
  Wire.setTimeOut(50);

  // Perform an immediate I2C diagnostic scan to show on Serial Monitor
  Serial.println("\n--- I2C Diagnostic Bus Scan (Master - Right Upper) ---");
  int devCount = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print(" -> Found device at address: 0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      if (addr == 0x68) Serial.print(" (Master Thigh MPU6050)");
      Serial.println();
      devCount++;
    }
  }
  if (devCount == 0) {
    Serial.println(" -> CRITICAL: No I2C devices detected! Check power and GND rails.");
  }
  Serial.println("------------------------------------------------------\n");

  // Initialize Thigh MPU6050 with Raw I2C
  setupMPU(0x68);

  // Set up ADC resolution for EMG
  analogReadResolution(12); // 0-4095

  // Initialize I2S for Microphone (Core 3.x uses driver/i2s_std.h to avoid legacy ADC conflict)
#if USE_NEW_I2S
  i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
  if (i2s_new_channel(&chan_cfg, NULL, &rx_handle) == ESP_OK) {
    i2s_std_config_t std_cfg = {
      .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(16000),
      .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO),
      .gpio_cfg = {
        .mclk = I2S_GPIO_UNUSED,
        .bclk = (gpio_num_t)I2S_SCK,
        .ws   = (gpio_num_t)I2S_WS,
        .dout = I2S_GPIO_UNUSED,
        .din  = (gpio_num_t)I2S_SD,
        .invert_flags = {
          .mclk_inv = false,
          .bclk_inv = false,
          .ws_inv   = false,
        },
      },
    };
    std_cfg.slot_cfg.slot_mask = I2S_STD_SLOT_RIGHT;
    i2s_channel_init_std_mode(rx_handle, &std_cfg);
    i2s_channel_enable(rx_handle);
  }
#else
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = 16000,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_RIGHT,
    .communication_format = (i2s_comm_format_t)(I2S_COMM_FORMAT_I2S | I2S_COMM_FORMAT_I2S_MSB),
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD
  };

  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);
#endif

  // 2. Initialize Wi-Fi (AP+STA mode for UDP to Pi and ESP-NOW from Slaves)
  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(ssid, password);
  
  Serial.print("Connecting to Wi-Fi hotspot");
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 6) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\nWiFi connected successfully!");
    Serial.print("Master IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Master STA MAC: ");
    Serial.println(WiFi.macAddress());
    Serial.print("WiFi Channel: ");
    Serial.println(WiFi.channel());
    udp.begin(udpPort);
    Serial.printf("UDP listening on port %d\n", udpPort);
  } else {
    WiFi.disconnect();
    esp_wifi_set_channel(1, WIFI_SECOND_CHAN_NONE);
    Serial.println("\nWiFi not connected to hotspot. Operating in standalone ESP-NOW mode (Channel 1 locked).");
    Serial.print("Master STA MAC: ");
    Serial.println(WiFi.macAddress());
  }

  // 3. Initialize ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
  } else {
    esp_now_register_recv_cb(OnDataRecv);
    Serial.println("ESP-NOW initialized and receive callback registered.");
  }
}

void loop() {
  // --- Check for Incoming UDP Commands (e.g. "CALIBRATE") from Pi/Dashboard ---
  if (wifiConnected) {
    int packetSize = udp.parsePacket();
    if (packetSize) {
      char incomingPacket[255];
      int len = udp.read(incomingPacket, 254);
      if (len > 0) {
        incomingPacket[len] = '\0';
      }
      if (String(incomingPacket) == "CALIBRATE") {
        isCalibrating = true;
        calibSampleCount = 0;
        // Reset offsets
        for(int i = 0; i < 4; i++) {
          accelX_offset[i] = 0; accelY_offset[i] = 0; accelZ_offset[i] = 0;
          gyroX_offset[i] = 0; gyroY_offset[i] = 0; gyroZ_offset[i] = 0;
          footAccelX_offset[i] = 0; footAccelY_offset[i] = 0; footAccelZ_offset[i] = 0;
          footGyroX_offset[i] = 0; footGyroY_offset[i] = 0; footGyroZ_offset[i] = 0;
        }
        Serial.println(">>> Starting 10-Second Sensor Calibration Routine...");
      }
    }
  }

  // 1. Read Master's Own Sensors (Raw values stored in nodeData[0])
  nodeData[0].id = 0;

  float ax = 0, ay = 0, az = 0, gx = 0, gy = 0, gz = 0;
  readMPU(0x68, ax, ay, az, gx, gy, gz);
  
  nodeData[0].accelX = ax;
  nodeData[0].accelY = ay;
  nodeData[0].accelZ = az;
  nodeData[0].gyroX = gx;
  nodeData[0].gyroY = gy;
  nodeData[0].gyroZ = gz;

  // Foot fields and FSRs do not exist on Master Upper node
  nodeData[0].footAccelX = 0;
  nodeData[0].footAccelY = 0;
  nodeData[0].footAccelZ = 0;
  nodeData[0].footGyroX = 0;
  nodeData[0].footGyroY = 0;
  nodeData[0].footGyroZ = 0;
  nodeData[0].fsrHeel = 0;
  nodeData[0].fsrM5 = 0;
  nodeData[0].fsrM1 = 0;
  // Simulated body temperature ~37.0°C (subtle physiological variation 36.9 - 37.15°C)
  nodeData[0].temperature = 36.9f + (float)random(0, 25) / 100.0f;

  // Read Master EMG and Microphone
  nodeData[0].emgValue = analogRead(EMG_PIN);
  nodeData[0].micData = getI2SChannelData();

  // --- Calibration Accumulation Logic ---
  if (isCalibrating) {
    for(int i = 0; i < 4; i++) {
      accelX_offset[i] += nodeData[i].accelX;
      accelY_offset[i] += nodeData[i].accelY;
      accelZ_offset[i] += (nodeData[i].accelZ - 9.81); // Subtract 1G gravity from Z axis
      gyroX_offset[i] += nodeData[i].gyroX;
      gyroY_offset[i] += nodeData[i].gyroY;
      gyroZ_offset[i] += nodeData[i].gyroZ;
      
      footAccelX_offset[i] += nodeData[i].footAccelX;
      footAccelY_offset[i] += nodeData[i].footAccelY;
      footAccelZ_offset[i] += (nodeData[i].footAccelZ - 9.81); 
      footGyroX_offset[i] += nodeData[i].footGyroX;
      footGyroY_offset[i] += nodeData[i].footGyroY;
      footGyroZ_offset[i] += nodeData[i].footGyroZ;
    }
    calibSampleCount++;
    if (calibSampleCount >= CALIB_SAMPLES_REQUIRED) {
      isCalibrating = false;
      for(int i = 0; i < 4; i++) {
        accelX_offset[i] /= CALIB_SAMPLES_REQUIRED;
        accelY_offset[i] /= CALIB_SAMPLES_REQUIRED;
        accelZ_offset[i] /= CALIB_SAMPLES_REQUIRED;
        gyroX_offset[i] /= CALIB_SAMPLES_REQUIRED;
        gyroY_offset[i] /= CALIB_SAMPLES_REQUIRED;
        gyroZ_offset[i] /= CALIB_SAMPLES_REQUIRED;
        
        footAccelX_offset[i] /= CALIB_SAMPLES_REQUIRED;
        footAccelY_offset[i] /= CALIB_SAMPLES_REQUIRED;
        footAccelZ_offset[i] /= CALIB_SAMPLES_REQUIRED;
        footGyroX_offset[i] /= CALIB_SAMPLES_REQUIRED;
        footGyroY_offset[i] /= CALIB_SAMPLES_REQUIRED;
        footGyroZ_offset[i] /= CALIB_SAMPLES_REQUIRED;
      }
      Serial.println(">>> Sensor Auto-Calibration Complete!");
    }
    // Do not broadcast uncalibrated data while calibrating
    delay(20);
    return;
  }

  // 2. Prepare Clean Broadcast Packet with Calibration Offsets Applied
  // (Using a separate broadcast buffer prevents offset double-subtraction bugs on raw data)
  struct_message broadcastData[4];
  memcpy(broadcastData, nodeData, sizeof(nodeData));

  for(int i = 0; i < 4; i++) {
    broadcastData[i].accelX -= accelX_offset[i];
    broadcastData[i].accelY -= accelY_offset[i];
    broadcastData[i].accelZ -= accelZ_offset[i];
    broadcastData[i].gyroX -= gyroX_offset[i];
    broadcastData[i].gyroY -= gyroY_offset[i];
    broadcastData[i].gyroZ -= gyroZ_offset[i];
    
    broadcastData[i].footAccelX -= footAccelX_offset[i];
    broadcastData[i].footAccelY -= footAccelY_offset[i];
    broadcastData[i].footAccelZ -= footAccelZ_offset[i];
    broadcastData[i].footGyroX -= footGyroX_offset[i];
    broadcastData[i].footGyroY -= footGyroY_offset[i];
    broadcastData[i].footGyroZ -= footGyroZ_offset[i];
  }

  // 3. Broadcast aggregated state via UDP to Raspberry Pi (if Wi-Fi connected)
  if (wifiConnected) {
    udp.beginPacket(udpAddress, udpPort);
    udp.write((const uint8_t*)broadcastData, sizeof(broadcastData));
    udp.endPacket();
  }

  // --- DEBUG PRINTS (Hardware Testing) ---
  Serial.print("Master (R_Up) | Thigh_Accel(X,Y,Z): "); 
  Serial.print(broadcastData[0].accelX); Serial.print(","); 
  Serial.print(broadcastData[0].accelY); Serial.print(","); 
  Serial.print(broadcastData[0].accelZ);
  Serial.print(" | Gyro(X,Y,Z): "); 
  Serial.print(broadcastData[0].gyroX); Serial.print(","); 
  Serial.print(broadcastData[0].gyroY); Serial.print(","); 
  Serial.print(broadcastData[0].gyroZ);
  Serial.print(" | EMG: "); Serial.print(broadcastData[0].emgValue);
  Serial.print(" | Mic: "); Serial.print(broadcastData[0].micData);
  Serial.print(" | Active Slaves: [1:"); Serial.print((millis() - lastSlavePacketTime[1] < 1500) ? "OK" : "--");
  Serial.print(" 2:"); Serial.print((millis() - lastSlavePacketTime[2] < 1500) ? "OK" : "--");
  Serial.print(" 3:"); Serial.print((millis() - lastSlavePacketTime[3] < 1500) ? "OK" : "--");
  Serial.println("]");

  delay(20); // 50 Hz UDP broadcast rate
}
