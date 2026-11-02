// HORIZON · strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
/* =============================================================================
 *  Strumento di volo 80 mm  --  Scheda sensori AHRS  ·  firmware 2.0
 *  MCU: Seeed XIAO ESP32-S3 sul circuito stampato strumento80_sensori v1.0
 *
 *  IMU (riconosciuta da sola all'avvio, stesso zoccolo mikroBUS):
 *    ICM-42688-P  (6DOF IMU 14 Click, MIKROE-4237)
 *    ICM-45605    (6DOF IMU 16 Click, MIKROE-6040)  BalancedGyro
 *    ICM-45686    (6DOF IMU 27 Click, MIKROE-6514)  BalancedGyro, formato M
 *  Barometro: BMP581 (I2C 0x47)   ·   Pitot: MS4525DO o Honeywell HSC ...2A3 (I2C 0x28)
 *
 *  Novità rispetto alla 1.x
 *    - driver IMU propri: filtri anti-aliasing e passa basso del chip ACCESI (prima erano spenti)
 *    - campionamento e fusione a 500 Hz con passo misurato, non più fisso
 *    - compensazione di virata, richiamata e accelerazione con la velocità del Pitot:
 *      l'orizzonte non "rientra" più in virata stretta e prolungata
 *    - vario inerziale (baro + accelerometro): risposta pronta e rumore circa 10 volte più basso
 *    - azzeramento automatico del giroscopio all'accensione se lo strumento è fermo
 *    - configurazione salvata in memoria (QNH, assi, offset, guadagni, bias)
 *    - barometro e Pitot su un task separato: la fusione non aspetta mai l'I2C
 *    - frase $STAT ogni secondo con lo stato dei sensori; controllo e ripartenza automatica dell'IMU
 *
 *  Uscita verso il Raspberry Pi (UART3 del Pi, 115200 8N1):
 *    $RPYL,roll,pitch,yaw,slip*CS           25 Hz -> pagina orizzonte (gradi, slip in g)
 *    $POV,P,<hPa>,Q,<Pa>,E,<m/s>*CS          10 Hz -> XCSoar (driver OpenVario) + PFD
 *    $STAT,<fw>,<imu>,<°C>,<Hz>,<err>,<baro>,<pitot>,<TAS m/s>,<fiducia>*CS   1 Hz
 *
 *  Novità 2.1: le stesse frasi escono anche via Bluetooth LE (servizio Nordic UART, nome «HORIZON-AHRS»)
 *  verso l'app HORIZON v2 sul telefono, che le usa come fonte principale di assetto, velocità e quota.
 *  Dal telefono arrivano gli stessi comandi del Pi ($CAL, $SETUP,...).
 *
 *  Comandi dal Pi:
 *    $SETUP,<chiave>,<valore>  chiavi: QNH MPITCH MROLL KP KI TRG TRR VTAU AXES CENT
 *                              AXES: "+X+Y+Z" = assi del sensore per avanti, destra, giù
 *                              CENT: 1/0 compensazione di virata (default 1)
 *    $SETUP,SAVE               salva subito la configurazione (si salva comunque da sola)
 *    $SETUP,RESET              torna ai valori di fabbrica
 *    $CAL                      aereo fermo, motore spento, Pitot coperto: azzera giroscopio e Pitot
 *
 *  Librerie (Arduino Library Manager): "SparkFun BMP581 Arduino Library"
 *  Scheda Arduino: "XIAO_ESP32S3", USB CDC On Boot: Enabled
 * ========================================================================== */

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <Preferences.h>
#include <SparkFun_BMP581_Arduino_Library.h>
#include "ahrs_core.h"
#include <NimBLEDevice.h>                               // libreria «NimBLE-Arduino» 2.x

#define FW_VERSION "2.1"

