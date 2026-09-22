/*
  MPU6050 Single Sensor Test
  
  Reads the accelerometer and gyroscope data from an MPU6050
  using the Adafruit_MPU6050 library.
  
  Set your Serial Monitor to 115200 baud.
*/

#include <Wire.h>

#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

void setup() {
  Serial.begin(115200);
  delay(2000); // Wait 2 seconds for Serial Monitor to catch up after reset

  Serial.println("\n\n--- Adafruit MPU6050 test! ---");

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  // Initialize the MPU6050 with Raw I2C
  setupMPU(0x68);
  Serial.println("MPU6050 Setup Complete!");
}

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
  Wire.beginTransmission(addr);
  Wire.write(0x3B); // ACCEL_XOUT_H
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)addr, (size_t)14, true);
  
  if (Wire.available() >= 14) {
    int16_t raw_ax = Wire.read() << 8 | Wire.read();
    int16_t raw_ay = Wire.read() << 8 | Wire.read();
    int16_t raw_az = Wire.read() << 8 | Wire.read();
    int16_t raw_t  = Wire.read() << 8 | Wire.read();
    int16_t raw_gx = Wire.read() << 8 | Wire.read();
    int16_t raw_gy = Wire.read() << 8 | Wire.read();
    int16_t raw_gz = Wire.read() << 8 | Wire.read();

    ax = (float)raw_ax * 9.81 / 4096.0;
    ay = (float)raw_ay * 9.81 / 4096.0;
    az = (float)raw_az * 9.81 / 4096.0;
    gx = (float)raw_gx * (3.14159 / 180.0) / 65.5; 
    gy = (float)raw_gy * (3.14159 / 180.0) / 65.5;
    gz = (float)raw_gz * (3.14159 / 180.0) / 65.5;
  }
}

void loop() {
  float ax = 0, ay = 0, az = 0, gx = 0, gy = 0, gz = 0;
  readMPU(0x68, ax, ay, az, gx, gy, gz);

  // Print Accelerometer values
  Serial.print("AccelX: ");
  Serial.print(ax);
  Serial.print(" | AccelY: ");
  Serial.print(ay);
  Serial.print(" | AccelZ: ");
  Serial.print(az);
  
  // Print Gyroscope values
  Serial.print(" || GyroX: ");
  Serial.print(gx);
  Serial.print(" | GyroY: ");
  Serial.print(gy);
  Serial.print(" | GyroZ: ");
  Serial.println(gz);

  delay(100);
}
