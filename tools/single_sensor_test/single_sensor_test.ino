/*
  KATANA - Single Sensor Quick Test (HC-SR04 Ultrasonik)
  Uji coba 1 sensor langsung untuk memastikan sensor berfungsi.
  
  KONEKSI KABEL (HANYA 4 KABEL):
  - VCC sensor  --> 5V Arduino Nano
  - GND sensor  --> GND Arduino Nano
  - TRIG sensor --> D3 Arduino Nano (atau pin trigger pilihan)
  - ECHO sensor --> D2 Arduino Nano (atau pin echo pilihan)
*/

#include <Arduino.h>

const byte PIN_TRIG = 3;  // Pin Trigger
const byte PIN_ECHO = 2;  // Pin Echo

void setup() {
  Serial.begin(115200);
  delay(100);

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);

  Serial.println(F("\n=============================================="));
  Serial.println(F("      UJI COBA 1 SENSOR ULTRASONIK (HC-SR04)   "));
  Serial.println(F("=============================================="));
  Serial.println(F("Koneksi yang dipakai:"));
  Serial.println(F("  VCC  -> 5V"));
  Serial.println(F("  GND  -> GND"));
  Serial.println(F("  TRIG -> Pin D3"));
  Serial.println(F("  ECHO -> Pin D2"));
  Serial.println(F("----------------------------------------------"));
  Serial.println(F("Arahkan tangan atau benda di depan sensor..."));
}

void loop() {
  // Kirim pulsa trigger 10 mikrodetik
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(4);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  // Baca durasi pantulan echo (timeout 30ms = ~5 meter)
  unsigned long duration = pulseIn(PIN_ECHO, HIGH, 30000);

  if (duration == 0) {
    Serial.println(F("[STATUS] SENSOR TIDAK MERESPONS (Timeout / Kabel belum pas)"));
    Serial.println(F("         -> Cek apakah VCC dan GND sudah tercolok rapi"));
    Serial.println(F("         -> Cek apakah pin TRIG dan ECHO terbalik"));
  } else {
    // Hitung jarak dalam cm (kecepatan suara = 0.0343 cm/us)
    float distanceCm = (duration * 0.0343) / 2.0;

    Serial.print(F("[SUKSES] Jarak Terbaca: "));
    Serial.print(distanceCm, 1);
    Serial.print(F(" cm  "));

    // Visual bar jarak
    Serial.print(F("["));
    int bars = (int)(distanceCm / 5.0);
    if (bars > 20) bars = 20;
    for (int i = 0; i < bars; i++) Serial.print(F("="));
    for (int i = bars; i < 20; i++) Serial.print(F(" "));
    Serial.println(F("]"));
  }

  delay(300); // Pembacaan setiap 0.3 detik
}
