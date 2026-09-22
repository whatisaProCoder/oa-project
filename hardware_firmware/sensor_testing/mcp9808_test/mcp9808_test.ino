/*
  MCP9808 Single Sensor Test
  
  Reads the highly accurate temperature data from an MCP9808
  using the Adafruit_MCP9808 library.
  
  Set your Serial Monitor to 115200 baud.
*/

#include <Wire.h>
#include <Adafruit_MCP9808.h>

Adafruit_MCP9808 mcp = Adafruit_MCP9808();

#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

void setup() {
  Serial.begin(115200);
  delay(2000); // Wait 2 seconds for Serial Monitor to catch up
  
  Serial.println("\n\n--- Adafruit MCP9808 test! ---");

  // Initialize I2C with ESP32 pins
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  // Initialize the sensor (default I2C address is 0x18)
  if (!mcp.begin(0x18)) {
    Serial.println("Couldn't find MCP9808! Check your connections and verify the address.");
    while (1) {
      delay(10);
    }
  }
  
  Serial.println("Found MCP9808!");
  
  // Set resolution to 3 (highest accuracy, slightly slower read time ~250ms)
  mcp.setResolution(3); 
}

void loop() {
  Serial.println("Waking up sensor...");
  mcp.wake();   // Wake up from sleep mode
  
  float c = mcp.readTempC();
  float f = mcp.readTempF();
  
  Serial.print("Temp: "); 
  Serial.print(c, 4); Serial.print(" *C  |  "); 
  Serial.print(f, 4); Serial.println(" *F"); 
  
  Serial.println("Putting sensor to sleep to prevent self-heating...");
  mcp.shutdown_wake(1); // Put sensor back to sleep
  
  Serial.println("------------------------------------");
  delay(2000); // Wait 2 seconds before the next reading
}
