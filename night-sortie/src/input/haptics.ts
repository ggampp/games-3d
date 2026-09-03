import { settings } from '../settings';

/**
 * DualSense haptics. Two paths:
 *  1. Gamepad API `vibrationActuator` (works on Chrome for any dual-rumble pad).
 *  2. Optional WebHID (user gesture required): richer rumble + battery level readout.
 */
type HIDDeviceLike = { opened: boolean; open(): Promise<void>; sendReport(id: number, data: BufferSource): Promise<void>; addEventListener(t: string, cb: (e: { reportId: number; data: DataView }) => void): void; productName?: string };
type NavHID = Navigator & { hid?: { requestDevice(o: { filters: Array<{ vendorId: number; productId?: number }> }): Promise<HIDDeviceLike[]>; getDevices(): Promise<HIDDeviceLike[]> } };

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
function crc32(bytes: Uint8Array, seed = 0xffffffff) { let c = seed; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export class Haptics {
  private engine = 0;   // 0..1 continuous rumble
  private pulse = 0;    // transient strong
  private pulseT = 0;
  private acc = 0;
  hid: HIDDeviceLike | null = null;
  hidBluetooth = false;
  battery = -1;         // percent or -1 unknown
  hidSupported = typeof (navigator as NavHID).hid !== 'undefined';
  private lastSent = 0;
  private currentPad: Gamepad | null = null;

  setPad(p: Gamepad | null) { this.currentPad = p; }
  setEngine(v: number) { this.engine = Math.max(0, Math.min(1, v)); }
  /** Short transient: strength 0..1, duration seconds. */
  kick(strength: number, dur = 0.08) { this.pulse = Math.max(this.pulse, strength); this.pulseT = Math.max(this.pulseT, dur); }
  tick() { this.kick(0.25, 0.04); }
  hit() { this.kick(0.7, 0.1); }
  kill() { this.kick(1, 0.09); setTimeout(() => this.kick(1, 0.09), 130); }
  buffet(v: number) { if (v > 0) this.kick(v * 0.5, 0.05); }

  get connected() { return this.hid !== null; }

  async pairHID(): Promise<boolean> {
    const nav = navigator as NavHID;
    if (!nav.hid) return false;
    try {
      const devs = await nav.hid.requestDevice({ filters: [{ vendorId: 0x054c, productId: 0x0ce6 }, { vendorId: 0x054c, productId: 0x0df2 }] });
      if (!devs.length) return false;
      const d = devs[0];
      if (!d.opened) await d.open();
      this.hid = d;
      d.addEventListener('inputreport', (e) => this.onReport(e.reportId, e.data));
      return true;
    } catch (err) { console.warn('WebHID pairing failed', err); return false; }
  }
  private onReport(id: number, data: DataView) {
    // USB: report 0x01, battery byte at offset 52 (0-based in data after report id). Bluetooth: report 0x31, +1 offset.
    let off = -1;
    if (id === 0x01 && data.byteLength >= 63) { off = 52; this.hidBluetooth = false; }
    else if (id === 0x31 && data.byteLength >= 77) { off = 53; this.hidBluetooth = true; }
    if (off >= 0) { const b = data.getUint8(off); const lvl = b & 0x0f; this.battery = Math.min(100, Math.round((lvl / 8) * 100)); }
  }
  private async sendHID(left: number, right: number) {
    const d = this.hid; if (!d) return;
    const L = Math.round(left * 255), R = Math.round(right * 255);
    try {
      if (!this.hidBluetooth) {
        const rep = new Uint8Array(47);
        rep[0] = 0x02 | 0x01; rep[1] = 0x15 | 0x08; // enable rumble + lightbar etc.
        rep[2] = R; rep[3] = L;
        rep[44] = 0x20; rep[45] = 0x80; rep[46] = 0xff; // lightbar cyan
        await d.sendReport(0x02, rep);
      } else {
        const rep = new Uint8Array(77);
        rep[0] = 0x02; rep[1] = 0x03; rep[2] = 0x15 | 0x08; rep[3] = R; rep[4] = L;
        rep[45] = 0x20; rep[46] = 0x80; rep[47] = 0xff;
        const seed = crc32(new Uint8Array([0xa2, 0x31]), 0xffffffff) ^ 0xffffffff;
        const crc = crc32(rep.subarray(0, 73), seed) ;
        rep[73] = crc & 0xff; rep[74] = (crc >>> 8) & 0xff; rep[75] = (crc >>> 16) & 0xff; rep[76] = (crc >>> 24) & 0xff;
        await d.sendReport(0x31, rep);
      }
    } catch { /* device gone */ }
  }

  update(dt: number) {
    this.acc += dt;
    if (this.pulseT > 0) { this.pulseT -= dt; if (this.pulseT <= 0) this.pulse = 0; }
    if (this.acc < 0.05) return;
    this.acc = 0;
    const k = settings.haptics;
    const weak = Math.min(1, this.engine * 0.6 + this.pulse * 0.5) * k;
    const strong = Math.min(1, this.pulse + this.engine * 0.15) * k;
    const now = performance.now();
    if (now - this.lastSent < 45) return;
    this.lastSent = now;
    const gp = this.currentPad;
    const act = (gp as unknown as { vibrationActuator?: { playEffect(t: string, o: object): Promise<unknown> } } | null)?.vibrationActuator;
    if (act && (weak > 0.01 || strong > 0.01)) { act.playEffect('dual-rumble', { startDelay: 0, duration: 80, weakMagnitude: weak, strongMagnitude: strong }).catch(() => { /* ignore */ }); }
    if (this.hid) void this.sendHID(strong, weak);
  }
}
