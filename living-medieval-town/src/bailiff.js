// src/bailiff.js — the bailiff's campaign: seven days, three errands a day.
// Pure-ish rules + ledger UI. The world (town.js) supplies souls, buildings,
// fire/thief/bell effects and the clock through the `world` object.

export const DAYS = [
  { id: "monday", name: "Monday", theme: "market day", blurb: "The stalls go up at dawn. The reeve wants every penny counted." },
  { id: "tuesday", name: "Tuesday", theme: "tithe day", blurb: "One sheaf in ten to Saint Brannoc's. Somebody always forgets." },
  { id: "wednesday", name: "Wednesday", theme: "fire drill", blurb: "Dry thatch and a hot summer. The reeve orders a drill." },
  { id: "thursday", name: "Thursday", theme: "feast day", blurb: "The keep pays for the ale tonight. There is a great deal to fetch." },
  { id: "friday", name: "Friday", theme: "the thief", blurb: "A hooded figure was seen by the west gate. Double the watch." },
  { id: "saturday", name: "Saturday", theme: "fair day", blurb: "Half the shire is inside the walls. Keep the peace, mind the braziers." },
  { id: "sunday", name: "Sunday", theme: "mass", blurb: "Bells at eight, the procession at ten. Then, at last, rest." },
];

export const REWARD = { find: 12, message: 15, fire: 25, thief: 40, visit: 10, allThree: 10 };
export const DAY_START = 6;
export const SAVE_KEY = "stagsmere.campaign.v1";

export const RANKS = [
  { min: 340, title: "Reeve of Stagsmere", line: "The parish would follow you into the mere." },
  { min: 220, title: "Trusted Bailiff", line: "Doors open before you knock." },
  { min: 110, title: "Bailiff", line: "Honest work, honestly done." },
  { min: 0, title: "Apprentice Bailiff", line: "The lanes are long and the week was short." },
];

export function rankFor(favour) {
  return RANKS.find((r) => favour >= r.min) || RANKS[RANKS.length - 1];
}

export function fmtHour(h) {
  const H = Math.floor(h) % 24;
  const M = Math.round((h % 1) * 60) % 60;
  return String(H).padStart(2, "0") + ":" + String(M).padStart(2, "0");
}

export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (s && s.v === 1 && typeof s.day === "number") return s;
  } catch { /* ignore */ }
  return null;
}
export function writeSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
export function freshSave() {
  return { v: 1, day: 0, days: {}, complete: false };
}
export function totalFavour(save) {
  return Object.values(save.days).reduce((a, d) => a + (d.favour || 0), 0);
}

// ---------------------------------------------------------------- errands
// An errand definition is plain data; `status` is pending | open | done | lost.
function E(type, fields) {
  return { type, status: "pending", ...fields };
}

