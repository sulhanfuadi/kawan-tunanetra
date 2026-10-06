# KATANA Physical Hardware Wiring Blueprint

> **Reference Guide for Hardware Assembly on Arduino Nano V3 (ATmega328P)**  
> This document details the exact pin-to-pin wiring connections between physical sensor modules and the Arduino Nano V3. All module pin names in this guide match the physical PCB silkscreen labels on standard breakout boards.

---

## 1. Pinout Mapping Table (Module Silkscreen to Microcontroller)

| Component / Module | Silkscreen Label | Arduino Nano Pin | Function / Signal Description |
|---|:---:|:---:|---|
| **Conductive Water Sensor** | **`S`** | **A0** | Analog voltage signal proportional to moisture |
| | **`+`** | **5V** | 5V DC power supply rail |
| | **`-`** | **GND** | System ground reference |
| **HC-SR04 (Front Obstacle)** | **`VCC`** | **5V** | 5V DC power supply rail |
| | **`TRIG`** | **D3** | Ultrasonic trigger pulse output (10 us TTL) |
| | **`ECHO`** | **D2** | Echo return pulse input |
| | **`GND`** | **GND** | System ground reference |
| **HC-SR04 (Ground Drop-off)** | **`VCC`** | **5V** | 5V DC power supply rail |
| | **`TRIG`** | **D9** | Ultrasonic trigger pulse output (10 us TTL) |
| | **`ECHO`** | **D8** | Echo return pulse input |
| | **`GND`** | **GND** | System ground reference |
| **MPU6050 (GY-521 IMU)** | **`VCC`** | **5V** | 5V DC power supply rail (onboard 3.3V LDO regulator) |
| | **`GND`** | **GND** | System ground reference |
| | **`SCL`** | **A5** | I2C Clock line |
| | **`SDA`** | **A4** | I2C Data line |
| | *XDA, XCL, AD0, INT* | *(Unconnected)* | Leave floating for standard I2C address `0x68` |
| **Haptic Vibration Module** | **`IN` / `SIG` / `S`** | **D5** | PWM vibration control signal (0-255 duty cycle) |
| | **`VCC` / `+`** | **5V** | 5V DC power supply rail |
| | **`GND` / `-`** | **GND** | System ground reference |
| **Active 5V Buzzer (Bare)** | **Long Leg (+)** | **5V** | 5V DC power supply rail |
| | **Short Leg (-)** | **Collector (C)** | Connects to Collector of BC547 NPN transistor |

---

## 2. Active Buzzer Transistor Switch Circuit (BC547 NPN)

Standard ATmega328P I/O pins have a maximum recommended continuous current limit of 20 mA. Driving an active magnetic buzzer directly from a digital pin can cause voltage sags or microcontroller brownouts. An external BC547 NPN transistor driver is required:

```text
               +5V (Power Rail) ------------ (+) Long Lead - Active Buzzer (-)
                                                    |
                                                    | (Collector Lead)
Pin D6 Arduino --- [ 1k Ohm Resistor ] --- (Base)     BC547 (NPN)
                                                    | (Emitter Lead)
                                                   GND (Power Rail)
```

### BC547 Pin Identification (Flat Face Facing You):
- **Pin 1 (Left)**: **Collector (C)** -> Connects to the negative (short) buzzer leg.
- **Pin 2 (Middle)**: **Base (B)** -> Connects through a 1 kOhm current-limiting resistor to Arduino pin **D6**.
- **Pin 3 (Right)**: **Emitter (E)** -> Connects to system **GND**.

---

## 3. Power Distribution Rail Architecture

1. **Common 5V Bus**:
   - The 5V pin on the Arduino Nano supplies the positive bus on the mini breadboard.
   - All `5V` / `VCC` / `+` pins from the front HC-SR04, downward HC-SR04, MPU6050, water sensor, haptic vibration driver, and buzzer positive lead tie together into this bus.
2. **Common GND Bus**:
   - The GND pin on the Arduino Nano supplies the ground bus on the mini breadboard.
   - All `GND` / `-` pins from all sensors, actuators, and the BC547 emitter tie together into this bus.
3. **Primary Power Supply**:
   - Regulated 5V DC is supplied via the Arduino Nano USB port connected to a standard 5V 2A portable battery bank.

---

## 4. Physical Component Placement on Forearm Crutch

For optimal ergonomic feedback and accurate environmental scanning, components should be mounted according to the following physical layout:

```text
       [ ARM CUFF ]
           |
       [ HANDLE ]  <--- Coreless Vibration Motor mounted underneath grip
           |
    [ CONTROL BOX ] <-- ABS Enclosure: Arduino Nano, MPU6050, Breadboard, BC547, Buzzer
           |
           |
     [ FRONT HC-SR04 ] <--- Mounted 55-65 cm above ground, facing forward (0 deg horizon)
           |
           |
     [ DOWN HC-SR04 ]  <--- Mounted 15-20 cm above rubber foot, angled 35-45 deg downward
           |
     [ WATER SENSOR ]  <--- Mounted 2-3 cm above rubber foot; trace side faces forward
           |
     [ RUBBER FOOT ]
```

