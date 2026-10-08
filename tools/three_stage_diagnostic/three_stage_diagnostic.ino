/*
  ==============================================================
         KATANA ULTIMATE 3-STAGE HARDWARE DIAGNOSTIC SUITE
  ==============================================================
  Program terpadu untuk pengujian bertahap tanpa perlu ganti-ganti sketch:
  
  TAHAP 1: DIAGNOSA PIN FISIK
           - Memeriksa kesehatan logika internal pin CMOS D2-D12 & ADC A0-A7.
           - Mode sentuh kabel GND interaktif.
  
  TAHAP 2: UJI AKTUATOR (BUZZER D6 & MOTOR VIBRATOR D5)
           - Siklus getar motor D5 dan bunyi bip buzzer D6 secara otomatis/bergantian.
           - Pengujian haptic feedback & audio verification.
  
  TAHAP 3: UJI SENSOR & AKTUATOR MANDIRI (PER KOMPONEN)
           - Mengetes sensor satu per satu saat dicolokkan ke pin.
           - Mendukung perintah serial interaktif (Ketik: DEPAN, BAWAH, IMU, AIR, MOTOR, BUZZER, DUAL).
*/

#include <Arduino.h>
#include <Wire.h>

// Definisi Pin Sesuai Blueprint Terbaru
const byte PIN_BUZZER    = 6;   // Buzzer Aktif D6
const byte PIN_MOTOR     = 5;   // Motor Getar D5
const byte PIN_FRONT_TRIG = 3;  // HC-SR04 Depan Trig D3
const byte PIN_FRONT_ECHO = 2;  // HC-SR04 Depan Echo D2
const byte PIN_DOWN_TRIG  = 9;  // HC-SR04 Bawah Trig D9
const byte PIN_DOWN_ECHO  = 8;  // HC-SR04 Bawah Echo D8
const byte PIN_WATER      = A0; // Sensor Air Analog A0

// Daftar pin digital yang dipindai di Tahap 1
const byte DIGITAL_PINS[] = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12};
const byte NUM_DIGITAL = sizeof(DIGITAL_PINS) / sizeof(DIGITAL_PINS[0]);

enum DiagnosticStage {
  STAGE_1_PIN_CHECK,
  STAGE_2_ACTUATOR_TEST,
  STAGE_3_COMPONENT_TEST,
  STAGE_4_KATANA_LIVE
};

#define STAGE_2_BUZZER_TEST STAGE_2_ACTUATOR_TEST

DiagnosticStage currentStage = STAGE_1_PIN_CHECK;
bool lastDigitalState[14] = {false};
unsigned long actuatorTimer = 0;
byte actuatorStep = 255;
byte actuatorCount = 0;
byte actuatorCycleCount = 0;

// Variabel untuk Stage 4: Katana Live Simulation
float stage4DownBaseline = 35.0;
unsigned long stage4LastCycle = 0;
bool stage4FrontConn = false;
bool stage4DownConn = false;
bool stage4MpuConn = false;
bool stage4WaterConn = false;

void printMenu() {
  Serial.println(F("\n========================================================"));
  Serial.println(F("    KATANA 4-STAGE HARDWARE DIAGNOSTIC SUITE            "));
  Serial.println(F("========================================================"));
  Serial.println(F("Perintah Navigasi Tahap:"));
  Serial.println(F("  1  atau PIN      -> TAHAP 1: Cek Kesehatan Semua Pin"));
  Serial.println(F("  2  atau AKTUATOR -> TAHAP 2: Siklus Uji Aktuator (Buzzer D6 & Motor D5)"));
  Serial.println(F("  3  atau SENSOR   -> TAHAP 3: Cek Sensor & Aktuator Mandiri"));
  Serial.println(F("  4  atau KATANA   -> TAHAP 4: Simulasi Live Katana (Deteksi Rintangan & Turunan)"));
  Serial.println(F("--------------------------------------------------------"));
  Serial.println(F("Perintah Uji Aktuator Cepat:"));
  Serial.println(F("  BUZZER           -> Uji coba suara Buzzer D6 (3x beep)"));
  Serial.println(F("  MOTOR            -> Uji coba getar Motor D5 (1.5 detik)"));
  Serial.println(F("  DUAL             -> Uji Buzzer + Motor getar bersamaan"));
  Serial.println(F("  MOTOR ON / OFF   -> Nyalakan / matikan getar kontinu"));
  Serial.println(F("  BUZZER ON / OFF  -> Nyalakan / matikan buzzer kontinu"));
  Serial.println(F("  STOP             -> Matikan semua getaran, suara, & stream"));
  Serial.println(F("========================================================\n"));
}

