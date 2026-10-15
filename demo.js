// "How it works" phones: a self-playing walkthrough of the real tool.
// Each phone holds copies of the actual sheet screens (cloned from #sheet at load), fills
// them with the same helpers (window.PPFlow) and the same simulated backend (window.PPApi),
// and a finger taps through them. Change a screen in index.html and the demo changes with it.
//   Phone 1  Tell us your car   find → car → miles → color
//   Phone 2  See your range     email → range → quick checks → contact → done
//   Phone 3  Your offer, by text  Messages thread → offer → visit → booked
(function () {
  const F = window.PPFlow, API = window.PPApi;
  const { $, $$ } = F;
  const showcase = $('#showcase');
  if (!showcase || !F || !API) return;
  const sheet = $('#sheet');
  const W = 390;                                   // logical width the screens are laid out at (an iPhone)
  const DEMO = { plate: 'JDR 4821', state: 'OH', email: 'jordan.m@email.com', zip: '43537', first: 'Jordan', last: 'Miller', phone: '4195550142' };
  const fmtPhone = d => d.length > 6 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : d;

  // ---------- clock that only runs while the showcase is on screen ----------
  let active = false;
  const wait = ms => new Promise(res => {
    let left = ms, last = performance.now();
    (function tick() {
      const now = performance.now();
      if (active) left -= now - last;
      last = now;
      if (left <= 0) res(); else setTimeout(tick, 40);
    })();
  });

  // ---------- build the phones ----------
  function scrub(root) {
    $$('[id]', root).forEach(e => e.removeAttribute('id'));
    $$('[data-note]', root).forEach(e => e.removeAttribute('data-note'));
  }
  function makeFinger(root) {
    const f = document.createElement('i'); f.className = 'finger'; root.appendChild(f); return f;
  }
  function buildPhone(vp, names) {
    vp.innerHTML = '';
    vp.inert = true;
    const scale = document.createElement('div'); scale.className = 'demo-scale';
    const sh = document.createElement('div'); sh.className = 'demo-sheet';
    sh.appendChild($('.sheet-top', sheet).cloneNode(true));
    names.forEach(n => sh.appendChild($(`.screen[data-screen="${n}"]`, sheet).cloneNode(true)));
    scrub(sh);
    scale.appendChild(sh);
    vp.appendChild(scale);
    return { vp, scale, sheet: sh, finger: makeFinger(scale), dev: vp.closest('.dev') };
  }
  const P1 = buildPhone($('[data-demo="1"]'), ['find', 'car', 'miles', 'color']);
  const P2 = buildPhone($('[data-demo="2"]'), ['email', 'range', 'acc', 'lights', 'loan', 'other', 'contact', 'done']);
  const P3 = buildPhone($('[data-demo="3"]'), ['offer', 'visit', 'booked']);
  const msgs = $('.d3 .dscreen');
  const thread = $('#demoThread');
  const msgFinger = makeFinger(msgs);
  const phones = [P1, P2, P3];

  function fit() {
    phones.forEach(p => {
      const s = p.vp.clientWidth / W;
      if (!s) return;
      p.scale.style.setProperty('--s', s);
      p.scale.style.height = (p.vp.clientHeight / s) + 'px';
    });
  }
  fit();
  addEventListener('resize', fit);

  function dshow(p, name) {
    $$('.screen', p.sheet).forEach(s => { s.hidden = s.dataset.screen !== name; });
    $('.prog i', p.sheet).style.width = (F.PROGRESS[name] || 10) + '%';
    $('.icon-btn', p.sheet).disabled = ['find', 'email', 'offer', 'done', 'booked'].includes(name);
  }
  const scr = (p, name) => $(`.screen[data-screen="${name}"]`, p.sheet);

  // ---------- the finger ----------
  function pos(el, root) {
    let x = el.offsetWidth / 2, y = el.offsetHeight / 2, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y };
  }
  // The finger glides on `translate` and presses on `scale` (separate CSS properties, so pressing
  // never moves it). Travel time grows with distance; it rests on the target before it presses.
  function place(finger, x, y, ms) {
    finger.style.setProperty('--mv', ms + 'ms');
    finger.style.setProperty('--x', x + 'px');
    finger.style.setProperty('--y', y + 'px');
    finger.dataset.x = x; finger.dataset.y = y;
  }
  async function moveTo(finger, root, el) {
    const { x, y } = pos(el, root);
    if (!finger.classList.contains('on')) {
      // enter from just below the target, the way a thumb comes up to the screen
      place(finger, x, y + 70, 0);
      void finger.offsetWidth;
      finger.classList.add('on');
      await wait(40);
      place(finger, x, y, 420);
      await wait(560);
      return;
    }
    const dist = Math.hypot(x - +finger.dataset.x, y - +finger.dataset.y);
    const ms = Math.round(Math.min(820, Math.max(380, 300 + dist * 0.9)));
    place(finger, x, y, ms);
    await wait(ms + 160);
  }
  async function tapIn(finger, root, el) {
    await moveTo(finger, root, el);
    finger.classList.add('press'); el.classList.add('is-press');
    await wait(150);
    finger.classList.remove('press'); el.classList.remove('is-press');
    await wait(180);
  }
  const tap = (p, el) => tapIn(p.finger, p.scale, el);
  async function pick(p, el) { await tap(p, el); $$('button', el.parentElement).forEach(x => x.classList.toggle('picked', x === el)); await wait(300); }
  async function type(p, input, text, fmt = v => v) {
    await tap(p, input);
    const ring = input.closest('.plate-group') || input;
    ring.classList.add('is-focus');
    let v = '';
    for (const ch of text) { v += ch; input.value = fmt(v); await wait(55 + Math.random() * 55); }
    await wait(220);
    ring.classList.remove('is-focus');
  }
  const lift = p => p.finger.classList.remove('on');

  // ---------- floating notes + step cards + mobile carousel follow the story ----------
  const note = (cls, on) => $(`.float-note.${cls}`).classList.toggle('pop', on);
  let touched = 0;
  showcase.addEventListener('pointerdown', () => { touched = Date.now(); }, { passive: true });
  function stage(n, p) {
    $$('.steps3 [data-step]').forEach(c => c.classList.toggle('live', +c.dataset.step === n));
    phones.forEach(x => x.dev.classList.toggle('live', x === p));
    if (p && innerWidth <= 900 && Date.now() - touched > 6000) {
      showcase.scrollTo({ left: p.dev.offsetLeft - (showcase.clientWidth - p.dev.offsetWidth) / 2, behavior: 'smooth' });
    }
  }

  // ---------- data: asked once from the simulated backend, same calls the tool makes ----------
  // fetched in the background while phone 1 starts typing
  let D = null, Dp = null;
  const data = () => Dp || (Dp = (async () => {
    const [car, days] = await Promise.all([API.lookupPlate(DEMO.plate, DEMO.state).then(r => r.car), API.timeSlots()]);
    const range = await API.estimateRange({ car, miles: 45000, color: 'Gray', zip: DEMO.zip });
    const offer = (await API.requestOffer({ car, range, answers: { acc: 'none', lights: 'no', loan: 'no', other: 'no' } })).offer;
    return (D = { car, range, offer, days });
  })());

  // ---------- resting states (what a phone shows before its turn) ----------
  function rest1() {
    dshow(P1, 'find');
    $('.plate', P1.sheet).value = '';
    $$('.picked', P1.sheet).forEach(x => x.classList.remove('picked'));
    note('n1', false);
  }
  function rest2() {
    dshow(P2, 'range');
    $('[data-bind="rLow"]', P2.sheet).textContent = F.money(D.range.low);
    $('[data-bind="rHigh"]', P2.sheet).textContent = F.money(D.range.high);
    $('[data-bind="rFill"]', P2.sheet).style.right = '15%';
  }
  function bubble(cls, html) {
    const b = document.createElement('div');
    b.className = 'mb ' + cls; b.innerHTML = html;
    thread.appendChild(b);
    requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add('show')));
    return b;
  }
  const nb = t => t.replace(/-/g, '\u2011');            // keep "F-150" on one line in bubbles
  const offerText = () => `Hi ${DEMO.first}, your PricePro offer for the ${nb(D.car.name)} is ready.`;
  const card = () => '<div class="oc"><img src="assets/logo-reverse-co.svg" alt=""><span>Your firm offer</span><b>View offer</b></div>';
  function rest3() {
    thread.innerHTML = '<p class="m-time">Today 10:24 AM</p>';
    bubble('in', offerText());
    bubble('card', card());
    P3.vp.classList.remove('open');
    msgFinger.classList.remove('on');
  }

  // ---------- the three scenes ----------
  async function play1() {
    stage(1, P1);
    rest1();
    await wait(700);
    await type(P1, $('.plate', P1.sheet), DEMO.plate);
    const go = $('.pill', scr(P1, 'find'));
    await tap(P1, go);
    const undo = F.busy(go, 'Finding your car');
    await wait(1100);
    await data();
    undo();
    F.paintCar(P1.sheet, D.car);
    dshow(P1, 'car');
    $('.float-note.n1 small').textContent = D.car.name;
    note('n1', true);
    await wait(1300);
    await tap(P1, $('.choice.yes', scr(P1, 'car')));
    dshow(P1, 'miles');
    await wait(700);
    await pick(P1, $('[data-val="45000"]', scr(P1, 'miles')));
    dshow(P1, 'color');
    await wait(700);
    await pick(P1, $('[data-val="Gray"]', scr(P1, 'color')));
    lift(P1);
    await wait(600);
  }

  async function play2() {
    stage(2, P2);
    const em = scr(P2, 'email');
    $$('input', P2.sheet).forEach(i => { i.value = ''; });
    $$('.picked', P2.sheet).forEach(x => x.classList.remove('picked'));
    dshow(P2, 'email');
    await wait(600);
    await type(P2, $('input[type=email]', em), DEMO.email);
    await type(P2, $('input[inputmode=numeric]', em), DEMO.zip);
    const go = $('.pill-red', em);
    await tap(P2, go);
    const undo = F.busy(go, 'Checking the market');
    await wait(1300);
    undo();
    F.paintCar(P2.sheet, D.car);
    dshow(P2, 'range');
    F.renderRange(P2.sheet, D.range);
    await wait(2600);
    await tap(P2, $('[data-go="acc"]', scr(P2, 'range')));
    stage(3, P2);
    dshow(P2, 'acc');
    await wait(500);
    await pick(P2, $('[data-val="none"]', scr(P2, 'acc')));
    dshow(P2, 'lights');
    await wait(500);
    await pick(P2, $('[data-val="no"]', scr(P2, 'lights')));
    dshow(P2, 'loan');
    await wait(500);
    await pick(P2, $('[data-val="no"]', scr(P2, 'loan')));
    dshow(P2, 'other');
    await wait(500);
    await pick(P2, $('[data-val="no"]', scr(P2, 'other')));
    const ct = scr(P2, 'contact');
    dshow(P2, 'contact');
    await wait(500);
    const [first, last, phone] = $$('input', ct);
    await type(P2, first, DEMO.first);
    await type(P2, last, DEMO.last);
    await type(P2, phone, DEMO.phone, fmtPhone);
    const send = $('.pill-red', ct);
    await tap(P2, send);
    const undo2 = F.busy(send, 'Sending to a buyer');
    await wait(1200);
    undo2();
    F.bind(P2.sheet, 'firstName', DEMO.first);
    F.dayButtons($('[data-slots]', scr(P2, 'done')), D.days, '');
    dshow(P2, 'done');
    lift(P2);
    await wait(1800);
  }

  async function play3() {
    stage(3, P3);
    thread.innerHTML = '<p class="m-time">Today 10:24 AM</p>';
    P3.vp.classList.remove('open');
    note('n3', false);
    await wait(700);
    const dots = bubble('in typing', '<i></i><i></i><i></i>');
    await wait(1300);
    dots.remove();
    bubble('in', offerText());
    await wait(600);
    const c = bubble('card', card());
    note('n3', true);
    await wait(1200);
    await tapIn(msgFinger, msgs, $('.oc b', c));
    msgFinger.classList.remove('on');

    // the link opens the offer screen
    F.paintCar(P3.sheet, D.car);
    dshow(P3, 'offer');
    $$('.picked', P3.sheet).forEach(x => x.classList.remove('picked'));
    F.bind(P3.sheet, 'modeNote', ' ');
    $('[data-times]', P3.sheet).innerHTML = '';
    P3.vp.classList.add('open');
    await wait(500);
    F.renderOffer(P3.sheet, D.offer.amount);
    await wait(2400);
    await tap(P3, $('[data-go="visit"]', scr(P3, 'offer')));
    const vs = scr(P3, 'visit');
    F.dayButtons($('[data-slots]', vs), D.days, '');
    dshow(P3, 'visit');
    await wait(600);
    await pick(P3, $('[data-val="drop"]', vs));
    F.bind(P3.sheet, 'modeNote', '1671 Toll Gate Dr, Maumee. A buyer walks the car with you.');
    await wait(300);
    const day = $('[data-slots] button', vs);
    await tap(P3, day);
    day.setAttribute('aria-pressed', 'true');
    const times = $('[data-times]', vs);
    F.timeButtons(times, D.days[0], '');
    await wait(400);
    const slot = $$('button', times).find(b => b.textContent === '12:30 PM');
    await tap(P3, slot);
    slot.setAttribute('aria-pressed', 'true');
    const confirm = $('.pill-red', vs);
    await tap(P3, confirm);
    const undo = F.busy(confirm, 'Booking');
    await wait(900);
    undo();
    F.bind(P3.sheet, 'firstName', DEMO.first);
    F.bind(P3.sheet, 'bookedWhen', `${D.days[0].day}, ${D.days[0].date} at 12:30 PM. See you at 1671 Toll Gate Dr. We'll text a reminder.`);
    dshow(P3, 'booked');
    lift(P3);
    await wait(2000);

    // back to Messages: the confirmation lands in the thread
    P3.vp.classList.remove('open');
    await wait(500);
    bubble('in', `You're booked for ${D.days[0].day}, ${D.days[0].date} at 12:30 PM. See you at 1671 Toll Gate Dr.`);
    await wait(2800);
  }

  // ---------- run ----------
  async function loop() {
    // phones 2 and 3 show their resting screens as soon as the sample data is in
    dshow(P2, 'email');
    data().then(() => { if (!played2) rest2(); if (!played3) rest3(); });
    for (;;) { await play1(); played2 = true; await play2(); played3 = true; await play3(); }
  }
  let played2 = false, played3 = false;
  async function still() {
    await data();
    F.paintCar(P1.sheet, D.car); dshow(P1, 'car');
    rest2(); rest3();
    $('.float-note.n1 small').textContent = D.car.name;
    note('n1', true); note('n3', true);
  }

  const setActive = on => { active = on && document.visibilityState === 'visible'; showcase.classList.toggle('paused', !active); };
  let inView = false;
  new IntersectionObserver(([en]) => { inView = en.isIntersecting; setActive(inView); }, { threshold: 0.25 }).observe(showcase);
  document.addEventListener('visibilitychange', () => setActive(inView));
  rest1();
  if (F.reduce) still(); else loop();
})();
