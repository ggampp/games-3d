import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAIN_CATALOG } from '../src/entities/train-factory.js';
import { ShopState, SHOP_KEYS, getTrainGameplayProfile } from '../src/core/shop-state.js';
import { trackRetention } from '../src/entities/track.js';
import { LEVEL_ONE } from '../src/levels/level-config.js';
import { sound } from '../src/core/audio.js';

const storage = initial => {
  const map = new Map(Object.entries(initial || {}));
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), map };
};

test('M0-T01: catalog profiles use numeric SI units and preserve requested prices', () => {
  assert.deepEqual(Object.values(TRAIN_CATALOG).map(t => t.price), [0, 50, 100, 1000, 2000]);
  for (const train of Object.values(TRAIN_CATALOG)) {
    const profile = getTrainGameplayProfile(train.id);
    assert.equal(profile.totalCars, train.maxCars);
    assert.ok(Number.isFinite(profile.maxSpeedMps));
    assert.equal(Math.round(profile.maxSpeedMps * 3.6), Number.parseInt(train.specs.speed));
    assert.ok(profile.startSpeedMps < profile.maxSpeedMps);
    assert.equal(getTrainGameplayProfile(train.id, LEVEL_ONE).maxSpeedMps, 18);
  }
  assert.throws(() => getTrainGameplayProfile('unknown'), RangeError);
  assert.throws(() => getTrainGameplayProfile('__proto__'), RangeError);
});

test('M0-T02: saves load independently, preserve zero and recover corrupt owned JSON', () => {
  for (const bank of [0, 50, 2000]) {
    const store = storage({ [SHOP_KEYS.bank]: String(bank), [SHOP_KEYS.best]: '95', [SHOP_KEYS.owned]: '["cyber","steam"]', [SHOP_KEYS.selected]: 'steam' });
    const shop = new ShopState(store);
    assert.equal(shop.bank, bank); assert.equal(shop.best, 95); assert.equal(shop.selected, 'steam');
    assert.deepEqual(shop.owned, ['cyber', 'steam']);
    assert.equal(store.map.size, 4); // Load does not rewrite legacy keys.
  }
  const shop = new ShopState(storage({ [SHOP_KEYS.bank]: '2000', [SHOP_KEYS.best]: '42', [SHOP_KEYS.owned]: '{', [SHOP_KEYS.selected]: 'class395' }));
  assert.equal(shop.bank, 2000); assert.equal(shop.best, 42); assert.equal(shop.selected, 'cyber');
  for (const value of ['-1', 'Infinity', '10junk', '2.5']) assert.equal(new ShopState(storage({ [SHOP_KEYS.bank]: value })).bank, 50);
  const failed = new ShopState({ getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } });
  assert.equal(failed.storageError, true); assert.equal(failed.buy('steam'), true); assert.equal(failed.bank, 0);
  assert.equal(new ShopState(null).storageError, true);
});

test('M0-T03: purchases and credits cannot apply twice, balances never become negative', () => {
  const shop = new ShopState(storage({ [SHOP_KEYS.bank]: '50' }));
  assert.equal(shop.buy('steam'), true); assert.equal(shop.buy('steam'), false);
  assert.equal(shop.bank, 0); assert.equal(shop.buy('passenger'), false);
  assert.equal(shop.buy('__proto__'), false); assert.equal(shop.buy('constructor'), false);
  assert.equal(shop.awardPoints({ eventId: '1:pickup:1', amount: 20 }), true);
  assert.equal(shop.awardPoints({ eventId: '1:pickup:1', amount: 20 }), false);
  assert.equal(shop.awardPoints({ eventId: 'bad', amount: -10 }), false);
  assert.equal(shop.bank, 20);
});

test('M0-T04: blocked/nonexistent equipment is rejected; active profile is immutable', () => {
  const shop = new ShopState(); const active = getTrainGameplayProfile(shop.selected, LEVEL_ONE);
  assert.equal(shop.equip('class395'), false); assert.equal(shop.equip('unknown'), false);
  assert.equal(shop.buy('steam'), true); assert.equal(shop.equip('steam'), true);
  assert.equal(active.trainId, 'cyber'); assert.equal(shop.selected, 'steam');
  assert.ok(Object.isFrozen(active));
});

test('M0-T06: 12-car retention covers the whole tail plus a 60m margin', () => {
  const profile = getTrainGameplayProfile('class395');
  const carLength = (Math.hypot(3.4, 6.8) / 2 + 0.9) * 2;
  const tail = 11 * (carLength + 0.5);
  assert.equal(profile.totalCars, 12); assert.equal(profile.whistleType, 'british');
  assert.equal(trackRetention(profile.totalCars, carLength), tail + 60);
});

test('Class395 British whistle uses the British two-tone profile instead of generic horn', () => {
  const original = { isReady: sound.isReady, playTone: sound.playTone, playNoise: sound.playNoise };
  const tones = [];
  try {
    sound.isReady = () => true; sound.playTone = (...args) => tones.push(args); sound.playNoise = () => {};
    sound.playWhistle(getTrainGameplayProfile('class395').whistleType);
    assert.equal(tones.length, 4); assert.equal(tones[0][1], 440); assert.equal(tones[2][1], 349.23);
  } finally { Object.assign(sound, original); }
});