// Day factories: pick concrete souls/buildings from the world at day start.
function dayErrands(dayI, w) {
  const soul = (role, i = 0) => {
    const list = w.souls.filter((s) => s.role === role && !s.notable);
    return list[i % Math.max(1, list.length)] || w.souls[0];
  };
  const notable = (name) => w.souls.find((s) => s.name === name) || w.souls[0];
  const near = (kind, dist, skip = []) => {
    const well = w.places.well;
    const list = w.buildings
      .filter((b) => b.kind === kind && !skip.includes(b) && b.roofs.length && Math.hypot(b.x - well.x, b.z - well.z) < dist)
      .sort((a, b) => Math.hypot(a.x - well.x, a.z - well.z) - Math.hypot(b.x - well.x, b.z - well.z));
    return list[0] || w.buildings.find((b) => b.kind === kind && b.roofs.length);
  };
  const byKind = (kind) => w.buildings.find((b) => b.kind === kind);

  switch (dayI) {
    case 0: {
      const chap = soul("merchant", 0), cask = soul("merchant", 1), kid = soul("child", 0);
      return [
        E("find", { target: chap, by: 11.5, title: `Find ${chap.name}`, why: "has not paid the stall-penny. Catch him before the noon trade." }),
        E("message", { from: notable("Nell of the Stag"), to: cask, by: 17, title: `Word from Nell to ${cask.name}`, why: "three casks wanted at the Stag before the evening rush." }),
        E("find", { target: kid, by: 16.5, title: `Find ${kid.name}`, why: "a child lost sight of in the market crowd. The mother is frantic." }),
      ];
    }
    case 1: {
      const croft = soul("farmer", 2);
      return [
        E("message", { from: notable("Father Aldous"), to: notable("Lady Isolde"), by: 13, title: "The tithe roll to Lady Isolde", why: "Father Aldous has the roll ready for her seal." }),
        E("find", { target: notable("Marta Miller"), by: 14, title: "Find Marta Miller", why: "the mill owes a sack of flour to the church." }),
        E("find", { target: croft, by: 18, title: `Find ${croft.name}`, why: "the croft has not tithed since Lady Day." }),
      ];
    }
    case 2: {
      const drill = near("house", 24);
      const oven = byKind("bakery") || near("house", 30, [drill]);
      return [
        E("fire", { building: drill, at: 8.5, buckets: 4, burnHours: 2.6, drill: true, title: `Fire drill at the ${drill.name}`, why: "the reeve's drill. Run buckets from the well to the roof." }),
        E("find", { target: notable("Captain Rowe"), by: 13, title: "Find Captain Rowe", why: "the well rope frayed during the drill; the watch must inspect it." }),
        E("fire", { building: oven, at: 18, buckets: 6, burnHours: 2.4, title: `Fire at the ${oven.name}`, why: "a spark from the oven. This one is real." }),
      ];
    }
    case 3: {
      const fisher = soul("fisher", 0);
      return [
        E("message", { from: notable("Lady Isolde"), to: notable("Nell of the Stag"), by: 12, title: "Lady Isolde's word to Nell", why: "the keep will pay for tonight's ale." }),
        E("find", { target: notable("Hob Smith"), by: 13.5, title: "Find Hob Smith", why: "the roasting spit wants mending before the feast." }),
        E("find", { target: fisher, by: 11.5, title: `Find ${fisher.name}`, why: "the catch for the feast must come up from the mere by noon." }),
      ];
    }
    case 4: {
      const guard = soul("guard", 1), elder = soul("elder", 0);
      return [
        E("message", { from: notable("Captain Rowe"), to: guard, by: 18, title: `Captain Rowe's word to ${guard.name}`, why: "double the watch tonight." }),
        E("find", { target: elder, by: 17, title: `Find ${elder.name}`, why: "saw a hooded figure by the west gate. Hear the account." }),
        E("thief", { at: 20.5, leaveAt: 23.7, title: "Catch the thief", why: "he comes by the west gate after dark and ducks into alleys. Follow him; click when he stops." }),
      ];
    }
    case 5: {
      const herd = soul("herd", 0), chap = soul("merchant", 2);
      const stall = near("stall", 12);
      return [
        E("find", { target: herd, by: 10.5, title: `Find ${herd.name}`, why: "the sheep are loose on the fair-ground." }),
        E("fire", { building: stall, at: 14, buckets: 5, burnHours: 1.8, title: "Brazier fire at the fair", why: "a brazier tipped under a stall cloth. Quick, the well is close." }),
        E("message", { from: chap, to: notable("Hob Smith"), by: 17, title: `Word from ${chap.name} to Hob Smith`, why: "the prize-ring wants a new pin before the wrestling." }),
      ];
    }
    default: {
      return [
        E("visit", { building: byKind("church"), from: 7.5, to: 8.6, title: "Toll the bell for mass", why: "click Saint Brannoc's between half past seven and half past eight." }),
        E("find", { target: notable("Father Aldous"), from: 10, by: 11.2, title: "Walk with the procession", why: "find Father Aldous at the market cross between ten and eleven." }),
        E("message", { from: notable("Lady Isolde"), to: notable("Father Aldous"), by: 17, title: "Lady Isolde's thanks to the vicar", why: "the keep's thanks for the week, to be read at vespers." }),
      ];
    }
  }
}

// ---------------------------------------------------------------- campaign
export class Campaign {
  constructor(world) {
    this.w = world;
    this.save = loadSave() || freshSave();
    this.active = false;
    this.dayI = 0;
    this.errands = [];
    this.dayFavour = 0;
    this.ended = false;
    this._uiT = 0;
  }

  get day() { return DAYS[this.dayI]; }
  get total() { return totalFavour(this.save); }

  doneCount() { return this.errands.filter((e) => e.status === "done").length; }
  resolvedCount() { return this.errands.filter((e) => e.status === "done" || e.status === "lost").length; }

  startDay(i) {
    this.dayI = Math.max(0, Math.min(DAYS.length - 1, i));
    this.active = true;
    this.ended = false;
    this.dayFavour = 0;
    this.errands = dayErrands(this.dayI, this.w);
    for (const e of this.errands) {
      if (e.type === "find" || e.type === "message" || e.type === "visit") e.status = "open";
      e.thrown = 0; e.cool = 0; e.carried = false;
    }
    this.save.day = this.dayI;
    writeSave(this.save);
    this.w.beginDay(this.dayI, this.day);
    this.w.toast(`${this.day.name} · ${this.day.theme}`, "day");
    this.render(true);
  }

