/*
  KATANA (Kawan Tunanetra) - Wokwi logic prototype
  Board: Arduino Nano / ATmega328P

  Wokwi substitutions:
  - Second HC-SR04         = lower/drop-distance sensor
  - A0 slide potentiometer = water sensor (0..1023)
  - Logic Analyzer D0      = measurement of the D5 vibration-motor PWM command
  - Pushbutton on D4      = quick fall-test input

  Real hardware keeps the same pins. See REAL_WIRING.md before assembling.
*/

#include <Wire.h>
#include <math.h>

// Keep 1 for Wokwi's passive buzzer model. Change to 0 before uploading
// to the physical cane, which uses the active 3-5 V buzzer in the RAB.
#define WOKWI_SIMULATION 1

// Pin map
const byte PIN_FRONT_ECHO = 2;
const byte PIN_FRONT_TRIG = 3;
const byte PIN_FALL_TEST = 4;     // Wokwi-only test button
const byte PIN_VIBRATION = 5;     // Real: PWM motor module SIG
const byte PIN_BUZZER = 6;        // Real: active buzzer through BC547
const byte PIN_DOWN_ECHO = 8;
const byte PIN_DOWN_TRIG = 9;
const byte PIN_WATER_SIM = A0;    // Real: water sensor AO

const byte MPU_ADDR = 0x68;

// Initial thresholds for controlled prototype testing
const int FRONT_LOW_CM = 100;
const int FRONT_MEDIUM_CM = 60;
const int FRONT_NEAR_CM = 30;
const int DOWN_DROP_THRESHOLD_CM = 45; // Ambang batas langsung sensor ke tanah
const int WATER_LIMIT = 650;
const float FALL_TILT_LIMIT_DEG = 60.0;
const unsigned long DROP_DEBOUNCE_MS = 200;
const unsigned long FALL_CONFIRM_MS = 2000;

enum AlertState {
  NORMAL,
  OBJECT_LOW,
  OBJECT_MEDIUM,
  OBJECT_NEAR,
  WATER_ALERT,
  DROP_ALERT,
  FALL_ALERT
};

AlertState activeState = NORMAL;
unsigned long dropStartMs = 0;
unsigned long fallStartMs = 0;
unsigned long lastReportMs = 0;

float frontCm = 400.0;
float downCm = 30.0;
int waterValue = 0;
float tiltDeg = 0.0;
bool dropConfirmed = false;
bool fallConfirmed = false;
bool vibrationOn = false;

// Mode Simulasi / Override Serial
bool demoMode = false;
float simFrontCm = 80.0;
float simDownCm = 30.0;
float simTiltDeg = 12.0;
int simWaterVal = 220;
String serialBuffer = "";

void processSerialCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;
  String upper = cmd;
  upper.toUpperCase();

  if (upper == "HELP" || upper == "?") {
    Serial.println(F("\n--- KATANA WOKWI INTERACTIVE COMMANDS ---"));
    Serial.println(F("DEMO ON / DEMO OFF"));
    Serial.println(F("FRONT <cm> | DOWN <cm> | TILT <deg> | WATER <val>"));
    Serial.println(F("FALL | DROP | WET | NEAR | NORMAL\n"));
    return;
  }
  if (upper == "DEMO ON" || upper == "DEMO:ON" || upper == "SIM 1") {
    demoMode = true;
    Serial.println(F("[SISTEM] >>> MODE DEMO AKTIF <<<"));
    return;
  }
  if (upper == "DEMO OFF" || upper == "DEMO:OFF" || upper == "SIM 0") {
    demoMode = false;
    Serial.println(F("[SISTEM] >>> MODE DEMO NONAKTIF <<<"));
    return;
  }
  if (upper == "FALL" || upper == "DEMO:FALL") {
    demoMode = true;
    simTiltDeg = 75.0;
    Serial.println(F("[SISTEM] Skenario: Tongkat Terjatuh"));
    return;
  }
  if (upper == "DROP" || upper == "DEMO:DROP") {
    demoMode = true;
    simDownCm = 60.0;
    simTiltDeg = 15.0;
    Serial.println(F("[SISTEM] Skenario: Tepi Turunan"));
    return;
  }
  if (upper == "WET" || upper == "DEMO:WET") {
    demoMode = true;
    simWaterVal = 850;
    Serial.println(F("[SISTEM] Skenario: Genangan Air"));
    return;
  }
  if (upper == "NEAR" || upper == "DEMO:NEAR") {
    demoMode = true;
    simFrontCm = 15.0;
    Serial.println(F("[SISTEM] Skenario: Objek Dekat"));
    return;
  }
  if (upper == "NORMAL" || upper == "RESET" || upper == "DEMO:NORMAL") {
    demoMode = true;
    simFrontCm = 120.0;
    simDownCm = downBaselineCm;
    simTiltDeg = 12.0;
    simWaterVal = 180;
    Serial.println(F("[SISTEM] Skenario: Kondisi Normal"));
    return;
  }

  if (upper.startsWith("DEMO:")) upper = upper.substring(5);
  int sep = upper.indexOf('=');
  if (sep == -1) sep = upper.indexOf(' ');
  if (sep != -1) {
    String key = upper.substring(0, sep);
    key.trim();
    float val = upper.substring(sep + 1).toFloat();
    demoMode = true;
    if (key == "FRONT" || key == "DEPAN") simFrontCm = val;
    else if (key == "DOWN" || key == "BAWAH") simDownCm = val;
    else if (key == "TILT" || key == "SUDUT") simTiltDeg = val;
    else if (key == "WATER" || key == "AIR") simWaterVal = (int)val;
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
      if (serialBuffer.length() < 64) serialBuffer += c;
    }
  }
}

