/*
  KATANA (Kawan Tunanetra) - Smart Cane Prototype
  Target Board: Arduino Nano V3 (ATmega328P)

  Fitur Diagnosa Otomatis & Sensor Presence:
  - Mendeteksi secara langsung apakah sensor fisik terhubung (RIIL) atau terlepas (LEPAS).
  - Mencegah false alarm (misal alarm TEPI_TURUNAN tidak akan berbunyi jika sensor bawah memang belum dicolok).
  - Menampilkan status koneksi real-time setiap sensor di Serial Monitor.
*/

#include <Arduino.h>
#include <Wire.h>
#include <math.h>
#include <EEPROM.h>

// Set ke 0 untuk hardware fisik (Buzzer aktif 3-5V via transistor BC547)
// Set ke 1 jika simulasi di Wokwi
#define WOKWI_SIMULATION 0

// ================= PIN MAPPING =================
const byte PIN_FRONT_ECHO = 2;    // HC-SR04 Depan Echo
const byte PIN_FRONT_TRIG = 3;    // HC-SR04 Depan Trig
const byte PIN_FALL_TEST  = 4;    // Wokwi test button (D4 ke GND)
const byte PIN_VIBRATION  = 5;    // PWM Motor Getar SIG
const byte PIN_BUZZER     = 6;    // Active Buzzer via BC547 base
const byte PIN_DOWN_ECHO  = 8;    // HC-SR04 Bawah Echo
const byte PIN_DOWN_TRIG  = 9;    // HC-SR04 Bawah Trig
const byte PIN_WATER_RAW  = A0;   // Sensor Air Analog (A0)

const byte MPU_ADDR = 0x68;       // Alamat I2C MPU6050 (A4=SDA, A5=SCL)

// ================= PARAMETER AMBANG =================
const int FRONT_LOW_CM        = 100;
const int FRONT_MEDIUM_CM     = 60;
const int FRONT_NEAR_CM       = 30;
const int DROP_DELTA_LIMIT_CM = 15;
const int WATER_LIMIT         = 400; // Diset ke 400 sesuai kalibrasi pengguna (ADC > 400 dianggap basah)
const float DROP_TILT_MAX_DEG = 25.0; // Deteksi turunan aktif saat tongkat tegak (< 25°)
const float FALL_TILT_LIMIT_DEG = 30.0; // Batas jatuh tongkat diubah ke > 30° (Alarm SOS)
const unsigned long DROP_DEBOUNCE_MS = 200;
const unsigned long FALL_CONFIRM_MS  = 2000;

// Volume Buzzer PWM (0 - 255): Default 35 (~15% duty cycle, suara lembut dan tidak memekakkan telinga)
byte buzzerVolumePwm = 35;

enum AlertState {
  STANDBY,        // Sensor utama belum terpasang
  NORMAL,         // Semua sensor terpasang dan dalam batas aman
  OBJECT_LOW,     // Objek depan mulai terdeteksi (waspada)
  OBJECT_MEDIUM,  // Objek depan sedang
  OBJECT_NEAR,    // Objek depan sangat dekat (bahaya)
  WATER_ALERT,    // Genangan air / permukaan basah
  DROP_ALERT,     // Tepi turunan / lubang
  FALL_ALERT      // Tongkat jatuh / tergeletak
};

AlertState activeState = STANDBY;
unsigned long dropStartMs = 0;
unsigned long fallStartMs = 0;
unsigned long lastReportMs = 0;

// Data sensor & status koneksi hardware
bool frontConnected = false;
bool downConnected  = false;
bool mpuConnected   = false;
bool waterConnected = false;

// Konfigurasi Sensor Air Fisik (Pin A0)
// Diaktifkan default agar langsung membaca sensor air fisik tanpa perlu ketik WATER ON
bool waterSensorInstalled = true;

float frontCm = -1.0;
float downCm  = -1.0;
int dropDeltaCm = 0;
float downBaselineCm = 30.0;
int waterValue = 0;
float tiltDeg = -1.0;

bool dropConfirmed  = false;
bool fallConfirmed  = false;
bool vibrationOn    = false;

// Mode Simulasi / Override Serial (seperti di Wokwi)
bool demoMode       = false;
float simFrontCm    = 80.0;
float simDownCm     = 30.0;
float simTiltDeg    = 12.0;
int simWaterVal     = 220;
String serialBuffer = "";

// Manual Override / Uji Aktuator Terpisah
bool overrideMotor = false;
byte manualMotorPwm = 0;
unsigned long overrideMotorUntilMs = 0;

bool overrideBuzzer = false;
bool manualBuzzerState = false;
unsigned long overrideBuzzerUntilMs = 0;

void processSerialCommand(String cmd);
void checkSerialInput();

byte mpuAddr = 0x68;              // Alamat I2C MPU6050 dinamis (0x68 atau 0x69)
bool frontPinsInverted = false;    // Status apakah pin Trig/Echo depan tertukar
bool downPinsInverted = false;     // Status apakah pin Trig/Echo bawah tertukar

// Vektor gravitasi acuan saat tongkat dalam posisi tegak lurus (upright)
// Default fallback: Sesuai posisi fisik modul GY-521 yang ditempel di tongkat
// di mana bidang sensor berada pada kemiringan ~45° antara sumbu Y dan Z (normal 40-45°)
float refAccelX = 0.0;
float refAccelY = 0.7071;
float refAccelZ = 0.7071;
bool isCalibrated = false;

const int EEPROM_MAGIC_ADDR = 16;
const byte EEPROM_MAGIC_VAL = 0x54; // 'T' untuk Tilt calibration

void loadTiltCalibration() {
  if (EEPROM.read(EEPROM_MAGIC_ADDR) == EEPROM_MAGIC_VAL) {
    EEPROM.get(EEPROM_MAGIC_ADDR + 1, refAccelX);
    EEPROM.get(EEPROM_MAGIC_ADDR + 1 + sizeof(float), refAccelY);
    EEPROM.get(EEPROM_MAGIC_ADDR + 1 + 2 * sizeof(float), refAccelZ);
    
    float mag = sqrt(refAccelX * refAccelX + refAccelY * refAccelY + refAccelZ * refAccelZ);
    if (mag > 0.5 && mag < 1.5) {
      refAccelX /= mag;
      refAccelY /= mag;
      refAccelZ /= mag;
      isCalibrated = true;
      return;
    }
  }
  // Default fallback: kemiringan ~45° antara sumbu Y dan Z sesuai pemasangan fisik vertikal
  refAccelX = 0.0;
  refAccelY = 0.7071;
  refAccelZ = 0.7071;
  isCalibrated = false;
}

void saveTiltCalibration(float nx, float ny, float nz) {
  refAccelX = nx;
  refAccelY = ny;
  refAccelZ = nz;
  isCalibrated = true;
  EEPROM.write(EEPROM_MAGIC_ADDR, EEPROM_MAGIC_VAL);
  EEPROM.put(EEPROM_MAGIC_ADDR + 1, refAccelX);
  EEPROM.put(EEPROM_MAGIC_ADDR + 1 + sizeof(float), refAccelY);
  EEPROM.put(EEPROM_MAGIC_ADDR + 1 + 2 * sizeof(float), refAccelZ);
}

