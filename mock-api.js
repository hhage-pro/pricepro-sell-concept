// PricePro Sell Your Car · simulated backend.
// Every call the page makes goes through window.PPApi and returns a Promise, with a
// realistic delay. To go live, replace each function body with a fetch() to the real
// service and keep the return shape. Nothing here leaves the browser.
//
//   lookupPlate(plate, state)   → plate-to-VIN decode service       { ok, car } | { ok:false, message }
//   decodeVin(vin)              → VIN decoder                        { ok, car } | { ok:false, message }
//   fromList(year, make, model) → no call needed, builds the car     { ok, car }
//   estimateRange(input)        → range provider (KBB / Black Book)  { low, high }
//   saveRangeOnly(input)        → DriveCentric "range only" lead     { ok }
//   requestOffer(input)         → DriveCentric "offer request" lead  { leadId, readyInMs, offer }
//   pickupQuote(zip, runs)      → hauling partner / rate table       { fee, zone, note }
//   timeSlots()                 → appointment calendar               [{ key, day, date, times:[{ t, open }] }]
//   bookVisit(input)            → calendar + lead update             { ok, confirmation }
//
// Demo hooks: plate JDR 4821 is always the 2019 F-150 in the photo. Plates starting with
// ZZ come back "not found" so the error screen can be tested.
(function () {
  const speed = { value: 1 };
  const wait = ms => new Promise(r => setTimeout(r, ms * speed.value));
  const jitter = (a, b) => a + Math.random() * (b - a);
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const r100 = n => Math.round(n / 100) * 100;
  const THIS_YEAR = 2026;

  // value = what the car is worth one year old with ~12K miles; dep = yearly loss after that
  const CATALOG = [
    { make: 'Ford', model: 'F-150', trims: ['XLT', 'Lariat', 'STX'], sub: 'SuperCrew 4x4', body: 'truck', value: 38000, dep: 0.89 },
    { make: 'Chevrolet', model: 'Silverado 1500', trims: ['LT', 'RST', 'Custom'], sub: 'Crew Cab 4WD', body: 'truck', value: 37000, dep: 0.89 },
    { make: 'Ram', model: '1500', trims: ['Big Horn', 'Laramie'], sub: 'Crew Cab 4x4', body: 'truck', value: 36000, dep: 0.88 },
    { make: 'Ford', model: 'Escape', trims: ['SE', 'SEL', 'Titanium'], sub: 'AWD', body: 'suv', value: 24000, dep: 0.86 },
    { make: 'Ford', model: 'Explorer', trims: ['XLT', 'Limited'], sub: '4WD', body: 'suv', value: 33000, dep: 0.87 },
    { make: 'Jeep', model: 'Grand Cherokee', trims: ['Laredo', 'Limited'], sub: '4x4', body: 'suv', value: 33000, dep: 0.87 },
    { make: 'Jeep', model: 'Wrangler', trims: ['Sport', 'Sahara'], sub: 'Unlimited 4x4', body: 'suv', value: 34000, dep: 0.9 },
    { make: 'Chevrolet', model: 'Equinox', trims: ['LT', 'LS'], sub: 'AWD', body: 'suv', value: 22000, dep: 0.86 },
    { make: 'Honda', model: 'CR-V', trims: ['EX', 'EX-L', 'LX'], sub: 'AWD', body: 'suv', value: 27000, dep: 0.89 },
    { make: 'Toyota', model: 'RAV4', trims: ['XLE', 'LE'], sub: 'AWD', body: 'suv', value: 28000, dep: 0.9 },
    { make: 'Toyota', model: 'Camry', trims: ['SE', 'LE', 'XSE'], sub: 'Sedan', body: 'sedan', value: 24000, dep: 0.88 },
    { make: 'Honda', model: 'Civic', trims: ['EX', 'Sport', 'LX'], sub: 'Sedan', body: 'sedan', value: 21000, dep: 0.88 },
    { make: 'Nissan', model: 'Rogue', trims: ['SV', 'SL'], sub: 'AWD', body: 'suv', value: 22000, dep: 0.85 },
  ];
  const DEMO_PLATE = 'JDR4821';
  const BODY_BY_MAKE = { Ford: 'suv', Chevrolet: 'suv', Ram: 'truck', GMC: 'truck', Jeep: 'suv', Toyota: 'sedan', Honda: 'sedan', Nissan: 'suv', Hyundai: 'sedan', Kia: 'suv', Subaru: 'suv', Tesla: 'sedan' };

  function makeCar(entry, year, trim, source) {
    const name = `${year} ${entry.make} ${entry.model}${trim ? ' ' + trim : ''}`;
    return { year, make: entry.make, model: entry.model, trim, sub: entry.sub, body: entry.body, value: entry.value, dep: entry.dep, name, source };
  }
  function pick(seed) {
    const entry = CATALOG[seed % CATALOG.length];
    const year = 2015 + (seed >>> 5) % 9;               // 2015–2023
    const trim = entry.trims[(seed >>> 9) % entry.trims.length];
    return { entry, year, trim };
  }

  // 10th VIN character is the model year
  const VIN_YEAR = { F: 2015, G: 2016, H: 2017, J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025 };
  // first 3 characters: maker, and for some prefixes the body type ("make:body")
  const WMI = { '1FT': 'Ford:truck', '1FM': 'Ford:suv', '1FA': 'Ford', '1GC': 'Chevrolet:truck', '3GC': 'Chevrolet:truck', '2GN': 'Chevrolet:suv', '1C6': 'Ram:truck', '3C6': 'Ram:truck', '1C4': 'Jeep', '2HK': 'Honda:suv', '19X': 'Honda:sedan', '2T3': 'Toyota:suv', '4T1': 'Toyota:sedan', '5N1': 'Nissan', 'JN8': 'Nissan' };

  const api = {
    speed,

    async lookupPlate(plate, state) {
      const p = String(plate).toUpperCase().replace(/\s/g, '');
      await wait(jitter(900, 1300));
      if (p.startsWith('ZZ')) return { ok: false, message: `We couldn't find ${plate} in ${state}. Try your VIN, or pick it from the list.` };
      if (p === DEMO_PLATE) return { ok: true, car: makeCar(CATALOG[0], 2019, 'XLT', 'plate') };
      const { entry, year, trim } = pick(hash(p + state));
      return { ok: true, car: makeCar(entry, year, trim, 'plate') };
    },

    async decodeVin(vin) {
      const v = String(vin).toUpperCase();
      await wait(jitter(700, 1100));
      const seed = hash(v);
      const [make, body] = (WMI[v.slice(0, 3)] || '').split(':');
      const matches = CATALOG.filter(c => c.make === make && (!body || c.body === body));
      const options = matches.length ? matches : CATALOG;
      const entry = options[seed % options.length];
      const year = VIN_YEAR[v[9]] || pick(seed).year;
      return { ok: true, car: makeCar(entry, year, entry.trims[(seed >>> 9) % entry.trims.length], 'vin') };
    },

    async fromList(year, make, model) {
      const known = CATALOG.find(c => c.make === make && c.model.toLowerCase() === model.trim().toLowerCase());
      const entry = known || { make, model: model.trim(), trims: [''], sub: 'Trim confirmed at inspection', body: BODY_BY_MAKE[make] || 'suv', value: 26000, dep: 0.87 };
      const car = makeCar(entry, +year, '', 'list');
      car.sub = 'Trim confirmed at inspection';
      return { ok: true, car };
    },

    async estimateRange({ car, miles = 45000, color = '', zip = '' }) {
      await wait(jitter(1300, 1700));
      const age = Math.max(0, THIS_YEAR - car.year);
      let mid = car.value * Math.pow(car.dep, Math.max(0, age - 1));
      mid -= (miles - age * 12000) * 0.06;                       // 6 cents a mile off the yearly norm
      if (color === 'Other') mid *= 0.985;
      if (!/^43[56]/.test(zip)) mid *= 0.99;                      // outside the local ZIPs
      mid = Math.max(1500, mid);
      const spread = age > 8 ? 0.09 : 0.07;
      return { low: r100(mid * (1 - spread)), high: r100(mid * (1 + spread)), mid: r100(mid) };
    },

    async saveRangeOnly() {
      await wait(jitter(500, 800));
      return { ok: true };
    },

    async requestOffer({ range, answers = {} }) {
      await wait(jitter(1100, 1500));
      let amount = range ? range.mid : 15000;
      if (answers.acc === 'one') amount *= 0.94;
      if (answers.acc === 'more') amount *= 0.86;
      if (answers.lights === 'yes') amount *= 0.95;
      return {
        leadId: 'PP-' + (100000 + Math.floor(Math.random() * 900000)),
        readyInMs: 9000 * speed.value,                            // real promise: within 2 business hours
        offer: { amount: r100(amount), validDays: 7 },
      };
    },

    async pickupQuote(zip, runs = true) {
      await wait(jitter(400, 700));
      const p = String(zip).slice(0, 3);
      const LOCAL = ['435', '436'];
      const REGIONAL = ['433', '434', '438', '439', '448', '449', '458', '467', '468', '480', '481', '482', '491', '492'];
      if (LOCAL.includes(p)) return { fee: runs ? 0 : 75, zone: 'Local · up to 25 miles' };
      if (REGIONAL.includes(p)) return { fee: runs ? 149 : 224, zone: 'Regional · 25 to 150 miles' };
      return { fee: null, zone: 'More than 150 miles' };
    },

    async timeSlots() {
      await wait(jitter(300, 500));
      const out = [];
      const d = new Date();
      while (out.length < 3) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() === 0) continue;                           // closed Sunday (to confirm)
        const key = d.toISOString().slice(0, 10);
        out.push({
          key,
          day: d.toLocaleDateString('en-US', { weekday: 'short' }),
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          times: ['10:00 AM', '12:30 PM', '3:00 PM', '5:30 PM'].map((t, i) => ({ t, open: (hash(key + t) % 5) !== 0 || i === 1 })),
        });
      }
      return out;
    },

    async bookVisit({ slot, time, mode }) {
      await wait(jitter(700, 1000));
      return { ok: true, confirmation: 'PP' + (hash(slot + time + mode) % 90000 + 10000) };
    },
  };

  window.PPApi = new Proxy(api, {
    get(target, key) {
      const v = target[key];
      if (typeof v !== 'function') return v;
      return async (...args) => {
        const res = await v.apply(target, args);
        console.info('[PPApi mock]', key, args, res);
        return res;
      };
    },
  });
})();