// ----------------------------- PIN MAP XIAO ESP32-S3 ------------------------
//  pad  GPIO  uso                       circuito stampato
//  D8   7     SPI SCK   -> IMU          mikroBUS 4
//  D9   8     SPI MISO  <- IMU          mikroBUS 5
//  D10  9     SPI MOSI  -> IMU          mikroBUS 6
//  D3   4     CS IMU                    mikroBUS 3
//  D2   3     INT IMU (non usato: lettura a tempo)   mikroBUS 15
//  D4   5     I2C SDA   <-> BMP581, Pitot (J4)
//  D5   6     I2C SCL
//  D6   43    UART TX   -> Pi GPIO5 (RXD3, pin 29)
//  D7   44    UART RX   <- Pi GPIO4 (TXD3, pin 7)
#define PIN_SPI_SCK    7
#define PIN_SPI_MISO   8
#define PIN_SPI_MOSI   9
#define PIN_IMU_CS     4
#define PIN_I2C_SDA    5
#define PIN_I2C_SCL    6
#define PIN_TX        43
#define PIN_RX        44
#define NMEA_BAUD 115200

#define PITOT_ADDR   0x28
#define BMP581_ADDR  0x47

static const float LOOP_HZ = 500.0f;

HardwareSerial& PiSerial = Serial1;
BMP581 baro;
Preferences prefs;

// ============================================================================
//  CONFIGURAZIONE (salvata in memoria non volatile)
// ============================================================================
struct Config {
  float qnh = 1013.25f;
  float mountPitch = 0, mountRoll = 0;          // gradi
  float kp = 1.8f, ki = 0.02f, trustG = 0.08f, trustRate = 0.60f;
  float varioTau = 1.2f;                         // s
  bool  centripetal = true;
  char  axes[8] = "+X+Y+Z";
  float gyroBias[3] = {0, 0, 0};                 // rad/s, ultimo $CAL o azzeramento automatico
  float qOffset = 0;                             // Pa
} cfg;
AxisMap axes;
volatile bool cfgDirty = false;
uint32_t cfgDirtyMs = 0;

void loadConfig() {
  prefs.begin("ahrs", true);
  if (prefs.getUInt("ver", 0) == 2) prefs.getBytes("cfg", &cfg, sizeof(cfg));
  prefs.end();
  if (!axes.set(cfg.axes)) { strcpy(cfg.axes, "+X+Y+Z"); axes.set(cfg.axes); }
}
void saveConfig() {
  prefs.begin("ahrs", false);
  prefs.putUInt("ver", 2);
  prefs.putBytes("cfg", &cfg, sizeof(cfg));
  prefs.end();
  cfgDirty = false;
}
void markDirty() { cfgDirty = true; cfgDirtyMs = millis(); }

// ============================================================================
//  DRIVER IMU (SPI modo 3, 8 MHz) — ICM-42688-P e famiglia ICM-456xx
// ============================================================================
enum ImuType { IMU_NONE = 0, IMU_42688, IMU_45605, IMU_45686 };
static const char* IMU_NAME[] = {"nessuna", "ICM-42688-P", "ICM-45605", "ICM-45686"};
ImuType imuType = IMU_NONE;
SPISettings imuSpi(8000000, MSBFIRST, SPI_MODE3);
float accLsb = 1.0f / 2048.0f;                 // g per LSB (±16 g)
float gyrLsb = (1000.0f / 32768.0f) / RAD2DEG; // rad/s per LSB (±1000 °/s)
float tmpLsb = 1.0f / 132.48f;
bool  imuBigEndian = true;