bool writeMPU(byte reg, byte value) {
  Wire.beginTransmission(mpuAddr);
  Wire.write(reg);
  Wire.write(value);
  byte err = Wire.endTransmission(true);
  return (err == 0);
}

// Prosedur pembersihan bus I2C ATmega328P jika SDA ditahan LOW oleh slave yang macet
void recoverI2CBus() {
  pinMode(A4, INPUT_PULLUP); // SDA
  pinMode(A5, OUTPUT);       // SCL
  
  // Kirim 9 clock pulse di SCL untuk release SDA jika slave sedang stuck
  for (byte i = 0; i < 9; i++) {
    digitalWrite(A5, HIGH);
    delayMicroseconds(10);
    digitalWrite(A5, LOW);
    delayMicroseconds(10);
  }
  
  // Generate STOP condition
  pinMode(A4, OUTPUT);
  digitalWrite(A4, LOW);
  delayMicroseconds(10);
  digitalWrite(A5, HIGH);
  delayMicroseconds(10);
  digitalWrite(A4, HIGH);
  delayMicroseconds(10);
  
  pinMode(A4, INPUT);
  pinMode(A5, INPUT);
  Wire.begin();
  Wire.setClock(100000);
}

byte scanI2C() {
  Wire.begin();
  Wire.setClock(100000);
  #if defined(WIRE_HAS_TIMEOUT)
    Wire.setWireTimeout(3000, true);
  #endif

  // Cek 0x68 (Default AD0 GND/Float)
  Wire.beginTransmission(0x68);
  if (Wire.endTransmission() == 0) return 0x68;

  // Cek 0x69 (AD0 VCC/Pull-up)
  Wire.beginTransmission(0x69);
  if (Wire.endTransmission() == 0) return 0x69;

  // Scan seluruh rentang alamat
  for (byte a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) return a;
  }

  // Jika belum terdeteksi, coba jalankan bus recovery untuk melepas slave yang terkunci
  recoverI2CBus();
  Wire.beginTransmission(0x68);
  if (Wire.endTransmission() == 0) return 0x68;
  Wire.beginTransmission(0x69);
  if (Wire.endTransmission() == 0) return 0x69;

  for (byte a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) return a;
  }

  return 0; // Tidak ada satupun perangkat I2C merespons
}

bool setupMPU() {
  byte detected = scanI2C();
  if (detected == 0) {
    return false; // Jalur I2C tidak merespons
  }
  mpuAddr = detected;

  bool okWake  = writeMPU(0x6B, 0x00); // Wake MPU6050 dari sleep mode
  delay(15);
  bool okAccel = writeMPU(0x1C, 0x00); // Accelerometer range +/-2g
  return (okWake && okAccel);
}

bool readMPUAccel(float &ax, float &ay, float &az) {
  Wire.beginTransmission(mpuAddr);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) {
    // Fallback: Beberapa modul klon menolak repeated start, coba dengan true (STOP condition)
    Wire.beginTransmission(mpuAddr);
    Wire.write(0x3B);
    if (Wire.endTransmission(true) != 0) return false;
  }
  if (Wire.requestFrom((int)mpuAddr, 6, true) != 6) return false;

  int16_t rawX = (Wire.read() << 8) | Wire.read();
  int16_t rawY = (Wire.read() << 8) | Wire.read();
  int16_t rawZ = (Wire.read() << 8) | Wire.read();
  ax = rawX / 16384.0;
  ay = rawY / 16384.0;
  az = rawZ / 16384.0;
  return true;
}

bool calibrateUpright() {
  if (!mpuConnected) {
    Serial.println(F("[IMU] Gagal kalibrasi: Sensor MPU6050 belum terdeteksi!"));
    return false;
  }
  
  Serial.println(F("[IMU] Memulai kalibrasi posisi tegak... Tahan tongkat tegak diam selama 0.3 detik."));
  float sumX = 0, sumY = 0, sumZ = 0;
  int samples = 0;
  for (int i = 0; i < 20; i++) {
    float ax, ay, az;
    if (readMPUAccel(ax, ay, az)) {
      sumX += ax;
      sumY += ay;
      sumZ += az;
      samples++;
    }
    delay(15);
  }
  
  if (samples >= 10) {
    float avgX = sumX / samples;
    float avgY = sumY / samples;
    float avgZ = sumZ / samples;
    float mag = sqrt(avgX * avgX + avgY * avgY + avgZ * avgZ);
    if (mag > 0.4) {
      saveTiltCalibration(avgX / mag, avgY / mag, avgZ / mag);
      Serial.print(F("[IMU] KALIBRASI SUKSES! Vektor Acuan Tegak: X="));
      Serial.print(refAccelX, 2); Serial.print(F("g, Y="));
      Serial.print(refAccelY, 2); Serial.print(F("g, Z="));
      Serial.print(refAccelZ, 2); Serial.println(F("g"));
      Serial.println(F("[IMU] Tersimpan permanen di EEPROM. Kemiringan saat ini di-reset ke 0.0° [TEGAK]."));
      tiltDeg = 0.0;
      return true;
    }
  }
  Serial.println(F("[IMU] Gagal kalibrasi: Tongkat bergerak atau data tidak stabil. Coba ulangi."));
  return false;
}

// Mengembalikan jarak cm jika tersambung, atau -1.0 jika timeout/lepas
float readUltrasonicCm(byte trigPin, byte echoPin, bool &connected) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long pulse = pulseIn(echoPin, HIGH, 25000UL);
  if (pulse == 0) {
    connected = false;
    return -1.0;
  }
  connected = true;
  return pulse / 58.0;
}

// Pembacaan cerdas sensor depan dengan deteksi otomatis jika kabel Trig(D3) & Echo(D2) tertukar
float readFrontUltrasonic(bool &connected) {
  if (!frontPinsInverted) {
    float val = readUltrasonicCm(PIN_FRONT_TRIG, PIN_FRONT_ECHO, connected);
    if (connected) return val;

    // Coba uji coba apakah pin D2 dan D3 tertukar secara fisik
    pinMode(PIN_FRONT_ECHO, OUTPUT);
    pinMode(PIN_FRONT_TRIG, INPUT);
    float invVal = readUltrasonicCm(PIN_FRONT_ECHO, PIN_FRONT_TRIG, connected);
    if (connected) {
      frontPinsInverted = true;
      Serial.println(F("[AUTO-DETECT] Sensor Depan: Pin D2 dan D3 terpasang terbalik. Auto-swap aktif."));
      return invVal;
    }
    // Jika tetap gagal, kembalikan konfigurasi semula
    pinMode(PIN_FRONT_TRIG, OUTPUT);
    pinMode(PIN_FRONT_ECHO, INPUT);
    connected = false;
    return -1.0;
  } else {
    // Mode inverted aktif
    float val = readUltrasonicCm(PIN_FRONT_ECHO, PIN_FRONT_TRIG, connected);
    if (connected) return val;

    // Uji apakah sudah dibalikkan ke normal oleh pengguna
    pinMode(PIN_FRONT_TRIG, OUTPUT);
    pinMode(PIN_FRONT_ECHO, INPUT);
    float normVal = readUltrasonicCm(PIN_FRONT_TRIG, PIN_FRONT_ECHO, connected);
    if (connected) {
      frontPinsInverted = false;
      return normVal;
    }
    pinMode(PIN_FRONT_ECHO, OUTPUT);
    pinMode(PIN_FRONT_TRIG, INPUT);
    connected = false;
    return -1.0;
  }
}

