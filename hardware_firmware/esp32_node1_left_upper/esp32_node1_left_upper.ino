#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Wire.h>

#if __has_include(<driver/i2s_std.h>)
#include <driver/i2s_std.h>
#define USE_NEW_I2S 1
static i2s_chan_handle_t rx_handle = NULL;
#else
#include <driver/i2s.h>
#define USE_NEW_I2S 0
#endif

// --- PIN DEFINITIONS (Node 1 - Left Upper / Thigh) ---
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22
#define EMG_PIN 34
#define I2S_WS 15
#define I2S_SD 35
#define I2S_SCK 14

// --- HARDWARE CONFIGURATION ---
const char* hotspotSSID = "RAHULPC6759"; // Target hotspot to synchronize channel with
uint8_t thighMpuAddr = 0x68;           // Auto-detected (0x68 or 0x69)
bool mpuReady = false;

// --- RAW I2C HELPER FUNCTIONS ---
bool setupMPU(uint8_t addr) {
  Wire.beginTransmission(addr);
  Wire.write(0x6B);  // PWR_MGMT_1
  Wire.write(0x00);  // Wake up
  if (Wire.endTransmission(true) != 0) {
    return false; // MPU not connected at this address
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
    return; // MPU not connected or bus busy; exit instantly
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

// --- NETWORK ---
// Master ESP32 MAC Address (Broadcast FF:FF:FF:FF:FF:FF or replace with Master STA MAC)
uint8_t masterAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}; 
esp_now_peer_info_t peerInfo;

// --- DATA STRUCTURE ---
// Must match exactly on Master and all Slaves (Node 0, 1, 2, 3)
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

// --- NETWORK STATUS ---
bool espNowReady = false;
volatile bool lastSendSuccess = false;
uint32_t lastDiagPrint = 0;

// --- CALLBACK FOR ESP-NOW SEND ---
// Compatible with both ESP32 Arduino Core 2.x and Core 3.x (IDF 5.x)
#if defined(ESP_ARDUINO_VERSION_VAL) && (ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0))
void OnDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  lastSendSuccess = (status == ESP_NOW_SEND_SUCCESS);
}
#else
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  lastSendSuccess = (status == ESP_NOW_SEND_SUCCESS);
}
#endif

void setup() {
  Serial.begin(115200);
  
  // Power stabilization delay for sensors & rails
  delay(2000); 
  
  // Initialize Node ID (Node 1 = Left Upper / Thigh)
  myData.id = 1;

  // Initialize I2C First (Before Wi-Fi radio causes power spikes)
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(50000);
  Wire.setTimeOut(50);

  // Perform an immediate I2C diagnostic scan to verify bus on Serial Monitor
  Serial.println("\n====================================================");
  Serial.println("  Node 1 Initialization: Left Upper / Thigh Node   ");
  Serial.println("====================================================");
  Serial.println("--- I2C Diagnostic Bus Scan ---");
  int devCount = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print(" -> Found device at address: 0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      if (addr == 0x68) Serial.print(" (MPU6050 with AD0=GND)");
      else if (addr == 0x69) Serial.print(" (MPU6050 with AD0=VCC)");
      Serial.println();
      devCount++;
    }
  }
  if (devCount == 0) {
    Serial.println(" -> WARNING: No I2C devices detected on I2C bus! Check power and GND rails.");
  }
  Serial.println("----------------------------------------------------\n");

  // Auto-detect Thigh MPU6050 at 0x68 (standard) or 0x69 (alternate)
  if (setupMPU(0x68)) {
    thighMpuAddr = 0x68;
    mpuReady = true;
    Serial.println("✓ Thigh MPU6050 initialized successfully at address 0x68.");
  } else if (setupMPU(0x69)) {
    thighMpuAddr = 0x69;
    mpuReady = true;
    Serial.println("✓ Thigh MPU6050 initialized successfully at address 0x69.");
  } else {
    thighMpuAddr = 0x68;
    mpuReady = false;
    Serial.println("✗ Thigh MPU6050 not detected at 0x68 or 0x69. Loop will retry non-blocking.");
  }

  // Set up ADC resolution for EMG (ADC1 GPIO 34)
  analogReadResolution(12); // 0-4095
  Serial.println("✓ ADC1 initialized (EMG on GPIO 34).");

  // Initialize I2S for Microphone (INMP441 on GPIO 14, 15, 35)
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
    Serial.println("✓ I2S Microphone initialized (New driver API).");
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
  Serial.println("✓ I2S Microphone initialized (Legacy driver API).");
