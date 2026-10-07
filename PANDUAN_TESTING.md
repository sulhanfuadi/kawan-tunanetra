# Panduan Pengujian Hardware & Firmware Katana

> **Buku Saku Pengujian Cepat & Akurat untuk Perakitan Alat Bantu Tunanetra "Katana"**  
> Gunakan panduan langkah demi langkah ini untuk memastikan setiap pin, sensor, dan aktuator berfungsi optimal sebelum alat dirakit permanen.

---

## 📋 Ringkasan Blueprint Pin Arduino Nano

Sebelum mulai menguji, pastikan kabel jumper Anda sudah terpasang sesuai tabel berikut:

| Komponen / Sensor | Pin Modul | Pin Arduino Nano | Catatan Khusus |
|---|:---:|:---:|---|
| **Ultrasonik Depan (HC-SR04)** | `TRIG` | **D3** | Jarak rintangan depan (0 - 200 cm) |
| | `ECHO` | **D2** | |
| **Ultrasonik Bawah (HC-SR04)** | `TRIG` | **D9** | Deteksi turunan / lubang jalan |
| | `ECHO` | **D8** | |
| **Buzzer Aktif 5V** | `(+)` | **D6** *(via R 1k/Transistor)* | Bunyi audio peringatan |
| **Motor Getar (Vibrator)** | `IN / SIG` | **D5** *(PWM)* | Umpan balik taktil di pegangan tongkat |
| **Sensor IMU (MPU6050 / GY-521)** | `SDA` | **A4** | Deteksi ayunan langkah (*tilt*) |
| | `SCL` | **A5** | |
| **Sensor Air Analog** | `SIG / S` | **A0** | Deteksi genangan air jalan |
| **Semua Jalur VCC** | `VCC / +` | **5V** | Hubungkan ke rel positif (+) breadboard |
| **Semua Jalur GND** | `GND / -` | **GND** | Hubungkan ke rel negatif (-) breadboard |

---

## 🛠️ Alat Uji Utama: `three_stage_diagnostic.ino`

Semua pengujian dapat dilakukan menggunakan satu sketch diagnostik terpadu yang ada di folder:  
📁 `tools/three_stage_diagnostic/three_stage_diagnostic.ino`

### Cara Membuka Console Diagnostik:
1. Buka Arduino IDE, buka file `tools/three_stage_diagnostic/three_stage_diagnostic.ino`.
2. Pastikan Board dipilih **Arduino Nano** (Processor: *ATmega328P* atau *ATmega328P Old Bootloader*).
3. Klik tombol **Upload**.
4. Setelah selesai, buka **Serial Monitor** (tekan `Ctrl + Shift + M`).
5. **PENTING**: Pastikan baudrate di pojok kanan bawah Serial Monitor diset ke **`115200 baud`**.

---

## 🚀 Alur Praktik Pengujian (4 Tahap Bertingkat)

```
[Tahap 1: Cek Pin CMOS] ➡️ [Tahap 2: Tes Aktuator] ➡️ [Tahap 3: Cek Sensor Fisik] ➡️ [Tahap 4: Simulasi Live]
```

---

### Tahap 1: Cek Kesehatan Pin Arduino (Perintah: `1`)

* **Tujuan**: Memastikan pin Arduino Nano sehat, tidak ada korsleting (short circuit) ke GND atau 5V.
* **Cara Memulai**: Ketik `1` lalu tekan **Enter**.
* **Apa yang Diamati**:
  * Pin digital (D2 - D12) akan berstatus `[NORMAL - SEHAT]`.
  * Pin analog (A0 - A7) akan menampilkan nilai tegangan saat ini.
* **Tes Sentuh Interaktif**:
  * Tancapkan 1 kabel jumper ke pin **GND**.
  * Sentuhkan ujung lainnya ke pin **D2, D3, D5, D6, D8, D9, atau A0**.
  * Di Serial Monitor akan muncul pesan deteksi sentuhan secara langsung (*LIVE*). Jika muncul, berarti jalur pin mikrokontroler Anda 100% normal!

