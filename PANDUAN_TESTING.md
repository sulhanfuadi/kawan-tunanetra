# Panduan Simulasi & Pengujian Kasus Katana

Panduan pengujian langsung berbasis kondisi logika dan tangga prioritas keselamatan pada firmware Katana (`katana/katana.ino`). Gunakan panduan ini untuk menguji respon sistem baik secara fisik maupun melalui perintah simulasi serial.

---

## 1. Referensi Pin & Ambang Logika

### Blueprint Pin Hardware (Arduino Nano)
| Komponen | Pin Modul | Pin Nano | Deskripsi & Jalur |
|---|:---:|:---:|---|
| **Ultrasonik Depan (HC-SR04)** | TRIG / ECHO | **D3 / D2** | Rintangan depan (0 - 200 cm) |
| **Ultrasonik Bawah (HC-SR04)** | TRIG / ECHO | **D9 / D8** | Turunan / lubang (baseline ~30 cm) |
| **Buzzer Aktif 5V** | (+) | **D6** | Audio alarm darurat (Morse SOS) |
| **Motor Getar (PWM)** | SIG | **D5** | Umpan balik taktil pada handle tongkat |
| **IMU MPU6050 (GY-521)** | SDA / SCL | **A4 / A5** | Sudut orientasi & deteksi jatuh |
| **Sensor Air Analog** | SIG | **A0** | Deteksi genangan air jalan |
| **Daya & Ground** | VCC / GND | **5V / GND** | Rel daya sirkuit bersama |

### Matriks Tangga Prioritas Bahaya
```
Prioritas 1: FALL_ALERT   (Tongkat Jatuh)      -> Buzzer Morse SOS, Motor OFF
Prioritas 2: DROP_ALERT   (Tepi Turunan)       -> Motor 3 Denyut Taktil, Buzzer OFF
Prioritas 3: WATER_ALERT  (Genangan Air)       -> Motor 2 Denyut Panjang, Buzzer OFF
Prioritas 4: OBJECT_NEAR  (Depan < 30 cm)      -> Motor Getar Kontinu Penuh, Buzzer OFF
Prioritas 5: OBJECT_MED   (Depan 30 - 60 cm)   -> Motor Getar Denyut Cepat, Buzzer OFF
Prioritas 6: OBJECT_LOW   (Depan 60 - 100 cm)  -> Motor Getar Denyut Lambat, Buzzer OFF
Prioritas 7: NORMAL       (Jalur Aman)         -> Motor OFF, Buzzer OFF
Standby    : STANDBY      (Sensor Lepas)       -> Motor OFF, Buzzer OFF (Cegah False Alarm)
```

---

## 2. Cara Menjalankan Konsol Uji

1. Buka Arduino IDE, unggah firmware `katana/katana.ino` ke Arduino Nano.
2. Buka **Serial Monitor** pada kecepatan **`115200 baud`**.
3. Pastikan baris input diset ke **Newline** atau **Both NL & CR**.
4. *(Alternatif)*: Hubungkan via **Katana Dashboard** pada web browser menggunakan Web Serial API.

---

## 3. Skenario Uji Kasus Nyata (Case 1 - Case 8)

### KASUS 1: Tongkat Terjatuh / Tunanetra Tumbang (Prioritas 1 - Darurat Utama)
Kondisi di mana pengguna terjatuh atau tongkat terlepas ke tanah. Membutuhkan pertolongan audio bagi orang di sekitar.

- **Kondisi Logika**: `mpuConnected == true` DAN `tiltDeg > 60.0°` bertahan terus-menerus selama `>= 2000 ms` (2 detik).
- **Pengujian Fisik Riil**: Baringkan tongkat / sensor MPU6050 mendatar di lantai/meja (> 60°) selama minimal 2 detik.
- **Simulasi Serial / Dashboard**: Ketik `FALL` atau `TILT 75` lalu Enter.
- **Respon Aktuator**:
  - **Buzzer (D6)**: [AKTIF] Bunyi pola kode internasional SOS Morse (`... --- ...`).
  - **Motor (D5)**: [MATI] Getaran dinonaktifkan untuk menghemat daya baterai dan memfokuskan alarm pada audio lingkungan.