// =================== TAHAP 1: CEK PIN ===================
void runStage1PinCheck() {
  currentStage = STAGE_1_PIN_CHECK;
  Serial.println(F("\n>>> [TAHAP 1] PEMERIKSAAN KESEHATAN PIN MIKROKONTROLER <<<"));
  Serial.println(F("Scanning otomatis register internal CMOS..."));
  
  byte healthy = 0;
  for (byte i = 0; i < NUM_DIGITAL; i++) {
    byte pin = DIGITAL_PINS[i];
    pinMode(pin, INPUT_PULLUP);
    delayMicroseconds(50);
    int state = digitalRead(pin);

    Serial.print(F(" Pin D"));
    if (pin < 10) Serial.print(F("0"));
    Serial.print(pin);
    Serial.print(F(" : "));

    if (state == HIGH) {
      Serial.println(F("[NORMAL - SEHAT]"));
      healthy++;
    } else {
      Serial.println(F("[PERHATIAN - LOW] Terbaca 0V (Mungkin korslet ke GND / ada beban)"));
    }
  }

  Serial.println(F("\nScanning Pin Analog ADC (A0 - A7):"));
  for (byte i = 0; i < 8; i++) {
    int val = analogRead(i);
    Serial.print(F(" Pin A")); Serial.print(i);
    Serial.print(F(" : ADC=")); Serial.print(val);
    Serial.print(F(" (~")); Serial.print((val * 5.0) / 1023.0, 2); Serial.print(F("V) "));
    if (val > 1000) Serial.println(F("[5V Rail]"));
    else if (val < 20) Serial.println(F("[GND / 0V]"));
    else Serial.println(F("[Floating / Siap Sensor]"));
  }

  Serial.println(F("\n[PETUNJUK UJI KABEL JUMPER TAHAP 1]:"));
  Serial.println(F("Tancapkan 1 kabel jumper ke GND, lalu sentuh ujungnya ke pin:"));
  Serial.println(F("D2, D3, D5, D6, D8, D9, D10, D11, atau A0."));
  Serial.println(F("Sistem akan langsung mendeteksi sentuhan pin secara LIVE!"));
  Serial.println(F("Ketik '2' lalu Enter untuk lanjut ke TAHAP 2 (Tes Aktuator Buzzer & Motor).\n"));
}

// =================== TAHAP 2: TES AKTUATOR (BUZZER & MOTOR) ===================
void runStage2Actuator() {
  currentStage = STAGE_2_ACTUATOR_TEST;
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_MOTOR, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
  analogWrite(PIN_MOTOR, 0);

  actuatorCount = 0;
  actuatorTimer = millis();
  actuatorStep = 255;

  Serial.println(F("\n========================================================"));
  Serial.println(F(">>> TAHAP 2: UJI AKTUATOR (BUZZER D6 & MOTOR GETAR D5) <<<"));
  Serial.println(F("========================================================"));
  Serial.println(F("Koneksi Fisik:"));
  Serial.println(F("  1. Buzzer       : Kaki (+) ke Pin D6, Kaki (-) ke GND"));
  Serial.println(F("  2. Motor Getar  : IN ke Pin D5 (PWM), VCC ke 5V, GND ke GND"));
  Serial.println(F("\nSiklus otomatis bergantian berulang setiap 3.6 detik:"));
  Serial.println(F("  - Fasa 1: Buzzer Beep di D6"));
  Serial.println(F("  - Fasa 2: Motor Getar di D5 (PWM 220)"));
  Serial.println(F("  - Fasa 3: Buzzer & Motor aktif bersamaan"));
  Serial.println(F("--------------------------------------------------------"));
  Serial.println(F("Perintah: Ketik 'BUZZER', 'MOTOR', 'DUAL', 'STOP', atau '3' (Tahap 3).\n"));
}

void runStage2Buzzer() {
  runStage2Actuator();
}

// =================== TAHAP 3: BACA SENSOR PER KOMPONEN ===================
float measureUltrasonic(byte trigPin, byte echoPin) {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  
  digitalWrite(trigPin, LOW);
  delayMicroseconds(4);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout (~5m)
  if (duration == 0) return -1.0;
  return (duration * 0.0343) / 2.0;
}

void testFrontSensor() {
  Serial.print(F("[UJI 1: SENSOR DEPAN D2/D3] "));
  float dist = measureUltrasonic(PIN_FRONT_TRIG, PIN_FRONT_ECHO);
  if (dist >= 0) {
    Serial.print(F("TERHUBUNG! Jarak Terbaca: "));
    Serial.print(dist, 1);
    Serial.println(F(" cm"));
  } else {
    // Coba deteksi jika pin tertukar
    float inv = measureUltrasonic(PIN_FRONT_ECHO, PIN_FRONT_TRIG);
    if (inv >= 0) {
      Serial.print(F("TERHUBUNG TAPI TERBALIK! (Echo di D3, Trig di D2). Jarak: "));
      Serial.print(inv, 1);
      Serial.println(F(" cm. -> Silakan tukar kabel D2 dan D3!"));
    } else {
      Serial.println(F("LEPAS / KABEL TIDAK MERESPONS. Cek VCC(5V), GND, D2, D3."));
    }
  }
}

