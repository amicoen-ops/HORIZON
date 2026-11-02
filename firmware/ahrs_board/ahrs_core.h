// I-A517 Strumento di volo · © 2026 Enrico D'Amico · Tutti i diritti riservati.
// Copia, modifica e distribuzione solo con permesso scritto dell'autore (vedi il file LICENSE).
// =============================================================================
//  ahrs_core.h  --  matematica della scheda sensori (senza dipendenze Arduino)
//  Strumento di volo 80 mm · I-A517 · firmware 2.0
//
//  Terna del corpo: x avanti, y destra, z in basso (FRD, convenzione aeronautica).
//  Accelerometro: forza specifica in g (a riposo, livellato: f = (0, 0, -1)).
//  Giroscopio: rad/s, p rollio a destra +, q cabrata +, r imbardata a destra +.
// =============================================================================
#pragma once
#include <math.h>

static const float G0      = 9.80665f;
static const float RAD2DEG = 57.2957795f;

static inline float clampf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }

// ---------------------------------------------------------------------------
//  Filtro di Mahony con fiducia adattiva sull'accelerometro
// ---------------------------------------------------------------------------
struct Mahony {
  float q0 = 1, q1 = 0, q2 = 0, q3 = 0;   // quaternione corpo -> terra (NED)
  float ix = 0, iy = 0, iz = 0;           // termine integrale (bias residuo del giroscopio, rad/s)
  float kp = 1.8f, ki = 0.02f;
  float trustG = 0.08f;                   // tolleranza sul modulo dell'accelerazione (g)
  float trustRate = 0.60f;                // tolleranza sulla velocità angolare (rad/s)
  float trust = 1.0f;                     // ultimo valore di fiducia (0..1), per diagnostica

  void reset() { q0 = 1; q1 = q2 = q3 = 0; ix = iy = iz = 0; }

  // Allinea subito l'assetto all'accelerometro (avvio o dopo $CAL)
  void levelFrom(float fx, float fy, float fz) {
    float roll  = atan2f(-fy, -fz);
    float pitch = atan2f(fx, sqrtf(fy * fy + fz * fz));
    float cr = cosf(roll * 0.5f), sr = sinf(roll * 0.5f), cp = cosf(pitch * 0.5f), sp = sinf(pitch * 0.5f);
    q0 = cr * cp; q1 = sr * cp; q2 = cr * sp; q3 = -sr * sp;
    ix = iy = iz = 0;
  }

  // Direzione "giù" della terra espressa nel corpo
  void down(float& dx, float& dy, float& dz) const {
    dx = 2.0f * (q1 * q3 - q0 * q2);
    dy = 2.0f * (q0 * q1 + q2 * q3);
    dz = q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3;
  }

  // gx,gy,gz in rad/s; fx,fy,fz forza specifica in g (già compensata dalle accelerazioni di manovra)
  void update(float gx, float gy, float gz, float fx, float fy, float fz, float dt) {
    float mag  = sqrtf(fx * fx + fy * fy + fz * fz);
    float rate = sqrtf(gx * gx + gy * gy + gz * gz);
    float e1 = (mag - 1.0f) / trustG, e2 = rate / trustRate;
    trust = expf(-(e1 * e1)) * expf(-(e2 * e2));
    if (mag > 0.3f && mag < 3.0f) {
      // direzione misurata del "giù" = -f
      float ax = -fx / mag, ay = -fy / mag, az = -fz / mag;
      float vx, vy, vz; down(vx, vy, vz);
      float ex = ay * vz - az * vy, ey = az * vx - ax * vz, ez = ax * vy - ay * vx;
      float k = kp * trust;
      if (ki > 0.0f && trust > 0.05f) {
        ix += ki * ex * dt; iy += ki * ey * dt; iz += ki * ez * dt;
        const float IMAX = 0.035f;   // 2 °/s al massimo
        ix = clampf(ix, -IMAX, IMAX); iy = clampf(iy, -IMAX, IMAX); iz = clampf(iz, -IMAX, IMAX);
      }
      gx += k * ex + ix; gy += k * ey + iy; gz += k * ez + iz;
    } else {
      gx += ix; gy += iy; gz += iz;
    }
    float h = 0.5f * dt, a = q0, b = q1, c = q2, d = q3;
    q0 += (-b * gx - c * gy - d * gz) * h;
    q1 += ( a * gx + c * gz - d * gy) * h;
    q2 += ( a * gy - b * gz + d * gx) * h;
    q3 += ( a * gz + b * gy - c * gx) * h;
    float n = 1.0f / sqrtf(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3);
    q0 *= n; q1 *= n; q2 *= n; q3 *= n;
  }

  // Angoli in gradi: rollio a destra +, beccheggio a cabrare +, prua 0..360
  void euler(float& roll, float& pitch, float& yaw) const {
    roll  = atan2f(2.0f * (q0 * q1 + q2 * q3), 1.0f - 2.0f * (q1 * q1 + q2 * q2)) * RAD2DEG;
    pitch = asinf(clampf(2.0f * (q0 * q2 - q3 * q1), -1.0f, 1.0f)) * RAD2DEG;
    yaw   = atan2f(2.0f * (q0 * q3 + q1 * q2), 1.0f - 2.0f * (q2 * q2 + q3 * q3)) * RAD2DEG;
    if (yaw < 0) yaw += 360.0f;
  }
};

