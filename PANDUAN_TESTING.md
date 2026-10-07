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

## 🎯 Siap Upload Firmware Utama (`katana.ino`)

Jika Tahap 2 dan Tahap 3 (khususnya sensor ultrasonik depan & aktuator) sudah bekerja dengan baik:

1. Buka file project utama:  
   📁 `katana/katana.ino`
2. Langsung klik tombol **Upload**.
3. **Selesai!** Katana sudah siap digunakan untuk mendampingi tunanetra.

> **💡 Tips Penting**:
> Jika sensor IMU MPU6050 atau sensor air belum siap/belum disolder, Anda **tetap bisa langsung mengunggah `katana.ino`**. Sistem sudah dirancang tahan kesalahan (*fault-tolerant*) dan akan tetap bekerja 100% menggunakan sensor ultrasonik depan, sensor bawah, motor vibrator, dan buzzer!