void testDownSensor() {
  Serial.print(F("[UJI 2: SENSOR BAWAH D8/D9] "));
  float dist = measureUltrasonic(PIN_DOWN_TRIG, PIN_DOWN_ECHO);
  if (dist >= 0) {
    Serial.print(F("TERHUBUNG! Jarak Terbaca: "));
    Serial.print(dist, 1);
    Serial.println(F(" cm"));
  } else {
    float inv = measureUltrasonic(PIN_DOWN_ECHO, PIN_DOWN_TRIG);
    if (inv >= 0) {
      Serial.print(F("TERHUBUNG TAPI TERBALIK! (Echo di D9, Trig di D8). Jarak: "));
      Serial.print(inv, 1);
      Serial.println(F(" cm. -> Silakan tukar kabel D8 dan D9!"));
    } else {
      Serial.println(F("LEPAS / KABEL TIDAK MERESPONS. Cek VCC(5V), GND, D8, D9."));
    }
  }
}

void testIMUSensor() {
  Serial.print(F("[UJI 3: SENSOR IMU MPU6050 A4/A5] "));
  
  // 1. Matikan TWI Hardware terlebih dahulu agar kita bisa cek kondisi elektrik pin A4/A5
  TWCR &= ~(_BV(TWEN));
  pinMode(A4, INPUT);
  pinMode(A5, INPUT);
  delayMicroseconds(10);

  int vSDA = analogRead(A4);
  int vSCL = analogRead(A5);

  // 2. I2C Bus Recovery: Clock 9 siklus di pin A5 (SCL) untuk membebaskan chip MPU jika sedang lockup (menahan SDA LOW)
  pinMode(A5, OUTPUT);
  pinMode(A4, INPUT_PULLUP);
  for (byte k = 0; k < 9; k++) {
    digitalWrite(A5, LOW);
    delayMicroseconds(5);
    digitalWrite(A5, HIGH);
    delayMicroseconds(5);
  }
  // Generate STOP condition
  pinMode(A4, OUTPUT);
  digitalWrite(A4, LOW);
  delayMicroseconds(5);
  digitalWrite(A5, HIGH);
  delayMicroseconds(5);
  digitalWrite(A4, HIGH);
  delayMicroseconds(5);

  // 3. Mulai Wire kembali
  Wire.begin();
  #if defined(WIRE_HAS_TIMEOUT)
    Wire.setWireTimeout(3000, true);
  #endif

  byte error, address;
  byte foundAddress = 0;

  // Cek alamat standar 0x68 terlebih dahulu
  Wire.beginTransmission(0x68);
  if (Wire.endTransmission() == 0) {
    foundAddress = 0x68;
  } else {
    // Cek alternatif 0x69 (AD0 High)
    Wire.beginTransmission(0x69);
    if (Wire.endTransmission() == 0) {
      foundAddress = 0x69;
    } else {
      // Pindai alamat 1..126
      for (address = 1; address < 127; address++) {
        Wire.beginTransmission(address);
        error = Wire.endTransmission();
        if (error == 0) {
          foundAddress = address;
          break;
        }
      }
    }
  }

  if (foundAddress != 0) {
    Serial.print(F("TERHUBUNG di 0x"));
    Serial.print(foundAddress, HEX);
    
    // Inisialisasi wake up MPU6050
    Wire.beginTransmission(foundAddress);
    Wire.write(0x6B); // Power Management 1
    Wire.write(0);    // Wake up
    Wire.endTransmission();
    delay(10);

    // Baca data mentah akselerometer (Register 0x3B - 0x40)
    Wire.beginTransmission(foundAddress);
    Wire.write(0x3B);
    Wire.endTransmission(false);
    Wire.requestFrom((int)foundAddress, 6, true);

    if (Wire.available() >= 6) {
      int16_t rawX = (Wire.read() << 8) | Wire.read();
      int16_t rawY = (Wire.read() << 8) | Wire.read();
      int16_t rawZ = (Wire.read() << 8) | Wire.read();

      float ax = rawX / 16384.0;
      float ay = rawY / 16384.0;
      float az = rawZ / 16384.0;

      // Hitung sudut kemiringan (tilt) terhadap posisi tegak normal tongkat (acuan ~45° vertikal Y/Z)
      float mag = sqrt(ax*ax + ay*ay + az*az);
      float tiltNormal = 0.0;
      float tiltRawZ = 0.0;
      if (mag > 0.05) {
        float nx = ax / mag;
        float ny = ay / mag;
        float nz = az / mag;
        // Acuan posisi tegak normal tongkat kataba (pemasangan vertikal pcb ~45° Y & Z)
        float dot = constrain((ny * 0.7071) + (nz * 0.7071), -1.0, 1.0);
        tiltNormal = acos(dot) * 180.0 / 3.14159;

        float r = fabs(az) / mag;
        if (r > 1.0) r = 1.0;
        tiltRawZ = acos(r) * 180.0 / 3.14159;
      }

      Serial.print(F(" | DATA: X=")); Serial.print(ax, 2);
      Serial.print(F("g, Y=")); Serial.print(ay, 2);
      Serial.print(F("g, Z=")); Serial.print(az, 2);
      Serial.print(F("g | Kemiringan Tegak: ")); Serial.print(tiltNormal, 1);
      Serial.print(F("° (Raw Z: ")); Serial.print(tiltRawZ, 1);
      Serial.println(F("°)"));
    } else {
      Serial.println(F(" | Gagal meminta data register!"));
    }
  } else {
    Serial.print(F("LEPAS! (SDA/A4="));
    Serial.print((vSDA * 5.0) / 1023.0, 1);
    Serial.print(F("V, SCL/A5="));
    Serial.print((vSCL * 5.0) / 1023.0, 1);
    Serial.println(F("V)."));
    Serial.println(F("   -> CATATAN: Pastikan VCC=5V, GND=GND, SDA=A4, SCL=A5, dan PIN MODUL SUDAH DISOLDER TIMAH."));
  }
}

