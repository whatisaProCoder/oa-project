/*
  MLX90614 All-Address Scanner & Reader
  Tests every single I2C address (0x00 to 0x7F) with the Adafruit MLX90614 library
  to find the exact address your sensor is responding on.
*/

#include <Wire.h>
#include <Adafruit_MLX90614.h>

#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

Adafruit_MLX90614 mlx = Adafruit_MLX90614();

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("\n=======================================================");
  Serial.println("     MLX90614 ALL-ADDRESS BRUTE FORCE SCANNER          ");
  Serial.println("=======================================================");

  // Initialize I2C bus at 50 kHz
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(50000);
  Wire.setTimeOut(100);
}

void loop() {
  Serial.println("\n--- Starting Full Scan of Addresses 0x01 to 0x7E ---");
  int foundCount = 0;
  uint8_t workingAddress = 0xFF;

  for (uint8_t addr = 1; addr < 127; addr++) {
    // 1. Basic I2C ping
    Wire.beginTransmission(addr);
    byte err = Wire.endTransmission();

    if (err == 0) {
      Serial.print("  [+] I2C ACK at address 0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      Serial.print(" -> Testing with MLX library... ");

      // 2. Test reading temperature with Adafruit library on this address
      if (mlx.begin(addr, &Wire)) {
        float tempC = mlx.readObjectTempC();
        
        if (!isnan(tempC) && tempC > -200.0f && tempC < 300.0f) {
          Serial.println("SUCCESS! REAL TEMPERATURE FOUND!");
          Serial.print("      -> Live Target Temp: ");
          Serial.print(tempC); Serial.println(" *C");
          Serial.print("      -> Ambient Temp:     ");
          Serial.print(mlx.readAmbientTempC()); Serial.println(" *C");
          workingAddress = addr;
        } else {
          Serial.print("ACKed, but returned NAN or invalid temp (");
          Serial.print(tempC);
          Serial.println(")");
        }
      } else {
        Serial.println("mlx.begin() failed.");
      }
      foundCount++;
    }
  }

  // Also test 0x00 (Broadcast address)
  Wire.beginTransmission(0x00);
  if (Wire.endTransmission() == 0) {
    Serial.print("  [+] I2C ACK at address 0x00 (General Call/Broadcast)");
    if (mlx.begin(0x00, &Wire)) {
      float tempC = mlx.readObjectTempC();
      if (!isnan(tempC) && tempC > -200.0f) {
        Serial.print(" -> SUCCESS at 0x00! Temp: ");
        Serial.print(tempC); Serial.println(" *C");
        workingAddress = 0x00;
      } else {
        Serial.println(" -> Responded, but data was invalid (likely grounded SDA).");
      }
    }
    foundCount++;
  }

  Serial.println("-------------------------------------------------------");
  if (workingAddress != 0xFF) {
    Serial.print(">>> WORKING MLX SENSOR FOUND AT ADDRESS: 0x");
    if (workingAddress < 16) Serial.print("0");
    Serial.println(workingAddress, HEX);
  } else if (foundCount == 0) {
    Serial.println(">>> ZERO I2C DEVICES RESPONDED ON ANY ADDRESS!");
    Serial.println("    This means no electrical connection between ESP32 and sensor.");
    Serial.println("    Check: 1) Soldered pins  2) SCL=22, SDA=21  3) Power (3.3V vs 5V)");
  } else {
    Serial.println(">>> Some addresses ACKed, but none yielded valid MLX temperatures.");
  }
  Serial.println("=======================================================\n");

  delay(4000); // Scan again in 4 seconds
}
