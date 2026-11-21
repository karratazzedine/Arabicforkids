'use strict';

/* =========================================================
   Instellingen — hier kun je makkelijk dingen aanpassen
   ========================================================= */
const INSTELLINGEN = {
  minutenPerVraag: 2.25,        // 20 vragen = 45 min, 40 vragen = 90 min
  waarschuwingMinuten: 5,       // timer wordt oranje als er minder dan zoveel minuten over zijn
  voldoende: 5.5,               // grens voor een voldoende
  zwakGrens: 0.6,               // onder 60% goed = zwak onderwerp
  kaartIntervallenDagen: [0, 0, 1, 3, 7, 14] // bakje 1 t/m 5: na hoeveel dagen een kaart terugkomt
};

const SLEUTEL = {
  data: 'pm_vragenbank',
  toetsen: 'pm_toetsen',
  actief: 'pm_actieve_toets',
  kaarten: 'pm_kaarten',
  spss: 'pm_spss_antwoorden'
};

const LETTERS = ['A', 'B', 'C', 'D'];
let DATA = null;          // { vragen, begrippen, spss }
let DATABRON = '';        // waar de vragen vandaan kwamen
let WAARSCHUWINGEN = [];
let timerId = null;
let toetsHandler = null;  // sneltoetsen voor het huidige scherm

/* =========================================================
   Hulpfuncties
   ========================================================= */
const app = document.getElementById('app');