// Pembacaan cerdas sensor bawah dengan deteksi otomatis jika kabel Trig(D9) & Echo(D8) tertukar
float readDownUltrasonic(bool &connected) {
  if (!downPinsInverted) {
    float val = readUltrasonicCm(PIN_DOWN_TRIG, PIN_DOWN_ECHO, connected);
    if (connected) return val;

    // Coba uji coba apakah pin D8 dan D9 tertukar secara fisik
    pinMode(PIN_DOWN_ECHO, OUTPUT);
    pinMode(PIN_DOWN_TRIG, INPUT);
    float invVal = readUltrasonicCm(PIN_DOWN_ECHO, PIN_DOWN_TRIG, connected);
    if (connected) {
      downPinsInverted = true;
      Serial.println(F("[AUTO-DETECT] Sensor Bawah: Pin D8 dan D9 terpasang terbalik. Auto-swap aktif."));
      return invVal;
    }
    // Jika tetap gagal, kembalikan konfigurasi semula
    pinMode(PIN_DOWN_TRIG, OUTPUT);
    pinMode(PIN_DOWN_ECHO, INPUT);
    connected = false;
    return -1.0;
  } else {
    // Mode inverted aktif
    float val = readUltrasonicCm(PIN_DOWN_ECHO, PIN_DOWN_TRIG, connected);
    if (connected) return val;

    // Uji apakah sudah dibalikkan ke normal oleh pengguna
    pinMode(PIN_DOWN_TRIG, OUTPUT);
    pinMode(PIN_DOWN_ECHO, INPUT);
    float normVal = readUltrasonicCm(PIN_DOWN_TRIG, PIN_DOWN_ECHO, connected);
    if (connected) {
      downPinsInverted = false;
      return normVal;
    }
    pinMode(PIN_DOWN_ECHO, OUTPUT);
    pinMode(PIN_DOWN_TRIG, INPUT);
    connected = false;
    return -1.0;
  }
}

void calibrateDownBaseline() {
  float total = 0.0;
  byte valid = 0;
  bool isConn = false;
  for (byte i = 0; i < 12; i++) {
    float value = readDownUltrasonic(isConn);
    if (isConn && value >= 5.0 && value <= 120.0) {
      total += value;
      valid++;
    }
    delay(35);
  }
  if (valid >= 6) {
    downBaselineCm = total / valid;
  }
}

void processSerialCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  String upper = cmd;
  upper.toUpperCase();

  if (upper == "HELP" || upper == "?") {
    Serial.println(F("\n=================================================="));
    Serial.println(F("       KATANA SERIAL SIMULATION CONSOLE           "));
    Serial.println(F("=================================================="));
    Serial.println(F("Perintah Dasar:"));
    Serial.println(F("  DEMO ON   -> Aktifkan mode simulasi / override"));
    Serial.println(F("  DEMO OFF  -> Kembali ke sensor fisik asli"));
    Serial.println(F(""));
    Serial.println(F("Atur Sensor Manual:"));
    Serial.println(F("  FRONT <cm>   -> Jarak depan (misal: FRONT 15)"));
    Serial.println(F("  DOWN <cm>    -> Jarak bawah/turunan (misal: DOWN 55)"));
    Serial.println(F("  TILT <deg>   -> Kemiringan tongkat (misal: TILT 75)"));
    Serial.println(F("  WATER <val>  -> Sensor air 0-1023 (misal: WATER 750)"));
    Serial.println(F(""));
    Serial.println(F("Uji Aktuator Fisik:"));
    Serial.println(F("  TEST MOTOR    -> Getarkan motor selama 1.5 detik (Pin D5)"));
    Serial.println(F("  MOTOR ON/OFF  -> Nyalakan / matikan motor getar terus-menerus"));
    Serial.println(F("  TEST BUZZER   -> Bunyikan buzzer pola beep selama 1.5 detik (Pin D6)"));
    Serial.println(F("  BUZZER ON/OFF -> Nyalakan / matikan buzzer terus-menerus"));
    Serial.println(F("  VOL <5-255>   -> Atur volume buzzer PWM (misal: VOL 35 lembut, VOL 120 sedang)"));
    Serial.println(F("  TEST OUTPUT   -> Self-test motor getar & buzzer bersamaan"));
    Serial.println(F("  STOP          -> Matikan semua uji aktuator manual"));
    Serial.println(F("Kalibrasi & Diagnosa Sensor:"));
    Serial.println(F("  CALIB         -> Kalibrasi posisi tegak tongkat ke 0.0° (Simpan ke EEPROM)"));
    Serial.println(F("  TEST IMU      -> Uji live akselerometer MPU6050 & status kemiringan"));
    Serial.println(F("  DIAG          -> Diagnosa koneksi fisik semua sensor"));
    Serial.println(F(""));
    Serial.println(F("Skenario Cepat (Preset Wokwi):"));
    Serial.println(F("  FALL    -> Simulasi Tongkat Jatuh (Alarm SOS)"));
    Serial.println(F("  DROP    -> Simulasi Tepi Turunan / Lubang"));
    Serial.println(F("  WET     -> Simulasi Genangan Air"));
    Serial.println(F("  NEAR    -> Simulasi Objek Sangat Dekat"));
    Serial.println(F("  NORMAL  -> Simulasi Kondisi Aman Normal"));
    Serial.println(F("==================================================\n"));
    return;
  }

  if (upper == "DEMO ON" || upper == "DEMO:ON" || upper == "SIM 1" || upper == "SIM ON") {
    demoMode = true;
    Serial.println(F("[SISTEM] >>> MODE DEMO AKTIF: Nilai sensor di-override via serial <<<"));
    return;
  }

  if (upper == "DEMO OFF" || upper == "DEMO:OFF" || upper == "SIM 0" || upper == "SIM OFF") {
    demoMode = false;
    Serial.println(F("[SISTEM] >>> MODE DEMO NONAKTIF: Kembali membaca sensor fisik <<<"));
    return;
  }

  if (upper == "WATER ON" || upper == "WATER:ON") {
    waterSensorInstalled = true;
    Serial.println(F("[SENSOR] Sensor Air A0 DIAKTIFKAN."));
    return;
  }

  if (upper == "WATER OFF" || upper == "WATER:OFF") {
    waterSensorInstalled = false;
    waterConnected = false;
    waterValue = 0;
    Serial.println(F("[SENSOR] Sensor Air A0 DINONAKTIFKAN (Status: LEPAS)."));
    return;
  }

  if (upper == "FALL" || upper == "DEMO:FALL") {
    demoMode = true;
    simTiltDeg = 75.0;
    Serial.println(F("[SISTEM] PRESET AKTIF: Tongkat Terjatuh (Kemiringan 75°)"));
    return;
  }

  if (upper == "DROP" || upper == "DEMO:DROP") {
    demoMode = true;
    simDownCm = downBaselineCm + 25.0;
    simTiltDeg = 15.0;
    Serial.println(F("[SISTEM] PRESET AKTIF: Tepi Turunan / Lubang (+25cm delta)"));
    return;
  }

  if (upper == "WET" || upper == "WATER_ALERT" || upper == "DEMO:WET") {
    demoMode = true;
    simWaterVal = 850;
    Serial.println(F("[SISTEM] PRESET AKTIF: Genangan Air (Nilai 850)"));
    return;
  }

  if (upper == "NEAR" || upper == "DEMO:NEAR") {
    demoMode = true;
    simFrontCm = 15.0;
    Serial.println(F("[SISTEM] PRESET AKTIF: Rintangan Depan Sangat Dekat (15cm)"));
    return;
  }

  if (upper == "CALIB" || upper == "TARE" || upper == "ZERO" || upper == "CALIB IMU" || upper == "CALIB:IMU") {
    calibrateUpright();
    return;
  }

  if (upper == "TEST IMU" || upper == "TEST:IMU") {
    Serial.println(F("\n--- [UJI SENSOR IMU MPU6050] ---"));
    if (!mpuConnected) {
      Serial.println(F("Status: LEPAS / TIDAK TERDETEKSI (Cek SDA ke A4, SCL ke A5, VCC ke 5V)"));
    } else {
      float ax, ay, az;
      if (readMPUAccel(ax, ay, az)) {
        float mag = sqrt(ax * ax + ay * ay + az * az);
        float nx = (mag > 0.1) ? (ax / mag) : 0;
        float ny = (mag > 0.1) ? (ay / mag) : 0;
        float nz = (mag > 0.1) ? (az / mag) : 0;
        float dot = constrain((nx * refAccelX) + (ny * refAccelY) + (nz * refAccelZ), -1.0f, 1.0f);
        float curTilt = acos(dot) * 180.0 / PI;

        Serial.print(F("Akselerometer Fisik: X=")); Serial.print(ax, 2);
        Serial.print(F("g, Y=")); Serial.print(ay, 2);
        Serial.print(F("g, Z=")); Serial.print(az, 2);
        Serial.print(F("g (Total: ")); Serial.print(mag, 2); Serial.println(F("g)"));

        Serial.print(F("Vektor Acuan Tegak:  X=")); Serial.print(refAccelX, 2);
        Serial.print(F(", Y=")); Serial.print(refAccelY, 2);
        Serial.print(F(", Z=")); Serial.print(refAccelZ, 2);
        Serial.println(isCalibrated ? F(" [EEPROM]") : F(" [DEFAULT VERTIKAL ~45°]"));

        Serial.print(F("Kemiringan Relatif:  ")); Serial.print(curTilt, 1);
        Serial.print(F("° -> Status: "));
        if (curTilt > FALL_TILT_LIMIT_DEG) {
          Serial.println(F("[BAHAYA: TONGKAT JATUH / SOS]"));
        } else if (curTilt > DROP_TILT_MAX_DEG) {
          Serial.println(F("[MIRING (Turunan Dicegah)]"));
        } else {
          Serial.println(F("[TEGAK STABIL / AMAN]"));
        }
        Serial.println(F("Tips: Posisikan tongkat berdiri tegak normal, lalu ketik 'CALIB' untuk set acuan 0.0°."));
      } else {
        Serial.println(F("Gagal membaca register data sensor I2C."));
      }
    }
    Serial.println(F("--------------------------------\n"));
    return;
  }

  if (upper == "DIAG" || upper == "CHECK" || upper == "TEST ALL" || upper == "TEST:ALL") {
    Serial.println(F("\n--- [HASIL DIAGNOSA KONEKSI SENSOR FISIK] ---"));
    
    // Test 1: Depan
    bool connF = false;
    float distF = readFrontUltrasonic(connF);
    Serial.print(F("1. Sensor Depan (D2/D3): "));
    if (connF) {
      Serial.print(F("TERHUBUNG (Jarak: ")); Serial.print(distF, 1); Serial.print(F(" cm)"));
      if (frontPinsInverted) Serial.print(F(" [PIN D2/D3 TERBALIK AUTO-SWAPPED]"));
      Serial.println();
    } else {
      Serial.println(F("LEPAS (Echo timeout. Coba tukar pin D2 & D3 atau cek VCC 5V)"));
    }

    // Test 2: Bawah
    bool connD = false;
    float distD = readDownUltrasonic(connD);
    Serial.print(F("2. Sensor Bawah (D8/D9): "));
    if (connD) {
      Serial.print(F("TERHUBUNG (Jarak: ")); Serial.print(distD, 1); Serial.print(F(" cm)"));
      if (downPinsInverted) Serial.print(F(" [PIN D8/D9 TERBALIK AUTO-SWAPPED]"));
      Serial.println();
    } else {
      Serial.println(F("LEPAS / KABEL TIDAK MERESPONS (Echo timeout 25ms)"));
    }

    // Test 3: MPU6050
    Serial.print(F("3. Sensor IMU MPU6050 (A4/A5 I2C): "));
    byte i2cAddr = scanI2C();
    if (i2cAddr != 0) {
      mpuAddr = i2cAddr;
      setupMPU(); // Bangunkan dari mode sleep
      float ax, ay, az;
      if (readMPUAccel(ax, ay, az)) {
        float mag = sqrt(ax * ax + ay * ay + az * az);
        float nx = (mag > 0.1) ? (ax / mag) : 0;
        float ny = (mag > 0.1) ? (ay / mag) : 0;
        float nz = (mag > 0.1) ? (az / mag) : 0;
        float dot = constrain((nx * refAccelX) + (ny * refAccelY) + (nz * refAccelZ), -1.0f, 1.0f);
        float curTilt = acos(dot) * 180.0 / PI;

        Serial.print(F("TERHUBUNG pada 0x")); Serial.print(i2cAddr, HEX);
        Serial.print(F(" (X:")); Serial.print(ax, 2);
        Serial.print(F(" Y:")); Serial.print(ay, 2);
        Serial.print(F(" Z:")); Serial.print(az, 2);
        Serial.print(F("g | Kemiringan: ")); Serial.print(curTilt, 1);
        Serial.println(F("°)"));
      } else {
        Serial.print(F("ALAMAT 0x")); Serial.print(i2cAddr, HEX); Serial.println(F(" MERESPONS TAPI GAGAL BACA DATA"));
      }
    } else {
      Serial.println(F("LEPAS (Tidak ada perangkat I2C). Cek: 1. Pin header sudah disolder? 2. SDA ke A4, SCL ke A5 3. VCC ke 5V"));
    }

    // Test 4: Sensor Air
    int wVal = analogRead(PIN_WATER_RAW);
    Serial.print(F("4. Sensor Air (A0): "));
    Serial.print(F("ADC RAW = ")); Serial.print(wVal);
    if (wVal < 50) Serial.println(F(" (Kering / Mengambang)"));
    else if (wVal > 650) Serial.println(F(" (Basah Terdeteksi)"));
    else Serial.println(F(" (Lembab Sedang)"));

    Serial.println(F("--------------------------------------------\n"));
    return;
  }

  if (upper == "TEST FRONT" || upper == "TEST:FRONT") {
    bool conn = false;
    float d = readFrontUltrasonic(conn);
    Serial.print(F("[TEST SENSOR DEPAN] "));
    if (conn) {
      Serial.print(F("TERHUBUNG -> Jarak = ")); Serial.print(d, 1); Serial.print(F(" cm"));
      if (frontPinsInverted) Serial.print(F(" (Pin D2/D3 terbalik, auto-swapped)"));
      Serial.println();
    } else {
      Serial.println(F("LEPAS -> Echo timeout. Coba tukar kabel pin D2 dan D3, serta pastikan VCC dapat 5V!"));
    }
    return;
  }

  if (upper == "TEST DOWN" || upper == "TEST:DOWN") {
    bool conn = false;
    float d = readDownUltrasonic(conn);
    Serial.print(F("[TEST SENSOR BAWAH] "));
    if (conn) {
      Serial.print(F("TERHUBUNG -> Jarak = ")); Serial.print(d, 1); Serial.print(F(" cm"));
      if (downPinsInverted) Serial.print(F(" (Pin D8/D9 terbalik, auto-swapped)"));
      Serial.println();
    } else {
      Serial.println(F("LEPAS -> Tidak ada pulsa echo dari pin D8. Cek kabel VCC, GND, D8, D9!"));
    }
    return;
  }

  if (upper == "TEST IMU" || upper == "TEST:IMU" || upper == "TEST MPU") {
    Serial.println(F("[TEST MPU6050] Memulai diagnosa bus I2C (A4/A5)..."));
    byte addr = scanI2C();
    if (addr != 0) {
      mpuAddr = addr;
      setupMPU();
      float ax, ay, az;
      if (readMPUAccel(ax, ay, az)) {
        float mag = sqrt(ax * ax + ay * ay + az * az);
        float tilt = (mag > 0.05) ? acos(constrain(fabs(az) / mag, 0.0f, 1.0f)) * 180.0 / PI : 0.0;
        Serial.print(F("[TEST MPU6050] TERHUBUNG di 0x")); Serial.print(addr, HEX);
        Serial.print(F(" -> Accel X=")); Serial.print(ax, 2);
        Serial.print(F(" Y=")); Serial.print(ay, 2);
        Serial.print(F(" Z=")); Serial.print(az, 2);
        Serial.print(F(" | Sudut Kemiringan: ")); Serial.print(tilt, 1); Serial.println(F("°"));
      } else {
        Serial.print(F("[TEST MPU6050] ALAMAT 0x")); Serial.print(addr, HEX);
        Serial.println(F(" MERESPONS TAPI GAGAL BACA REGISTER DATA"));
      }
    } else {
      Serial.println(F("[TEST MPU6050] LEPAS -> Bus I2C tidak merespons!"));
      Serial.println(F("  Checklist Solusi Cepat:"));
      Serial.println(F("  1. Pastikan pin header GY-521 SUDAH DISOLDER (bukan hanya ditusuk ke PCB)."));
      Serial.println(F("  2. Pastikan SDA -> A4 dan SCL -> A5 (tidak tertukar)."));
      Serial.println(F("  3. Pastikan VCC modul ke pin 5V Nano (jangan ke 3.3V)."));
      Serial.println(F("  4. Periksa apakah lampu LED merah/hijau di papan modul GY-521 menyala terang."));
    }
    return;
  }

  if (upper == "TEST WATER" || upper == "TEST:WATER") {
    if (!waterSensorInstalled) {
      Serial.println(F("[TEST SENSOR AIR A0] Sensor Air DINONAKTIFKAN / BELUM DIPASANG di Pin A0 (Ketik 'WATER ON' jika sudah dipasang)."));
      return;
    }
    int val = analogRead(PIN_WATER_RAW);
    Serial.print(F("[TEST SENSOR AIR A0] Terbaca ADC: "));
    Serial.print(val);
    Serial.println(val > 650 ? F(" -> BASAH") : F(" -> KERING"));
    return;
  }

  // ================= UJI SIMULASI & TRIGGER AKTUATOR =================
  if (upper == "TEST MOTOR" || upper == "TEST:MOTOR" || upper == "VIBE" || upper == "GETAR") {
    overrideMotorUntilMs = millis() + 1500;
    manualMotorPwm = 220;
    Serial.println(F("[UJI AKTUATOR] Motor Getar AKTIF selama 1.5 detik (PWM 220 di Pin D5)..."));
    return;
  }

  if (upper == "MOTOR ON" || upper == "MOTOR:ON") {
    overrideMotor = true;
    manualMotorPwm = 220;
    overrideMotorUntilMs = 0;
    Serial.println(F("[UJI AKTUATOR] Motor Getar DINYALAKAN (Ketik MOTOR OFF untuk mematikan)."));
    return;
  }

  if (upper == "MOTOR OFF" || upper == "MOTOR:OFF") {
    overrideMotor = false;
    manualMotorPwm = 0;
    overrideMotorUntilMs = 0;
    analogWrite(PIN_VIBRATION, 0);
    Serial.println(F("[UJI AKTUATOR] Motor Getar DIMATIKAN."));
    return;
  }

  if (upper == "TEST BUZZER" || upper == "TEST:BUZZER" || upper == "BEEP" || upper == "BUNYI") {
    overrideBuzzerUntilMs = millis() + 1500;
    Serial.println(F("[UJI AKTUATOR] Buzzer AKTIF pola Beep selama 1.5 detik di Pin D6..."));
    return;
  }

  if (upper == "BUZZER ON" || upper == "BUZZER:ON") {
    overrideBuzzer = true;
    manualBuzzerState = true;
    overrideBuzzerUntilMs = 0;
    driveBuzzer(true);
    Serial.println(F("[UJI AKTUATOR] Buzzer DINYALAKAN terus-menerus (Ketik BUZZER OFF untuk mematikan)."));
    return;
  }

  if (upper == "BUZZER OFF" || upper == "BUZZER:OFF") {
    overrideBuzzer = false;
    manualBuzzerState = false;
    overrideBuzzerUntilMs = 0;
    driveBuzzer(false);
    Serial.println(F("[UJI AKTUATOR] Buzzer DIMATIKAN."));
    return;
  }

  if (upper == "TEST OUTPUT" || upper == "TEST ACTUATOR" || upper == "TEST ACTUATORS" || upper == "TEST:ACTUATORS") {
    Serial.println(F("[UJI AKTUATOR] Memulai Self-Test Semua Aktuator: Motor getar lalu Buzzer..."));
    selfTest();
    Serial.println(F("[UJI AKTUATOR] Uji coba aktuator selesai!"));
    return;
  }

  if (upper == "STOP" || upper == "ACTUATOR OFF" || upper == "OUTPUT OFF") {
    overrideMotor = false;
    manualMotorPwm = 0;
    overrideMotorUntilMs = 0;
    analogWrite(PIN_VIBRATION, 0);

    overrideBuzzer = false;
    manualBuzzerState = false;
    overrideBuzzerUntilMs = 0;
    driveBuzzer(false);
    Serial.println(F("[UJI AKTUATOR] Semua aktuator manual DIMATIKAN."));
    return;
  }

  if (upper == "NORMAL" || upper == "RESET" || upper == "DEMO:NORMAL") {
    demoMode = false;
    simFrontCm = 120.0;
    simDownCm = downBaselineCm;
    simTiltDeg = 12.0;
    simWaterVal = 180;
    Serial.println(F("[SISTEM] KEMBALI KE SENSOR FISIK ASLI"));
    return;
  }

  // Handle format: DEMO:KEY=VAL atau KEY=VAL atau KEY VAL
  if (upper.startsWith("DEMO:")) {
    upper = upper.substring(5);
  }

  int sep = upper.indexOf('=');
  if (sep == -1) sep = upper.indexOf(' ');
  if (sep != -1) {
    String key = upper.substring(0, sep);
    key.trim();
    String valStr = upper.substring(sep + 1);
    valStr.trim();
    float val = valStr.toFloat();

    demoMode = true; // Otomatis aktifkan demo jika ada nilai yang diset

    if (key == "FRONT" || key == "DEPAN") {
      simFrontCm = val;
      Serial.print(F("[SIM] Jarak Depan diset ke: "));
      Serial.print(simFrontCm, 0);
      Serial.println(F(" cm"));
    } else if (key == "DOWN" || key == "BAWAH") {
      simDownCm = val;
      Serial.print(F("[SIM] Jarak Bawah diset ke: "));
      Serial.print(simDownCm, 0);
      Serial.println(F(" cm"));
    } else if (key == "TILT" || key == "SUDUT") {
      simTiltDeg = val;
      Serial.print(F("[SIM] Kemiringan diset ke: "));
      Serial.print(simTiltDeg, 1);
      Serial.println(F("°"));
    } else if (key == "WATER" || key == "AIR") {
      simWaterVal = (int)val;
      Serial.print(F("[SIM] Sensor Air diset ke: "));
      Serial.println(simWaterVal);
    } else if (key == "VOL" || key == "VOLUME") {
      buzzerVolumePwm = (byte)constrain((int)val, 5, 255);
      Serial.print(F("[AUDIO] Volume Buzzer diset ke PWM: "));
      Serial.print(buzzerVolumePwm);
      Serial.print(F("/255 (~"));
      Serial.print((buzzerVolumePwm * 100) / 255);
      Serial.println(F("%)"));
    }
  }
}