1. **Handle Haptic Motor**: Mounted directly beneath the grip surface using structural adhesive or silicone wrap to maximize vibration transmission to the palm.
2. **Control Enclosure**: Secured along the upper vertical aluminum shaft below the handle, housing the Arduino Nano, MPU6050, breadboard, driver transistor, and acoustic buzzer.
3. **Frontal Obstacle Sensor (HC-SR04)**: Mounted 55-65 cm above the floor, aligned parallel with the walking path to detect waist-to-chest-height obstacles, low hanging branches, and walls.
4. **Ground Drop-off Sensor (HC-SR04)**: Mounted 15-20 cm above the rubber cane foot, angled at 35 to 45 degrees downward-forward to monitor road continuity and identify curbs or holes.
5. **Conductive Water Sensor**: Positioned 2-3 cm above the bottom rubber foot. Traces must face forward and remain elevated from direct weight bearing to avoid mechanical damage.

---

## 5. Hardware Pre-Flight Checklist

Before applying power:
- [ ] Verify continuity of the common ground rail across all modules.
- [ ] Confirm the 1k Ohm resistor is in place between Pin D6 and the Base of the BC547 transistor.
- [ ] Confirm no sensor 5V line is accidentally shorted to ground with a multimeter in resistance mode.
- [ ] Check that MPU6050 `SDA` is tied to **A4** and `SCL` to **A5**.
- [ ] Secure all wiring runs along the crutch shaft using cable ties or spiral wrap to prevent snagging during movement.

---

## 6. Prosedur Pengujian Hardware Mandiri (Skenario 3: Uji Komponen Satu per Satu)

Di **Skenario 3** (menggunakan suite diagnostik pada `tools/three_stage_diagnostic/three_stage_diagnostic.ino` atau Serial Monitor pada baud rate **115200**), Anda **bebas memilih** mau menguji secara **berurutan satu per satu (sangat direkomendasikan)** atau langsung menguji semuanya sekaligus.

Karena di meja Anda sensornya masih terpisah-pisah, **cara terbaik adalah menguji 1 komponen secara bergantian**:

---

### Cara Input Skenario 3 (Uji Komponen Satu per Satu):

Cukup ketik **nama komponennya** di baris input Serial Monitor lalu tekan **Enter**:

#### 1. Uji Sensor Ultrasonik Depan (HC-SR04)
* **Kabel yang dicolokkan (4 kabel):**
  * `VCC` ➡️ **5V**
  * `GND` ➡️ **GND**
  * `TRIG` ➡️ **D3**
  * `ECHO` ➡️ **D2**
* **Input di Serial Monitor:** Ketik **`DEPAN`** lalu tekan Enter.
* **Hasil:** Sistem akan membaca jarak cm di depan sensor secara langsung. (Jika kabel terbalik, program akan memberi tahu: *"Kabel D2 dan D3 terbalik!"*).

---

#### 2. Uji Sensor Ultrasonik Bawah (HC-SR04)
* **Kabel yang dicolokkan (4 kabel):**
  * `VCC` ➡️ **5V**
  * `GND` ➡️ **GND**
  * `TRIG` ➡️ **D9** *(Pin baru)*
  * `ECHO` ➡️ **D8** *(Pin baru)*
* **Input di Serial Monitor:** Ketik **`BAWAH`** lalu tekan Enter.
* **Hasil:** Membaca jarak cm untuk deteksi turunan/lubang.

---

#### 3. Uji Sensor IMU MPU6050 (Kemiringan Tongkat)
* **Kabel yang dicolokkan (4 kabel):**
  * `VCC` ➡️ **5V** (pastikan lampu LED merah/biru kecil di modul GY-521 menyala)
  * `GND` ➡️ **GND**
  * `SDA` ➡️ **A4**
  * `SCL` ➡️ **A5**
* **Input di Serial Monitor:** Ketik **`IMU`** lalu tekan Enter.
* **Hasil:** Memindai alamat I2C `0x68` dan konfirmasi komunikasi data.

---

#### 4. Uji Sensor Air
* **Kabel yang dicolokkan (3 kabel):**
  * `+` / `VCC` ➡️ **5V**
  * `-` / `GND` ➡️ **GND**
  * `S` / Signal ➡️ **A0**
* **Input di Serial Monitor:** Ketik **`AIR`** lalu tekan Enter.
* **Hasil:** Menampilkan nilai ADC mentah (akan berubah jika pelat disentuh tangan basah / air).

---

#### 5. Uji Motor Getar Haptic
* **Kabel yang dicolokkan (3 kabel):**
  * `VCC` ➡️ **5V**
  * `GND` ➡️ **GND**
  * `SIG` / `IN` ➡️ **D5**
* **Input di Serial Monitor:** Ketik **`MOTOR`** lalu tekan Enter.
* **Hasil:** Motor akan bergetar di tangan Anda selama 1 detik.

---

### Ingin Tes Semuanya Sekaligus?
Jika nanti semua sensor sudah terpasang rapi di breadboard:
* Cukup ketik **`ALL`** atau **`3`** lalu tekan Enter.
* Sistem akan memindai kelima komponen di atas secara otomatis dalam satu klik!

