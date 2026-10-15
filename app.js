// PricePro Sell Your Car · v8. Front-end complete; every answer comes from window.PPApi
// (mock-api.js), a simulated backend with the same shape the real services will have.
// Tool flow (one question per screen):
//   find → car → miles → color → email → range ─┬─ acc → lights → loan → other → contact → done
//                                                └─ rangeonly (email updates, no calls)
//   text arrives (toast) → offer → visit → booked
// The phones in "How it works" (demo.js) replay these same screens with the same helpers.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const API = window.PPApi;

  // ---------- review notes ----------
  const rt = $('#reviewToggle');
  $('#noteCount').textContent = $$('[data-note]').length;
  rt.addEventListener('click', () => {
    const on = document.body.classList.toggle('review');
    rt.setAttribute('aria-pressed', on);
    rt.firstElementChild.textContent = on ? 'Hide review notes' : 'Show review notes';
  });

  // ---------- shared render helpers (also used by the phone demos) ----------
  const SILHOUETTE = {
    suv: '<path d="M12 84V62c0-8 6-12 14-13l26-2 18-24c4-5 9-7 16-7h104c9 0 15 4 19 11l12 22c9 2 15 8 15 17v18z" fill="#2b2c31"/><path d="M78 26h46v22H62zM132 26h52c5 0 8 2 10 6l8 16h-70z" fill="#9aa3ad" opacity=".55"/>',
    sedan: '<path d="M10 84v-8c0-10 8-16 20-18l40-6c12-14 26-22 50-22h30c18 0 32 10 46 22l18 4c12 2 18 10 18 20v8z" fill="#2b2c31"/><path d="M84 50c10-10 20-14 36-14h8v16zM136 36h14c12 0 22 6 30 16h-44z" fill="#9aa3ad" opacity=".55"/>',
  };
  function carImg(car) {
    if (car.body === 'truck') return { src: 'assets/truck.png', alt: car.name };
    const body = SILHOUETTE[car.body] || SILHOUETTE.suv;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 110">${body}<circle cx="62" cy="86" r="17" fill="#111"/><circle cx="62" cy="86" r="7" fill="#9b9ea4"/><circle cx="186" cy="86" r="17" fill="#111"/><circle cx="186" cy="86" r="7" fill="#9b9ea4"/></svg>`;
    return { src: 'data:image/svg+xml,' + encodeURIComponent(svg), alt: car.name };
  }
  function bind(root, key, val) {
    $$(`[data-bind="${key}"]`, root).forEach(el => {
      if (el.tagName === 'IMG') { el.src = val.src; el.alt = val.alt; } else el.textContent = val;
    });
  }
  const nb = t => t.replace(/-/g, '\u2011');              // non-breaking hyphen keeps "F-150" together
  function paintCar(root, car) {
    bind(root, 'carName', nb(car.name));
    bind(root, 'carSub', car.sub);
    bind(root, 'carImg', carImg(car));
    bind(root, 'rangeCar', car.name);
  }
  // numbers roll in like an odometer
  function odo(el, value, baseDelay) {
    const txt = money(value);
    el.innerHTML = '';
    const wrap = document.createElement('span'); wrap.className = 'odo';
    let k = 0;
    for (const ch of txt) {
      if (/\d/.test(ch)) {
        const col = document.createElement('span'); col.className = 'col';
        const strip = document.createElement('span'); strip.className = 'strip';
        strip.innerHTML = Array.from({ length: 10 }, (_, n) => `<i>${n}</i>`).join('');
        strip.style.setProperty('--d', (baseDelay + k * 90) + 'ms');
        col.appendChild(strip); wrap.appendChild(col); k++;
        requestAnimationFrame(() => requestAnimationFrame(() => { strip.style.transform = `translateY(-${+ch}em)`; }));
      } else {
        const sym = document.createElement('span'); sym.className = 'sym'; sym.textContent = ch; wrap.appendChild(sym);
      }
    }
    el.appendChild(wrap);
    el.setAttribute('aria-label', txt);
  }
  function renderRange(root, r) {
    const fill = $('[data-bind="rFill"]', root), lo = $('[data-bind="rLow"]', root), hi = $('[data-bind="rHigh"]', root);
    fill.style.transition = 'none'; fill.style.right = '85%'; void fill.offsetWidth; fill.style.transition = '';
    requestAnimationFrame(() => { fill.style.right = '15%'; });
    if (reduce) { lo.textContent = money(r.low); hi.textContent = money(r.high); return; }
    odo(lo, r.low, 150);
    odo(hi, r.high, 450);
  }
  function renderOffer(root, amount) {
    const el = $('[data-bind="offerAmt"]', root);
    if (reduce) el.textContent = money(amount); else odo(el, amount, 200);
  }
  // a button that is waiting on the backend
  function busy(btn, label) {
    const html = btn.innerHTML;
    btn.disabled = true; btn.classList.add('busy');
    btn.innerHTML = `<span class="spin" aria-hidden="true"></span>${label}`;
    return () => { btn.disabled = false; btn.classList.remove('busy'); btn.innerHTML = html; };
  }
  function dayButtons(box, days, picked, onPick) {
    box.innerHTML = '';
    days.forEach(d => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.key = d.key; b.setAttribute('aria-pressed', d.key === picked);
      b.innerHTML = `<b>${d.day}</b>${d.date}`;
      b.addEventListener('click', () => { $$('button', box).forEach(x => x.setAttribute('aria-pressed', x === b)); onPick && onPick(d); });
      box.appendChild(b);
    });
  }
  function timeButtons(box, day, picked, onPick) {
    box.innerHTML = '';
    day.times.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = t.t; b.disabled = !t.open; b.setAttribute('aria-pressed', t.t === picked);
      b.addEventListener('click', () => { $$('button', box).forEach(x => x.setAttribute('aria-pressed', x === b)); onPick && onPick(t.t); });
      box.appendChild(b);
    });
  }
  const PROGRESS = { find: 8, car: 18, miles: 30, color: 40, email: 50, range: 60, acc: 68, lights: 75, loan: 82, other: 88, contact: 95, done: 100, rangeonly: 100, offer: 100, visit: 100, booked: 100 };
  window.PPFlow = { $, $$, money, odo, bind, paintCar, carImg, renderRange, renderOffer, busy, dayButtons, timeButtons, PROGRESS, reduce };

  // ---------- state ----------
  const S = { car: null, miles: 45000, color: '', email: '', zip: '', range: null, answers: {}, first: '', last: '', phone: '', offer: null, days: null, slot: '', time: '', mode: '' };

  // ---------- sheet ----------
  const sheet = $('#sheet');
  const back = $('#sheetBack');
  const hist = [];
  let cur = null;
  let lastFocus = null;

  function show(name, dir = 'fwd') {
    $$('.screen', sheet).forEach(s => {
      const on = s.dataset.screen === name;
      s.hidden = !on;
      if (on) { s.classList.toggle('back', dir === 'back'); void s.offsetWidth; }
    });
    cur = name;
    $('.sheet').scrollTop = 0;
    $('#progBar').style.width = (PROGRESS[name] || 10) + '%';
    back.disabled = hist.length === 0 || ['done', 'rangeonly', 'offer', 'booked'].includes(name);
    if (name === 'range' && S.range) renderRange(sheet, S.range);
    if (name === 'offer' && S.offer) renderOffer(sheet, S.offer.amount);
    if (name === 'visit') loadVisit();
    const f = $(`.screen[data-screen="${name}"] input:not([type=hidden])`, sheet);
    if (f && !reduce) setTimeout(() => f.focus({ preventScroll: true }), 60);
  }
  function go(name) { if (cur && cur !== name) hist.push(cur); show(name); }
  function open(start) {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
    if (start) { hist.length = 0; show(start); }
    else if (!cur) show('find');
  }
  function close() {
    sheet.hidden = true;
    document.body.style.overflow = '';
    if (['done', 'rangeonly', 'booked'].includes(cur)) { hist.length = 0; cur = null; }
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  back.addEventListener('click', () => { if (hist.length) show(hist.pop(), 'back'); });
  $$('[data-close]').forEach(b => b.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) close(); });

  // openers anywhere on the page: data-open="find-plate|find-vin|find-ymm"
  $$('[data-open]').forEach(b => b.addEventListener('click', e => {
    e.preventDefault();
    const pane = b.dataset.open.split('-')[1] || 'plate';
    setPane(pane);
    open('find');
  }));

  function setCar(car) { S.car = car; paintCar(sheet, car); }

  // hero plate form → look it up, then straight to "is this your car?"
  const plate = $('#plate');
  plate.addEventListener('input', () => { plate.value = plate.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ''); $('#starterErr').textContent = ''; });
  $('#starter').addEventListener('submit', async e => {
    e.preventDefault();
    if (plate.value.replace(/\s/g, '').length < 2) { $('#starterErr').textContent = 'Type your plate number first, or use your VIN below.'; plate.focus(); return; }
    $('#plate2').value = plate.value; $('#state2').value = $('#state').value;
    const done = busy($('#starter button[type=submit]'), 'Finding your car');
    const res = await API.lookupPlate(plate.value, $('#state').value);
    done();
    if (!res.ok) { $('#starterErr').textContent = res.message; return; }
    setCar(res.car);
    open(); hist.length = 0; hist.push('find'); show('car');
  });

  // ---------- find screen ----------
  let pane = 'plate';
  function setPane(p) {
    pane = p;
    $$('[data-find]', sheet).forEach(t => t.setAttribute('aria-selected', t.dataset.find === p));
    $$('.find-pane', sheet).forEach(x => { x.hidden = x.dataset.pane !== p; });
    $('#errFind').textContent = '';
  }
  $$('[data-find]', sheet).forEach(t => t.addEventListener('click', () => setPane(t.dataset.find)));
  $('#plate2').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ''); });
  $('#vin').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); $('#vinCount').textContent = e.target.value.length; });
  $('#year').innerHTML = '<option value="">Year</option>' + Array.from({ length: 27 }, (_, i) => `<option>${2026 - i}</option>`).join('');
  $('#make').innerHTML += ['Acura','Audi','BMW','Buick','Cadillac','Chevrolet','Chrysler','Dodge','Ford','GMC','Honda','Hyundai','Jeep','Kia','Lexus','Lincoln','Mazda','Mercedes-Benz','Nissan','Ram','Subaru','Tesla','Toyota','Volkswagen','Volvo','Other'].map(m => `<option>${m}</option>`).join('');
  $('#findGo').addEventListener('click', async () => {
    const err = m => { $('#errFind').textContent = m; };
    let call;
    if (pane === 'plate') {
      if ($('#plate2').value.replace(/\s/g, '').length < 2) return err('Type your plate number.');
      call = () => API.lookupPlate($('#plate2').value, $('#state2').value);
    } else if (pane === 'vin') {
      const v = $('#vin').value;
      if (v.length !== 17) return err(`A VIN has 17 characters. You have ${v.length}.`);
      if (/[IOQ]/.test(v)) return err('VINs never use I, O or Q. Check for 1 and 0.');
      call = () => API.decodeVin(v);
    } else {
      if (!$('#year').value || !$('#make').value || !$('#model').value.trim()) return err('Pick the year and make, and type the model.');
      call = () => API.fromList($('#year').value, $('#make').value, $('#model').value);
    }
    err('');
    const done = busy($('#findGo'), 'Finding your car');
    const res = await call();
    done();
    if (!res.ok) { if (pane === 'plate') setPane('vin'); return err(res.message); }
    setCar(res.car);
    go('car');
  });

  // ---------- generic navigation ----------
  $$('[data-go]', sheet).forEach(b => b.addEventListener('click', async () => {
    if (b.dataset.fix) setPane(b.dataset.fix);
    if (b.dataset.go === 'rangeonly') {
      bind(sheet, 'email', S.email || 'your email');
      const done = busy(b, 'Saving');
      await API.saveRangeOnly({ email: S.email, zip: S.zip, car: S.car, range: S.range });
      done();
    }
    if (b.dataset.go === 'acc' && cur === 'rangeonly') hist.length = 0;
    go(b.dataset.go);
  }));

  // tap-to-answer screens: pick highlights, then auto-advance
  $$('[data-pick]', sheet).forEach(group => {
    group.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn || !group.contains(btn)) return;
      $$('button', group).forEach(x => x.classList.toggle('picked', x === btn));
      const key = group.dataset.pick, val = btn.dataset.val;
      if (key === 'miles') S.miles = +val;
      else if (key === 'color') S.color = val;
      else if (key === 'mode') return setMode(val);
      else S.answers[key] = val;
      if (key === 'other') {
        $('#otherAmt').hidden = val !== 'yes';
        if (val === 'yes') { setTimeout(() => $('#otherOffer').focus(), 80); return; }
        return setTimeout(() => go('contact'), reduce ? 0 : 260);
      }
      if (group.dataset.next) setTimeout(() => go(group.dataset.next), reduce ? 0 : 260);
    });
  });
  $('#otherOffer').addEventListener('input', e => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 7);
    e.target.value = d ? money(+d) : '';
    S.answers.otherOffer = +d || 0;
  });

  // ---------- email → range ----------
  $('#zip').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
  $('#emailGo').addEventListener('click', async () => {
    if (!/^\S+@\S+\.\S+$/.test($('#email').value)) return ($('#errEmail').textContent = 'Type your email so we can send your range.');
    if (!/^\d{5}$/.test($('#zip').value)) return ($('#errEmail').textContent = 'Type a 5-digit ZIP code.');
    $('#errEmail').textContent = '';
    S.email = $('#email').value; S.zip = $('#zip').value;
    const done = busy($('#emailGo'), 'Checking the market');
    S.range = await API.estimateRange({ car: S.car, miles: S.miles, color: S.color, zip: S.zip });
    done();
    go('range');
  });

  // ---------- contact → done ----------
  $('#phone').addEventListener('input', e => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 10);
    e.target.value = d.length > 6 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : d;
  });
  $('#contactGo').addEventListener('click', async () => {
    const err = m => { $('#errContact').textContent = m; };
    if (!$('#first').value.trim()) return err('Type your first name.');
    if (!$('#last').value.trim()) return err('Type your last name.');
    if ($('#phone').value.replace(/\D/g, '').length !== 10) return err('Type a 10-digit mobile number.');
    err('');
    S.first = $('#first').value.trim(); S.last = $('#last').value.trim(); S.phone = $('#phone').value;
    const done = busy($('#contactGo'), 'Sending to a buyer');
    const res = await API.requestOffer({ car: S.car, miles: S.miles, color: S.color, zip: S.zip, email: S.email, range: S.range, answers: S.answers, first: S.first, last: S.last, phone: S.phone });
    done();
    S.offer = res.offer;
    bind(sheet, 'firstName', S.first);
    go('done');
    loadDays($('[data-slots="done"]', sheet), d => { S.slot = d.key; });
    setTimeout(textArrives, res.readyInMs);
  });

  // ---------- the firm offer arrives by text (simulated) ----------
  const toast = $('#ptoast');
  function textArrives() {
    bind(document, 'toastMsg', `Hi ${S.first}, your firm offer for the ${nb(S.car.name)} is ready. Tap to view.`);
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('show'));
  }
  toast.addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => { toast.hidden = true; }, 400);
    open('offer');
  });

  // ---------- visit: drop off or pickup, day, time ----------
  async function loadDays(box, onPick) {
    box.innerHTML = '<p class="hint">Loading open times…</p>';
    S.days = S.days || await API.timeSlots();
    dayButtons(box, S.days, S.slot, onPick);
  }
  function setMode(val) {
    S.mode = val;
    if (val === 'drop') { bind(sheet, 'modeNote', '1671 Toll Gate Dr, Maumee. A buyer walks the car with you.'); return; }
    bind(sheet, 'modeNote', 'Checking pickup for your ZIP…');
    API.pickupQuote(S.zip, true).then(q => {
      if (S.mode !== 'pickup') return;
      bind(sheet, 'modeNote', q.fee === null ? `We'll text you a carrier quote for ${S.zip}.` : q.fee === 0 ? `Pickup is included at ${S.zip}.` : `Pickup at ${S.zip} is ${money(q.fee)}, taken out of your offer.`);
    });
  }
  function loadVisit() {
    $('#errVisit').textContent = '';
    const times = $('[data-times]', sheet);
    const pickDay = d => { S.slot = d.key; S.time = ''; timeButtons(times, d, '', t => { S.time = t; }); };
    loadDays($('[data-slots="visit"]', sheet), pickDay).then(() => {
      const d = S.days.find(x => x.key === S.slot);
      if (d) timeButtons(times, d, S.time, t => { S.time = t; }); else times.innerHTML = '';
    });
  }
  $('#visitGo').addEventListener('click', async () => {
    const err = m => { $('#errVisit').textContent = m; };
    if (!S.mode) return err('Choose drop off or pickup.');
    if (!S.slot) return err('Pick a day.');
    if (!S.time) return err('Pick a time.');
    err('');
    const done = busy($('#visitGo'), 'Booking');
    await API.bookVisit({ slot: S.slot, time: S.time, mode: S.mode, first: S.first, phone: S.phone });
    done();
    const d = S.days.find(x => x.key === S.slot);
    bind(sheet, 'bookedWhen', `${d.day}, ${d.date} at ${S.time}. ${S.mode === 'drop' ? 'See you at 1671 Toll Gate Dr.' : 'We come to you.'} We'll text a reminder.`);
    go('booked');
  });

  // ---------- pickup estimator ----------
  let runs = true;
  $$('[data-runs]').forEach(b => b.addEventListener('click', () => {
    runs = b.dataset.runs === 'yes';
    $$('[data-runs]').forEach(x => x.setAttribute('aria-checked', x === b));
  }));
  $('#estZip').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); $('#estErr').textContent = ''; });
  $('#estGo').addEventListener('click', async () => {
    const z = $('#estZip').value;
    if (!/^\d{5}$/.test(z)) { $('#estOut').classList.remove('show'); $('#estErr').textContent = 'Type a 5-digit ZIP code.'; return; }
    const done = busy($('#estGo'), 'Checking');
    const { fee, zone } = await API.pickupQuote(z, runs);
    done();
    $('#estFee').textContent = fee === null ? 'Quoted by text' : fee === 0 ? 'Included' : money(fee);
    $('#estZone').textContent = zone;
    $('#estNote').textContent = fee === null ? 'We get a carrier quote and text it to you with your offer.'
      : (fee === 0 ? 'Pickup is included in your area.' : 'Comes out of your offer, never billed separately.') + (runs ? '' : ' Includes winch loading.');
    $('#estOut').classList.remove('show'); void $('#estOut').offsetWidth; $('#estOut').classList.add('show');
  });


  // ---------- motion pass 2 ----------
  // Word Rotate in the headline
  const rot = $('#rot');
  const WORDS = ['car?', 'truck?', 'SUV?', 'van?', 'ride?'];
  let wi = 0;
  const fitRot = () => { const w = $('.rw:not(.out)', rot); if (w) rot.style.width = w.offsetWidth + 'px'; };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(fitRot, 900));
  addEventListener('resize', fitRot);
  if (!reduce) setInterval(() => {
    const old = $('.rw:not(.out)', rot);
    wi = (wi + 1) % WORDS.length;
    const nw = document.createElement('span'); nw.className = 'rw in'; nw.textContent = WORDS[wi];
    old.classList.remove('in');          // the outgoing word must only play the exit
    old.classList.add('out');
    rot.appendChild(nw);
    rot.style.width = nw.offsetWidth + 'px';
    old.addEventListener('animationend', () => old.remove(), { once: true });
  }, 2800);

  // Animated grid pattern: light up a handful of hero squares
  const cells = $('#gridCells');
  if (cells && !reduce) {
    const hero = $('.hero');
    const cols = Math.ceil(hero.offsetWidth / 56), rows = Math.ceil(hero.offsetHeight / 56);
    for (let n = 0; n < 18; n++) {
      const d = document.createElement('i'); d.className = 'gc';
      d.style.left = (Math.floor(Math.random() * cols) * 56 + 1) + 'px';
      d.style.top = (Math.floor(Math.random() * rows) * 56 + 1) + 'px';
      d.style.setProperty('--del', (Math.random() * 6).toFixed(2) + 's');
      d.style.setProperty('--dur', (5 + Math.random() * 4).toFixed(2) + 's');
      cells.appendChild(d);
    }
  }

  // Blur Fade: split section headings into words
  function splitWords(el) {
    let i = 0;
    (function walk(node) {
      [...node.childNodes].forEach(ch => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span'); s.className = 'bw'; s.style.setProperty('--i', i++); s.textContent = part;
            frag.appendChild(s);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
      });
    })(el);
    el.classList.add('split');
  }
  if (!reduce) $$('h2.reveal').forEach(splitWords);

  // Spotlight cards
  $$('.wcard, .fcard').forEach(card => {
    card.classList.add('spot');
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  // Container scroll: phones tilt from 3D to flat as the section scrolls in
  const phones = $('.phones');
  if (phones && !reduce) {
    let ticking = false;
    const tilt = () => {
      ticking = false;
      if (innerWidth <= 900) { phones.style.removeProperty('--tilt'); phones.style.removeProperty('--sc'); return; }
      const r = phones.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.75)));
      $$('.phone', phones).forEach(ph => { ph.style.setProperty('--tilt', (24 * (1 - p)).toFixed(2) + 'deg'); ph.style.setProperty('--sc', (0.9 + 0.1 * p).toFixed(3)); });
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(tilt); } }, { passive: true });
    tilt();
  }

  // Device showcase: side phones fan out as the section scrolls in (demo.js plays the screens)
  const showcaseEl = $('#showcase');
  if (showcaseEl) {
    if (reduce) showcaseEl.style.setProperty('--p', 1);
    else {
      let tk = false;
      const fan = () => {
        tk = false;
        if (innerWidth <= 900) { showcaseEl.style.setProperty('--p', 1); return; }
        const r = showcaseEl.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.7)));
        showcaseEl.style.setProperty('--p', (1 - Math.pow(1 - p, 2)).toFixed(3));
      };
      addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(fan); } }, { passive: true });
      fan();
    }
  }

  // ---------- scroll motion ----------
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: 0.15 });
  $$('.reveal').forEach(el => io.observe(el));

  // chat messages arrive one by one when the chat scrolls into view
  const chat = $('#chatbox');
  new IntersectionObserver(([en], obs) => {
    if (!en.isIntersecting) return;
    $$('.cmsg', chat).forEach((m, i) => setTimeout(() => m.classList.add('in'), reduce ? 0 : 350 + i * 900));
    obs.disconnect();
  }, { threshold: 0.35 }).observe(chat);

  // mascot + mobile sticky CTA appear once the hero form scrolls away
  const mascot = $('#mascot'), sticky = $('#sticky');
  new IntersectionObserver(([en]) => {
    mascot.classList.toggle('show', !en.isIntersecting);
    sticky.classList.toggle('show', !en.isIntersecting);
  }).observe($('#starter'));
})();