void checkSerialInput() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialBuffer.length() > 0) {
        processSerialCommand(serialBuffer);
        serialBuffer = "";
      }
    } else {
      if (serialBuffer.length() < 64) {
        serialBuffer += c;
      }
    }
  }
}

void updateInputs() {
  checkSerialInput();

  unsigned long now = millis();
  
  if (demoMode) {
    // Mode Simulasi / Override Serial
    frontConnected = true;
    downConnected  = true;
    mpuConnected   = true;
    waterConnected = true;

    frontCm     = simFrontCm;
    downCm      = simDownCm;
    tiltDeg     = simTiltDeg;
    waterValue  = simWaterVal;

    dropDeltaCm = (int)(downCm - downBaselineCm);
    if (dropDeltaCm < 0) dropDeltaCm = 0;
  } else {
    // Mode Fisik Nyata: Baca sensor fisik
    // 1. Baca sensor depan
    frontCm = readFrontUltrasonic(frontConnected);
    delayMicroseconds(2500); // Cegah cross-talk ultrasonik
    
    // 2. Baca sensor bawah (dengan deteksi otomatis pin D8/D9)
    downCm = readDownUltrasonic(downConnected);
    
    // Hitung delta bawah hanya jika sensor bawah terhubung
    if (downConnected) {
      dropDeltaCm = (int)(downCm - downBaselineCm);
      if (dropDeltaCm < 0) dropDeltaCm = 0;
    } else {
      dropDeltaCm = 0;
    }

    // 3. Baca sensor air (Pin A0)
    if (waterSensorInstalled) {
      waterValue = analogRead(PIN_WATER_RAW);
      waterConnected = true; // Selalu terhubung selama modul terpasang fisik
    } else {
      waterValue = 0;
      waterConnected = false;
    }

    // 4. Baca MPU6050 dengan auto re-detection jika sempat lepas
    float ax = 0.0, ay = 0.0, az = 1.0;
    if (mpuConnected) {
      if (readMPUAccel(ax, ay, az)) {
        float magnitude = sqrt(ax * ax + ay * ay + az * az);
        if (magnitude > 0.1) {
          float nx = ax / magnitude;
          float ny = ay / magnitude;
          float nz = az / magnitude;
          float dot = (nx * refAccelX) + (ny * refAccelY) + (nz * refAccelZ);
          dot = constrain(dot, -1.0f, 1.0f);
          tiltDeg = acos(dot) * 180.0 / PI;
        }
      } else {
        mpuConnected = false;
        tiltDeg = -1.0;
      }
    } else {
      // Re-deteksi & inisialisasi ulang otomatis tiap 1.5 detik jika sensor baru dipasang/dicolok
      static unsigned long lastMpuRetryMs = 0;
      if (now - lastMpuRetryMs >= 1500) {
        lastMpuRetryMs = now;
        if (setupMPU()) {
          mpuConnected = true;
          loadTiltCalibration();
        }
      }
    }
  }

  // Filter deteksi turunan: HANYA aktif jika sensor bawah benar-benar TERHUBUNG (bukan lepas)
  bool dropCandidate = downConnected && (dropDeltaCm > DROP_DELTA_LIMIT_CM) && (!mpuConnected || tiltDeg < DROP_TILT_MAX_DEG);
  if (dropCandidate) {
    if (dropStartMs == 0) dropStartMs = now;
    dropConfirmed = (now - dropStartMs >= DROP_DEBOUNCE_MS);
  } else {
    dropStartMs = 0;
    dropConfirmed = false;
  }

  // Deteksi tongkat jatuh: HANYA aktif jika MPU6050 TERHUBUNG (kemiringan > 30 deg selama > 2 detik)
  bool fallButton = (digitalRead(PIN_FALL_TEST) == LOW);
  bool fallCandidate = mpuConnected && (tiltDeg > FALL_TILT_LIMIT_DEG);
  if (fallCandidate) {
    if (fallStartMs == 0) fallStartMs = now;
    fallConfirmed = (now - fallStartMs >= FALL_CONFIRM_MS);
  } else {
    fallStartMs = 0;
    fallConfirmed = false;
  }
  if (fallButton) fallConfirmed = true;
}

