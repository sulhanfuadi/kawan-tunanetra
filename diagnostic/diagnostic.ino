/*
  KATANA Sensor Diagnostic Test
  Cek satu per satu apakah setiap sensor menyala/terdeteksi atau tidak
  
  Serial Monitor: 115200 baud
  Ikuti menu interaktif untuk test individual sensor
*/

#include <Wire.h>
#include <math.h>

// ================= PIN MAPPING =================
const byte PIN_FRONT_ECHO = 2;    // HC-SR04 Depan Echo
const byte PIN_FRONT_TRIG = 3;    // HC-SR04 Depan Trig
const byte PIN_FALL_TEST  = 4;    // Wokwi test button (D4 ke GND)
const byte PIN_VIBRATION  = 5;    // PWM Motor Getar SIG
const byte PIN_BUZZER     = 6;    // Active Buzzer via BC547 base
const byte PIN_DOWN_ECHO  = 10;   // HC-SR04 Bawah Echo
const byte PIN_DOWN_TRIG  = 11;   // HC-SR04 Bawah Trig
const byte PIN_WATER_RAW  = A0;   // Sensor Air Analog (A0)

const byte MPU_ADDR = 0x68;       // Alamat I2C MPU6050 (A4=SDA, A5=SCL)

String userInput = "";

// ============= HELPER FUNCTIONS =============

void printMenu() {
  Serial.println(F("\n╔════════════════════════════════════════════════╗"));
  Serial.println(F("║     KATANA SENSOR DIAGNOSTIC TEST MENU        ║"));
  Serial.println(F("╠════════════════════════════════════════════════╣"));
  Serial.println(F("║  1 = Test HC-SR04 DEPAN (D2/D3)               ║"));
  Serial.println(F("║  2 = Test HC-SR04 BAWAH (D10/D11)             ║"));
  Serial.println(F("║  3 = Test MPU6050 IMU (A4/A5 I2C)             ║"));
  Serial.println(F("║  4 = Test Water Sensor (A0 Analog)            ║"));
  Serial.println(F("║  5 = Test Vibration Motor (D5 PWM)            ║"));
  Serial.println(F("║  6 = Test Buzzer (D6 via BC547)               ║"));
  Serial.println(F("║  7 = Test I2C Scanner (Find all devices)      ║"));
  Serial.println(F("║  A = Test ALL sensors                         ║"));
  Serial.println(F("║  H = Tampilkan menu ini                       ║"));
  Serial.println(F("╚════════════════════════════════════════════════╝"));
  Serial.println(F("Ketik angka/huruf + ENTER:\n"));
}

void writeMPU(byte reg, byte value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission(true);
}

bool readMPUAccel(float &ax, float &ay, float &az) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((int)MPU_ADDR, 6, true) != 6) return false;

  int16_t rawX = (Wire.read() << 8) | Wire.read();
  int16_t rawY = (Wire.read() << 8) | Wire.read();
  int16_t rawZ = (Wire.read() << 8) | Wire.read();
  ax = rawX / 16384.0;
  ay = rawY / 16384.0;
  az = rawZ / 16384.0;
  return true;
}

// ============= TEST FUNCTIONS =============

void testFrontUltrasonic() {
  Serial.println(F("\n┌─ TEST HC-SR04 DEPAN (D2=ECHO, D3=TRIG) ─┐"));
  pinMode(PIN_FRONT_TRIG, OUTPUT);
  pinMode(PIN_FRONT_ECHO, INPUT);
  
  Serial.println(F("Mengirim 5x trigger pulses..."));
  digitalWrite(PIN_FRONT_TRIG, LOW);
  delay(100);
  
  int successCount = 0;
  for (int i = 0; i < 5; i++) {
    Serial.print(F("  ["));
    Serial.print(i + 1);
    Serial.print(F("/5] "));
    
    digitalWrite(PIN_FRONT_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_FRONT_TRIG, LOW);
    
    unsigned long pulse = pulseIn(PIN_FRONT_ECHO, HIGH, 25000UL);
    
    if (pulse == 0) {
      Serial.println(F("TIMEOUT (sensor tidak merespons)"));
    } else {
      float distance = pulse / 58.0;
      Serial.print(F("OK - Pulse: "));
      Serial.print(pulse);
      Serial.print(F(" us = "));
      Serial.print(distance, 1);
      Serial.println(F(" cm"));
      successCount++;
    }
    
    delay(150);
  }
  
  Serial.print(F("\n✓ RESULT: "));
  if (successCount >= 3) {
    Serial.print(successCount);
    Serial.println(F("/5 success → SENSOR HIDUP ✓"));
  } else {
    Serial.print(successCount);
    Serial.println(F("/5 success → SENSOR MATI atau LEPAS ✗"));
    Serial.println(F("  Cek: VCC/GND terhubung? D2/D3 benar? Kabel rusak?"));
  }
  Serial.println(F("└────────────────────────────────────────┘"));
}

