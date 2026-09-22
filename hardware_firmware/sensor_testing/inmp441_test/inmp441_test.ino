/*
  INMP441 I2S Microphone Test
  
  Reads digital acoustic data from the I2S microphone 
  and prints the raw sound amplitude values.
  
  Set your Serial Monitor to 115200 baud.
*/

#include <driver/i2s.h>

// I2S Pins
#define I2S_WS  15  // LRCL (Word Select)
#define I2S_SD  35  // DOUT (Serial Data) - Using Input-Only Pin to avoid conflicts
#define I2S_SCK 14  // BCLK (Serial Clock)

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n--- INMP441 I2S Microphone Test Started ---");

  // I2S Configuration
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

  // I2S Pin Configuration
  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD
  };

  // Install and start I2S driver
  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);
}

void loop() {
  int32_t sample = 0;
  size_t bytesRead = 0;

  // Read a single 32-bit sample from the I2S microphone
  i2s_read(I2S_NUM_0, &sample, sizeof(sample), &bytesRead, portMAX_DELAY);

  if (bytesRead > 0) {
    // The INMP441 outputs 24 bits of data aligned to the left of a 32-bit word.
    // We bit-shift right by 8 to get a clean 24-bit signed integer.
    sample = sample >> 8; 
    
    // 1. Rectify the audio (convert negative swings to positive)
    int32_t abs_sample = abs(sample);

    // 2. Apply an Exponential Moving Average (EMA) to smooth the jagged waveform
    // The 0.05 value controls the smoothness. Lower = smoother, Higher = more responsive.
    static float smoothed_amplitude = 0;
    smoothed_amplitude = (0.05 * abs_sample) + (0.95 * smoothed_amplitude);
    
    // For the Serial Plotter to work, we must print ONLY the number!
    Serial.println(smoothed_amplitude);
  }
}