static void spiW(uint8_t reg, uint8_t val) {
  SPI.beginTransaction(imuSpi); digitalWrite(PIN_IMU_CS, LOW);
  SPI.transfer(reg & 0x7F); SPI.transfer(val);
  digitalWrite(PIN_IMU_CS, HIGH); SPI.endTransaction();
}
static void spiWn(uint8_t reg, const uint8_t* buf, uint8_t n) {
  SPI.beginTransaction(imuSpi); digitalWrite(PIN_IMU_CS, LOW);
  SPI.transfer(reg & 0x7F); for (uint8_t i = 0; i < n; i++) SPI.transfer(buf[i]);
  digitalWrite(PIN_IMU_CS, HIGH); SPI.endTransaction();
}
static void spiR(uint8_t reg, uint8_t* buf, uint8_t n) {
  SPI.beginTransaction(imuSpi); digitalWrite(PIN_IMU_CS, LOW);
  SPI.transfer(reg | 0x80); for (uint8_t i = 0; i < n; i++) buf[i] = SPI.transfer(0);
  digitalWrite(PIN_IMU_CS, HIGH); SPI.endTransaction();
}
static uint8_t spiR1(uint8_t reg) { uint8_t v; spiR(reg, &v, 1); return v; }

// --- ICM-456xx: registri indiretti (IREG) ---
static void iregW(uint16_t addr, uint8_t val) {
  uint8_t b[3] = {(uint8_t)(addr >> 8), (uint8_t)(addr & 0xFF), val};
  delayMicroseconds(4); spiWn(0x7C, b, 3); delayMicroseconds(4);
}
static uint8_t iregR(uint16_t addr) {
  uint8_t b[2] = {(uint8_t)(addr >> 8), (uint8_t)(addr & 0xFF)};
  delayMicroseconds(4); spiWn(0x7C, b, 2); delayMicroseconds(4);
  return spiR1(0x7E);
}

static bool init456xx(uint8_t who) {
  spiW(0x7F, 0x02);                 // REG_MISC2: soft reset
  delay(3);
  spiW(0x2D, 0x0C);                 // INTF_CONFIG1_OVRD: SPI a 4 fili
  if (spiR1(0x72) != who) return false;
  imuBigEndian = (iregR(0xA267) >> 1) & 1;          // SREG_CTRL: ordine dei byte dei dati
  spiW(0x1B, (0x1 << 4) | 0x6);     // ACCEL_CONFIG0: ±16 g, 800 Hz
  spiW(0x1C, (0x2 << 4) | 0x6);     // GYRO_CONFIG0:  ±1000 °/s, 800 Hz
  uint8_t g = iregR(0xA4AC);        // IPREG_SYS1_REG_172: passa basso giroscopio = ODR/8 (100 Hz)
  iregW(0xA4AC, (g & 0xF8) | 0x02);
  uint8_t a = iregR(0xA583);        // IPREG_SYS2_REG_131: passa basso accelerometro = ODR/8 (100 Hz)
  iregW(0xA583, (a & 0xF8) | 0x02);
  spiW(0x10, 0x0F);                 // PWR_MGMT0: accelerometro e giroscopio in basso rumore
  delay(60);
  accLsb = 16.0f / 32768.0f; gyrLsb = (1000.0f / 32768.0f) / RAD2DEG; tmpLsb = 1.0f / 128.0f;
  return true;
}

static bool init42688() {
  spiW(0x76, 0x00);                 // REG_BANK_SEL: banco 0
  spiW(0x11, 0x01);                 // DEVICE_CONFIG: soft reset (riaccende i filtri anti-aliasing e notch)
  delay(3);
  if (spiR1(0x75) != 0x47) return false;
  imuBigEndian = true;
  spiW(0x4F, (0x1 << 5) | 0x06);    // GYRO_CONFIG0:  ±1000 °/s, 1 kHz
  spiW(0x50, (0x0 << 5) | 0x06);    // ACCEL_CONFIG0: ±16 g, 1 kHz
  spiW(0x52, 0x55);                 // GYRO_ACCEL_CONFIG0: passa basso UI = max(400 Hz, ODR)/16 (62 Hz)
  spiW(0x4E, 0x0F);                 // PWR_MGMT0: basso rumore
  delay(60);
  accLsb = 16.0f / 32768.0f; gyrLsb = (1000.0f / 32768.0f) / RAD2DEG; tmpLsb = 1.0f / 132.48f;
  return true;
}