void testDownUltrasonic() {
  Serial.println(F("\n┌─ TEST HC-SR04 BAWAH (D10=ECHO, D11=TRIG) ─┐"));
  pinMode(PIN_DOWN_TRIG, OUTPUT);
  pinMode(PIN_DOWN_ECHO, INPUT);
  
  Serial.println(F("Mengirim 5x trigger pulses..."));
  digitalWrite(PIN_DOWN_TRIG, LOW);
  delay(100);
  
  int successCount = 0;
  for (int i = 0; i < 5; i++) {
    Serial.print(F("  ["));
    Serial.print(i + 1);
    Serial.print(F("/5] "));
    
    digitalWrite(PIN_DOWN_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_DOWN_TRIG, LOW);
    
    unsigned long pulse = pulseIn(PIN_DOWN_ECHO, HIGH, 25000UL);
    
    if (pulse == 0) {
      Serial.println(F("TIMEOUT (sensor tidak merespons)"));
    } else {
      float distance = pulse / 58.0;
      Serial.print(F("OK - Pulse: "));
      Serial.print(pulse);
      Serial.print(F(" us = "));
      Serial.print(distance, 1);
      Serial.println(F(" cm"));
      successCount++;
    }
    
    delay(150);
  }
  
  Serial.print(F("\n✓ RESULT: "));
  if (successCount >= 3) {
    Serial.print(successCount);
    Serial.println(F("/5 success → SENSOR HIDUP ✓"));
  } else {
    Serial.print(successCount);
    Serial.println(F("/5 success → SENSOR MATI atau LEPAS ✗"));
    Serial.println(F("  Cek: VCC/GND terhubung? D10/D11 benar? Kabel rusak?"));
  }
  Serial.println(F("└────────────────────────────────────────┘"));
}