void testWaterSensor() {
  // Matikan pull-up jika ada sisa mode digital pada A0
  pinMode(PIN_WATER, INPUT);
  delayMicroseconds(20);

  int raw = analogRead(PIN_WATER);
  float volt = (raw * 5.0) / 1023.0;
  Serial.print(F("[UJI 4: SENSOR AIR A0] DATA DITERIMA: ADC = "));
  Serial.print(raw);
  Serial.print(F(" (Tegangan: "));
  Serial.print(volt, 2);
  Serial.print(F("V) -> Status: "));
  
  if (raw >= 1020) {
    Serial.println(F("[ADC MAKSIMUM 1023] (Tegangan penuh 5.0V)."));
    Serial.println(F("   -> CATATAN DIAGNOSTIK:"));
    Serial.println(F("      1. Jika memakai sensor PCB pasif: Pin sinyal A0 mengambang (floating) / tersambung 5V."));
    Serial.println(F("      2. Jika memakai modul LM393 (dengan potensiometer): Modul ini bertipe Active-LOW"));
    Serial.println(F("         (1023 = KERING, saat dicelup air nilai akan drop ke bawah). Coba celupkan air!"));
  } else if (raw > 650) {
    Serial.println(F("[BASAH / TERKENA AIR] (Waspada Genangan!)"));
  } else if (raw > 100) {
    Serial.println(F("[KERING / UDARA NORMAL] (Siap Pakai)"));
  } else {
    Serial.println(F("[TERPUTUS / 0V GND] (Kering atau kabel lepas)"));
  }
}

void testMotorActuator() {
  Serial.println(F("[UJI 5: MOTOR GETAR D5] Menyalakan motor getar 1.5 detik (PWM 220)..."));
  pinMode(PIN_MOTOR, OUTPUT);
  analogWrite(PIN_MOTOR, 220);
  delay(1500);
  analogWrite(PIN_MOTOR, 0);
  Serial.println(F("[UJI 5: MOTOR GETAR D5] Selesai. Apakah Anda merasakan getaran di tangan?"));
}

void testBuzzerActuator() {
  Serial.println(F("[UJI 6: BUZZER D6] Membunyikan buzzer pola 3x beep lembut (Pin D6 PWM 35)..."));
  pinMode(PIN_BUZZER, OUTPUT);
  for (byte b = 0; b < 3; b++) {
    analogWrite(PIN_BUZZER, 35);
    delay(180);
    analogWrite(PIN_BUZZER, 0);
    delay(120);
  }
  Serial.println(F("[UJI 6: BUZZER D6] Selesai. Apakah Anda mendengar suara beep lembut dari buzzer?"));
}