const opslag = {
  lees(k, standaard) {
    try { const w = localStorage.getItem(k); return w === null ? standaard : JSON.parse(w); }
    catch (e) { return standaard; }
  },
  schrijf(k, w) {
    try { localStorage.setItem(k, JSON.stringify(w)); return true; }
    catch (e) { melding('Opslaan in de browser lukt niet (privévenster?)'); return false; }
  },
  wis(k) { try { localStorage.removeItem(k); } catch (e) { /* niets */ } }
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const tekstHTML = s => esc(s).replace(/\n/g, '<br>');

function schud(lijst) {
  const a = lijst.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const cijferTekst = c => c.toFixed(1).replace('.', ',');
const procent = (g, t) => t ? Math.round(100 * g / t) : 0;

function datumTekst(iso, metTijd = true) {
  const d = new Date(iso);
  const opties = { day: 'numeric', month: 'short', year: 'numeric' };
  if (metTijd) Object.assign(opties, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleString('nl-NL', opties);
}

function duurTekst(sec) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m ? `${m} min ${s} s` : `${s} s`;
}

function klok(ms) {
  const tot = Math.max(0, Math.ceil(ms / 1000));
  const u = Math.floor(tot / 3600), m = Math.floor((tot % 3600) / 60), s = tot % 60;
  const p = n => String(n).padStart(2, '0');
  return u ? `${u}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

let meldingTimer;
function melding(tekst) {
  const el = document.getElementById('melding');
  el.textContent = tekst;
  el.classList.add('zichtbaar');
  clearTimeout(meldingTimer);
  meldingTimer = setTimeout(() => el.classList.remove('zichtbaar'), 2600);
}

async function kopieer(tekst) {
  try {
    await navigator.clipboard.writeText(tekst);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = tekst;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e2) { /* niets */ }
    ta.remove();
  }
  melding('Gekopieerd! Plak het in je Claude-project.');
}

const vraagOpId = id => DATA.vragen.find(v => v.id === id);
const onderwerpen = () => [...new Set(DATA.vragen.map(v => v.onderwerp))].sort((a, b) => a.localeCompare(b, 'nl'));

/* =========================================================
   Vragenbank laden en controleren
   ========================================================= */
function normaliseer(ruw) {
  const fouten = [];
  const vragen = (ruw.vragen || []).map((v, i) => {
    const nr = `Vraag ${i + 1}${v.id ? ` (${v.id})` : ''}`;
    const id = v.id || `vraag-${i + 1}`;
    if (!v.id) fouten.push(`${nr}: geen "id" — tijdelijk "${id}" gebruikt.`);
    if (!v.onderwerp) fouten.push(`${nr}: geen "onderwerp".`);
    if (!v.vraag) fouten.push(`${nr}: geen "vraag".`);
    const opties = v.opties || {};
    LETTERS.forEach(L => { if (!opties[L]) fouten.push(`${nr}: antwoordoptie ${L} ontbreekt.`); });
    if (!LETTERS.includes(v.juist)) fouten.push(`${nr}: "juist" moet A, B, C of D zijn.`);
    if (!v.uitleg) fouten.push(`${nr}: geen "uitleg".`);
    LETTERS.filter(L => L !== v.juist).forEach(L => {
      if (!v.denkfouten || !v.denkfouten[L]) fouten.push(`${nr}: denkfout bij ${L} ontbreekt.`);
    });
    return {
      id, onderwerp: v.onderwerp || 'Overig', vraag: v.vraag || '', opties,
      juist: v.juist, uitleg: v.uitleg || '', denkfouten: v.denkfouten || {}, herkennen: v.herkennen || ''
    };
  });
  const ids = vragen.map(v => v.id);
  ids.filter((id, i) => ids.indexOf(id) !== i).forEach(id => fouten.push(`Het id "${id}" komt meer dan één keer voor.`));

  const begrippen = (ruw.begrippen || []).map((b, i) => ({ id: b.id || `begrip-${i + 1}`, begrip: b.begrip || '', definitie: b.definitie || '' }));
  const spss = (ruw.spss || []).map((s, i) => ({
    id: s.id || `spss-${i + 1}`, onderwerp: s.onderwerp || 'SPSS', vraag: s.vraag || '', output: s.output || '', richtlijn: s.richtlijn || ''
  }));
  if (!vragen.length) fouten.push('Er staan geen vragen in het bestand (lijst "vragen").');
  return { data: { vragen, begrippen, spss }, fouten };
}

function zetData(ruw, bron) {
  const { data, fouten } = normaliseer(ruw);
  DATA = data;
  DATABRON = bron;
  WAARSCHUWINGEN = fouten;
}

async function laadData() {
  try {
    const r = await fetch('vragen.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('niet gevonden');
    zetData(await r.json(), 'vragen.json');
    return true;
  } catch (e) {
    const opgeslagen = opslag.lees(SLEUTEL.data, null);
    if (opgeslagen) { zetData(opgeslagen, 'eerder gekozen bestand (opgeslagen in deze browser)'); return true; }
    return false;
  }
}

function leesBestand(input) {
  const bestand = input.files && input.files[0];
  if (!bestand) return;
  const lezer = new FileReader();
  lezer.onload = () => {
    try {
      const ruw = JSON.parse(lezer.result);
      opslag.schrijf(SLEUTEL.data, ruw);
      zetData(ruw, `${bestand.name} (gekozen bestand)`);
      melding(`Vragenbank geladen: ${DATA.vragen.length} vragen.`);
      if (location.hash === '#start' || !location.hash) route(); else location.hash = '#start';
    } catch (e) {
      alert('Dit bestand is geen geldige JSON. Controleer komma\'s, aanhalingstekens en haakjes.\n\nFoutmelding: ' + e.message);
    }
  };
  lezer.readAsText(bestand);
}

function laadScherm() {
  app.innerHTML = `
    <div class="kaart">
      <h1>Kies je vragenbestand</h1>
      <p>De site kon <code>vragen.json</code> niet automatisch openen. Dat gebeurt vaak als je
      <code>index.html</code> direct opent vanaf je computer: browsers blokkeren dan het inlezen van bestanden.</p>
      <p>Geen probleem: kies hieronder het bestand <code>vragen.json</code> uit dezelfde map.
      De browser onthoudt het daarna.</p>
      <label class="knop" style="cursor:pointer">
        Kies vragen.json
        <input type="file" accept=".json,application/json" hidden id="bestandKiezer">
      </label>
      <p class="zacht klein" style="margin-top:14px">Online (bijvoorbeeld via GitHub Pages) wordt het bestand wél automatisch geladen.</p>
    </div>`;
  document.getElementById('bestandKiezer').addEventListener('change', e => leesBestand(e.target));
}

/* =========================================================
   Router
   ========================================================= */
function route() {
  stopTimer();
  toetsHandler = null;
  if (!DATA) { laadScherm(); return; }
  if (controleerVerlopenToets()) return;

  const [view, arg] = (location.hash.slice(1) || 'start').split('/');
  const menuView = view === 'resultaat' ? 'voortgang' : view;
  document.querySelectorAll('.menu a').forEach(a => a.classList.toggle('actief', a.dataset.view === menuView));

  switch (view) {
    case 'toets': toetsScherm(); break;
    case 'resultaat': resultaatScherm(arg); break;
    case 'kaarten': kaartenScherm(); break;
    case 'spss': spssScherm(); break;
    case 'voortgang': voortgangScherm(); break;
    default: startScherm();
  }
  window.scrollTo(0, 0);
}

document.addEventListener('keydown', e => {
  if (!toetsHandler) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'input' || tag === 'select' || e.ctrlKey || e.metaKey || e.altKey) return;
  toetsHandler(e);
});

/* =========================================================
   Startscherm
   ========================================================= */
function startScherm() {
  const toetsen = opslag.lees(SLEUTEL.toetsen, []);
  const actief = opslag.lees(SLEUTEL.actief, null);
  const laatste = toetsen[toetsen.length - 1];
  const gemiddeld = toetsen.length ? toetsen.reduce((s, t) => s + t.cijfer, 0) / toetsen.length : null;
  const zwak = zwakkeOnderwerpen(toetsen)[0];
  const teHerhalen = kaartenTeHerhalen().length;

  app.innerHTML = `
    <h1>Hoi! Klaar om te oefenen?</h1>
    <p class="zacht">Rustig en stap voor stap naar die voldoende voor psychometrie.</p>

    ${actief ? `
      <div class="kaart" style="border-color:var(--accent)">
        <div class="rij-tussen">
          <div><strong>Je hebt nog een toets openstaan.</strong><br>
          <span class="zacht klein">Resterende tijd: ${klok(actief.eind - Date.now())}</span></div>
          <a class="knop" href="#toets">Verder met de toets</a>
        </div>
      </div>` : ''}

    <div class="kaart">
      <div class="raster" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
        <div><div class="zacht klein">Toetsen gemaakt</div><div style="font-size:1.6rem;font-weight:650">${toetsen.length}</div></div>
        <div><div class="zacht klein">Laatste cijfer</div><div style="font-size:1.6rem;font-weight:650">${laatste ? cijferTekst(laatste.cijfer) : '–'}</div></div>
        <div><div class="zacht klein">Gemiddeld cijfer</div><div style="font-size:1.6rem;font-weight:650">${gemiddeld !== null ? cijferTekst(gemiddeld) : '–'}</div></div>
        <div><div class="zacht klein">Kaarten te herhalen</div><div style="font-size:1.6rem;font-weight:650">${teHerhalen}</div></div>
      </div>
      ${zwak && zwak.score < INSTELLINGEN.zwakGrens ? `<p class="klein" style="margin-top:12px">Aandachtspunt: <strong>${esc(zwak.onderwerp)}</strong> (${procent(zwak.goed, zwak.totaal)}% goed).</p>` : ''}
    </div>

    <div class="raster">
      <a class="tegel" href="#toets"><h3>Toets maken</h3><p>20 of 40 meerkeuzevragen met timer, zoals de echte bloktoets. Cijfer pas aan het eind.</p></a>
      <a class="tegel" href="#kaarten"><h3>Flitskaarten</h3><p>Begrippen leren. Wat je fout hebt, komt vaker terug.</p></a>
      <a class="tegel" href="#spss"><h3>SPSS-opdrachten</h3><p>Open vragen over de juiste analyse kiezen en output lezen.</p></a>
      <a class="tegel" href="#voortgang"><h3>Voortgang</h3><p>Je cijfers over tijd en je zwakke onderwerpen.</p></a>
    </div>

    <div class="kaart" style="margin-top:16px">
      <h2>Vragenbank</h2>
      <p class="zacht klein">Geladen uit: ${esc(DATABRON)}<br>
      ${DATA.vragen.length} meerkeuzevragen · ${DATA.begrippen.length} begrippen · ${DATA.spss.length} SPSS-opdrachten · ${onderwerpen().length} onderwerpen</p>
      ${WAARSCHUWINGEN.length ? `<div class="waarschuwing" style="margin-bottom:12px"><strong>Let op, er klopt iets niet in het vragenbestand:</strong>
        <ul>${WAARSCHUWINGEN.slice(0, 15).map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        ${WAARSCHUWINGEN.length > 15 ? `<p class="klein">…en nog ${WAARSCHUWINGEN.length - 15} meldingen.</p>` : ''}</div>` : ''}
      <label class="knop licht" style="cursor:pointer">Ander vragenbestand kiezen
        <input type="file" accept=".json,application/json" hidden id="bestandKiezer"></label>
    </div>`;
  document.getElementById('bestandKiezer').addEventListener('change', e => leesBestand(e.target));
}

/* =========================================================
   Toetsmodus
   ========================================================= */
function toetsScherm() {
  const actief = opslag.lees(SLEUTEL.actief, null);
  if (actief) { toetsVraag(); return; }

  const opties = onderwerpen();
  app.innerHTML = `
    <h1>Toets maken</h1>
    <div class="kaart">
      <p>Je krijgt meerkeuzevragen met een timer. Je ziet pas aan het eind wat goed en fout is, net als bij de echte bloktoets.
      Je kunt tussendoor vrij heen en weer bladeren.</p>
      <div class="veld"><span>Aantal vragen</span>
        <div class="keuze" role="radiogroup">
          <label><input type="radio" name="aantal" value="20" checked><span>20 vragen</span></label>
          <label><input type="radio" name="aantal" value="40"><span>40 vragen</span></label>
        </div>
      </div>
      <label class="veld"><span>Onderwerp</span>
        <select id="onderwerp">
          <option value="">Alle onderwerpen (zoals de echte toets)</option>
          ${opties.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
        </select>
      </label>
      <p class="zacht klein" id="toetsInfo"></p>
      <button class="knop" id="startToets">Start de toets</button>
    </div>
    <p class="zacht klein alleen-laptop">Tip: op een laptop kun je kiezen met de toetsen A–D of 1–4 en bladeren met ← en →.</p>`;

  const info = () => {
    const n = Number(document.querySelector('input[name=aantal]:checked').value);
    const ow = document.getElementById('onderwerp').value;
    const beschikbaar = DATA.vragen.filter(v => !ow || v.onderwerp === ow).length;
    const echt = Math.min(n, beschikbaar);
    let t = `Tijd: ${Math.round(echt * INSTELLINGEN.minutenPerVraag)} minuten voor ${echt} vragen.`;
    if (beschikbaar < n) t += ` Let op: er zijn maar ${beschikbaar} vragen beschikbaar${ow ? ' in dit onderwerp' : ''}, dus de toets wordt korter. Voeg meer vragen toe aan vragen.json.`;
    document.getElementById('toetsInfo').textContent = t;
  };
  app.querySelectorAll('input[name=aantal], #onderwerp').forEach(el => el.addEventListener('change', info));
  info();

  document.getElementById('startToets').addEventListener('click', () => {
    const n = Number(document.querySelector('input[name=aantal]:checked').value);
    const ow = document.getElementById('onderwerp').value;
    const pool = DATA.vragen.filter(v => !ow || v.onderwerp === ow);
    const gekozen = schud(pool).slice(0, n);
    if (!gekozen.length) { melding('Geen vragen beschikbaar.'); return; }
    const nu = Date.now();
    opslag.schrijf(SLEUTEL.actief, {
      vragen: gekozen.map(v => v.id),
      antwoorden: {},
      huidig: 0,
      start: nu,
      eind: nu + Math.round(gekozen.length * INSTELLINGEN.minutenPerVraag * 60000),
      gevraagd: n,
      onderwerp: ow
    });
    toetsVraag();
    window.scrollTo(0, 0);
  });
}

function toetsVraag() {
  const t = opslag.lees(SLEUTEL.actief, null);
  if (!t) { toetsScherm(); return; }
  const n = t.vragen.length;
  const v = vraagOpId(t.vragen[t.huidig]);
  const aantalBeantwoord = Object.keys(t.antwoorden).length;

  app.innerHTML = `
    <div class="toets-kop">
      <strong>Vraag ${t.huidig + 1} van ${n}</strong>
      <div class="voortgangsbalk" aria-hidden="true"><div style="width:${procent(aantalBeantwoord, n)}%"></div></div>
      <span class="timer" id="timer" aria-label="Resterende tijd">${klok(t.eind - Date.now())}</span>
    </div>

    <div class="kaart">
      ${v ? `
        <span class="onderwerp-label">${esc(v.onderwerp)}</span>
        <div class="vraagtekst">${tekstHTML(v.vraag)}</div>
        <div class="opties">
          ${LETTERS.map(L => `
            <button class="optie ${t.antwoorden[t.huidig] === L ? 'gekozen' : ''}" data-letter="${L}" aria-pressed="${t.antwoorden[t.huidig] === L}">
              <span class="letter">${L}</span><span>${tekstHTML(v.opties[L])}</span>
            </button>`).join('')}
        </div>` : '<p>Deze vraag staat niet meer in de vragenbank. Ga door naar de volgende.</p>'}
    </div>

    <div class="rij-tussen">
      <button class="knop licht" id="vorige" ${t.huidig === 0 ? 'disabled' : ''}>← Vorige</button>
      ${t.huidig < n - 1
        ? '<button class="knop" id="volgende">Volgende →</button>'
        : '<button class="knop" id="inleveren2">Toets inleveren</button>'}
    </div>

    <div class="kaart" style="margin-top:16px">
      <div class="rij-tussen">
        <span class="klein zacht">${aantalBeantwoord} van ${n} beantwoord</span>
        <button class="knop licht" id="inleveren">Inleveren</button>
      </div>
      <div class="nummers">
        ${t.vragen.map((_, i) => `<button data-nr="${i}" class="${t.antwoorden[i] ? 'beantwoord' : ''} ${i === t.huidig ? 'huidig' : ''}" aria-label="Ga naar vraag ${i + 1}">${i + 1}</button>`).join('')}
      </div>
      <p class="klein zacht" style="margin:12px 0 0">
        <button class="knop gevaar" id="stoppen" style="min-height:36px;padding:6px 12px;font-size:.85rem">Toets afbreken (telt niet mee)</button>
      </p>
    </div>`;

  const ga = i => { t.huidig = Math.max(0, Math.min(n - 1, i)); opslag.schrijf(SLEUTEL.actief, t); toetsVraag(); window.scrollTo(0, 0); };
  const kies = L => { t.antwoorden[t.huidig] = L; opslag.schrijf(SLEUTEL.actief, t); toetsVraag(); };

  app.querySelectorAll('.optie').forEach(b => b.addEventListener('click', () => kies(b.dataset.letter)));
  app.querySelectorAll('.nummers button').forEach(b => b.addEventListener('click', () => ga(Number(b.dataset.nr))));
  document.getElementById('vorige').addEventListener('click', () => ga(t.huidig - 1));
  const volgende = document.getElementById('volgende');
  if (volgende) volgende.addEventListener('click', () => ga(t.huidig + 1));
  const inleveren = () => {
    const open = n - Object.keys(t.antwoorden).length;
    const vraag = open ? `Je hebt nog ${open} ${open === 1 ? 'vraag' : 'vragen'} niet beantwoord. Toch inleveren?` : 'Weet je zeker dat je de toets wilt inleveren?';
    if (confirm(vraag)) rondToetsAf(false);
  };
  document.getElementById('inleveren').addEventListener('click', inleveren);
  const inl2 = document.getElementById('inleveren2');
  if (inl2) inl2.addEventListener('click', inleveren);
  document.getElementById('stoppen').addEventListener('click', () => {
    if (confirm('Toets afbreken? Je antwoorden worden niet bewaard en de toets telt niet mee.')) {
      opslag.wis(SLEUTEL.actief); route();
    }
  });

  toetsHandler = e => {
    const k = e.key.toUpperCase();
    const idx = ['1', '2', '3', '4'].indexOf(k);
    if (LETTERS.includes(k)) kies(k);
    else if (idx >= 0) kies(LETTERS[idx]);
    else if (e.key === 'ArrowRight') ga(t.huidig + 1);
    else if (e.key === 'ArrowLeft') ga(t.huidig - 1);
  };

  startTimer(t.eind);
}

function startTimer(eind) {
  stopTimer();
  const tik = () => {
    const el = document.getElementById('timer');
    const rest = eind - Date.now();
    if (rest <= 0) { stopTimer(); rondToetsAf(true); return; }
    if (el) {
      el.textContent = klok(rest);
      el.classList.toggle('bijna', rest < INSTELLINGEN.waarschuwingMinuten * 60000);
    }
  };
  tik();
  timerId = setInterval(tik, 1000);
}
function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }

function controleerVerlopenToets() {
  const t = opslag.lees(SLEUTEL.actief, null);
  if (t && Date.now() >= t.eind) { rondToetsAf(true); return true; }
  return false;
}

function rondToetsAf(tijdOp) {
  const t = opslag.lees(SLEUTEL.actief, null);
  if (!t) return;
  stopTimer();
  const items = t.vragen.map((id, i) => {
    const v = vraagOpId(id);
    return { id, onderwerp: v ? v.onderwerp : 'Onbekend', gekozen: t.antwoorden[i] || null, juist: v ? v.juist : null };
  });
  const goed = items.filter(it => it.gekozen && it.gekozen === it.juist).length;
  const aantal = items.length;
  const resultaat = {
    id: Date.now().toString(36),
    datum: new Date().toISOString(),
    aantal, goed,
    cijfer: Math.round((1 + 9 * goed / aantal) * 10) / 10,
    duurSec: Math.round((Math.min(Date.now(), t.eind) - t.start) / 1000),
    tijdOp,
    onderwerp: t.onderwerp || '',
    items
  };
  const toetsen = opslag.lees(SLEUTEL.toetsen, []);
  toetsen.push(resultaat);
  opslag.schrijf(SLEUTEL.toetsen, toetsen);
  opslag.wis(SLEUTEL.actief);
  if (tijdOp) melding('De tijd is op. Je toets is ingeleverd.');
  location.hash = `#resultaat/${resultaat.id}`;
}

/* =========================================================
   Resultaat na een toets
   ========================================================= */
function scorePerOnderwerp(items) {
  const per = {};
  items.forEach(it => {
    per[it.onderwerp] = per[it.onderwerp] || { goed: 0, totaal: 0 };
    per[it.onderwerp].totaal++;
    if (it.gekozen && it.gekozen === it.juist) per[it.onderwerp].goed++;
  });
  return Object.entries(per)
    .map(([onderwerp, s]) => ({ onderwerp, ...s, score: s.goed / s.totaal }))
    .sort((a, b) => a.score - b.score || a.onderwerp.localeCompare(b.onderwerp, 'nl'));
}

function balkenHTML(rijen) {
  return `<div class="balken">${rijen.map(r => `
    <div class="balk-rij">
      <span>${esc(r.onderwerp)}</span>
      <div class="balk" role="img" aria-label="${esc(r.onderwerp)}: ${procent(r.goed, r.totaal)} procent goed">
        <div class="${r.score < INSTELLINGEN.zwakGrens ? 'laag' : ''}" style="width:${Math.max(2, procent(r.goed, r.totaal))}%"></div>
      </div>
      <span class="balk-waarde">${r.goed}/${r.totaal} · ${procent(r.goed, r.totaal)}%</span>
    </div>`).join('')}</div>`;
}

function resultaatScherm(id) {
  const toetsen = opslag.lees(SLEUTEL.toetsen, []);
  const r = toetsen.find(x => x.id === id) || toetsen[toetsen.length - 1];
  if (!r) { app.innerHTML = '<div class="kaart"><p>Geen toets gevonden.</p><a class="knop" href="#toets">Maak een toets</a></div>'; return; }

  const voldoende = r.cijfer >= INSTELLINGEN.voldoende;
  const fouten = r.items.filter(it => it.gekozen !== it.juist);
  const per = scorePerOnderwerp(r.items);

  app.innerHTML = `
    <h1>Resultaat</h1>
    <div class="kaart">
      <div class="cijfer-blok">
        <div class="cijfer ${voldoende ? 'voldoende' : 'onvoldoende'}">${cijferTekst(r.cijfer)}</div>
        <div>
          <p style="margin:0 0 4px"><strong>${r.goed} van ${r.aantal} goed</strong> (${procent(r.goed, r.aantal)}%)</p>
          <p class="zacht klein" style="margin:0">${datumTekst(r.datum)} · tijd: ${duurTekst(r.duurSec)}${r.tijdOp ? ' · tijd was op' : ''}${r.onderwerp ? ` · alleen ${esc(r.onderwerp)}` : ''}</p>
          <p style="margin:8px 0 0">${voldoende ? 'Voldoende — goed bezig!' : 'Nog geen voldoende. Bekijk hieronder rustig je fouten, daar leer je het meest van.'}</p>
        </div>
      </div>
      <div class="rij" style="margin-top:16px">
        <button class="knop" id="kopieer">Kopieer resultaten voor Claude</button>
        <a class="knop licht" href="#toets">Nieuwe toets</a>
      </div>
    </div>

    <div class="kaart">
      <h2>Score per onderwerp</h2>
      ${balkenHTML(per)}
    </div>

    <h2 style="margin-top:24px">${fouten.length ? `Je fouten (${fouten.length})` : 'Alles goed!'}</h2>
    ${fouten.map((it, i) => foutKaart(it, i)).join('')}

    ${r.goed ? `<details class="kaart"><summary style="cursor:pointer;font-weight:600">Bekijk ook de vragen die je goed had (${r.goed})</summary>
      ${r.items.filter(it => it.gekozen === it.juist).map(it => {
        const v = vraagOpId(it.id);
        return v ? `<div style="margin-top:14px"><span class="onderwerp-label">${esc(v.onderwerp)}</span>
          <p>${tekstHTML(v.vraag)}</p><p class="klein"><strong>${it.juist}. ${esc(v.opties[it.juist])}</strong><br><span class="zacht">${tekstHTML(v.uitleg)}</span></p></div>` : '';
      }).join('')}</details>` : ''}`;

  document.getElementById('kopieer').addEventListener('click', () => kopieer(resultaatTekst(r)));
}

function foutKaart(it, i) {
  const v = vraagOpId(it.id);
  if (!v) return `<div class="kaart fout-item"><p>Deze vraag (${esc(it.id)}) staat niet meer in de vragenbank.</p></div>`;
  const jouw = it.gekozen
    ? `<div class="regel jouw"><strong>JOUW ANTWOORD: ${it.gekozen}. ${esc(v.opties[it.gekozen])}</strong>
        ${v.denkfouten[it.gekozen] ? `Waarom dit fout is: ${tekstHTML(v.denkfouten[it.gekozen])}` : ''}</div>`
    : `<div class="regel jouw"><strong>NIET BEANTWOORD</strong>Deze vraag heb je open gelaten.</div>`;
  return `
    <div class="kaart fout-item">
      <span class="onderwerp-label">${esc(v.onderwerp)}</span>
      <p><strong>${i + 1}.</strong> ${tekstHTML(v.vraag)}</p>
      ${jouw}
      <div class="regel juist"><strong>JUIST ANTWOORD: ${v.juist}. ${esc(v.opties[v.juist])}</strong>${tekstHTML(v.uitleg)}</div>
      ${v.herkennen ? `<div class="regel tip"><strong>ZO HERKEN JE HET VOLGENDE KEER</strong>${tekstHTML(v.herkennen)}</div>` : ''}
    </div>`;
}

function resultaatTekst(r) {
  const per = scorePerOnderwerp(r.items);
  const fouten = r.items.filter(it => it.gekozen !== it.juist);
  const regels = [
    'PSYCHOMETRIE – TOETSRESULTAAT',
    `Datum: ${datumTekst(r.datum)}`,
    `Score: ${r.goed}/${r.aantal} goed (${procent(r.goed, r.aantal)}%) – cijfer ${cijferTekst(r.cijfer)}`,
    `Tijd: ${duurTekst(r.duurSec)}${r.tijdOp ? ' (tijd was op)' : ''}`,
    r.onderwerp ? `Onderwerp: alleen ${r.onderwerp}` : 'Onderwerp: alle onderwerpen',
    '',
    'SCORE PER ONDERWERP',
    ...per.map(p => `- ${p.onderwerp}: ${p.goed}/${p.totaal} (${procent(p.goed, p.totaal)}%)`),
    '',
    `FOUTE ANTWOORDEN (${fouten.length})`
  ];
  fouten.forEach((it, i) => {
    const v = vraagOpId(it.id);
    if (!v) { regels.push(`${i + 1}. (vraag ${it.id} niet meer beschikbaar)`, ''); return; }
    regels.push(`${i + 1}. [${v.onderwerp}] ${v.vraag}`);
    LETTERS.forEach(L => regels.push(`   ${L}. ${v.opties[L]}`));
    regels.push(`   Mijn antwoord: ${it.gekozen ? `${it.gekozen}. ${v.opties[it.gekozen]}` : 'niet beantwoord'}`);
    regels.push(`   Juiste antwoord: ${v.juist}. ${v.opties[v.juist]}`);
    if (it.gekozen && v.denkfouten[it.gekozen]) regels.push(`   Denkfout: ${v.denkfouten[it.gekozen]}`);
    regels.push('');
  });
  regels.push(
    'VRAAG AAN CLAUDE',
    'Maak een foutenanalyse van deze toets. Welke denkfouten komen vaker terug? Welke onderwerpen moet ik eerst herhalen?',
    'Leg de lastigste stof kort en helder uit en geef me daarna 3 nieuwe oefenvragen over mijn zwakste onderwerp (zonder meteen het antwoord te geven).'
  );
  return regels.join('\n');
}

/* =========================================================
   Flitskaarten met gespreid herhalen (Leitner-systeem)
   ========================================================= */
function kaartStatus() { return opslag.lees(SLEUTEL.kaarten, {}); }

function kaartenTeHerhalen() {
  if (!DATA) return [];
  const st = kaartStatus(), nu = Date.now();
  return DATA.begrippen.filter(b => !st[b.id] || st[b.id].volgende <= nu);
}

let kaartSessie = null; // { rij: [ids], omgedraaid, goed, fout }

function kaartenScherm() {
  if (!DATA.begrippen.length) {
    app.innerHTML = '<h1>Flitskaarten</h1><div class="kaart"><p>Er staan nog geen begrippen in <code>vragen.json</code> (lijst "begrippen").</p></div>';
    return;
  }
  if (!kaartSessie || !kaartSessie.rij.length) {
    const st = kaartStatus();
    const teDoen = kaartenTeHerhalen();
    const bak = b => (st[b.id] ? st[b.id].bak : 0);
    kaartSessie = { rij: schud(teDoen).sort((a, b) => bak(a) - bak(b)).map(b => b.id), omgedraaid: false, goed: 0, fout: 0, klaar: !teDoen.length };
  }
  tekenKaart();
}

function bakjesHTML() {
  const st = kaartStatus();
  const tel = [0, 0, 0, 0, 0, 0];
  DATA.begrippen.forEach(b => tel[st[b.id] ? st[b.id].bak : 0]++);
  return `
    <div class="bakjes" aria-label="Verdeling van kaarten over bakjes">
      ${[1, 2, 3, 4, 5].map(i => `<div class="bakje"><b>${tel[i] + (i === 1 ? tel[0] : 0)}</b>bakje ${i}</div>`).join('')}
    </div>
    <p class="zacht klein" style="margin:8px 0 0">Bakje 1 = nieuw of fout (komt steeds terug). Goed? De kaart schuift een bakje op en komt later terug: na ${INSTELLINGEN.kaartIntervallenDagen.slice(2).join(', ')} dagen.</p>`;
}

function tekenKaart() {
  const s = kaartSessie;
  if (!s.rij.length) {
    const st = kaartStatus();
    const volgende = Math.min(...DATA.begrippen.map(b => (st[b.id] ? st[b.id].volgende : 0)));
    app.innerHTML = `
      <h1>Flitskaarten</h1>
      <div class="kaart">
        <h2>${s.klaar ? 'Je bent bij!' : 'Ronde klaar!'}</h2>
        <p>${s.klaar ? 'Er zijn nu geen kaarten om te herhalen.' : `Je had ${s.goed} keer goed en ${s.fout} keer fout. Foute kaarten kwamen tussendoor opnieuw terug.`}</p>
        ${volgende > Date.now() ? `<p class="zacht">Volgende kaart om te herhalen: ${datumTekst(new Date(volgende).toISOString(), false)}.</p>` : ''}
        <div class="rij">
          <button class="knop" id="allesOefenen">Toch alle kaarten oefenen</button>
          <button class="knop licht" id="opnieuw">Opnieuw kijken</button>
        </div>
      </div>
      <div class="kaart">${bakjesHTML()}</div>`;
    document.getElementById('allesOefenen').addEventListener('click', () => {
      kaartSessie = { rij: schud(DATA.begrippen).map(b => b.id), omgedraaid: false, goed: 0, fout: 0 };
      tekenKaart();
    });
    document.getElementById('opnieuw').addEventListener('click', () => { kaartSessie = null; kaartenScherm(); });
    return;
  }

  const b = DATA.begrippen.find(x => x.id === s.rij[0]);
  app.innerHTML = `
    <div class="rij-tussen" style="margin-bottom:12px">
      <h1 style="margin:0">Flitskaarten</h1>
      <span class="zacht klein">Nog ${s.rij.length} in deze ronde · ${s.goed} goed · ${s.fout} fout</span>
    </div>
    <div class="kaart flitskaart" id="kaart" role="button" tabindex="0" aria-label="Kaart omdraaien">
      ${s.omgedraaid
        ? `<div class="zacht klein" style="margin-bottom:8px">${esc(b.begrip)}</div><div class="definitie">${tekstHTML(b.definitie)}</div>`
        : `<div class="begrip">${esc(b.begrip)}</div><div class="hint">Wat betekent dit? Zeg het hardop of in je hoofd, en tik dan om om te draaien.</div>`}
    </div>
    ${s.omgedraaid ? `
      <div class="rij" style="justify-content:center">
        <button class="knop fout" id="fout">✗ Wist ik niet</button>
        <button class="knop goed" id="goed">✓ Wist ik</button>
      </div>` : `
      <div class="rij" style="justify-content:center"><button class="knop" id="draai">Omdraaien</button></div>`}
    <p class="zacht klein alleen-laptop" style="text-align:center;margin-top:10px">Laptop: spatie = omdraaien, 1 = wist ik niet, 2 = wist ik</p>
    <div class="kaart" style="margin-top:16px">${bakjesHTML()}</div>`;

  const draai = () => { if (!s.omgedraaid) { s.omgedraaid = true; tekenKaart(); } };
  document.getElementById('kaart').addEventListener('click', draai);
  const knopDraai = document.getElementById('draai');
  if (knopDraai) knopDraai.addEventListener('click', draai);
  if (s.omgedraaid) {
    document.getElementById('goed').addEventListener('click', () => beoordeelKaart(true));
    document.getElementById('fout').addEventListener('click', () => beoordeelKaart(false));
  }
  toetsHandler = e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); draai(); }
    else if (s.omgedraaid && (e.key === '1' || e.key === 'ArrowLeft')) beoordeelKaart(false);
    else if (s.omgedraaid && (e.key === '2' || e.key === 'ArrowRight')) beoordeelKaart(true);
  };
}