bool imuInit() {
  pinMode(PIN_IMU_CS, OUTPUT); digitalWrite(PIN_IMU_CS, HIGH);
  delay(5);
  imuType = IMU_NONE;
  spiW(0x2D, 0x0C);                                  // su ICM-456xx abilita lo SPI a 4 fili
  uint8_t w = spiR1(0x72);
  if (w == 0xE5 && init456xx(0xE5)) imuType = IMU_45605;
  else if (w == 0xE9 && init456xx(0xE9)) imuType = IMU_45686;
  else { spiW(0x76, 0x00); if (spiR1(0x75) == 0x47 && init42688()) imuType = IMU_42688; }
  return imuType != IMU_NONE;
}

static inline int16_t be16(const uint8_t* p) { return (int16_t)((p[0] << 8) | p[1]); }
static inline int16_t le16(const uint8_t* p) { return (int16_t)((p[1] << 8) | p[0]); }

// Restituisce accelerazione (g), velocità angolare (rad/s), temperatura (°C) negli assi del sensore
bool imuRead(float a[3], float g[3], float& t) {
  uint8_t b[14];
  int16_t ra[3], rg[3], rt;
  if (imuType == IMU_42688) {
    spiR(0x1D, b, 14);              // TEMP, ACCEL XYZ, GYRO XYZ (big endian)
    rt = be16(b);
    for (int i = 0; i < 3; i++) { ra[i] = be16(b + 2 + 2 * i); rg[i] = be16(b + 8 + 2 * i); }
  } else if (imuType == IMU_45605 || imuType == IMU_45686) {
    spiR(0x00, b, 14);              // ACCEL XYZ, GYRO XYZ, TEMP
    for (int i = 0; i < 3; i++) {
      ra[i] = imuBigEndian ? be16(b + 2 * i) : le16(b + 2 * i);
      rg[i] = imuBigEndian ? be16(b + 6 + 2 * i) : le16(b + 6 + 2 * i);
    }
    rt = imuBigEndian ? be16(b + 12) : le16(b + 12);
  } else return false;
  if (ra[0] == -32768 && ra[1] == -32768 && ra[2] == -32768) return false;   // dato non valido
  bool allSame = true; for (int i = 1; i < 14; i++) if (b[i] != b[0]) { allSame = false; break; }
  if (allSame) return false;                                                  // bus fermo (0x00 o 0xFF)
  for (int i = 0; i < 3; i++) { a[i] = ra[i] * accLsb; g[i] = rg[i] * gyrLsb; }
  t = 25.0f + rt * tmpLsb;
  return true;
}

// ============================================================================
//  PITOT (MS4525DO e Honeywell HSC: stesso protocollo, uscita 10-90 %, ±1 psi)
// ============================================================================
bool readPitot(float& diffPa) {
  Wire.beginTransmission(PITOT_ADDR);            // l'MS4525DO avvia la misura, l'HSC lo ignora
  if (Wire.endTransmission() != 0) return false;
  delayMicroseconds(600);
  if (Wire.requestFrom(PITOT_ADDR, 4) != 4) return false;
  uint8_t b0 = Wire.read(), b1 = Wire.read(); Wire.read(); Wire.read();
  if ((b0 >> 6) != 0) return false;              // 2 = dato già letto, 3 = guasto
  uint16_t c = ((uint16_t)(b0 & 0x3F) << 8) | b1;
  float psi = ((float)c - 1638.3f) * 2.0f / 13106.4f - 1.0f;
  diffPa = psi * 6894.757f;
  return true;
}

// ============================================================================
//  STATO CONDIVISO
// ============================================================================
Mahony ahrs;
InertialVario vario;
portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