void testDualActuators() {
  Serial.println(F("[UJI 7: DUAL AKTUATOR] Menyalakan Motor Getar (D5) dan Buzzer (D6) bersamaan 1.5 detik..."));
  pinMode(PIN_MOTOR, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  analogWrite(PIN_MOTOR, 220);
  digitalWrite(PIN_BUZZER, HIGH);
  delay(1500);
  analogWrite(PIN_MOTOR, 0);
  digitalWrite(PIN_BUZZER, LOW);
  Serial.println(F("[UJI 7: DUAL AKTUATOR] Selesai. Keduanya aktif bersamaan!"));
}

// Mode Stream Data Realtime
bool liveStreamActive = false;
String liveStreamTarget = "ALL";
unsigned long lastStreamMs = 0;

void printStreamHeader() {
  Serial.println(F("\n>>> MODE STREAM DATA LIVE AKTIF <<<"));
  Serial.println(F("Data yang diterima sensor akan ditampilkan terus-menerus setiap 450ms."));
  Serial.println(F("Coba goyangkan/halangi sensor dengan tangan Anda untuk melihat perubahan nilai!"));
  Serial.println(F("Ketik 'STOP' untuk menghentikan stream data.\n"));
}

void runStage3ComponentTest() {
  currentStage = STAGE_3_COMPONENT_TEST;
  Serial.println(F("\n================================================================"));
  Serial.println(F(">>>       TAHAP 3: PEMERIKSAAN NILAI SENSOR & AKTUATOR       <<<"));
  Serial.println(F("================================================================"));
  testFrontSensor();
  testDownSensor();
  testIMUSensor();
  testWaterSensor();
  testMotorActuator();
  testBuzzerActuator();
  Serial.println(F("----------------------------------------------------------------"));
  Serial.println(F("Perintah Uji Aktuator Langsung:"));
  Serial.println(F("  MOTOR         -> Getarkan motor getar (Pin D5)"));
  Serial.println(F("  BUZZER        -> Bunyikan buzzer (Pin D6)"));
  Serial.println(F("  DUAL          -> Uji motor dan buzzer bersamaan"));
  Serial.println(F("  MOTOR ON/OFF  -> Nyalakan / matikan motor terus-menerus"));
  Serial.println(F("  BUZZER ON/OFF -> Nyalakan / matikan buzzer terus-menerus"));
  Serial.println(F("Perintah Live Stream Sensor:"));
  Serial.println(F("  STREAM        -> Tampilkan data live stream terus-menerus"));
  Serial.println(F("  STREAM DEPAN  -> Live stream sensor depan saja"));
  Serial.println(F("  STREAM BAWAH  -> Live stream sensor bawah saja"));
  Serial.println(F("  STREAM IMU    -> Live stream sudut MPU6050 saja"));
  Serial.println(F("  STREAM AIR    -> Live stream voltase air saja"));
  Serial.println(F("  STOP          -> Hentikan stream dan matikan semua aktuator\n"));
}

// =================== TAHAP 4: SIMULASI LIVE KATANA ===================
void runStage4KatanaLive() {
  currentStage = STAGE_4_KATANA_LIVE;
  liveStreamActive = false;
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_MOTOR, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
  analogWrite(PIN_MOTOR, 0);

  Serial.println(F("\n================================================================"));
  Serial.println(F(">>>   TAHAP 4: SIMULASI SISTEM KATANA (NAVIGASI TUNANETRA)   <<<"));
  Serial.println(F("================================================================"));
  Serial.println(F("Logika Katana dijalankan langsung dengan sensor fisik yang ada:"));
  Serial.println(F("  1. RINTANGAN DEPAN (HC-SR04 D2/D3):"));
  Serial.println(F("     - Jarak < 40 cm : BAHAYA DEKAT! (Buzzer cepat + Getar Kuat)"));
  Serial.println(F("     - Jarak < 90 cm : PERINGATAN! (Buzzer sedang + Getar Sedang)"));
  Serial.println(F("     - Jarak < 150 cm: WASPADA JAUH (Buzzer lambat + Getar Halus)"));
  Serial.println(F("  2. DETEKSI TURUNAN/LUBANG (HC-SR04 D8/D9):"));
  Serial.println(F("     - Jika jarak ke lantai bertambah drastis (>15cm dari baseline) -> ALARM TURUNAN!"));
  Serial.println(F("  3. SENSOR IMU & AIR:"));
  Serial.println(F("     - Otomatis dilewati jika belum terpasang (sistem tetap 100% jalan)."));
  Serial.println(F("----------------------------------------------------------------"));
  Serial.print(F("Mengkalibrasi jarak lantai sensor bawah... "));
  
  // Kalibrasi baseline lantai cepat (5 sampel)
  float total = 0.0;
  byte valid = 0;
  for (byte i = 0; i < 5; i++) {
    float d = measureUltrasonic(PIN_DOWN_TRIG, PIN_DOWN_ECHO);
    if (d > 5.0 && d < 150.0) {
      total += d;
      valid++;
    }
    delay(40);
  }
  if (valid >= 3) {
    stage4DownBaseline = total / valid;
    Serial.print(F("OK (Baseline Lantai: "));
    Serial.print(stage4DownBaseline, 1);
    Serial.println(F(" cm)"));
  } else {
    stage4DownBaseline = 35.0; // Nilai default wajar jika sensor bawah belum dicolok
    Serial.println(F("Belum terhubung. Menggunakan default 35.0 cm."));
  }

  Serial.println(F("\n>>> SIMULASI AKTIF! Dekatkan tangan ke sensor depan untuk mencoba feedback."));
  Serial.println(F("Ketik 'STOP', '1', '2', atau '3' untuk keluar dari simulasi.\n"));
  stage4LastCycle = millis();
}

void processCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  if (cmd.length() == 0) return;

  if (cmd == "1" || cmd == "PIN") {
    liveStreamActive = false;
    digitalWrite(PIN_BUZZER, LOW);
    analogWrite(PIN_MOTOR, 0);
    runStage1PinCheck();
  } else if (cmd == "2" || cmd == "AKTUATOR" || cmd == "ACTUATOR") {
    liveStreamActive = false;
    runStage2Actuator();
  } else if (cmd == "3" || cmd == "SENSOR" || cmd == "TAHAP3" || cmd == "ALL") {
    liveStreamActive = false;
    digitalWrite(PIN_BUZZER, LOW);
    analogWrite(PIN_MOTOR, 0);
    runStage3ComponentTest();
  } else if (cmd == "4" || cmd == "KATANA" || cmd == "SIM" || cmd == "LIVE") {
    runStage4KatanaLive();
  } else if (cmd == "DEPAN") {
    liveStreamActive = false;
    testFrontSensor();
  } else if (cmd == "BAWAH") {
    liveStreamActive = false;
    testDownSensor();
  } else if (cmd == "IMU" || cmd == "MPU") {
    liveStreamActive = false;
    testIMUSensor();
  } else if (cmd == "AIR" || cmd == "WATER") {
    liveStreamActive = false;
    testWaterSensor();
  } else if (cmd == "MOTOR" || cmd == "VIBE" || cmd == "GETAR") {
    liveStreamActive = false;
    testMotorActuator();
  } else if (cmd == "BUZZER" || cmd == "BEEP" || cmd == "BUNYI") {
    liveStreamActive = false;
    testBuzzerActuator();
  } else if (cmd == "DUAL" || cmd == "KEDUA" || cmd == "OUTPUT") {
    liveStreamActive = false;
    testDualActuators();
  } else if (cmd == "MOTOR ON" || cmd == "MOTOR:ON") {
    liveStreamActive = false;
    pinMode(PIN_MOTOR, OUTPUT);
    analogWrite(PIN_MOTOR, 220);
    Serial.println(F("[MANUAL] Motor Getar D5 DINYALAKAN (Ketik MOTOR OFF untuk mematikan)."));
  } else if (cmd == "MOTOR OFF" || cmd == "MOTOR:OFF") {
    analogWrite(PIN_MOTOR, 0);
    Serial.println(F("[MANUAL] Motor Getar D5 DIMATIKAN."));
  } else if (cmd == "BUZZER ON" || cmd == "BUZZER:ON") {
    liveStreamActive = false;
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, HIGH);
    Serial.println(F("[MANUAL] Buzzer D6 DINYALAKAN (Ketik BUZZER OFF untuk mematikan)."));
  } else if (cmd == "BUZZER OFF" || cmd == "BUZZER:OFF") {
    digitalWrite(PIN_BUZZER, LOW);
    Serial.println(F("[MANUAL] Buzzer D6 DIMATIKAN."));
  } else if (cmd.startsWith("STREAM")) {
    currentStage = STAGE_3_COMPONENT_TEST;
    liveStreamActive = true;
    if (cmd == "STREAM DEPAN") liveStreamTarget = "DEPAN";
    else if (cmd == "STREAM BAWAH") liveStreamTarget = "BAWAH";
    else if (cmd == "STREAM IMU") liveStreamTarget = "IMU";
    else if (cmd == "STREAM AIR") liveStreamTarget = "AIR";
    else liveStreamTarget = "ALL";
    printStreamHeader();
  } else if (cmd == "STOP" || cmd == "OFF" || cmd == "DIAM") {
    liveStreamActive = false;
    currentStage = STAGE_1_PIN_CHECK;
    digitalWrite(PIN_BUZZER, LOW);
    analogWrite(PIN_MOTOR, 0);
    Serial.println(F("[STOP] Semua aktivitas, simulasi katana, stream, dan aktuator dimatikan."));
  } else if (cmd == "MENU" || cmd == "HELP" || cmd == "?") {
    printMenu();
  } else {
    Serial.println(F("Perintah tidak dikenal. Ketik '1', '2', '3', '4', 'MOTOR', 'BUZZER', 'DUAL', 'DEPAN', 'BAWAH', 'IMU', 'AIR'."));
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);
  printMenu();
  runStage1PinCheck(); // Otomatis mulai dari Tahap 1
}

