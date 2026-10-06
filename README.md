<p align="center">
  <img src="assets/katana_logo.png" alt="KATANA Logo" width="160" />
</p>

# KATANA (Kawan Tunanetra / Smart Cane Assistant)

> **Intelligent Navigation & Safety Cane for the Visually Impaired**  
> A retrofit smart cane prototype built on a salvaged elbow crutch, integrating multi-sensor environmental perception: frontal obstacle detection, ground drop-off and pothole detection, puddle/water hazard sensing, tactile haptic feedback, and an emergency SOS buzzer triggered upon falls.

Online Virtual Simulation: [Wokwi KATANA Simulation](https://wokwi.com/projects/474342215789115393)

---

## System Overview & Architecture

KATANA retrofits an ergonomic forearm crutch into an assistive navigation device designed for outdoor and indoor mobility. It processes sensor streams in real time on an onboard microcontroller, evaluates hazard states via a deterministic priority engine, and provides distinct haptic vibration and acoustic alerts to the user.

```text
[ ENVIRONMENTAL INPUTS ]               [ PROCESSING UNIT ]              [ FEEDBACK ACTUATORS ]

HC-SR04 (Front Obstacle)   ---(D2/D3)--->                     ---(PWM D5)---> Eccentric Haptic Motor
HC-SR04 (Ground Drop-off)  ---(D8/D9)----> Arduino Nano V3                    (Handle Vibration)
Water Sensor (Conductive)  ---(A0)------> (ATmega328P / 16MHz)
MPU6050 (6-Axis IMU)       ---(I2C)----->                     ---(D6+BC547)-> 85dB Active Buzzer
                                                                              (Acoustic SOS Alarm)
                                                  |
                                                  v
                                          USB Serial (115200)
                                                  |
                                                  v
                                       [ TELEMETRY DASHBOARD ]
                                       Next.js + Web Serial API
```

---

## Visual Documentation

### Mechanical Blueprint & Physical Dimensions

![KATANA Mechanical Blueprint](assets/blueprint.png)

> 2D CAD dimensional drawing of the KATANA smart cane assembly. Shows the structural layout of the forearm crutch chassis, sensor mounting positions (front-facing HC-SR04, downward-facing HC-SR04, MPU6050 IMU, and water sensor plate), handle ergonomics, and cable routing channels.

---

### System Architecture Concept Diagram

![KATANA System Architecture Concept](assets/konsep_diagram.png)

> High-level block diagram illustrating the full signal flow: environmental sensor inputs, onboard ATmega328P processing unit, hazard priority state machine, feedback actuator outputs, and the USB serial telemetry uplink to the Next.js dashboard.

---

### Physical Electronic Wiring Schematic

![KATANA Physical Wiring Diagram](assets/wiring_diagram_riil.png)

> Complete breadboard-level wiring schematic for the production physical hardware build. Includes pin assignments for all sensors (D2/D3 front ultrasonic, D8/D9 downward ultrasonic, A0 water sensor, I2C SDA/SCL for MPU6050), actuator driver circuit (PWM D5 motor, BC547 NPN transistor switch D6 for buzzer), and power distribution rails.

---

### Embedded Firmware Flowchart - Physical Hardware

![KATANA Firmware Flowchart (Physical)](assets/flowchart_riil.png)

> State machine flowchart of the production firmware running on the physical Arduino Nano. Covers the `setup()` initialization sequence (calibration sampling, IMU warm-up), the main `loop()` polling cycle, the deterministic hazard priority ladder evaluation, and serial override command parsing.

---

### Embedded Firmware Flowchart - Wokwi Virtual Simulation

![KATANA Firmware Flowchart (Wokwi Simulation)](assets/flowchart_simulasi.png)

> Adapted flowchart for the Wokwi virtual simulation runtime. Highlights the differences from the physical build: simulated sensor reads, virtual actuator outputs, and the `WOKWI_SIMULATION` compile flag branch paths.

---

## Repository Structure

```text
katana/
|-- assets/
|   |-- katana_logo.png           # Official project emblem and logo
|   |-- blueprint.png             # Mechanical blueprint and 2D CAD dimensions
|   |-- konsep_diagram.png        # System architecture concept diagram
|   |-- wiring_diagram_riil.png   # Physical electronic schematic & pin mapping
|   |-- flowchart_riil.png        # Production hardware embedded firmware flowchart
|   `-- flowchart_simulasi.png    # Virtual Wokwi simulation runtime flowchart
|-- katana.ino            # Production firmware for physical Arduino Nano hardware
|-- REAL_WIRING.md        # Physical pinout guide, transistor driver schematic, and assembly checklist
|-- README.md             # Core project documentation and operation manual (English)
|-- AGENTS.md             # Developer guidelines, code standards, and style rules
|-- .gitignore            # Build artifact exclusions
|-- dashboard/            # Web Serial Live Telemetry Dashboard (Next.js 15, Tailwind CSS, Lucide)
|   |-- src/app/page.tsx  # Interactive UI (2D CAD cane orientation, radar chart, terminal, demo controls)
|   |-- package.json      # Frontend dependencies and runtime scripts
|   |-- README.md         # Dashboard architecture and setup guide
|   |-- AGENTS.md         # Dashboard-specific rules
|   `-- CLAUDE.md         # Assistant workspace link
`-- wokwi/                # Wokwi simulation bundle
    |-- sketch.ino        # Simulation sketch configured for virtual runtime
    |-- diagram.json      # Virtual breadboard and wiring definition
    |-- wokwi.toml        # Emulator configuration
    `-- wokwi-project.txt # Wokwi project reference metadata
```

---

## Hazard Evaluation & Alert Priority Logic

When multiple hazard conditions are detected simultaneously, the internal state machine selects a single active state based on a strict priority ladder. This eliminates cognitive overload and sensory confusion for the user:

| Priority | Hazard Scenario | Sensor Trigger | Active State Name | Feedback Actuator Response |
|:---:|---|---|---|---|
| **1 (Highest)** | **Cane Dropped / Fallen User** | MPU6050: Tilt angle > 60 deg sustained for > 2.0s | `TONGKAT_JATUH` | Vibration motor stops; Buzzer sounds continuous Morse SOS pattern (`... --- ...`) |
| **2** | **Drop-off / Pothole / Downward Stairs** | HC-SR04 Down: Ground distance increases by > 15 cm above calibrated baseline | `TEPI_TURUNAN` | 3 distinct high-intensity haptic pulses at the handle |
| **3** | **Water Puddle / Flooded Surface** | Conductive Water Sensor Plate: Analog signal (A0) > 650 | `PERMUKAAN_BASAH` | 2 sustained long vibration pulses |
| **4** | **Frontal Obstacle (Critical)** | HC-SR04 Front: Distance < 30 cm | `OBJEK_DEKAT` | Continuous high-frequency vibration (PWM 240) |
| **5** | **Frontal Obstacle (Medium)** | HC-SR04 Front: Distance between 30 cm and 60 cm | `OBJEK_SEDANG` | Rapid pulsing vibration (120ms cadence) |
| **6** | **Frontal Obstacle (Warning)** | HC-SR04 Front: Distance between 60 cm and 100 cm | `OBJEK_WASPADA` | Slow pulsing vibration (350ms cadence) |
| **-** | **Sensor Disconnected / Cable Fault** | Front or downward ultrasonic pulse returns 0 or timeout | `STANDBY` | Motor idle, buzzer idle, telemetry reports `LEPAS` |
| **-** | **Normal Walking Path** | All sensors within safe clearance thresholds | `NORMAL` | Motor idle, buzzer idle |

---

## Operating Instructions

### 1. Flashing Physical Hardware (Arduino Nano V3)

1. Open [katana.ino](katana.ino) in the Arduino IDE.
2. Verify the configuration flag is set for physical deployment:
   ```cpp
   #define WOKWI_SIMULATION 0
   ```
3. Connect your Arduino Nano via USB.
4. Select board **Arduino Nano** and choose your serial port (e.g., `/dev/cu.usbserial-110` on macOS or `COM3` on Windows).
5. For CH340 USB clones, select **Tools > Processor > ATmega328P (Old Bootloader)**.
6. Click **Upload**.
7. Open **Serial Monitor** at **115200 baud** to view real-time diagnostics.

> **Important: Ground Distance Auto-Calibration**  
> During `setup()`, the downward-facing ultrasonic sensor captures 12 samples over the floor to calculate a reference `baseline` (~30 cm depending on mounting height). Hold the cane upright at a natural walking angle for the first 2 seconds after power-on.

---

### 2. Running the Live Telemetry Dashboard (Next.js)

1. Navigate to the `dashboard/` directory and install dependencies if not already done:
   ```bash
   cd dashboard
   npm install
   ```
2. Start the local development server:
   ```bash
   npm run dev
   ```
3. Open a Chromium-based browser (**Google Chrome**, **Brave**, or **Microsoft Edge**) at [http://localhost:3000](http://localhost:3000).
4. Click **Hubungkan Arduino** (Connect Arduino) and select the corresponding USB serial port.
5. Telemetry streams instantly into the dashboard:
   - Live 2D CAD blueprint showing real cane tilt angle relative to the ground.
   - Frontal obstacle radar clearance indicator.
   - Ground drop-off delta monitor.
   - Surface conductivity index.
   - Actuator states (PWM duty cycle and buzzer status).
   - Sensor wiring integrity badges (`RIIL` vs `LEPAS`).

*(Note: Close the Arduino IDE Serial Monitor before connecting through the browser to avoid serial port contention).*

---

### 3. Interactive Simulation & Serial Override Protocol

KATANA firmware includes a bidirectional serial command parser. Developers can test every hazard condition, haptic cadence, and acoustic pattern without moving the physical cane:

- **Via Next.js Dashboard:**  
  Toggle **Mode Demo: AKTIF** to display simulation controls. Use the quick scenario presets (`JATUH (SOS)`, `TURUNAN`, `AIR`, `DEKAT`, `NORMAL`) or adjust sliders manually. If the physical Arduino is connected via USB, override commands are dispatched to the microcontroller in real time, causing the physical vibration motor and buzzer to react!
- **Via Serial Terminal (Baud 115200):**  
  Send text commands directly:
  - `HELP` : Prints command syntax and parameter ranges.
  - `DEMO ON` / `DEMO OFF` : Enables or disables sensor simulation mode.
  - `FALL` : Simulates fall event (75 deg tilt, triggering SOS alarm).
  - `DROP` : Simulates drop-off/pothole (baseline + 25 cm, 3 haptic pulses).
  - `WET` : Simulates puddle contact (analog 850, 2 long haptic pulses).
  - `NEAR` : Simulates close frontal obstacle (15 cm).
  - `FRONT <cm>` : Overrides front obstacle distance (e.g., `FRONT 25`).
  - `DOWN <cm>` : Overrides downward ground distance (e.g., `DOWN 55`).
  - `TILT <deg>` : Overrides tilt angle (e.g., `TILT 72`).
  - `WATER <val>` : Overrides moisture sensor reading (e.g., `WATER 900`).

---

### 4. Running Wokwi Virtual Simulation

- **Browser Edition:** Open [https://wokwi.com/projects/474342215789115393](https://wokwi.com/projects/474342215789115393).
- **Local VS Code Edition:** Open the `wokwi/` folder with the Wokwi for VS Code extension installed and launch `wokwi.toml`.

---

## Technical Specifications

| Parameter | Specification |
|---|---|
| **Core Microcontroller** | ATmega328P (8-bit AVR, 16 MHz, 32KB Flash, 2KB SRAM) |
| **Supply Voltage** | 5V DC via USB / 5V 2A portable battery bank |
| **Front Obstacle Range** | 2 cm - 100 cm effective detection window (40 kHz ultrasonic) |
| **Drop-off Threshold** | Delta > 15 cm above ground baseline |
| **Moisture Sensitivity** | Conductive FR-4 grid; threshold ADC > 650 (0-1023 range) |
| **Tilt Detection** | 6-Axis MPU6050 (accelerometer-derived roll/pitch vector) |
| **Haptic Actuator** | Coreless vibration motor driven via PWM pin D5 (220/255 duty cycle) |
| **Acoustic Actuator** | 5V Active Buzzer driven via BC547 NPN transistor switch (D6) |
| **Communication** | UART Serial at 115200 Baud, Web Serial API compliant |

---

## Documentation Links

| Document | Description |
|---|---|
| [Physical Wiring & Pinout Guide](REAL_WIRING.md) | Step-by-step breadboard assembly, transistor driver schematic, and pin mapping checklist |
| [Telemetry Dashboard Guide](dashboard/README.md) | Dashboard architecture, Web Serial setup, and component reference |
| [Wokwi Simulation](https://wokwi.com/projects/474342215789115393) | Live virtual simulation in the browser, no hardware required |