  // -- clicks -------------------------------------------------------------
  clickSoul(s) {
    if (!this.active || this.ended) return false;
    const h = this.w.hour();
    let handled = false;
    for (const e of this.errands) {
      if (e.status !== "open") continue;
      if (e.type === "find" && e.target === s) {
        if (e.from != null && h < e.from) { this.w.toast(`Not yet — ${e.why}`, "soft"); return true; }
        this.complete(e, `${s.name} found.`);
        handled = true;
      } else if (e.type === "message") {
        if (!e.carried && e.from === s) {
          e.carried = true;
          this.w.toast(`${s.name} gives you the message. Now find ${e.to.name}.`, "soft");
          this.w.sfx("take");
          this.w.pulse(s.px, s.pz);
          this.render(true);
          handled = true;
        } else if (!e.carried && e.to === s) {
          this.w.toast(`${s.name} waits — you have no word from ${e.from.name} yet.`, "soft");
          handled = true;
        } else if (e.carried && e.to === s) {
          this.complete(e, `Message delivered to ${s.name}.`);
          handled = true;
        }
      }
    }
    return handled;
  }

  clickBuilding(b) {
    if (!this.active || this.ended) return false;
    const h = this.w.hour();
    for (const e of this.errands) {
      if (e.status !== "open") continue;
      if (e.type === "fire" && e.building === b) {
        if (e.cool > 0) return true;
        e.thrown++;
        e.cool = 0.55;
        this.w.douse(b, e.thrown / e.buckets);
        this.w.sfx("bucket");
        if (e.thrown >= e.buckets) {
          this.w.endFire(b, { burnt: false });
          this.complete(e, e.drill ? "Drill done. The reeve nods." : `The ${b.name} is saved.`);
        } else this.render(true);
        return true;
      }
      if (e.type === "visit" && e.building === b) {
        if (h < e.from) { this.w.toast("Too early — the vicar is still at matins.", "soft"); return true; }
        this.w.ringBell(6);
        this.complete(e, "The bell tolls for mass.");
        return true;
      }
    }
    return false;
  }

  clickThief(lurking) {
    if (!this.active || this.ended) return false;
    const e = this.errands.find((x) => x.type === "thief" && x.status === "open");
    if (!e) return false;
    if (lurking) {
      this.w.catchThief();
      this.complete(e, "Caught in the alley. The watch takes him.");
    } else {
      this.w.toast("Too quick — he slips on. Wait until he ducks into an alley.", "soft");
    }
    return true;
  }

  complete(e, line) {
    e.status = "done";
    const gain = REWARD[e.type] || 10;
    this.dayFavour += gain;
    this.w.toast(`${line} +${gain} favour`, "good");
    this.w.sfx(e.type === "thief" ? "caught" : "done");
    this.render(true);
    this.maybeAutoEnd();
  }

  lose(e, line) {
    e.status = "lost";
    this.w.toast(line, "bad");
    this.w.sfx("lost");
    this.render(true);
    this.maybeAutoEnd();
  }

  maybeAutoEnd() {
    if (this.resolvedCount() >= this.errands.length) this.endDay("all errands answered");
  }

  // -- clock ----------------------------------------------------------------
  tick(dt) {
    if (!this.active || this.ended) return;
    const h = this.w.hour();
    for (const e of this.errands) {
      if (e.type === "fire") {
        if (e.status === "pending" && h >= e.at) {
          e.status = "open";
          this.w.startFire(e.building, e);
          this.w.toast(`${e.drill ? "Drill" : "Fire"} at the ${e.building.name}!`, "bad");
          this.w.sfx("alarm");
          this.render(true);
        } else if (e.status === "open") {
          e.cool = Math.max(0, e.cool - dt);
          if (h >= e.at + e.burnHours) {
            this.w.endFire(e.building, { burnt: !e.drill });
            this.lose(e, e.drill ? "The drill ran out of daylight." : `The ${e.building.name} burns to the sill.`);
          }
        }
      } else if (e.type === "thief") {
        if (e.status === "pending" && h >= e.at) {
          e.status = "open";
          this.w.spawnThief();
          this.w.toast("The watch: a hooded figure at the west gate.", "bad");
          this.w.sfx("alarm");
          this.render(true);
        } else if (e.status === "open") {
          if (this.w.thiefEscaped() || h >= e.leaveAt) {
            this.w.removeThief();
            this.lose(e, "He is over the wall and gone.");
          }
        }
      } else if (e.status === "open" && e.by != null && h >= e.by) {
        this.lose(e, `${e.title} — too late.`);
      }
    }
    this._uiT += dt;
    if (this._uiT > 0.4) { this._uiT = 0; this.render(false); }
  }