- **Status Telemetri**: `TONGKAT_JATUH` (Status Code: `FALL_ALERT`).

---

### KASUS 2: Tepi Turunan / Lubang Jalan / Bibir Tangga (Prioritas 2 - Bahaya Taktil)
Kondisi di mana ada penurunan permukaan jalan mendadak di depan langkah tunanetra.

- **Kondisi Logika**: `downConnected == true` DAN selisih jarak bawah `dropDeltaCm > 15 cm` di atas baseline terkalibrasi (contoh: baseline 30 cm, jarak terukur > 45 cm) DAN kemiringan tongkat `tiltDeg < 45.0°` selama `>= 200 ms`.
- **Pengujian Fisik Riil**: Pegang alat menghadap ke bawah di atas meja (~30 cm), lalu geser keluar bibir meja sehingga sensor menghadap langsung ke lantai ruang yang lebih dalam (> 45 cm).
- **Simulasi Serial / Dashboard**: Ketik `DROP` atau `DOWN 55` lalu Enter.
- **Respon Aktuator**:
  - **Motor (D5)**: [AKTIF] Pola burst 3 denyut menghentak kuat ("3 3 3") tenaga penuh PWM 255 (220ms getar, 120ms hening, 220ms getar, 120ms hening, 220ms getar per siklus 1.6 detik).
  - **Buzzer (D6)**: [MATI] Tetap hening agar tidak menimbulkan polusi pendengaran bagi pengguna.
- **Status Telemetri**: `TEPI_TURUNAN` (Status Code: `DROP_ALERT`).

---

### KASUS 3: Genangan Air / Permukaan Basah Licin (Prioritas 3 - Peringatan Permukaan)
Kondisi di mana ujung bawah tongkat menyentuh genangan air, kubangan, atau permukaan jalan basah.

- **Kondisi Logika**: Sensor air aktif (`waterSensorInstalled == true`) DAN nilai ADC pin A0 `waterValue > 650`.
- **Pengujian Fisik Riil**: Ketik `WATER ON` di Serial Monitor, lalu sentuhkan pelat kisi-kisi sensor air pin A0 ke air atau tisu basah.
- **Simulasi Serial / Dashboard**: Ketik `WET` atau `WATER 850` lalu Enter.
- **Respon Aktuator**:
  - **Motor (D5)**: [AKTIF] Pola 2 denyut panjang mantap ("2 2 2") tenaga penuh PWM 255 (400ms getar, 200ms hening, 400ms getar per siklus 1.8 detik).
  - **Buzzer (D6)**: [MATI] Tetap hening.
- **Status Telemetri**: `PERMUKAAN_BASAH` (Status Code: `WATER_ALERT`).

---

### KASUS 4: Rintangan Depan Jarak Sangat Dekat / Kritis (Prioritas 4 - Bahaya Benturan)
Kondisi di mana objek atau dinding berada sangat dekat dan berisiko langsung menabrak tubuh tunanetra jika terus melangkah.

- **Kondisi Logika**: `frontConnected == true` DAN jarak ultrasonik depan `frontCm < 30 cm`.
- **Pengujian Fisik Riil**: Dekatkan telapak tangan atau penghalang di depan sensor HC-SR04 depan pada jarak < 30 cm (misal 15 cm).
- **Simulasi Serial / Dashboard**: Ketik `NEAR` atau `FRONT 15` lalu Enter.
- **Respon Aktuator**:
  - **Motor (D5)**: [AKTIF] Getaran panjer kontinu 100% tanpa henti (PWM 255) langsung di genggaman tangan.
  - **Buzzer (D6)**: [AKTIF] Bunyi BEEP staccato cepat (100ms ON / 100ms OFF) sebagai alarm audio bahaya tabrakan!
- **Status Telemetri**: `OBJEK_DEKAT` (Status Code: `OBJECT_NEAR`, Buzzer: `BEEP`).

---

### KASUS 5: Rintangan Depan Jarak Sedang (Prioritas 5 - Peringatan Langkah)
Kondisi rintangan terdeteksi dalam jarak jangkauan langkah kaki berikutnya.