AlertState decideState() {
  // Jika seluruh sensor belum dicolok, tetap di mode STANDBY (cegah getar palsu)
  if (!frontConnected && !downConnected && !mpuConnected) {
    return STANDBY;
  }

  // Prioritas tunggal: Jatuh > Tepi Turunan > Genangan Air > Objek Depan
  if (fallConfirmed) return FALL_ALERT;
  if (dropConfirmed) return DROP_ALERT;
  if (waterConnected && waterValue > WATER_LIMIT) return WATER_ALERT;
  
  if (frontConnected) {
    if (frontCm < FRONT_NEAR_CM)   return OBJECT_NEAR;
    if (frontCm < FRONT_MEDIUM_CM) return OBJECT_MEDIUM;
    if (frontCm < FRONT_LOW_CM)    return OBJECT_LOW;
  }

  return NORMAL;
}

bool pulseWindow(unsigned long phase, unsigned long startMs, unsigned long endMs) {
  return phase >= startMs && phase < endMs;
}

// Menghasilkan nilai PWM getaran motor: 100% TEGANGAN PENUH (PWM 255) PADA SEMUA KASUS AKTIF
// Diferensiasi murni diatur lewat pola ritme, durasi sentakan inersia, dan jeda antar-getar agar getaran terasa paling kencang & bertenaga
byte getVibrationPwm(AlertState state, unsigned long now) {
  switch (state) {
    case OBJECT_LOW: {
      // Jarak Jauh (60-100cm): 1 Sentakan Kencang Penuh (PWM 255) tiap 600ms (200ms getar, 400ms jeda)
      // Memberi waktu motor berputar ke RPM maksimal lalu mati sejenak
      bool on = (now % 600UL) < 200UL;
      return on ? 255 : 0;
    }

    case OBJECT_MEDIUM: {
      // Jarak Sedang (30-60cm): Denyut rapat bertenaga penuh (PWM 255), periode 300ms (190ms getar, 110ms jeda)
      // Motor bergetar sangat intens dengan ritme ketukan cepat konstan
      bool on = (now % 300UL) < 190UL;
      return on ? 255 : 0;
    }

    case OBJECT_NEAR:
      // Jarak Sangat Dekat (<30cm): Getaran MAKSIMAL MUTLAK 100% (PWM 255) KONTINU tanpa jeda mati
      // RPM motor dipertahankan di batas tertinggi secara permanen
      return 255;

    case WATER_ALERT: {
      // Genangan Air / Basah: 2 Hentakan Panjang Keras (PWM 255)
      // Siklus 1100ms: 450ms getar penuh -> 120ms jeda -> 450ms getar penuh -> 80ms jeda
      // Gelombang getaran berat & panjang khas tanda permukaan licin/basah
      unsigned long p = now % 1100UL;
      bool on = pulseWindow(p, 0, 450) || pulseWindow(p, 570, 1020);
      return on ? 255 : 0;
    }

    case DROP_ALERT: {
      // Tepi Turunan / Lubang: 3 Hentakan Hantam Keras Agresif (PWM 255) lalu JEDA PANJANG
      // Siklus 950ms: 3x hentakan 160ms (jeda antar-hentak 50ms) -> jeda hening 370ms
      // Efek sentakan tripel tajam "DEG - DEG - DEG ..... DEG - DEG - DEG"
      unsigned long p = now % 950UL;
      bool on = pulseWindow(p, 0, 160) || pulseWindow(p, 210, 370) || pulseWindow(p, 420, 580);
      return on ? 255 : 0;
    }

    default:
      return 0;
  }
}