---

### Tahap 2: Uji Aktuator Buzzer & Motor (Perintah: `2`)

* **Tujuan**: Memastikan buzzer dan motor getar dapat menghasilkan getaran dan suara yang jelas.
* **Cara Memulai**: Ketik `2` lalu tekan **Enter**.
* **Siklus Otomatis (Bergantian Tiap 3.6 Detik)**:
  1. **Fasa 1**: Buzzer di pin **D6** berbunyi beep bip-bip.
  2. **Fasa 2**: Motor di pin **D5** bergetar berdenyut di tangan.
  3. **Fasa 3**: Keduanya berbunyi dan bergetar bersamaan.
* **Perintah Uji Mandiri Cepat**:
  * Ketik `BUZZER` ➡️ Tes bunyi 3x beep.
  * Ketik `MOTOR` ➡️ Tes getar 1.5 detik.
  * Ketik `DUAL` ➡️ Tes keduanya aktif bersamaan.
  * Ketik `STOP` ➡️ Matikan semua aktuator.

---

### Tahap 3: Uji Sensor Per Komponen (Perintah: `3` atau `STREAM`)

* **Tujuan**: Menguji pembacaan masing-masing sensor secara akurat.
* **Cara Memulai**: Ketik `3` lalu tekan **Enter** untuk cek ringkasan satu kali, ATAU ketik `STREAM` untuk melihat data terus-menerus.

#### 1. Uji Sensor Ultrasonik Depan (Ketik: `DEPAN` atau `STREAM DEPAN`)
* Arahkan tangan Anda di depan sensor HC-SR04 depan pada jarak 10 cm, 30 cm, dan 100 cm.
* **Hasil Benar**: Angka centimeter (cm) bertambah dan berkurang sesuai jarak tangan Anda.
* **Jika Muncul "PIN TERBALIK"**: Tukar posisi kabel pin D2 dan D3.

#### 2. Uji Sensor Ultrasonik Bawah (Ketik: `BAWAH` atau `STREAM BAWAH`)
* Arahkan sensor bawah menghadap ke lantai / meja datar.
* Angkat sensor lebih tinggi (simulasi lubang/turunan) atau dekatkan ke lantai.
* **Hasil Benar**: Jarak cm bertambah saat diangkat menjauhi permukaan.
* **Jika Muncul "PIN TERBALIK"**: Tukar posisi kabel pin D8 dan D9.

#### 3. Uji Sensor Kemiringan IMU MPU6050 (Ketik: `IMU` atau `STREAM IMU`)
* **Hasil Benar**: Terbaca akselerasi X, Y, Z dan sudut kemiringan (°). Saat modul dimiringkan, sudut kemiringan akan berubah.
* **Jika Muncul "LEPAS! Bus I2C tidak merespons"**:
  1. Periksa kabel: **SDA = A4**, **SCL = A5** (jangan terbalik!).
  2. Pastikan pin header modul GY-521 sudah **disolder mati** dengan timah.
  3. Cabut colokan USB 5 detik lalu colokkan kembali untuk mereset bus I2C.

#### 4. Uji Sensor Air (Ketik: `AIR` atau `STREAM AIR`)
* **Kering**: Nilai ADC berada di rentang normal atau 0V.
* **Basah**: Sentuh kisi-kisi sensor dengan jari basah / tisu basah.
* **Hasil Benar**: Status berubah menjadi `[BASAH / TERKENA AIR]`.
* *Catatan*: Jika memakai modul sensor LM393 (dengan potensiometer), modul tersebut tipe Active-LOW (1023 saat kering, dan nilai turun saat dicelup air).

---

### Tahap 4: Simulasi Live Navigasi Katana (Perintah: `4`)