- **Kondisi Logika**: `frontConnected == true` DAN jarak ultrasonik depan berada di rentang `30 cm <= frontCm < 60 cm`.
- **Pengujian Fisik Riil**: Posisikan telapak tangan atau penghalang di depan sensor depan pada jarak 45 cm.
- **Simulasi Serial / Dashboard**: Ketik `FRONT 45` lalu Enter.
- **Respon Aktuator**:
  - **Motor (D5)**: [AKTIF] Getaran berdenyut cepat dan rapat tenaga penuh PWM 255 (siklus 480ms: 260ms getar, 220ms jeda).
  - **Buzzer (D6)**: [MATI] Tetap hening.
- **Status Telemetri**: `OBJEK_SEDANG` (Status Code: `OBJECT_MEDIUM`).

---

### KASUS 6: Rintangan Depan Jarak Jauh (Prioritas 6 - Waspada Arah)
Kondisi rintangan mulai terdeteksi di kejauhan agar pengguna bersiap mengambil jalur alternatif.

- **Kondisi Logika**: `frontConnected == true` DAN jarak ultrasonik depan berada di rentang `60 cm <= frontCm < 100 cm`.
- **Pengujian Fisik Riil**: Posisikan penghalang di depan sensor depan pada jarak 80 cm.
- **Simulasi Serial / Dashboard**: Ketik `FRONT 80` lalu Enter.
- **Respon Aktuator**:
  - **Motor (D5)**: [AKTIF] Getaran berdenyut tunggal berkala mantap ("tek 1 1") tenaga penuh PWM 255 (siklus 1000ms: 320ms getar kuat, 680ms jeda).
  - **Buzzer (D6)**: [MATI] Tetap hening.
- **Status Telemetri**: `OBJEK_WASPADA` (Status Code: `OBJECT_LOW`).

---

### KASUS 7: Jalur Aman / Normal Walkway (Prioritas 7 - Kondisi Normal)
Kondisi jalan rata tanpa rintangan dalam radius aman.

- **Kondisi Logika**: Depan `>= 100 cm`, Bawah delta `<= 15 cm`, Kemiringan `<= 60°`, dan Sensor Air `<= 650`.
- **Pengujian Fisik Riil**: Arahkan tongkat ke ruang terbuka tanpa ada halangan di depan maupun turunan di bawah.
- **Simulasi Serial / Dashboard**: Ketik `NORMAL` atau `DEMO OFF` lalu Enter.
- **Respon Aktuator**:
  - **Motor (D5)**: [MATI] Total hening/idle.
  - **Buzzer (D6)**: [MATI] Total hening/idle.
- **Status Telemetri**: `NORMAL` (Status Code: `NORMAL`).

---

### KASUS 8: Proteksi Kerusakan / Sensor Lepas (Mode Standby & Diagnostic)
Kondisi di mana satu atau beberapa sensor dicabut, kabel jumper putus, atau pin terbalik.

- **Kondisi Logika**: Pulsa echo timeout (> 25ms) atau bus I2C MPU6050 tidak memberikan respons ACK.
- **Pengujian Fisik Riil**: Cabut salah satu atau seluruh kabel sensor ultrasonik / MPU6050 saat sistem berjalan.
- **Simulasi Serial / Dashboard**: Ketik `DIAG` atau `CHECK` lalu Enter.
- **Perilaku Proteksi Sistem**:
  1. **Anti False-Alarm**: Sistem tidak akan memicu alarm turunan atau jatuh jika sensor terkait terlepas (`conn == false`).
  2. **Auto-Pin Swapping**: Jika kabel TRIG dan ECHO tertukar (D2/D3 atau D8/D9), firmware otomatis mendeteksi dan menukar konfigurasi pin secara digital tanpa perlu mengubah kabel fisik.
  3. **Aktuator Tetap Aman**: Motor dan Buzzer otomatis berada pada status [MATI] (`STANDBY`).
- **Status Telemetri**: Menampilkan status per-sensor `LEPAS` pada log stream.

---

## 4. Daftar Perintah Cepat Uji Serial

Gunakan daftar perintah berikut langsung di Serial Monitor:

| Perintah Serial | Sasaran Kasus / Uji | Respon yang Diharapkan |
|---|---|---|
| `FALL` | Kasus 1: Tongkat Jatuh | Buzzer alarm SOS Morse aktif, Motor mati |
| `DROP` | Kasus 2: Tepi Turunan | Motor 3 denyut ("3 3 3") tenaga penuh PWM 255 |
| `WET` | Kasus 3: Genangan Air | Motor 2 denyut panjang ("2 2 2") tenaga penuh PWM 255 |
| `NEAR` | Kasus 4: Rintangan Dekat | Motor bergetar panjer kontinu penuh PWM 255 |
| `FRONT 45` | Kasus 5: Rintangan Sedang | Motor bergetar denyut cepat rapat (siklus 480ms) PWM 255 |
| `FRONT 80` | Kasus 6: Rintangan Jauh | Motor denyut tunggal berkala ("tek 1 1", siklus 1000ms) PWM 255 |
| `NORMAL` | Kasus 7: Jalur Aman | Motor dan Buzzer mati total |
| `DIAG` | Kasus 8: Cek Kabel & Pin | Cetak status koneksi riil ke-4 sensor |
| `TEST VIBE 3` | Uji Haptik Turunan/Lubang | Uji pola denyut 3-3-3 (PWM 255) selama 4.8 detik |
| `TEST VIBE 2` | Uji Haptik Genangan Air | Uji pola denyut ganda 2-2-2 (PWM 255) selama 5.4 detik |
| `TEST VIBE 1` | Uji Haptik Jarak Jauh | Uji pola tunggal tek 1-1 (PWM 255) selama 4.0 detik |
| `TEST VIBE MED` | Uji Haptik Jarak Sedang | Uji pola denyut cepat rapat (PWM 255) selama 4.0 detik |
| `TEST VIBE NEAR` | Uji Haptik Jarak Dekat | Uji pola getar panjer kontinu (PWM 255) selama 3.0 detik |
| `TEST MOTOR` | Hardware Aktuator Motor | Motor D5 aktif tenaga penuh (PWM 255) selama 2.0 detik |
| `TEST BUZZER` | Hardware Aktuator Buzzer | Buzzer D6 berbunyi beep selama 1.5 detik |
| `TEST OUTPUT` | Self-Test Semua Aktuator | Siklus getar motor diikuti bunyi buzzer |
| `STOP` | Reset Aktuator Manual | Mematikan paksa seluruh motor dan buzzer |
| `WATER ON` | Aktivasi Sensor Air Fisik | Mengaktifkan pembacaan ADC pin A0 |
| `WATER OFF` | Deaktivasi Sensor Air Fisik | Mencegah noise muatan statis pin A0 yang melayang |
| `DEMO OFF` | Kembali ke Sensor Fisik | Menonaktifkan mode simulasi, kembali baca pin fisik |

---

## 5. Lembar Ceklis Validasi Pengujian

Gunakan tabel ini saat melakukan uji coba prototipe di lapangan:

- [ ] **Uji 1**: Respon Morse SOS aktif saat dimiringkan > 60° selama 2 detik (`FALL`).
- [ ] **Uji 2**: Motor menghasilkan 3 denyut kuat ("3 3 3", PWM 255) saat dihadapkan pada bibir meja / turunan (`DROP` atau `TEST VIBE 3`).
- [ ] **Uji 3**: Motor menghasilkan 2 denyut panjang mantap ("2 2 2", PWM 255) saat modul air mendeteksi cairan (`WET` atau `TEST VIBE 2`).
- [ ] **Uji 4**: Motor bergetar panjer kontinu penuh (PWM 255) saat objek berada pada jarak < 30 cm (`NEAR` atau `TEST VIBE NEAR`).
- [ ] **Uji 5**: Motor bergetar cepat rapat (PWM 255) saat objek berada pada jarak 30 - 60 cm (`FRONT 45` atau `TEST VIBE MED`).
- [ ] **Uji 6**: Motor bergetar tunggal berkala mantap ("tek 1 1", PWM 255) saat objek berada pada jarak 60 - 100 cm (`FRONT 80` atau `TEST VIBE 1`).
- [ ] **Uji 7**: Motor dan buzzer mati tenang saat jalur di depan dan bawah bersih (`NORMAL`).
- [ ] **Uji 8**: Perintah `DIAG` melaporkan status koneksi pin dengan benar tanpa false alarm.