  hourWrapped() {
    if (!this.active || this.ended) return;
    this.endDay("midnight");
  }

  // -- day flow -------------------------------------------------------------
  canEnd() { return this.active && !this.ended && this.doneCount() >= 2; }

  endDay(reason) {
    if (this.ended) return;
    this.ended = true;
    const done = this.doneCount();
    if (done >= this.errands.length) this.dayFavour += REWARD.allThree;
    const prev = this.save.days[this.dayI];
    if (!prev || prev.favour < this.dayFavour) {
      this.save.days[this.dayI] = { favour: this.dayFavour, done: this.errands.map((e) => e.status === "done") };
    }
    const last = this.dayI >= DAYS.length - 1;
    if (last) this.save.complete = true;
    else this.save.day = Math.max(this.save.day, this.dayI + 1);
    writeSave(this.save);
    this.w.removeThief();
    this.w.showSummary({
      day: this.day, reason, errands: this.errands, dayFavour: this.dayFavour,
      allThree: done >= this.errands.length, total: this.total, last, rank: rankFor(this.total),
    });
    this.render(true);
  }

  nextDay() {
    if (this.dayI >= DAYS.length - 1) return false;
    this.startDay(this.dayI + 1);
    return true;
  }

  stop() {
    this.active = false;
    this.ended = false;
    this.errands = [];
    this.w.removeThief();
    this.render(true);
  }

  unlockedDays() {
    const n = this.save.complete ? DAYS.length : Math.min(DAYS.length, this.save.day + 1);
    return DAYS.map((d, i) => ({ ...d, i, unlocked: i < n, result: this.save.days[i] || null }));
  }

  // -- ledger UI -----------------------------------------------------------
  hintFor(e) {
    const h = this.w.hour();
    if (e.status === "done") return "done";
    if (e.status === "lost") return "lost";
    if (e.type === "find") {
      const t = e.target;
      const where = t.inside ? `${t.act} — indoors, lift a roof` : t.act || "abroad";
      const win = e.from != null && h < e.from ? `from ${fmtHour(e.from)} · ` : "";
      return `${win}by ${fmtHour(e.by)} · said to be ${where}`;
    }
    if (e.type === "message") {
      const t = e.carried ? e.to : e.from;
      const where = t.inside ? `${t.act} — indoors` : t.act || "abroad";
      return `${e.carried ? "deliver to" : "first find"} ${t.name} · by ${fmtHour(e.by)} · ${where}`;
    }
    if (e.type === "fire") {
      if (e.status === "pending") return `expected ${fmtHour(e.at)}`;
      const left = Math.max(0, e.at + e.burnHours - h);
      const bucket = e.cool > 0 ? "filling the bucket…" : "bucket full — click the roof";
      return `buckets ${e.thrown}/${e.buckets} · ${bucket} · ${Math.ceil(left * 60)} min left`;
    }
    if (e.type === "thief") {
      if (e.status === "pending") return `after ${fmtHour(e.at)}`;
      const st = this.w.thiefState();
      return st === "lurking" ? "he has stopped in an alley — now!" : st === "walking" ? "walking the lanes…" : "not yet seen";
    }
    if (e.type === "visit") return `between ${fmtHour(e.from)} and ${fmtHour(e.to)}`;
    return "";
  }

  render(full) {
    const box = this.w.el("errands");
    if (!box) return;
    box.hidden = !this.active;
    if (!this.active) return;
    if (full) {
      this.w.el("dayName").textContent = `${this.day.name} · ${this.day.theme}`;
      const ol = this.w.el("tasks");
      ol.innerHTML = "";
      for (const e of this.errands) {
        const li = document.createElement("li");
        li.className = "task " + e.status;
        li.innerHTML = `<span class="mark"></span><span class="ttl"></span><span class="sub"></span>`;
        li.querySelector(".ttl").textContent = e.title;
        li.title = e.why;
        e.li = li;
        ol.appendChild(li);
      }
      const btn = this.w.el("btnEndDay");
      btn.hidden = !this.canEnd();
    }
    for (const e of this.errands) {
      if (!e.li) continue;
      e.li.className = "task " + e.status;
      e.li.querySelector(".mark").textContent = e.status === "done" ? "✓" : e.status === "lost" ? "✗" : e.status === "pending" ? "·" : "○";
      e.li.querySelector(".sub").textContent = this.hintFor(e);
    }
    this.w.el("favourN").textContent = String(this.total + (this.ended ? 0 : this.dayFavour));
    this.w.el("btnEndDay").hidden = !this.canEnd();
  }
}