function beoordeelKaart(wistHet) {
  const s = kaartSessie;
  const id = s.rij.shift();
  const st = kaartStatus();
  const huidig = st[id] || { bak: 1, volgende: 0 };
  const dag = 24 * 3600 * 1000;
  if (wistHet) {
    const bak = Math.min(5, (huidig.bak || 1) + 1);
    st[id] = { bak, volgende: Date.now() + INSTELLINGEN.kaartIntervallenDagen[bak] * dag };
    s.goed++;
  } else {
    st[id] = { bak: 1, volgende: Date.now() };
    s.fout++;
    // fout? dan komt de kaart in deze ronde over een paar kaarten terug
    s.rij.splice(Math.min(3, s.rij.length), 0, id);
  }
  opslag.schrijf(SLEUTEL.kaarten, st);
  s.omgedraaid = false;
  tekenKaart();
}

/* =========================================================
   SPSS-opdrachten
   ========================================================= */
function spssScherm() {
  const antwoorden = opslag.lees(SLEUTEL.spss, {});
  if (!DATA.spss.length) {
    app.innerHTML = '<h1>SPSS-opdrachten</h1><div class="kaart"><p>Er staan nog geen SPSS-opdrachten in <code>vragen.json</code> (lijst "spss").</p></div>';
    return;
  }
  const aantalKlaar = DATA.spss.filter(s => antwoorden[s.id] && antwoorden[s.id].tekst.trim()).length;
  app.innerHTML = `
    <h1>SPSS-opdrachten</h1>
    <div class="kaart">
      <p>Open vragen over het kiezen van de juiste analyse en het lezen van SPSS-output. Je antwoorden worden automatisch bewaard in deze browser.
      Kopieer een antwoord en plak het in Claude om het te laten nakijken.</p>
      <div class="rij-tussen">
        <span class="zacht klein">${aantalKlaar} van ${DATA.spss.length} beantwoord</span>
        <button class="knop licht" id="kopieerAlles" ${aantalKlaar ? '' : 'disabled'}>Kopieer alle antwoorden</button>
      </div>
    </div>
    ${DATA.spss.map((s, i) => {
      const a = antwoorden[s.id];
      return `
      <div class="kaart" data-id="${esc(s.id)}">
        <div class="rij-tussen" style="margin-bottom:8px">
          <span class="onderwerp-label" style="margin:0">${esc(s.onderwerp)}</span>
          <span class="status-pil ${a && a.tekst.trim() ? 'klaar' : ''}" data-status>${a && a.tekst.trim() ? `Opgeslagen ${datumTekst(a.datum)}` : 'Nog niet beantwoord'}</span>
        </div>
        <h3>Opdracht ${i + 1}</h3>
        <p>${tekstHTML(s.vraag)}</p>
        ${s.output ? `<pre class="output" aria-label="SPSS-output">${esc(s.output)}</pre>` : ''}
        <label class="veld"><span>Jouw antwoord</span>
          <textarea data-antwoord placeholder="Typ hier je antwoord in je eigen woorden…">${esc(a ? a.tekst : '')}</textarea>
        </label>
        <div class="rij">
          <button class="knop" data-kopieer>Kopieer voor Claude</button>
        </div>
        ${s.richtlijn ? `<details class="richtlijn"><summary style="cursor:pointer;font-weight:600">Bekijk de richtlijn (pas nadat je zelf hebt geantwoord)</summary>
          <p style="margin:8px 0 0">${tekstHTML(s.richtlijn)}</p></details>` : ''}
      </div>`;
    }).join('')}`;

  const bewaar = (id, tekst, statusEl) => {
    const alles = opslag.lees(SLEUTEL.spss, {});
    alles[id] = { tekst, datum: new Date().toISOString() };
    opslag.schrijf(SLEUTEL.spss, alles);
    statusEl.textContent = tekst.trim() ? `Opgeslagen ${datumTekst(alles[id].datum)}` : 'Nog niet beantwoord';
    statusEl.classList.toggle('klaar', !!tekst.trim());
    document.getElementById('kopieerAlles').disabled = !DATA.spss.some(s => alles[s.id] && alles[s.id].tekst.trim());
  };

  app.querySelectorAll('[data-id]').forEach(kaart => {
    const id = kaart.dataset.id;
    const ta = kaart.querySelector('[data-antwoord]');
    const status = kaart.querySelector('[data-status]');
    let wacht;
    ta.addEventListener('input', () => { clearTimeout(wacht); wacht = setTimeout(() => bewaar(id, ta.value, status), 500); });
    ta.addEventListener('blur', () => { clearTimeout(wacht); bewaar(id, ta.value, status); });
    kaart.querySelector('[data-kopieer]').addEventListener('click', () => {
      bewaar(id, ta.value, status);
      if (!ta.value.trim()) { melding('Schrijf eerst een antwoord.'); return; }
      kopieer(spssTekst([DATA.spss.find(s => s.id === id)]));
    });
  });

  document.getElementById('kopieerAlles').addEventListener('click', () => {
    const alles = opslag.lees(SLEUTEL.spss, {});
    kopieer(spssTekst(DATA.spss.filter(s => alles[s.id] && alles[s.id].tekst.trim())));
  });
}