#endif

  // Initialize Wi-Fi in Station mode
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  // Channel Synchronization:
  // If Pi_Hotspot is broadcasting, sync Wi-Fi channel to match the Master ESP32
  uint8_t targetChannel = 1;
  Serial.print("Scanning for '");
  Serial.print(hotspotSSID);
  Serial.println("' to synchronize Wi-Fi channel...");
  int n = WiFi.scanNetworks(false, false, false, 300); // Quick scan
  for (int i = 0; i < n; i++) {
    if (WiFi.SSID(i) == hotspotSSID) {
      targetChannel = WiFi.channel(i);
      Serial.printf("✓ Found '%s' on Channel %d. Radio synced!\n", hotspotSSID, targetChannel);
      break;
    }
  }
  if (targetChannel == 1) {
    Serial.println("Note: Hotspot not detected; defaulting to Channel 1 (standalone mode).");
  }

  // Force ESP32 radio to target channel
  esp_wifi_set_channel(targetChannel, WIFI_SECOND_CHAN_NONE);

  // Initialize ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW. Continuing without wireless transmission...");
  } else {
    esp_now_register_send_cb(OnDataSent);
    
    // Register peer (Master)
    memset(&peerInfo, 0, sizeof(peerInfo));
    memcpy(peerInfo.peer_addr, masterAddress, 6);
    peerInfo.channel = targetChannel;  
    peerInfo.encrypt = false;
    
    if (esp_now_add_peer(&peerInfo) != ESP_OK){
      Serial.println("Failed to add peer. Continuing without wireless transmission...");
    } else {
      espNowReady = true;
      Serial.println("✓ ESP-NOW initialized and Master peer registered successfully.");
    }
  }

  Serial.println("====================================================\n");
}

void loop() {
  // 1. Read Thigh MPU6050
  float ax = 0, ay = 0, az = 0, gx = 0, gy = 0, gz = 0;
  readMPU(thighMpuAddr, ax, ay, az, gx, gy, gz);
  
  // If MPU wasn't ready on boot, attempt quick recovery if detected
  if (!mpuReady && (ax != 0 || ay != 0 || az != 0)) {
    mpuReady = true;
  }

  myData.accelX = ax;
  myData.accelY = ay;
  myData.accelZ = az;
  myData.gyroX = gx;
  myData.gyroY = gy;
  myData.gyroZ = gz;
  
  // 2. Read Quadriceps EMG
  myData.emgValue = analogRead(EMG_PIN);

  // 3. Clear unused lower node fields & simulate body temperature ~37.0°C
  myData.temperature = 36.9f + (float)random(0, 25) / 100.0f;
  myData.footAccelX = 0;
  myData.footAccelY = 0;
  myData.footAccelZ = 0;
  myData.footGyroX = 0;
  myData.footGyroY = 0;
  myData.footGyroZ = 0;
  myData.fsrHeel = 0;
  myData.fsrM5 = 0;
  myData.fsrM1 = 0;
  myData.fsrToe = 0;

  // 4. Read I2S Microphone with EMA Smoothing (Non-blocking: reads instantly, never halts if mic is unplugged)
  int32_t sample = 0;
  size_t bytesRead = 0;
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
    smoothed_amplitude = (0.05f * abs_sample) + (0.95f * smoothed_amplitude);
    myData.micData = (int32_t)smoothed_amplitude;
  } else {
    myData.micData = 0;
  }

  // 5. Send Data via ESP-NOW
  if (espNowReady) {
    esp_err_t result = esp_now_send(masterAddress, (uint8_t *) &myData, sizeof(myData));
  }
  
  // 6. Debug Prints (Hardware Testing - Throttled to ~20Hz for clean terminal output)
  if (millis() - lastDiagPrint > 50) {
    lastDiagPrint = millis();
    Serial.print("Node 1 (L_Up) | Thigh_Accel: "); 
    Serial.print(myData.accelX, 2); Serial.print(","); 
    Serial.print(myData.accelY, 2); Serial.print(","); 
    Serial.print(myData.accelZ, 2);
    Serial.print(" | Gyro: "); 
    Serial.print(myData.gyroX, 2); Serial.print(","); 
    Serial.print(myData.gyroY, 2); Serial.print(","); 
    Serial.print(myData.gyroZ, 2);
    Serial.print(" | EMG: "); Serial.print(myData.emgValue);
    Serial.print(" | Mic: "); Serial.print(myData.micData);
    Serial.print(" | ESP-NOW: "); Serial.println(espNowReady ? "TX_OK" : "NO_INIT");
  }

  delay(10); // Transmit roughly 100 times a second (100Hz)
}