* **Tujuan**: Mencoba langsung algoritma kecerdasan buatan dan umpan balik Katana seolah-olah alat sudah terpasang di tongkat!
* **Cara Memulai**: Ketik `4` lalu tekan **Enter**.
* **Cara Mempraktekkan**:
  1. Dekatkan tangan ke sensor depan pada jarak **< 40 cm** (Bahaya Dekat):
     * 👉 Motor getar akan bergetar maksimal + Buzzer berbunyi cepat tanpa henti!
  2. Jauhkan tangan ke jarak **40 cm - 90 cm** (Peringatan Sedang):
     * 👉 Motor berdenyut sedang + Buzzer berbunyi bip berjarak.
  3. Jauhkan tangan ke jarak **90 cm - 150 cm** (Waspada Jauh):
     * 👉 Motor bergetar halus untuk memberi tahu ada objek jauh (Buzzer diam agar hening).
  4. Bersihkan rintangan di depan (> 150 cm):
     * 👉 Motor dan buzzer langsung diam tenang.
  5. Jika sensor bawah diangkat tiba-tiba menjauhi lantai (> 15 cm):
     * 👉 Alarm bahaya turunan / lubang langsung aktif!

---

---

## ⚡ PENGUJIAN LANGSUNG DENGAN `katana.ino` (FIRMWARE UTAMA)

Jika Anda ingin langsung mengunggah dan menguji firmware produksi [`katana/katana.ino`](katana/katana.ino), file tersebut **sudah dilengkapi konsol diagnostik & perintah serial interaktif bawaan**!

### 1. Cara Upload Firmware Utama:
1. Di Arduino IDE, buka file `katana/katana.ino`.
2. Klik tombol **Upload**.
3. Buka **Serial Monitor** pada kecepatan **`115200 baud`**.
4. Saat pertama kali boot, Arduino akan otomatis menjalankan:
   * **Inisialisasi Pin & Sensor**
   * **Kalibrasi Baseline Lantai**
   * **Self-Test Singkat**: Motor getar bergetar sebentar (400ms) lalu buzzer berbunyi 2x beep.

---

### 2. Perintah Serial Interaktif Langsung di `katana.ino`:

Ketik perintah berikut di baris input Serial Monitor lalu tekan **Enter**:

| Perintah | Fungsi / Efek | Hasil yang Diharapkan |
|---|---|---|
| **`DIAG`** atau **`CHECK`** | Diagnosa status koneksi 4 sensor secara serentak | Menampilkan status koneksi & jarak terkini tiap sensor |
| **`TEST FRONT`** | Cek sensor depan HC-SR04 (D2/D3) | Terbaca jarak cm (+ deteksi auto-swap jika pin terbalik) |
| **`TEST DOWN`** | Cek sensor bawah HC-SR04 (D8/D9) | Terbaca jarak lantai (+ deteksi auto-swap) |
| **`TEST IMU`** | Cek sensor kemiringan MPU6050 | Menampilkan alamat I2C `0x68` dan nilai akselerometer |
| **`TEST WATER`** | Cek sensor air analog di Pin A0 | Menampilkan status Kering / Basah |
| **`TEST MOTOR`** | Uji getaran motor D5 selama 1.5 detik | Motor di pegangan bergetar nyata |
| **`TEST BUZZER`** | Uji bunyi bip buzzer D6 selama 1.5 detik | Buzzer berbunyi pola beep |
| **`TEST OUTPUT`** | Self-test motor getar dan buzzer berurutan | Motor getar berdenyut diikuti bunyi buzzer |
| **`STOP`** | Matikan semua aktuator yang sedang aktif | Motor dan buzzer langsung hening |

---

### 3. Skenario Uji Fisik Langsung di Lapangan:

Lakukan 3 pengujian fisik berikut dengan tangan Anda:

#### Skenario A: Uji Rintangan Depan (Sensor D2/D3)
1. Dekatkan telapak tangan Anda di depan sensor HC-SR04 depan:
   * Jarak **< 30 cm (`OBJEK_DEKAT`)**: Motor getar bergetar kontinu tanpa jeda!
   * Jarak **30 - 60 cm (`OBJEK_SEDANG`)**: Motor getar berdenyut cepat (cadence 120ms).
   * Jarak **60 - 100 cm (`OBJEK_WASPADA`)**: Motor getar berdenyut santai (cadence 350ms).
   * Jarak **> 100 cm (`NORMAL`)**: Motor getar langsung berhenti (diam).