function spssTekst(opdrachten) {
  const alles = opslag.lees(SLEUTEL.spss, {});
  const regels = [
    'Ik oefen voor het vak psychometrie. Kijk mijn antwoord(en) op de SPSS-opdracht(en) hieronder na.',
    'Geef per opdracht: wat er goed is, wat ontbreekt of niet klopt, een cijfer van 1 tot 10, en een verbeterd modelantwoord.',
    'De nakijkrichtlijn staat erbij als hulp; beoordeel ook of mijn redenering klopt als ik het anders formuleer.',
    ''
  ];
  opdrachten.forEach((s, i) => {
    regels.push(`=== OPDRACHT ${i + 1} (${s.onderwerp}) ===`, s.vraag, '');
    if (s.output) regels.push('SPSS-OUTPUT:', s.output, '');
    regels.push('MIJN ANTWOORD:', (alles[s.id] && alles[s.id].tekst.trim()) || '(nog niet beantwoord)', '');
    if (s.richtlijn) regels.push('NAKIJKRICHTLIJN:', s.richtlijn, '');
  });
  return regels.join('\n');
}

/* =========================================================
   Voortgang
   ========================================================= */
function zwakkeOnderwerpen(toetsen) {
  return scorePerOnderwerp(toetsen.flatMap(t => t.items));
}