volatile float sh_press = NAN, sh_q = 0, sh_tas = 0, sh_dvdt = 0;   // dai sensori lenti
volatile bool  sh_baroOk = false, sh_pitotOk = false;
volatile float out_roll = 0, out_pitch = 0, out_yaw = 0, out_slip = 0, out_vario = 0;
volatile float out_imuT = NAN, out_loopHz = 0, out_trust = 0;
volatile uint32_t imuErrors = 0, fusionBeat = 0;
volatile bool calGyro = false, calPitot = false, resetAttitude = false;

// ============================================================================
//  CORE 0: IMU + fusione a 500 Hz
// ============================================================================
void fusionTask(void*) {
  const TickType_t period = pdMS_TO_TICKS(1000.0f / LOOP_HZ);
  TickType_t next = xTaskGetTickCount();
  uint32_t lastUs = micros(), hzCount = 0, hzT0 = millis();
  int badRun = 0;
  bool leveled = false;
  // azzeramento automatico all'accensione: 2 s fermi entro i primi 10 s
  double stillSum[3] = {0, 0, 0}; uint32_t stillN = 0; bool autoZeroDone = false;
  float slipF = 0;
  float a[3], g[3], t;

  for (;;) {
    vTaskDelayUntil(&next, period);
    uint32_t now = micros();
    float dt = (now - lastUs) * 1e-6f; lastUs = now;
    if (dt <= 0 || dt > 0.05f) dt = 1.0f / LOOP_HZ;
    fusionBeat++;

    if (!imuRead(a, g, t)) {
      imuErrors++;
      if (++badRun > 250) { imuInit(); badRun = 0; }   // mezzo secondo senza dati: reinizializza
      continue;
    }
    badRun = 0;

    // --- azzeramento del giroscopio: automatico all'avvio oppure su $CAL ---
    float gn = sqrtf(g[0] * g[0] + g[1] * g[1] + g[2] * g[2]);
    if (!autoZeroDone || calGyro) {
      if (gn < 0.05f) {                                   // meno di 3 °/s: fermo
        for (int i = 0; i < 3; i++) stillSum[i] += g[i];
        if (++stillN >= (uint32_t)(2.0f * LOOP_HZ)) {
          for (int i = 0; i < 3; i++) cfg.gyroBias[i] = stillSum[i] / stillN;
          stillN = 0; stillSum[0] = stillSum[1] = stillSum[2] = 0;
          autoZeroDone = true;
          if (calGyro) { calGyro = false; resetAttitude = true; markDirty(); }
        }
      } else { stillN = 0; stillSum[0] = stillSum[1] = stillSum[2] = 0; }
      if (!calGyro && millis() > 10000) autoZeroDone = true;   // in moto all'accensione: tiene il bias salvato
    }
    for (int i = 0; i < 3; i++) g[i] -= cfg.gyroBias[i];

    // --- dagli assi del sensore agli assi dell'aereo (avanti, destra, giù) ---
    float fx = a[0], fy = a[1], fz = a[2], p = g[0], q = g[1], r = g[2];
    axes.apply(fx, fy, fz); axes.apply(p, q, r);
    // l'accelerometro misura +1 g sull'asse rivolto in alto: in terna FRD a riposo f = (0, 0, -1).
    // Circuito stampato montato capovolto con la X del sensore verso il muso: AXES = +X+Y+Z.

    if (!leveled || resetAttitude) { ahrs.levelFrom(fx, fy, fz); leveled = true; resetAttitude = false; }

    // --- compensazione delle accelerazioni di manovra ---
    float V, dvdt;
    portENTER_CRITICAL(&mux); V = sh_tas; dvdt = sh_dvdt; portEXIT_CRITICAL(&mux);
    float cx = fx, cy = fy, cz = fz;
    if (cfg.centripetal && V > 12.0f) compensateManoeuvre(cx, cy, cz, q, r, V, dvdt);

    ahrs.kp = cfg.kp; ahrs.ki = cfg.ki; ahrs.trustG = cfg.trustG; ahrs.trustRate = cfg.trustRate;
    ahrs.update(p, q, r, cx, cy, cz, dt);

    // --- vario inerziale: accelerazione verticale vera (forza specifica non compensata) ---
    float dx, dy, dz; ahrs.down(dx, dy, dz);
    float fDown = fx * dx + fy * dy + fz * dz;           // a riposo = -1 g
    float aUp = -(fDown + 1.0f) * G0;
    portENTER_CRITICAL(&mux); vario.predict(aUp, dt); portEXIT_CRITICAL(&mux);

    float roll, pitch, yaw; ahrs.euler(roll, pitch, yaw);
    roll -= cfg.mountRoll; pitch -= cfg.mountPitch;
    // "pallina": va dove punta la gravità apparente (-fy), filtrata 0,3 s; destra positiva come sul PFD
    slipF += (-fy - slipF) * clampf(dt / 0.3f, 0, 1);

    if (++hzCount >= 500) { uint32_t ms = millis(); out_loopHz = hzCount * 1000.0f / (ms - hzT0); hzT0 = ms; hzCount = 0; }
    portENTER_CRITICAL(&mux);
    out_roll = roll; out_pitch = pitch; out_yaw = yaw; out_slip = slipF;
    out_vario = vario.v; out_imuT = t; out_trust = ahrs.trust;
    portEXIT_CRITICAL(&mux);
  }
}