// ---------------------------------------------------------------------------
//  Compensazione delle accelerazioni di manovra (virata, richiamata, accelerazione)
//  a_c = omega x v con v = (V, 0, 0) nel corpo; dvdt = accelerazione lungo l'asse.
//  Restituisce la forza specifica "solo gravità" usata per correggere l'assetto.
// ---------------------------------------------------------------------------
static inline void compensateManoeuvre(float& fx, float& fy, float& fz,
                                       float gy, float gz, float V, float dvdt) {
  if (V <= 0.0f) return;
  fx -= dvdt / G0;          // accelerazione longitudinale
  fy -= gz * V / G0;        // virata:     a_y = r * V
  fz += gy * V / G0;        // richiamata: a_z = -q * V
}

// ---------------------------------------------------------------------------
//  Vario inerziale: filtro complementare del 3° ordine (quota baro + accelerazione verticale)
//  stato: h (m), v (m/s, positivo in salita), ab (bias dell'accelerazione, m/s²)
// ---------------------------------------------------------------------------
struct InertialVario {
  float h = NAN, v = 0, ab = 0;
  float k1 = 2.5f, k2 = 2.08f, k3 = 0.58f;  // tau = 1.2 s
  void setTau(float tau) { tau = clampf(tau, 0.3f, 5.0f); k1 = 3.0f / tau; k2 = 3.0f / (tau * tau); k3 = 1.0f / (tau * tau * tau); }
  // accelerazione verticale verso l'alto (m/s²) a ogni passo dell'IMU
  void predict(float aUp, float dt) {
    if (isnan(h)) return;
    float a = aUp - ab;
    h += v * dt + 0.5f * a * dt * dt;
    v += a * dt;
  }
  // quota barometrica (m) quando arriva un nuovo campione
  void correct(float hBaro, float dt) {
    if (isnan(h)) { h = hBaro; v = 0; ab = 0; return; }
    float e = hBaro - h;
    h  += k1 * e * dt;
    v  += k2 * e * dt;
    ab -= k3 * e * dt;
    ab = clampf(ab, -1.5f, 1.5f);
  }
};

// ---------------------------------------------------------------------------
//  Aria: pressione dinamica -> velocità (IAS e TAS), atmosfera standard
// ---------------------------------------------------------------------------
static inline float iasFromQ(float qPa) { return qPa > 0 ? sqrtf(2.0f * qPa / 1.225f) : 0.0f; }
static inline float densityFromStatic(float pHpa) {
  float hp = 44330.0f * (1.0f - powf(pHpa / 1013.25f, 0.1903f));   // quota pressione
  float T  = 288.15f - 0.0065f * hp;                                // temperatura ISA
  return pHpa * 100.0f / (287.05f * T);
}
static inline float tasFromQ(float qPa, float pHpa) {
  if (qPa <= 0 || pHpa < 300 || pHpa > 1100) return iasFromQ(qPa);
  return sqrtf(2.0f * qPa / densityFromStatic(pHpa));
}
static inline float pressureToAlt(float pHpa, float qnh) { return 44330.0f * (1.0f - powf(pHpa / qnh, 0.1903f)); }

// ---------------------------------------------------------------------------
//  Orientamento di montaggio: per x, y, z dell'aereo (FRD) asse e segno del sensore
// ---------------------------------------------------------------------------
struct AxisMap {
  signed char map[3] = {0, 1, 2};
  signed char sgn[3] = {1, 1, 1};
  bool set(const char* s) {        // "+X+Y+Z", "-Y+X+Z", ...
    signed char m[3], g[3]; bool used[3] = {false, false, false};
    for (int i = 0; i < 3; i++) {
      char sg = s[2 * i], ax = s[2 * i + 1];
      if (ax >= 'a' && ax <= 'z') ax -= 32;
      if ((sg != '+' && sg != '-') || ax < 'X' || ax > 'Z') return false;
      m[i] = ax - 'X'; g[i] = (sg == '-') ? -1 : 1;
      if (used[(int)m[i]]) return false;
      used[(int)m[i]] = true;
    }
    for (int i = 0; i < 3; i++) { map[i] = m[i]; sgn[i] = g[i]; }
    return true;
  }
  void toString(char* out) const {
    for (int i = 0; i < 3; i++) { out[2 * i] = sgn[i] < 0 ? '-' : '+'; out[2 * i + 1] = 'X' + map[i]; }
    out[6] = 0;
  }
  void apply(float& x, float& y, float& z) const {
    float v[3] = {x, y, z};
    x = sgn[0] * v[(int)map[0]]; y = sgn[1] * v[(int)map[1]]; z = sgn[2] * v[(int)map[2]];
  }
};