function voortgangScherm() {
  const toetsen = opslag.lees(SLEUTEL.toetsen, []);
  if (!toetsen.length) {
    app.innerHTML = `<h1>Voortgang</h1><div class="kaart"><p>Je hebt nog geen toetsen gemaakt. Na je eerste toets zie je hier je cijfers en zwakke onderwerpen.</p>
      <a class="knop" href="#toets">Maak je eerste toets</a></div>`;
    return;
  }
  const per = zwakkeOnderwerpen(toetsen);
  const zwak = per.filter(p => p.score < INSTELLINGEN.zwakGrens);
  const gem = toetsen.reduce((s, t) => s + t.cijfer, 0) / toetsen.length;
  const besteCijfer = Math.max(...toetsen.map(t => t.cijfer));

  app.innerHTML = `
    <h1>Voortgang</h1>
    <div class="kaart">
      <div class="rij-tussen" style="margin-bottom:6px">
        <h2 style="margin:0">Cijfers over tijd</h2>
        <span class="zacht klein">gemiddeld ${cijferTekst(gem)} · hoogste ${cijferTekst(besteCijfer)}</span>
      </div>
      <div class="grafiek-wrap" id="grafiekWrap"></div>
      <p class="zacht klein" style="margin:6px 0 0">De stippellijn is de grens voor een voldoende (${cijferTekst(INSTELLINGEN.voldoende)}).</p>
    </div>

    <div class="kaart">
      <h2>Score per onderwerp (alle toetsen samen)</h2>
      ${zwak.length ? `<p>Zwakke onderwerpen: <strong>${zwak.map(z => esc(z.onderwerp)).join(', ')}</strong>. Tip: maak een toets met alleen dit onderwerp.</p>` : '<p>Geen zwakke onderwerpen — mooi!</p>'}
      ${balkenHTML(per)}
    </div>

    <div class="kaart">
      <h2>Gemaakte toetsen</h2>
      <div class="tabel-scroll">
        <table class="lijst">
          <thead><tr><th>Datum</th><th>Vragen</th><th>Goed</th><th>Cijfer</th><th></th></tr></thead>
          <tbody>
            ${toetsen.slice().reverse().map(t => `
              <tr>
                <td>${datumTekst(t.datum)}${t.onderwerp ? `<br><span class="zacht klein">${esc(t.onderwerp)}</span>` : ''}</td>
                <td class="getal">${t.aantal}</td>
                <td class="getal">${t.goed}</td>
                <td class="getal"><strong style="color:${t.cijfer >= INSTELLINGEN.voldoende ? 'var(--goed)' : 'var(--fout)'}">${cijferTekst(t.cijfer)}</strong></td>
                <td><a href="#resultaat/${t.id}">Bekijk</a></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="kaart">
      <h2>Opnieuw beginnen</h2>
      <p class="zacht klein">Alles wordt alleen in deze browser op dit apparaat bewaard. Wissen kan niet ongedaan worden gemaakt.</p>
      <div class="rij">
        <button class="knop gevaar" id="wisToetsen">Toetsresultaten wissen</button>
        <button class="knop gevaar" id="wisKaarten">Flitskaartvoortgang wissen</button>
      </div>
    </div>`;

  const wrap = document.getElementById('grafiekWrap');
  GRAFIEK.b = Math.max(280, Math.round(wrap.clientWidth));
  GRAFIEK.h = GRAFIEK.b < 500 ? 200 : 230;
  wrap.innerHTML = grafiekSVG(toetsen) + '<div class="tooltip" id="tooltip"></div>';
  koppelGrafiek(toetsen);
  document.getElementById('wisToetsen').addEventListener('click', () => {
    if (confirm('Alle toetsresultaten wissen?')) { opslag.wis(SLEUTEL.toetsen); route(); }
  });
  document.getElementById('wisKaarten').addEventListener('click', () => {
    if (confirm('Voortgang van alle flitskaarten wissen?')) { opslag.wis(SLEUTEL.kaarten); kaartSessie = null; melding('Flitskaarten staan weer op nul.'); }
  });
}

const GRAFIEK = { b: 640, h: 230, l: 26, r: 14, t: 12, o: 28 };

function grafiekPunten(toetsen) {
  const g = GRAFIEK, n = toetsen.length;
  const bi = g.b - g.l - g.r, hi = g.h - g.t - g.o;
  return toetsen.map((t, i) => ({
    x: g.l + (n === 1 ? bi / 2 : i * bi / (n - 1)),
    y: g.t + (10 - t.cijfer) / 9 * hi,
    t
  }));
}

function grafiekSVG(toetsen) {
  const g = GRAFIEK;
  const hi = g.h - g.t - g.o;
  const yVan = c => g.t + (10 - c) / 9 * hi;
  const p = grafiekPunten(toetsen);
  const stap = Math.max(1, Math.ceil(p.length / 6));
  return `
    <svg class="grafiek" viewBox="0 0 ${g.b} ${g.h}" role="img" aria-label="Lijngrafiek van je toetscijfers over tijd">
      ${[1, 4, 7, 10].map(c => `
        <line class="rasterlijn" x1="${g.l}" x2="${g.b - g.r}" y1="${yVan(c)}" y2="${yVan(c)}"></line>
        <text class="as-tekst" x="${g.l - 8}" y="${yVan(c) + 4}" text-anchor="end">${c}</text>`).join('')}
      <line class="grens" x1="${g.l}" x2="${g.b - g.r}" y1="${yVan(INSTELLINGEN.voldoende)}" y2="${yVan(INSTELLINGEN.voldoende)}"></line>
      ${p.map((q, i) => (i % stap === 0 || i === p.length - 1) ? `<text class="as-tekst" x="${q.x}" y="${g.h - 8}" text-anchor="middle">${new Date(q.t.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</text>` : '').join('')}
      ${p.length > 1 ? `<polyline class="lijn" points="${p.map(q => `${q.x},${q.y}`).join(' ')}"></polyline>` : ''}
      ${p.map(q => `<circle class="punt" cx="${q.x}" cy="${q.y}" r="4.5"></circle>`).join('')}
      ${p.map((q, i) => `<circle class="raak" data-i="${i}" cx="${q.x}" cy="${q.y}" r="16" tabindex="0" aria-label="${datumTekst(q.t.datum)}: cijfer ${cijferTekst(q.t.cijfer)}"></circle>`).join('')}
    </svg>`;
}

function koppelGrafiek(toetsen) {
  const tip = document.getElementById('tooltip');
  const p = grafiekPunten(toetsen);
  const toon = el => {
    const q = p[Number(el.dataset.i)];
    tip.innerHTML = `<strong>${cijferTekst(q.t.cijfer)}</strong> · ${q.t.goed}/${q.t.aantal} goed<br>${datumTekst(q.t.datum)}`;
    tip.classList.add('zichtbaar');
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(GRAFIEK.b - half, Math.max(half, q.x))}px`;
    tip.style.top = `${q.y}px`;
  };
  const verberg = () => tip.classList.remove('zichtbaar');
  document.querySelectorAll('.grafiek .raak').forEach(el => {
    el.addEventListener('mouseenter', () => toon(el));
    el.addEventListener('focus', () => toon(el));
    el.addEventListener('click', () => toon(el));
    el.addEventListener('mouseleave', verberg);
    el.addEventListener('blur', verberg);
  });
}

/* =========================================================
   Starten
   ========================================================= */
window.addEventListener('hashchange', route);
laadData().then(route);
