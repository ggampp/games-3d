import { TRAIN_CATALOG } from '../entities/train-factory.js';

export const SHOP_KEYS = Object.freeze({ best: 'acrobatic_train_best', bank: 'acrobatic_train_bank_points', owned: 'acrobatic_train_unlocked_trains', selected: 'acrobatic_train_current_train' });

export function getTrainGameplayProfile(trainId, level = null) {
  const train = Object.hasOwn(TRAIN_CATALOG, trainId) ? TRAIN_CATALOG[trainId] : null;
  if (!train) throw new RangeError('Trem desconhecido');
  return Object.freeze({ trainId, totalCars: train.maxCars, bonusMultiplier: train.bonusMultiplier || 1,
    whistleType: train.whistleType || trainId,
    startSpeedMps: level?.startSpeedMps ?? train.gameplay.maxSpeedMps * 0.65,
    maxSpeedMps: level?.maxSpeedMps ?? train.gameplay.maxSpeedMps,
    accelerationMps2: level?.accelerationMps2 ?? train.gameplay.accelerationMps2,
    crossTimeS: 0.28 });
}

function integer(value, fallback) {
  if (value === null || !/^\d+$/.test(String(value))) return fallback;
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : fallback;
}

/** Single writer of the legacy shop keys; no browser globals required in tests. */
export class ShopState {
  #credits = new Set();
  constructor(storage = null) {
    this.storage = storage; this.storageError = !storage;
    const read = key => { try { return storage?.getItem(key) ?? null; } catch { this.storageError = true; return null; } };
    this.best = integer(read(SHOP_KEYS.best), 0);
    this.bank = integer(read(SHOP_KEYS.bank), 50);
    let owned = [];
    try { owned = JSON.parse(read(SHOP_KEYS.owned) || '[]'); } catch { /* Recover this key independently. */ }
    this.owned = [...new Set(['cyber', ...(Array.isArray(owned) ? owned.filter(id => Object.hasOwn(TRAIN_CATALOG, id)) : [])])];
    const selected = read(SHOP_KEYS.selected);
    this.selected = this.owned.includes(selected) ? selected : 'cyber';
  }
  write(key, value) {
    try { this.storage?.setItem(key, String(value)); } catch { this.storageError = true; }
  }
  buy(id) {
    const train = Object.hasOwn(TRAIN_CATALOG, id) ? TRAIN_CATALOG[id] : null;
    if (!train || this.owned.includes(id) || this.bank < train.price) return false;
    this.bank -= train.price; this.owned.push(id);
    this.write(SHOP_KEYS.bank, this.bank); this.write(SHOP_KEYS.owned, JSON.stringify(this.owned));
    return true;
  }
  equip(id) {
    if (!Object.hasOwn(TRAIN_CATALOG, id) || !this.owned.includes(id)) return false;
    this.selected = id; this.write(SHOP_KEYS.selected, id);
    return true;
  }
  awardPoints({ eventId, amount }) {
    if (typeof eventId !== 'string' || !eventId || this.#credits.has(eventId) || !Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(this.bank + amount)) return false;
    this.#credits.add(eventId); this.bank += amount; this.write(SHOP_KEYS.bank, this.bank);
    return true;
  }
  saveBest(score) {
    if (score > this.best && Number.isSafeInteger(score)) { this.best = score; this.write(SHOP_KEYS.best, score); }
  }
  snapshot() { return { bank: this.bank, best: this.best, selected: this.selected, owned: [...this.owned], storageError: this.storageError }; }
}
