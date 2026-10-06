/*
  KATANA - Arduino Nano Full Pin Diagnostic Tool
  Menguji seluruh Pin I/O (Digital D2-D12 dan Analog A0-A7).
  
  CARA PENGGUNAAN:
  1. Upload sketch ini ke Arduino Nano lewat Arduino IDE.
  2. Buka Serial Monitor pada baud rate 115200.
  3. Cek hasil diagnosis mandiri di layar.
  4. Ambil 1 HELAI KABEL JUMPER untuk tes interaktif sentuh GND.
*/

#include <Arduino.h>

// Daftar pin digital yang diuji (Pin D0 dan D1 dilewati karena dipakai kabel USB Serial)
// Pin D13 memiliki LED internal onboard + resistor, jadi diberi catatan khusus
const byte DIGITAL_PINS[] = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13};
const byte NUM_DIGITAL = sizeof(DIGITAL_PINS) / sizeof(DIGITAL_PINS[0]);

// Daftar pin analog yang diuji
// Catatan: A6 dan A7 pada ATmega328P hanya bisa ANALOG INPUT murni (tidak punya register digital)
const byte ANALOG_PINS[] = {A0, A1, A2, A3, A4, A5, A6, A7};
const byte NUM_ANALOG = sizeof(ANALOG_PINS) / sizeof(ANALOG_PINS[0]);

void printHeader() {
  Serial.println(F("\n========================================================"));
  Serial.println(F("       ARDUINO NANO FULL PIN DIAGNOSTIC SUITE           "));
  Serial.println(F("========================================================"));
}

// 1. Uji Pull-Up Internal (Memastikan gerbang input CMOS pin tidak korslet ke GND)
void testDigitalPullup() {
  Serial.println(F("\n[FASE 1] MEMERIKSA INPUT DIGITAL & INTERNAL PULL-UP:"));
  Serial.println(F("(Mengecek apakah pin mampu membaca logika HIGH 5V internal)"));
  Serial.println(F("--------------------------------------------------------"));
  
  byte healthyCount = 0;
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
      Serial.println(F("[NORMAL / SEHAT]"));
      healthyCount++;
    } else {
      if (pin == 13) {
        Serial.println(F("[PERHATIAN] Terbaca LOW (Wajar di D13 karena ada beban LED bawaan board)"));
      } else {
        Serial.println(F("[RUSAK / KORSLET] Terbaca LOW! Pin mungkin menempel ke GND atau gerbang CMOS rusak."));
      }
    }
  }
  Serial.print(F("Hasil Fase 1: "));
  Serial.print(healthyCount);
  Serial.print(F(" dari "));
  Serial.print(NUM_DIGITAL);
  Serial.println(F(" pin digital merespons HIGH dengan benar."));
}

// 2. Uji Pin Analog
void testAnalogPins() {
  Serial.println(F("\n[FASE 2] MEMERIKSA PIN ANALOG (ADC CONVERTER):"));
  Serial.println(F("--------------------------------------------------------"));
  for (byte i = 0; i < NUM_ANALOG; i++) {
    byte pin = ANALOG_PINS[i];
    int raw = analogRead(pin);
    
    Serial.print(F(" Pin A"));
    Serial.print(i);
    Serial.print(F(" : ADC = "));
    Serial.print(raw);
    
    // Konversi ke voltase estimasi
    float voltage = (raw * 5.0) / 1023.0;
    Serial.print(F(" (~"));
    Serial.print(voltage, 2);
    Serial.print(F("V) "));
    
    if (raw > 1000) {
      Serial.println(F("[Terhubung ke 5V / High Bias]"));
    } else if (raw < 20) {
      Serial.println(F("[Terhubung ke GND / 0V]"));
    } else {
      Serial.println(F("[Floating / Terbuka Normal (Impedansi Tinggi)]"));
    }
    delay(10);
  }
}

// 3. Uji Pin Output Toggle (Menghasilkan tegangan square wave untuk multimeter / LED)
void toggleOutputsOnce() {
  for (byte i = 0; i < NUM_DIGITAL; i++) {
    byte pin = DIGITAL_PINS[i];
    pinMode(pin, OUTPUT);
    digitalWrite(pin, HIGH);
  }
  delay(100);
  for (byte i = 0; i < NUM_DIGITAL; i++) {
    byte pin = DIGITAL_PINS[i];
    digitalWrite(pin, LOW);
    pinMode(pin, INPUT_PULLUP); // Kembalikan ke pullup agar siap dites interaktif
  }
}