unsigned long lastPinScan = 0;

void loop() {
  // 1. Terima Perintah Serial Monitor
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    processCommand(cmd);
  }

  // 2. Logika Tahap 1: Live Pin Touching Detector (Interaktif dengan kabel GND)
  if (currentStage == STAGE_1_PIN_CHECK) {
    if (millis() - lastPinScan >= 100) {
      lastPinScan = millis();
      for (byte i = 0; i < NUM_DIGITAL; i++) {
        byte pin = DIGITAL_PINS[i];
        pinMode(pin, INPUT_PULLUP);
        int val = digitalRead(pin);

        if (val == LOW && !lastDigitalState[pin]) {
          lastDigitalState[pin] = true;
          Serial.print(F(">>> [PIN D"));
          if (pin < 10) Serial.print(F("0"));
          Serial.print(pin);
          Serial.println(F(" DISENTUH GND] -> Gerbang Pin SEHAT & BERFUNGSI 100%!"));
        } else if (val == HIGH && lastDigitalState[pin]) {
          lastDigitalState[pin] = false;
        }
      }

      // Deteksi sentuhan pin Analog A0 - A5 menggunakan register digital + pull-up agar kebal derau statis
      static bool lastAnalogTouch[6] = {false};
      for (byte a = 0; a < 6; a++) {
        byte pinNum = A0 + a;
        pinMode(pinNum, INPUT_PULLUP);
        delayMicroseconds(20);
        int valA = digitalRead(pinNum);

        if (valA == LOW && !lastAnalogTouch[a]) {
          lastAnalogTouch[a] = true;
          int adcVal = analogRead(pinNum);
          Serial.print(F(">>> [PIN A"));
          Serial.print(a);
          Serial.print(F(" DISENTUH GND] -> Terbaca 0V / ADC: "));
          Serial.print(adcVal);
          Serial.println(F(" (Pin SEHAT & BERFUNGSI 100%)!"));
        } else if (valA == HIGH && lastAnalogTouch[a]) {
          lastAnalogTouch[a] = false;
          Serial.print(F("    [PIN A"));
          Serial.print(a);
          Serial.println(F(" DILEPAS DARI GND]"));
        }
      }
    }
  }

  // 3. Logika Tahap 2: Siklus Uji Aktuator (Buzzer D6 & Motor Getar D5)
  else if (currentStage == STAGE_2_ACTUATOR_TEST) {
    unsigned long elapsed = millis() - actuatorTimer;

    // Setiap siklus penuh berdurasi 3600ms (3.6 detik):
    // 0 - 1200ms : Fasa 1 -> Buzzer BEEP di D6
    // 1200 - 2400ms: Fasa 2 -> Motor GETAR di D5 (PWM 220)
    // 2400 - 3600ms: Fasa 3 -> BERSAMAAN (D6 + D5)

    if (elapsed < 1200) {
      if (actuatorStep != 0) {
        actuatorStep = 0;
        actuatorCycleCount++;
        analogWrite(PIN_MOTOR, 0);
        Serial.print(F(">>> [SIKLUS #"));
        Serial.print(actuatorCycleCount);
        Serial.println(F("] [FASA 1: BUZZER D6] Bunyi BEEP aktif di Pin D6..."));
      }
      bool beep = ((elapsed / 180) % 2 == 0);
      digitalWrite(PIN_BUZZER, beep ? HIGH : LOW);
      analogWrite(PIN_MOTOR, 0);
    } 
    else if (elapsed < 2400) {
      if (actuatorStep != 1) {
        actuatorStep = 1;
        digitalWrite(PIN_BUZZER, LOW);
        Serial.print(F(">>> [SIKLUS #"));
        Serial.print(actuatorCycleCount);
        Serial.println(F("] [FASA 2: MOTOR GETAR D5] Denyut GETAR aktif di Pin D5 (PWM 220)..."));
      }
      digitalWrite(PIN_BUZZER, LOW);
      bool vibe = (((elapsed - 1200) / 200) % 2 == 0);
      analogWrite(PIN_MOTOR, vibe ? 220 : 0);
    } 
    else if (elapsed < 3600) {
      if (actuatorStep != 2) {
        actuatorStep = 2;
        Serial.print(F(">>> [SIKLUS #"));
        Serial.print(actuatorCycleCount);
        Serial.println(F("] [FASA 3: DUAL] BUZZER D6 & MOTOR D5 AKTIF BERSAMAAN!"));
      }
      digitalWrite(PIN_BUZZER, HIGH);
      analogWrite(PIN_MOTOR, 220);
    } 
    else {
      digitalWrite(PIN_BUZZER, LOW);
      analogWrite(PIN_MOTOR, 0);
      actuatorTimer = millis();
      actuatorStep = 255;
    }
  }

  // 4. Logika Tahap 3: Live Stream Data Sensor Real-Time
  else if (currentStage == STAGE_3_COMPONENT_TEST && liveStreamActive) {
    if (millis() - lastStreamMs >= 450) {
      lastStreamMs = millis();

      if (liveStreamTarget == "DEPAN") {
        testFrontSensor();
      } else if (liveStreamTarget == "BAWAH") {
        testDownSensor();
      } else if (liveStreamTarget == "IMU") {
        testIMUSensor();
      } else if (liveStreamTarget == "AIR") {
        testWaterSensor();
      } else {
        // Mode STREAM ALL: Cetak baris ringkas terpadu yang mudah dibaca
        Serial.print(F("[STREAM] "));

        // Sensor Depan D2/D3
        float dFront = measureUltrasonic(PIN_FRONT_TRIG, PIN_FRONT_ECHO);
        Serial.print(F("Depan: "));
        if (dFront >= 0) {
          Serial.print(dFront, 1); Serial.print(F("cm | "));
        } else {
          Serial.print(F("LEPAS | "));
        }

        // Sensor Bawah D8/D9
        float dDown = measureUltrasonic(PIN_DOWN_TRIG, PIN_DOWN_ECHO);
        Serial.print(F("Bawah: "));
        if (dDown >= 0) {
          Serial.print(dDown, 1); Serial.print(F("cm | "));
        } else {
          Serial.print(F("LEPAS | "));
        }

        // Sensor Air A0
        int w = analogRead(PIN_WATER);
        Serial.print(F("Air: "));
        Serial.print(w);
        Serial.print(F(" ADC ("));
        Serial.print((w * 5.0) / 1023.0, 2);
        Serial.print(F("V) "));
        if (w > 650) Serial.print(F("[BASAH]"));
        else Serial.print(F("[KERING]"));

        Serial.println();
      }
    }
  }

  // 5. Logika Tahap 4: Simulasi Sistem Katana Penuh (Non-blocking Haptic & Audio Feedback)
  else if (currentStage == STAGE_4_KATANA_LIVE) {
    if (millis() - stage4LastCycle >= 120) {
      stage4LastCycle = millis();

      // 1. Baca Jarak Depan
      float dFront = measureUltrasonic(PIN_FRONT_TRIG, PIN_FRONT_ECHO);
      bool frontConn = (dFront >= 0);

      // 2. Baca Jarak Bawah
      float dDown = measureUltrasonic(PIN_DOWN_TRIG, PIN_DOWN_ECHO);
      bool downConn = (dDown >= 0);
      float dropDelta = (downConn && dDown > stage4DownBaseline) ? (dDown - stage4DownBaseline) : 0;

      // Evaluasi Umpan Balik:
      // Prioritas 1: Bahaya Turunan / Lubang (> 15cm lebih dalam dari lantai)
      if (downConn && dropDelta > 15.0) {
        // Hentakan agresif maksimal: PWM 255 (3 denyut cepat)
        unsigned long p = millis() % 950UL;
        bool v = (p < 160) || (p >= 210 && p < 370) || (p >= 420 && p < 580);
        analogWrite(PIN_MOTOR, v ? 255 : 0);
        bool b = ((millis() / 150) % 2 == 0);
        digitalWrite(PIN_BUZZER, b ? HIGH : LOW);
        Serial.print(F("[KATANA LIVE] !!! WASPADA LUBANG / TURUNAN !!! Delta: +"));
        Serial.print(dropDelta, 1);
        Serial.println(F(" cm (Motor PWM 255 Triple Pulse)"));
      }
      // Prioritas 2: Rintangan Depan Dekat (< 40cm)
      else if (frontConn && dFront < 40.0) {
        analogWrite(PIN_MOTOR, 255); // Tenaga Maksimal 100% Kontinu
        bool b = ((millis() / 100) % 2 == 0);
        digitalWrite(PIN_BUZZER, b ? HIGH : LOW);
        Serial.print(F("[KATANA LIVE] BAHAYA DEKAT! Rintangan: "));
        Serial.print(dFront, 1);
        Serial.println(F(" cm (Motor MAKSIMAL 255 Kontinu + Beep Cepat)"));
      }
      // Prioritas 3: Rintangan Sedang (40cm - 90cm)
      else if (frontConn && dFront < 90.0) {
        bool v = ((millis() % 300UL) < 190UL);
        analogWrite(PIN_MOTOR, v ? 255 : 0); // Tenaga Maksimal PWM 255 (Denyut Cepat)
        bool b = ((millis() / 250) % 2 == 0);
        digitalWrite(PIN_BUZZER, b ? HIGH : LOW);
        Serial.print(F("[KATANA LIVE] PERINGATAN! Rintangan: "));
        Serial.print(dFront, 1);
        Serial.println(F(" cm (Getar Penuh 255 + Beep Sedang)"));
      }
      // Prioritas 4: Rintangan Jauh (90cm - 150cm)
      else if (frontConn && dFront < 150.0) {
        bool v = ((millis() % 600UL) < 200UL);
        analogWrite(PIN_MOTOR, v ? 255 : 0); // Tenaga Maksimal PWM 255 (Sentakan Berjarak)
        digitalWrite(PIN_BUZZER, LOW); // Hening
        Serial.print(F("[KATANA LIVE] Waspada Jauh: Rintangan "));
        Serial.print(dFront, 1);
        Serial.println(F(" cm (Getar Penuh 255 Berjarak)"));
      }
      // Kondisi Aman (Jalan Bersih / Sensor Lepas)
      else {
        analogWrite(PIN_MOTOR, 0);
        digitalWrite(PIN_BUZZER, LOW);
      }
    }
  }
}