#### Skenario B: Uji Tepi Turunan / Lubang Jalan (Sensor D8/D9)
1. Letakkan alat di atas meja datar menghadap ke bawah (jarak wajar 20-35 cm).
2. Geser ujung tongkat keluar bibir meja (sehingga sensor bawah melihat lantai bawah yang lebih dalam):
   * Status berubah menjadi **`TEPI_TURUNAN`**.
   * Motor getar menghasilkan **3 denyut taktil berulang** (*3 high-intensity haptic pulses*) untuk memperingatkan pengguna!

#### Skenario C: Skenario Darurat Morse SOS (Tongkat Terjatuh)
1. Jika modul IMU MPU6050 terpasang, baringkan alat mendatar di lantai (> 60°) selama 2 detik:
   * Status berubah menjadi **`TONGKAT_JATUH`**.
   * Buzzer aktif membunyikan kode internasional **SOS Morse (`... --- ...`)** secara periodik agar orang di sekitar dapat menolong tunanetra!
2. *(Alternatif simulasi jika tanpa MPU)*: Ketik **`FALL`** di Serial Monitor untuk menguji nada SOS Morse. Ketik **`NORMAL`** untuk mereset kembali.

---

## 🔍 Audit & Verifikasi Logika Firmware (`katana.ino`)

Hasil audit arsitektur logika dan pohon keputusan sistem:

```
                  [ updateInputs() ]
                          |
             [ Sensor Presence Validator ]
              /                         \
      (Semua Lepas)                (Minimal 1 Aktif)
            |                              |
      [ STATE: STANDBY ]            [ decideState() ]
       Motor: MATI                  Tangga Prioritas Bahaya:
       Buzzer: MATI                 1. FALL_ALERT (Tongkat Jatuh: Morse SOS)
                                    2. DROP_ALERT (Turunan / Lubang: 3 Denyut Taktil)
                                    3. WATER_ALERT (Genangan Air: 2 Denyut Panjang)
                                    4. OBJECT_NEAR (< 30cm: Getar Penuh Kontinu)
                                    5. OBJECT_MEDIUM (30-60cm: Getar Cepat)
                                    6. OBJECT_LOW (60-100cm: Getar Santai)
                                    7. NORMAL (Aman: Motor & Buzzer Hening)
```

### ✅ Poin Kunci Keamanan & Kenyamanan yang Terverifikasi:
1. **Sensory Conflict Prevention (Bebas Polusi Suara)**:
   * Buzzer **HANYA** berbunyi saat situasi kritis darurat (**Tongkat Terjatuh / User Pingsan** via sinyal SOS Morse).
   * Navigasi berjalan sehari-hari (rintangan depan, turunan, jalan basah) disalurkan melalui **Getaran Taktil di Pegangan**, sehingga tunanetra tidak mengalami kelelahan auditori (*auditory fatigue*) dan pendengarannya tetap bebas mendengar suara lingkungan sekitar.
2. **Auto-Pin Swapping (Tahan Salah Colok)**:
   * Jika kabel `TRIG` dan `ECHO` tertukar secara fisik di breadboard (misal D2 dan D3, atau D8 dan D9), firmware otomatis mendeteksi dan menukar peran pin melalui software secara live.
3. **Ghost Ground-Drop Prevention**:
   * Jika sensor bawah belum terpasang, sistem tidak akan memicu alarm turunan palsu. Alarm turunan hanya dievaluasi jika `downConnected == true` dan tongkat tidak sedang dimiringkan ekstrem.
4. **Floating ADC Noise Shielding**:
   * Pin A0 dinonaktifkan secara default (`waterSensorInstalled = false;`) sehingga muatan statis pin analog tidak memicu alarm air palsu. Cukup ketik `WATER ON` bila modul air fisik sudah siap.