void writeMPU(byte reg, byte value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission(true);
}

void setupMPU() {
  Wire.begin();
  writeMPU(0x6B, 0x00); // wake MPU6050
  writeMPU(0x1C, 0x00); // accelerometer range +/-2 g
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

float readUltrasonicCm(byte trigPin, byte echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long pulse = pulseIn(echoPin, HIGH, 25000UL);
  if (pulse == 0) return 400.0;
  return pulse / 58.0;
}

void calibrateDownBaseline() {
  float total = 0.0;
  byte valid = 0;
  for (byte i = 0; i < 12; i++) {
    float value = readUltrasonicCm(PIN_DOWN_TRIG, PIN_DOWN_ECHO);
    if (value >= 5.0 && value <= 120.0) {
      total += value;
      valid++;
    }
    delay(35);
  }
  if (valid >= 6) downBaselineCm = total / valid;
}

void updateInputs() {
  checkSerialInput();
  unsigned long now = millis();

  if (demoMode) {
    frontCm = simFrontCm;
    downCm = simDownCm;
    tiltDeg = simTiltDeg;
    waterValue = simWaterVal;
  } else {
    frontCm = readUltrasonicCm(PIN_FRONT_TRIG, PIN_FRONT_ECHO);
    delayMicroseconds(2500); // reduce cross-talk between the two ultrasonic modules
    downCm = readUltrasonicCm(PIN_DOWN_TRIG, PIN_DOWN_ECHO);
    waterValue = analogRead(PIN_WATER_SIM);

    float ax = 0.0, ay = 0.0, az = 1.0;
    if (readMPUAccel(ax, ay, az)) {
      float magnitude = sqrt(ax * ax + ay * ay + az * az);
      if (magnitude > 0.05) {
        float ratio = fabs(ay) / magnitude; // Sumbu Y MPU6050 sejajar dengan batang vertikal tongkat
        ratio = constrain(ratio, 0.0f, 1.0f);
        tiltDeg = acos(ratio) * 180.0 / PI;
      }
    }
  }

  // Filter deteksi turunan: Murni dievaluasi dari jarak langsung sensor bawah
  bool dropCandidate = downCm > DOWN_DROP_THRESHOLD_CM;
  if (dropCandidate) {
    if (dropStartMs == 0) dropStartMs = now;
    dropConfirmed = (now - dropStartMs >= DROP_DEBOUNCE_MS);
  } else {
    dropStartMs = 0;
    dropConfirmed = false;
  }

  bool fallButton = digitalRead(PIN_FALL_TEST) == LOW;
  bool fallCandidate = tiltDeg > FALL_TILT_LIMIT_DEG;
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
  // Highest risk wins, preventing overlapping alert patterns.
  if (fallConfirmed) return FALL_ALERT;
  if (dropConfirmed) return DROP_ALERT;
  if (waterValue > WATER_LIMIT) return WATER_ALERT;
  if (frontCm < FRONT_NEAR_CM) return OBJECT_NEAR;
  if (frontCm < FRONT_MEDIUM_CM) return OBJECT_MEDIUM;
  if (frontCm < FRONT_LOW_CM) return OBJECT_LOW;
  return NORMAL;
}

bool pulseWindow(unsigned long phase, unsigned long startMs, unsigned long endMs) {
  return phase >= startMs && phase < endMs;
}

bool vibrationPattern(AlertState state, unsigned long now) {
  switch (state) {
    case OBJECT_LOW:
      return (now % 1000UL) < 100UL;
    case OBJECT_MEDIUM:
      return (now % 400UL) < 120UL;
    case OBJECT_NEAR:
      return true;
    case WATER_ALERT: {
      unsigned long p = now % 1900UL;
      return pulseWindow(p, 0, 500) || pulseWindow(p, 750, 1250);
    }
    case DROP_ALERT: {
      unsigned long p = now % 1300UL;
      return pulseWindow(p, 0, 160) || pulseWindow(p, 280, 440) || pulseWindow(p, 560, 720);
    }
    default:
      return false;
  }
}

bool buzzerPattern(AlertState state, unsigned long now) {
  if (state != FALL_ALERT) return false;

  // Active buzzer: SOS-like on/off locator pattern for a fallen cane.
  unsigned long p = now % 3600UL;
  return pulseWindow(p, 0, 140) || pulseWindow(p, 240, 380) || pulseWindow(p, 480, 620) ||
         pulseWindow(p, 820, 1220) || pulseWindow(p, 1340, 1740) || pulseWindow(p, 1860, 2260) ||
         pulseWindow(p, 2460, 2600) || pulseWindow(p, 2700, 2840) || pulseWindow(p, 2940, 3080);
}

void driveBuzzer(bool on) {
#if WOKWI_SIMULATION
  if (on) tone(PIN_BUZZER, 1000);
  else noTone(PIN_BUZZER);
#else
  digitalWrite(PIN_BUZZER, on ? HIGH : LOW);
#endif
}

void updateOutputs(AlertState state) {
  unsigned long now = millis();
  vibrationOn = vibrationPattern(state, now);
  analogWrite(PIN_VIBRATION, vibrationOn ? 220 : 0);
  driveBuzzer(buzzerPattern(state, now));
}

const __FlashStringHelper *stateName(AlertState state) {
  switch (state) {
    case OBJECT_LOW: return F("OBJEK_WASPADA");
    case OBJECT_MEDIUM: return F("OBJEK_SEDANG");
    case OBJECT_NEAR: return F("OBJEK_DEKAT");
    case WATER_ALERT: return F("PERMUKAAN_BASAH");
    case DROP_ALERT: return F("TEPI_TURUNAN");
    case FALL_ALERT: return F("TONGKAT_JATUH");
    default: return F("NORMAL");
  }
}

void selfTest() {
  analogWrite(PIN_VIBRATION, 200);
  driveBuzzer(true);
  delay(160);
  analogWrite(PIN_VIBRATION, 0);
  driveBuzzer(false);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_FRONT_TRIG, OUTPUT);
  pinMode(PIN_FRONT_ECHO, INPUT);
  pinMode(PIN_DOWN_TRIG, OUTPUT);
  pinMode(PIN_DOWN_ECHO, INPUT);
  pinMode(PIN_FALL_TEST, INPUT_PULLUP);
  pinMode(PIN_VIBRATION, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  setupMPU();
  calibrateDownBaseline();
  selfTest();
  Serial.println(F("KATANA Wokwi ready"));
  Serial.println(F("HC depan D2/D3, HC bawah D8/D9, A0=air, D4=tes jatuh"));
}

void loop() {
  updateInputs();
  activeState = decideState();
  updateOutputs(activeState);

  unsigned long now = millis();
  if (now - lastReportMs >= 300) {
    lastReportMs = now;
    Serial.print(F("state="));
    Serial.print(stateName(activeState));
    Serial.print(F(" | depan="));
    Serial.print(frontCm, 0);
    Serial.print(F("cm | bawah="));
    Serial.print(downCm, 0);
    Serial.print(F("cm"));
    Serial.print(F(" | air="));
    Serial.print(waterValue);
    Serial.print(F(" | tilt="));
    Serial.print(tiltDeg, 1);
    Serial.print(F("deg | MOTOR="));
    Serial.print(vibrationOn ? F("ON") : F("OFF"));
    Serial.print(F(" | BUZZER="));
    Serial.println(activeState == FALL_ALERT ? F("SOS") : F("DIAM"));
  }
  delay(20);
}