// ============================================================================
//  CORE 1: barometro e Pitot a 50 Hz
// ============================================================================
void airTask(void*) {
  const TickType_t period = pdMS_TO_TICKS(20);
  TickType_t next = xTaskGetTickCount();
  float qF = 0, tasF = 0, tasPrev = 0, dvdtF = 0;
  double qSum = 0; int qN = 0; uint32_t pitotFail = 0, baroFail = 0;
  for (;;) {
    vTaskDelayUntil(&next, period);
    bmp5_sensor_data d;
    if (baro.getSensorData(&d) == BMP5_OK && d.pressure > 30000 && d.pressure < 110000) {
      float p = d.pressure / 100.0f;
      float h = pressureToAlt(p, cfg.qnh);
      portENTER_CRITICAL(&mux);
      vario.setTau(cfg.varioTau);
      vario.correct(h, 0.02f);
      sh_press = p; sh_baroOk = true;
      portEXIT_CRITICAL(&mux);
      baroFail = 0;
    } else if (++baroFail > 25) sh_baroOk = false;

    float dp;
    if (readPitot(dp)) {
      pitotFail = 0; sh_pitotOk = true;
      if (calPitot) { qSum += dp; if (++qN >= 100) { cfg.qOffset = qSum / qN; qSum = 0; qN = 0; calPitot = false; markDirty(); } }
      float q = dp - cfg.qOffset;
      qF += (q - qF) * 0.3f;
      float pS = isnan(sh_press) ? 1013.25f : sh_press;
      float tas = tasFromQ(qF, pS);
      tasF += (tas - tasF) * 0.2f;
      float acc = (tasF - tasPrev) / 0.02f; tasPrev = tasF;
      dvdtF += (clampf(acc, -8.0f, 8.0f) - dvdtF) * 0.04f;  // circa 0,5 s
      portENTER_CRITICAL(&mux); sh_q = qF; sh_tas = tasF; sh_dvdt = dvdtF; portEXIT_CRITICAL(&mux);
    } else if (++pitotFail > 25) {
      sh_pitotOk = false;
      portENTER_CRITICAL(&mux); sh_tas = 0; sh_dvdt = 0; portEXIT_CRITICAL(&mux);
    }
  }
}