// Kompatibilitas boolean untuk telemetri flag
bool vibrationPattern(AlertState state, unsigned long now) {
  return getVibrationPwm(state, now) > 0;
}

bool buzzerPattern(AlertState state, unsigned long now) {
  // 1. Alarm SOS Morse jika tongkat jatuh (Prioritas 1)
  if (state == FALL_ALERT) {
    // Pola SOS Morse (... --- ...)
    unsigned long p = now % 3600UL;
    return pulseWindow(p, 0, 140) || pulseWindow(p, 240, 380) || pulseWindow(p, 480, 620) ||
           pulseWindow(p, 820, 1220) || pulseWindow(p, 1340, 1740) || pulseWindow(p, 1860, 2260) ||
           pulseWindow(p, 2460, 2600) || pulseWindow(p, 2700, 2840) || pulseWindow(p, 2940, 3080);
  }

  // 2. Alarm Bip Cepat Audio jika rintangan depan sangat dekat (< 30cm / Kasus 4)
  if (state == OBJECT_NEAR) {
    return ((now / 100UL) % 2 == 0); // Beep staccato cepat 100ms ON / 100ms OFF
  }

  return false;
}

void driveBuzzer(bool on) {
#if WOKWI_SIMULATION
  if (on) tone(PIN_BUZZER, 1000);
  else noTone(PIN_BUZZER);
#else
  // Gunakan PWM (analogWrite) untuk mengatur volume suara buzzer secara presisi
  if (on) {
    analogWrite(PIN_BUZZER, buzzerVolumePwm > 0 ? buzzerVolumePwm : 35);
  } else {
    analogWrite(PIN_BUZZER, 0);
  }
#endif
}

void updateOutputs(AlertState state) {
  unsigned long now = millis();

  // 1. Motor Getar: Cek apakah sedang dalam mode uji/override manual
  if (overrideMotorUntilMs > 0) {
    if (now < overrideMotorUntilMs) {
      vibrationOn = true;
      analogWrite(PIN_VIBRATION, manualMotorPwm > 0 ? manualMotorPwm : 255);
    } else {
      overrideMotorUntilMs = 0;
      vibrationOn = false;
      analogWrite(PIN_VIBRATION, 0);
    }
  } else if (overrideMotor) {
    vibrationOn = (manualMotorPwm > 0);
    analogWrite(PIN_VIBRATION, manualMotorPwm);
  } else {
    byte pwmVal = getVibrationPwm(state, now);
    vibrationOn = (pwmVal > 0);
    analogWrite(PIN_VIBRATION, pwmVal);
  }

  // 2. Buzzer: Cek apakah sedang dalam mode uji/override manual
  if (overrideBuzzerUntilMs > 0) {
    if (now < overrideBuzzerUntilMs) {
      // Pola beep berselang-seling (150ms ON, 150ms OFF) agar jelas terdengar
      bool beep = ((now / 150) % 2 == 0);
      driveBuzzer(beep);
    } else {
      overrideBuzzerUntilMs = 0;
      driveBuzzer(false);
    }
  } else if (overrideBuzzer) {
    driveBuzzer(manualBuzzerState);
  } else {
    driveBuzzer(buzzerPattern(state, now));
  }
}