void testMPU6050() {
  Serial.println(F("\n┌─ TEST MPU6050 IMU (A4=SDA, A5=SCL I2C) ─┐"));
  
  Wire.begin();
  delay(100);
  
  // Test I2C connection
  Serial.println(F("1. Testing I2C connection to address 0x68..."));
  Wire.beginTransmission(MPU_ADDR);
  byte error = Wire.endTransmission();
  
  if (error != 0) {
    Serial.print(F("   ✗ ERROR: I2C tidak merespons (code: "));
    Serial.print(error);
    Serial.println(F(")"));
    Serial.println(F("   Cek: Kabel A4/A5 terhubung? VCC/GND? Pull-up resistor?"));
    Serial.println(F("└────────────────────────────────────────┘"));
    return;
  }
  
  Serial.println(F("   ✓ I2C Connection OK"));
  
  // Wake up MPU
  Serial.println(F("2. Waking up MPU6050..."));
  writeMPU(0x6B, 0x00);
  delay(50);
  writeMPU(0x1C, 0x00); // ±2g range
  Serial.println(F("   ✓ MPU6050 initialized"));
  
  // Read accelerometer data
  Serial.println(F("3. Reading accelerometer 5x..."));
  int successCount = 0;
  
  for (int i = 0; i < 5; i++) {
    float ax, ay, az;
    Serial.print(F("  ["));
    Serial.print(i + 1);
    Serial.print(F("/5] "));
    
    if (readMPUAccel(ax, ay, az)) {
      Serial.print(F("aX="));
      Serial.print(ax, 2);
      Serial.print(F(" aY="));
      Serial.print(ay, 2);
      Serial.print(F(" aZ=");
      Serial.println(az, 2);
      successCount++;
    } else {
      Serial.println(F("Failed to read"));
    }
    
    delay(200);
  }
  
  Serial.print(F("\n✓ RESULT: "));
  if (successCount >= 3) {
    Serial.print(successCount);
    Serial.println(F("/5 success → SENSOR HIDUP ✓"));
  } else {
    Serial.print(successCount);
    Serial.println(F("/5 success → SENSOR MATI atau LEPAS ✗"));
    Serial.println(F("  Cek: I2C address (default 0x68)? VCC/GND?"));
  }
  Serial.println(F("└────────────────────────────────────────┘"));
}

void testWaterSensor() {
  Serial.println(F("\n┌─ TEST WATER SENSOR (A0 Analog) ─┐"));
  pinMode(PIN_WATER_RAW, INPUT);
  
  Serial.println(F("Membaca nilai analog 10x (dry=0, wet=1023)..."));
  
  int minVal = 1024, maxVal = -1, avgVal = 0;
  
  for (int i = 0; i < 10; i++) {
    int val = analogRead(PIN_WATER_RAW);
    Serial.print(F("  ["));
    Serial.print(i + 1);
    Serial.print(F("/10] A0 = "));
    Serial.println(val);
    
    minVal = min(minVal, val);
    maxVal = max(maxVal, val);
    avgVal += val;
    
    delay(100);
  }
  
  avgVal /= 10;
  
  Serial.println();
  Serial.print(F("  Min: "));
  Serial.print(minVal);
  Serial.print(F(" | Max: "));
  Serial.print(maxVal);
  Serial.print(F(" | Avg: "));
  Serial.println(avgVal);
  
  Serial.println(F("\n✓ RESULT:"));
  if (maxVal - minVal > 10) {
    Serial.println(F("  → SENSOR HIDUP ✓ (ada variasi nilai)"));
    if (avgVal < 100) {
      Serial.println(F("    Status: DRY (kering, ~0V)");
    } else if (avgVal > 700) {
      Serial.println(F("    Status: WET (basah, ~5V)");
    } else {
      Serial.println(F("    Status: Medium (semi-basah)");
    }
  } else {
    Serial.println(F("  → SENSOR MATI atau LEPAS ✗ (nilai statis)"));
    Serial.println(F("    Cek: Pin A0 terhubung? VCC/GND? Kabel rusak?"));
  }
  Serial.println(F("└──────────────────────────────┘"));
}

void testVibrationMotor() {
  Serial.println(F("\n┌─ TEST VIBRATION MOTOR (D5 PWM) ─┐"));
  pinMode(PIN_VIBRATION, OUTPUT);
  
  Serial.println(F("Mengirim PWM pattern:"));
  
  Serial.println(F("  [1/4] 50% duty cycle (2.5V) for 1 sec..."));
  analogWrite(PIN_VIBRATION, 127);
  delay(1000);
  
  Serial.println(F("  [2/4] 100% duty cycle (5V) for 1 sec..."));
  analogWrite(PIN_VIBRATION, 255);
  delay(1000);
  
  Serial.println(F("  [3/4] OFF for 0.5 sec..."));
  analogWrite(PIN_VIBRATION, 0);
  delay(500);
  
  Serial.println(F("  [4/4] Rapid pulse (20ms on/off) x10..."));
  for (int i = 0; i < 10; i++) {
    analogWrite(PIN_VIBRATION, 220);
    delay(20);
    analogWrite(PIN_VIBRATION, 0);
    delay(20);
  }
  
  Serial.println(F("\n✓ RESULT:"));
  Serial.println(F("  Apakah motor BERGETAR? (Y/N)"));
  Serial.println(F("  → Jika YA: MOTOR HIDUP ✓"));
  Serial.println(F("  → Jika TIDAK: Cek VCC/GND, pin D5, atau motor rusak ✗"));
  Serial.println(F("└──────────────────────────────┘"));
}

void testBuzzer() {
  Serial.println(F("\n┌─ TEST BUZZER (D6 via BC547) ─┐"));
  pinMode(PIN_BUZZER, OUTPUT);
  
  Serial.println(F("Mengirim output pattern:"));
  
  Serial.println(F("  [1/5] HIGH (5V ke BC547 base) for 1 sec..."));
  digitalWrite(PIN_BUZZER, HIGH);
  delay(1000);
  
  Serial.println(F("  [2/5] LOW (0V) for 0.5 sec..."));
  digitalWrite(PIN_BUZZER, LOW);
  delay(500);
  
  Serial.println(F("  [3/5] HIGH for 0.5 sec..."));
  digitalWrite(PIN_BUZZER, HIGH);
  delay(500);
  
  Serial.println(F("  [4/5] LOW for 0.5 sec..."));
  digitalWrite(PIN_BUZZER, LOW);
  delay(500);
  
  Serial.println(F("  [5/5] Rapid pulse (200ms on/off) x5..."));
  for (int i = 0; i < 5; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(200);
    digitalWrite(PIN_BUZZER, LOW);
    delay(200);
  }
  
  Serial.println(F("\n✓ RESULT:"));
  Serial.println(F("  Apakah buzzer BERBUNYI? (Y/N)"));
  Serial.println(F("  → Jika YA: BUZZER HIDUP ✓"));
  Serial.println(F("  → Jika TIDAK: Cek 1k resistor D6→BC547 base?"));
  Serial.println(F("            Atau: VCC ke buzzer + terhubung? ✗"));
  Serial.println(F("└────────────────────────────────┘"));
}

void scanI2C() {
  Serial.println(F("\n┌─ I2C SCANNER (Find all I2C devices) ─┐"));
  Wire.begin();
  delay(100);
  
  Serial.println(F("Scanning I2C addresses 0x08-0x77..."));
  
  byte foundCount = 0;
  for (byte addr = 8; addr < 120; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print(F("  ✓ Found device at address 0x"));
      Serial.println(addr, HEX);
      foundCount++;
    }
  }
  
  Serial.println();
  if (foundCount == 0) {
    Serial.println(F("✗ RESULT: Tidak ada device I2C terdeteksi"));
    Serial.println(F("  Cek: Kabel A4/A5 terhubung? Pull-up resistor?"));
  } else {
    Serial.print(F("✓ RESULT: "));
    Serial.print(foundCount);
    Serial.println(F(" device(s) found"));
    Serial.println(F("  MPU6050 seharusnya di 0x68");
  }
  Serial.println(F("└────────────────────────────────────────┘"));
}

void testAllSensors() {
  Serial.println(F("\n╔════════════════════════════════════════════════╗"));
  Serial.println(F("║        TESTING ALL SENSORS (Full Suite)        ║"));
  Serial.println(F("╚════════════════════════════════════════════════╝"));
  
  testFrontUltrasonic();
  delay(500);
  
  testDownUltrasonic();
  delay(500);
  
  testMPU6050();
  delay(500);
  
  testWaterSensor();
  delay(500);
  
  testVibrationMotor();
  delay(2000);
  
  testBuzzer();
  delay(1000);
  
  Serial.println(F("\n╔════════════════════════════════════════════════╗"));
  Serial.println(F("║          ALL TESTS COMPLETED                   ║"));
  Serial.println(F("╚════════════════════════════════════════════════╝\n"));
  
  printMenu();
}

void checkSerialInput() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (userInput.length() > 0) {
        String cmd = userInput;
        cmd.toUpperCase();
        
        if (cmd == "1") testFrontUltrasonic();
        else if (cmd == "2") testDownUltrasonic();
        else if (cmd == "3") testMPU6050();
        else if (cmd == "4") testWaterSensor();
        else if (cmd == "5") testVibrationMotor();
        else if (cmd == "6") testBuzzer();
        else if (cmd == "7") scanI2C();
        else if (cmd == "A") testAllSensors();
        else if (cmd == "H") printMenu();
        else {
          Serial.println(F("❌ Input tidak dikenali. Ketik H untuk menu."));
        }
        
        userInput = "";
        if (cmd != "A") printMenu(); // Jangan reprint menu setelah ALL
      }
    } else if (c == '\b' || c == 127) { // Backspace
      if (userInput.length() > 0) {
        userInput = userInput.substring(0, userInput.length() - 1);
        Serial.print(F("\b \b"));
      }
    } else {
      if (userInput.length() < 32) {
        userInput += c;
        Serial.print(c);
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  
  Serial.println(F("\n\n"));
  Serial.println(F("╔════════════════════════════════════════════════╗"));
  Serial.println(F("║  KATANA SENSOR DIAGNOSTIC TEST v1.0            ║"));
  Serial.println(F("║  Arduino Nano V3 (ATmega328P)                  ║"));
  Serial.println(F("╚════════════════════════════════════════════════╝"));
  
  printMenu();
}

void loop() {
  checkSerialInput();
  delay(50);
}