// ============================================================================
//  CORE 1: uscita NMEA verso il Pi + controllo di funzionamento
// ============================================================================
static uint8_t nmeaChecksum(const char* s) { uint8_t c = 0; for (const char* p = s; *p; ++p) c ^= (uint8_t)*p; return c; }
// ---- Bluetooth LE verso il telefono (Nordic UART) ----
#define NUS_SVC "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define NUS_RX  "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"   // dal telefono
#define NUS_TX  "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"   // al telefono (notify)
static NimBLECharacteristic* bleTx = nullptr;
static volatile bool bleConn = false;
static char bleCmd[80]; static volatile bool bleCmdReady = false;
class HzSrvCb : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* s, NimBLEConnInfo& ci) override { bleConn = true; s->updateConnParams(ci.getConnHandle(), 12, 24, 0, 400); }
  void onDisconnect(NimBLEServer* s, NimBLEConnInfo& ci, int reason) override { bleConn = false; NimBLEDevice::startAdvertising(); }
};
class HzRxCb : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c, NimBLEConnInfo& ci) override {
    NimBLEAttValue v = c->getValue();
    if (!bleCmdReady && v.length() > 0 && v.length() < sizeof(bleCmd)) { memcpy(bleCmd, v.data(), v.length()); bleCmd[v.length()] = 0; bleCmdReady = true; }
  }
};
static void bleInit() {
  NimBLEDevice::init("HORIZON-AHRS");
  NimBLEDevice::setMTU(185);
  NimBLEServer* srv = NimBLEDevice::createServer(); srv->setCallbacks(new HzSrvCb());
  NimBLEService* svc = srv->createService(NUS_SVC);
  bleTx = svc->createCharacteristic(NUS_TX, NIMBLE_PROPERTY::NOTIFY);
  NimBLECharacteristic* rx = svc->createCharacteristic(NUS_RX, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  rx->setCallbacks(new HzRxCb());
  svc->start();
  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(NUS_SVC); adv->setName("HORIZON-AHRS"); adv->enableScanResponse(true);
  adv->start();
}
static void sendNMEA(const char* body) {
  char line[140]; snprintf(line, sizeof(line), "$%s*%02X\r\n", body, nmeaChecksum(body));
  PiSerial.print(line);
  if (bleConn && bleTx) { bleTx->setValue((const uint8_t*)line, strlen(line)); bleTx->notify(); }
}

void outputTask(void*) {
  const TickType_t period = pdMS_TO_TICKS(40);   // 25 Hz
  TickType_t next = xTaskGetTickCount();
  uint32_t div = 0, lastBeat = 0, stuck = 0; char body[130];
  for (;;) {
    vTaskDelayUntil(&next, period);
    float r, p, y, s, pr, v, q, tas, it, hz, tr; bool bo, po;
    portENTER_CRITICAL(&mux);
    r = out_roll; p = out_pitch; y = out_yaw; s = out_slip; v = out_vario;
    pr = sh_press; q = sh_q; tas = sh_tas; it = out_imuT; hz = out_loopHz; tr = out_trust;
    bo = sh_baroOk; po = sh_pitotOk;
    portEXIT_CRITICAL(&mux);

    if (imuType != IMU_NONE) {
      snprintf(body, sizeof(body), "RPYL,%.1f,%.1f,%.1f,%.3f", r, p, y, s); sendNMEA(body);
    }
    if (div % 3 == 0 && bo) {
      snprintf(body, sizeof(body), "POV,P,%.2f,Q,%.1f,E,%.2f", pr, q < 0 ? 0 : q, v); sendNMEA(body);
    }
    if (div % 25 == 0) {
      snprintf(body, sizeof(body), "STAT,%s,%s,%.1f,%.0f,%lu,%d,%d,%.1f,%.2f",
               FW_VERSION, IMU_NAME[imuType], it, hz, (unsigned long)imuErrors, bo ? 1 : 0, po ? 1 : 0, tas, tr);
      sendNMEA(body);
      // la fusione deve avanzare: se è ferma da 2 s riparte la scheda
      if (fusionBeat == lastBeat) { if (++stuck >= 2) ESP.restart(); } else stuck = 0;
      lastBeat = fusionBeat;
    }
    div++;
  }
}

// ============================================================================
//  COMANDI DAL PI
// ============================================================================
void applyCommand(char* line) {
  char* star = strchr(line, '*'); if (star) *star = 0;
  if (strncmp(line, "$CAL", 4) == 0) { calGyro = true; calPitot = true; return; }
  if (strncmp(line, "$SETUP,", 7) != 0) return;
  char* key = line + 7; char* val = strchr(key, ',');
  if (!strcmp(key, "SAVE")) { saveConfig(); return; }
  if (!strcmp(key, "RESET")) { cfg = Config(); axes.set(cfg.axes); saveConfig(); resetAttitude = true; return; }
  if (!val) return;
  *val++ = 0;
  if (!strcmp(key, "AXES")) {
    if (axes.set(val)) { axes.toString(cfg.axes); resetAttitude = true; markDirty(); }
    return;
  }
  float v = atof(val);
  if      (!strcmp(key, "QNH") && v > 900 && v < 1100) cfg.qnh = v;
  else if (!strcmp(key, "MPITCH")) cfg.mountPitch = clampf(v, -30, 30);
  else if (!strcmp(key, "MROLL"))  cfg.mountRoll  = clampf(v, -30, 30);
  else if (!strcmp(key, "KP"))     cfg.kp = clampf(v, 0, 10);
  else if (!strcmp(key, "KI"))     cfg.ki = clampf(v, 0, 1);
  else if (!strcmp(key, "TRG"))    cfg.trustG = clampf(v, 0.01f, 1);
  else if (!strcmp(key, "TRR"))    cfg.trustRate = clampf(v, 0.05f, 5);
  else if (!strcmp(key, "VTAU"))   cfg.varioTau = clampf(v, 0.3f, 5);
  else if (!strcmp(key, "CENT"))   cfg.centripetal = v != 0;
  else return;
  markDirty();
}

// ============================================================================
void setup() {
  Serial.begin(115200);                                   // USB, solo diagnostica
  PiSerial.begin(NMEA_BAUD, SERIAL_8N1, PIN_RX, PIN_TX);
  loadConfig();
  bleInit();                                              // Bluetooth LE verso l'app sul telefono

  SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI, PIN_IMU_CS);
  if (imuInit()) Serial.printf("IMU: %s\n", IMU_NAME[imuType]);
  else Serial.println("IMU non trovata: controlla la Click (COMM SEL su SPI) e lo zoccolo");

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL); Wire.setClock(400000);
  if (baro.beginI2C(BMP581_ADDR) != BMP5_OK) Serial.println("BMP581 non trovato: controlla I2C/indirizzo");
  baro.setODRFrequency(BMP5_ODR_50_HZ);
  float t; if (!readPitot(t)) Serial.println("Sensore Pitot non risponde a 0x28");
  vario.setTau(cfg.varioTau);

  char b[60]; snprintf(b, sizeof(b), "STAT,%s,%s,avvio,assi %s", FW_VERSION, IMU_NAME[imuType], cfg.axes); sendNMEA(b);

  xTaskCreatePinnedToCore(fusionTask, "fusion", 8192, NULL, 5, NULL, 0);
  xTaskCreatePinnedToCore(airTask,    "air",    4096, NULL, 3, NULL, 1);
  xTaskCreatePinnedToCore(outputTask, "output", 4096, NULL, 2, NULL, 1);
}

void loop() {
  static char buf[80]; static uint8_t n = 0;
  while (PiSerial.available()) {
    char c = PiSerial.read();
    if (c == '\n' || c == '\r') { if (n) { buf[n] = 0; applyCommand(buf); n = 0; } }
    else if (n < sizeof(buf) - 1) buf[n++] = c;
  }
  if (bleCmdReady) { char c2[80]; strncpy(c2, bleCmd, sizeof(c2)); c2[79] = 0; bleCmdReady = false; applyCommand(c2); }   // comandi dal telefono
  if (cfgDirty && millis() - cfgDirtyMs > 3000) saveConfig();   // salva 3 s dopo l'ultima modifica
  vTaskDelay(pdMS_TO_TICKS(20));
}