const __FlashStringHelper *stateName(AlertState state) {
  switch (state) {
    case STANDBY:       return F("STANDBY (Sensor Lepas)");
    case OBJECT_LOW:    return F("OBJEK_WASPADA");
    case OBJECT_MEDIUM: return F("OBJEK_SEDANG");
    case OBJECT_NEAR:   return F("OBJEK_DEKAT");
    case WATER_ALERT:   return F("PERMUKAAN_BASAH");
    case DROP_ALERT:    return F("TEPI_TURUNAN");
    case FALL_ALERT:    return F("TONGKAT_JATUH");
    default:            return F("NORMAL");
  }
}

void selfTest() {
  Serial.println(F("[UJI AKTUATOR] 1. Menguji Motor Getar (Pin D5 PWM)..."));
  analogWrite(PIN_VIBRATION, 220);
  delay(400);
  analogWrite(PIN_VIBRATION, 0);
  delay(200);

  Serial.println(F("[UJI AKTUATOR] 2. Menguji Buzzer (Pin D6)..."));
  driveBuzzer(true);
  delay(150);
  driveBuzzer(false);
  delay(100);
  driveBuzzer(true);
  delay(150);
  driveBuzzer(false);
}

void setup() {
  Serial.begin(115200);
  delay(100); // Beri jeda stabilisasi serial port
  Serial.println(F("\n[BOOT] Arduino Booting..."));
  Serial.println(F("[BOOT] Menginisialisasi Pin I/O..."));

  pinMode(PIN_FRONT_TRIG, OUTPUT);
  pinMode(PIN_FRONT_ECHO, INPUT);
  pinMode(PIN_DOWN_TRIG, OUTPUT);
  pinMode(PIN_DOWN_ECHO, INPUT);
  pinMode(PIN_FALL_TEST, INPUT_PULLUP);
  pinMode(PIN_VIBRATION, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  // Inisialisasi dan diagnosa MPU6050
  loadTiltCalibration();
  Serial.print(F("[BOOT] Mengecek Sensor IMU MPU6050 (A4/A5)... "));
  bool mpuOk = setupMPU();
  if (mpuOk) {
    mpuConnected = true;
    Serial.print(F("OK (Terdeteksi di 0x"));
    Serial.print(mpuAddr, HEX);
    Serial.print(F(") -> Acuan Tegak: ["));
    if (isCalibrated) {
      Serial.print(F("EEPROM"));
    } else {
      Serial.print(F("DEFAULT VERTIKAL"));
    }
    Serial.print(F(" X:")); Serial.print(refAccelX, 2);
    Serial.print(F(" Y:")); Serial.print(refAccelY, 2);
    Serial.print(F(" Z:")); Serial.print(refAccelZ, 2);
    Serial.println(F("]"));
  } else {
    mpuConnected = false;
    Serial.println(F("LEPAS/GAGAL (Bus I2C A4/A5 tidak merespons)"));
  }

  // Kalibrasi ultrasonik bawah
  Serial.print(F("[BOOT] Mengkalibrasi Sensor Bawah (Pin 8/9)... "));
  calibrateDownBaseline();
  Serial.print(F("Baseline: "));
  Serial.print(downBaselineCm, 1);
  Serial.println(F(" cm"));

  // Uji aktuator getar dan buzzer
  Serial.print(F("[BOOT] Uji Coba Aktuator (Self-Test)... "));
  selfTest();
  Serial.println(F("OK"));

  Serial.println(F("=================================================="));
  Serial.println(F("      KATANA SMART CANE - SYSTEM ONLINE           "));
  Serial.println(F("  Ketik HELP di Serial Monitor untuk Mode Demo    "));
  Serial.println(F("=================================================="));
}

void loop() {
  updateInputs();
  activeState = decideState();
  updateOutputs(activeState);

  unsigned long now = millis();
  if (now - lastReportMs >= 400) {
    lastReportMs = now;

    if (demoMode) {
      // Telemetri Khusus Mode Simulasi / Override Serial
      Serial.print(F("[SIMULASI] "));
      Serial.print(F("Depan:SIM("));
      Serial.print(frontCm, 0);
      Serial.print(F("cm) "));

      Serial.print(F("| Bawah:SIM("));
      Serial.print(downCm, 0);
      Serial.print(F("cm) "));

      Serial.print(F("| IMU:SIM("));
      Serial.print(tiltDeg, 1);
      Serial.print(F("°) "));

      Serial.print(F("| Air:SIM("));
      Serial.print(waterValue);
      Serial.print(F(")"));
    } else {
      // Telemetri Hardware Fisik Riil
      Serial.print(F("[KONEKSI] "));
      
      // Sensor Depan
      Serial.print(F("Depan:"));
      if (frontConnected) {
        Serial.print(F("RIIL("));
        Serial.print(frontCm, 0);
        Serial.print(F("cm) "));
      } else {
        Serial.print(F("LEPAS "));
      }

      // Sensor Bawah
      Serial.print(F("| Bawah:"));
      if (downConnected) {
        Serial.print(F("RIIL("));
        Serial.print(downCm, 0);
        Serial.print(F("cm) "));
      } else {
        Serial.print(F("LEPAS "));
      }

      // MPU6050
      Serial.print(F("| IMU:"));
      if (mpuConnected) {
        Serial.print(F("RIIL("));
        Serial.print(tiltDeg, 1);
        Serial.print(F("°) "));
      } else {
        Serial.print(F("LEPAS "));
      }

      // Sensor Air
      Serial.print(F("| Air:"));
      if (waterConnected) {
        Serial.print(F("RIIL("));
        Serial.print(waterValue);
        Serial.print(waterValue > WATER_LIMIT ? F(")[BASAH] ") : F(")[KERING] "));
      } else {
        Serial.print(F("LEPAS "));
      }
    }

    // Status Keputusan & Aktuator Fisik
    Serial.print(F(" || STATE: "));
    Serial.print(stateName(activeState));
    Serial.print(F(" | Motor: "));
    Serial.print(vibrationOn ? F("ON") : F("OFF"));
    Serial.print(F(" | Buzzer: "));
    if (activeState == FALL_ALERT) {
      Serial.println(F("SOS"));
    } else if (activeState == OBJECT_NEAR) {
      Serial.println(F("BEEP"));
    } else {
      Serial.println(F("DIAM"));
    }
  }
  delay(20);
}