void printInteractiveGuide() {
  Serial.println(F("\n========================================================"));
  Serial.println(F("  [FASE 3] MODE MONITOR INTERAKTIF (LIVE PIN CHECKER)   "));
  Serial.println(F("========================================================"));
  Serial.println(F("CARA UJI MANUAL DENGAN 1 KABEL JUMPER:"));
  Serial.println(F("1. Tancapkan satu ujung kabel jumper ke lubang GND Arduino."));
  Serial.println(F("2. Sentuhkan ujung kabel satunya bergantian ke lubang pin:"));
  Serial.println(F("   -> Sentuh D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12"));
  Serial.println(F("   -> Sentuh A0, A1, A2, A3, A4, A5"));
  Serial.println(F("3. Jika pin disentuh ke GND, sistem di bawah akan LANGSUNG"));
  Serial.println(F("   mendeteksi dan mencetak nama pin tersebut di layar!"));
  Serial.println(F("--------------------------------------------------------"));
  Serial.println(F("Menunggu sentuhan kabel ke pin... (Silakan coba sekarang)"));
}

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000); // Tunggu serial jika diperlukan
  
  printHeader();
  testDigitalPullup();
  testAnalogPins();
  printInteractiveGuide();
}

unsigned long lastScanMs = 0;
bool lastDigitalState[14] = {false};
int lastAnalogBand[8] = {0};

void loop() {
  unsigned long now = millis();

  // Scan status pin setiap 100ms
  if (now - lastScanMs >= 100) {
    lastScanMs = now;

    // Scan Pin Digital D2-D12
    for (byte i = 0; i < NUM_DIGITAL; i++) {
      byte pin = DIGITAL_PINS[i];
      if (pin == 13) continue; // Skip D13 dari notifikasi sentuh agar tidak spam

      pinMode(pin, INPUT_PULLUP);
      int val = digitalRead(pin);

      // Jika pin disentuh ke GND (berubah dari HIGH ke LOW)
      if (val == LOW && !lastDigitalState[pin]) {
        lastDigitalState[pin] = true;
        Serial.print(F(">>> [PIN D"));
        if (pin < 10) Serial.print(F("0"));
        Serial.print(pin);
        Serial.println(F(" TERDETEKSI!] -> Berhasil membaca sinyal LOW (Pin SEHAT 100%)"));
      } else if (val == HIGH && lastDigitalState[pin]) {
        lastDigitalState[pin] = false;
        Serial.print(F("    [PIN D"));
        if (pin < 10) Serial.print(F("0"));
        Serial.print(pin);
        Serial.println(F(" DILEPAS]    -> Kembali ke HIGH (Pull-up normal)"));
      }
    }

    // Scan Pin Analog A0-A5 (sentuh ke GND)
    for (byte i = 0; i < 6; i++) {
      byte pin = ANALOG_PINS[i];
      pinMode(pin, INPUT_PULLUP);
      int val = digitalRead(pin);

      if (val == LOW && lastAnalogBand[i] != 1) {
        lastAnalogBand[i] = 1;
        Serial.print(F(">>> [PIN A"));
        Serial.print(i);
        Serial.println(F(" TERDETEKSI!] -> Berhasil membaca sinyal LOW (Pin Analog SEHAT 100%)"));
      } else if (val == HIGH && lastAnalogBand[i] == 1) {
        lastAnalogBand[i] = 0;
        Serial.print(F("    [PIN A"));
        Serial.print(i);
        Serial.println(F(" DILEPAS]    -> Kembali ke HIGH"));
      }
    }
  }

  // Jika user mengetikkan perintah di Serial Monitor
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();
    if (cmd == "TEST" || cmd == "RETEST" || cmd == "ULANG") {
      printHeader();
      testDigitalPullup();
      testAnalogPins();
      printInteractiveGuide();
    } else if (cmd == "BLINK" || cmd == "OUTPUT") {
      Serial.println(F("[UJI OUTPUT] Memberikan sinyal 5V lalu 0V ke semua pin digital..."));
      toggleOutputsOnce();
      Serial.println(F("[UJI OUTPUT] Selesai."));
    }
  }
}
