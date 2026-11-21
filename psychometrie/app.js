'use strict';

/* =========================================================
   Instellingen — hier kun je makkelijk dingen aanpassen
   ========================================================= */
const INSTELLINGEN = {
  naam: 'Dounia',               // voor wie is de site?
  minutenPerVraag: 2.25,        // proeftoets: 20 vragen = 45 min, 40 vragen = 90 min
  waarschuwingMinuten: 5,       // timer wordt oranje als er minder dan zoveel minuten over zijn
  voldoende: 5.5,               // grens voor een voldoende
  zwakGrens: 0.6,               // onder 60% goed = zwak onderwerp
  geleerdVanafBakje: 3,         // een begrip telt als 'geleerd' vanaf dit bakje
  kaartIntervallenDagen: [0, 0, 1, 3, 7, 14] // bakje 1 t/m 5: na hoeveel dagen een kaart terugkomt
};

const SLEUTEL = {
  data: 'pm_vragenbank',
  toetsen: 'pm_toetsen',
  actief: 'pm_actieve_toets',
  kaarten: 'pm_kaarten',
  kaartSessie: 'pm_kaartsessie',
  spss: 'pm_spss_antwoorden',
  dagen: 'pm_oefendagen',
  extra: 'pm_extra_vragen'
};

const LETTERS = ['A', 'B', 'C', 'D'];
const NAAM = INSTELLINGEN.naam;
const WISKUNDE_ZIN = `Ik vind wiskunde en formules lastig. Leg het daarom uit in gewone taal, stap voor stap, met een voorbeeld uit het dagelijks leven. Leg elke rekenstap apart uit en gebruik geen formules zonder te zeggen wat ze betekenen.`;

let DATA = null;          // { vragen, begrippen, spss, bronnenPerOnderwerp }
let DATABRON = '';
let RUW_BASIS = null;     // de vragenbank zoals ingelezen, zonder zelf toegevoegde vragen
let WAARSCHUWINGEN = [];
let TOETS = null;         // de toets of oefenronde die nu openstaat
let timerId = null;
let toetsHandler = null;  // sneltoetsen voor het huidige scherm

/* =========================================================
   Icoontjes (eenvoudige lijntekeningen)
   ========================================================= */
const ICOON_PADEN = {
  oefenen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  toets: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 2h6"/>',
  kaarten: '<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>',
  spss: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="5" rx="1"/><rect x="12" y="8" width="3" height="9" rx="1"/><rect x="17" y="5" width="3" height="12" rx="1"/>',
  voortgang: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  lamp: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2Z"/>',
  vlam: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-4 3 0-2 0-4-2-7-1 4-6 7-6 13 0 4 4 7 9 7Z"/>',
  boek: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  ster: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
  pauze: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  kruis: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  doel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  hart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  lach: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  kopie: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'
};
const icoon = naam => `<svg class="icoon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICOON_PADEN[naam] || ''}</svg>`;
const icoonChip = (naam, kleur, klasse = 'tegel-icoon') => `<span class="${klasse} kleur-${kleur}">${icoon(naam)}</span>`;

/* =========================================================
   Motivatie en grapjes
   ========================================================= */
const TROTS = 'Je man is trots op je!';

const GOED_ZINNEN = [
  'Goed zo, {naam}!', 'Yes! Helemaal raak.', 'Kijk jou gaan, {naam}!',
  'Raak! Daar kan geen meetfout tegenop.', 'Helemaal goed. Je man is trots op je!',
  'Spot on! Jouw z-score voor deze vraag: torenhoog.', 'Precies goed, {naam}. Professorniveau!'
];
const FOUT_ZINNEN = [
  'Oeps, {naam}! Deze vraag was even slimmer dan jij. Even.',
  'Bijna! Je brein nam de toeristische route.',
  'Niet erg, {naam}. Dit is gewoon een meetfout met een leerdoel.',
  'Plot twist: het juiste antwoord is een ander.',
  'Die vraag had een valkuil, en jij stapte er keurig in. 😄',
  'Geen paniek, {naam}! Liever hier fout dan straks op de toets.',
  'Creatief antwoord! Alleen niet het goede.',
  'Ernaast, maar wel met stijl.'
];
const GRAPJES = {
  'Betrouwbaarheid': [
    'Mijn weegschaal is super betrouwbaar: hij geeft elke ochtend precies 3 kilo te weinig aan. Valide? Daar praten we niet over. 🤫',
    'Cronbach\'s alpha ging naar relatietherapie. "We hangen gewoon niet meer samen," zeiden de items.',
    'Twee beoordelaars kregen ruzie over een essay. Gelukkig kwam Cohen langs met zijn kappa om de vrede te bewaren.'
  ],
  'Validiteit': [
    'Betrouwbaarheid en validiteit gaan uit eten. Betrouwbaarheid is elke keer precies op tijd. Validiteit ook… maar steeds bij het verkeerde restaurant.',
    'Een horoscoop is heel betrouwbaar: elke week precies even vaag. Valide is hij helaas niet.'
  ],
  'Klassieke testtheorie': [
    'Wat zei de meetfout tegen de ware score? "Zonder mij ben je maar saai."',
    'Mijn ware score voor koken is een 9. Mijn geobserveerde score is aangebrande pasta. Dat noemen we meetfout.'
  ],
  'Itemanalyse': [
    'Een item met een negatieve item-restcorrelatie zei: "Ik ben niet dwars, ik ben gewoon niet omgepoold!"',
    'Een item met p = .99 kwam op een feestje. Iedereen kende hem al.'
  ],
  'Normering': [
    'Waarom was de z-score zo zelfverzekerd? Hij wist precies hoeveel standaarddeviaties hij boven het gemiddelde zat.',
    'Een statisticus zit met zijn hoofd in de oven en zijn voeten in de vriezer. "Gemiddeld voel ik me prima," zegt hij. (Daarom kijk je óók naar de spreiding!)'
  ],
  'Factoranalyse': [
    'Hoe noem je een factor met een eigenwaarde van 0,3? Een bijzaak.',
    'Waarom houden factoren zo van oblique rotatie? Dan mogen ze eindelijk een beetje tegen elkaar aan leunen.'
  ],
  'algemeen': [
    'Wat zegt een statisticus als hij twijfelt? "Ik weet het voor 95% zeker… denk ik."',
    'Statistici gaan nooit alleen naar een feestje. Ze nemen altijd een steekproef mee.',
    'Waarom nam de psychometricus een ladder mee naar college? Hij had gehoord dat het over hogere-orde factoren ging.'
  ]
};

function hashGetal(tekst) {
  let h = 0;
  for (const c of String(tekst)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
const kiesUit = (lijst, zaad) => lijst[hashGetal(zaad) % lijst.length];
const metNaam = zin => zin.replace('{naam}', NAAM);
function grapjeVoor(onderwerp, zaad) {
  return kiesUit([...(GRAPJES[onderwerp] || []), ...GRAPJES.algemeen], zaad + 'mop');
}

function confetti(aantal = 70) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const laag = document.createElement('div');
  laag.className = 'confetti';
  laag.setAttribute('aria-hidden', 'true');
  const kleuren = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)', 'var(--accent-4)', 'var(--let-op)'];
  for (let i = 0; i < aantal; i++) {
    const stukje = document.createElement('i');
    stukje.style.left = `${Math.random() * 100}%`;
    stukje.style.background = kleuren[i % kleuren.length];
    stukje.style.animationDelay = `${Math.random() * .5}s`;
    stukje.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    stukje.style.setProperty('--zwaai', `${(Math.random() - .5) * 160}px`);
    if (i % 3 === 0) stukje.style.borderRadius = '50%';
    laag.appendChild(stukje);
  }
  document.body.appendChild(laag);
  setTimeout(() => laag.remove(), 3600);
}

/* =========================================================
   Hulpfuncties
   ========================================================= */
const app = document.getElementById('app');
const strook = document.getElementById('strook');

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
  const opties = { day: 'numeric', month: 'short', year: 'numeric' };
  if (metTijd) Object.assign(opties, { hour: '2-digit', minute: '2-digit' });
  return new Date(iso).toLocaleString('nl-NL', opties);
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
  meldingTimer = setTimeout(() => el.classList.remove('zichtbaar'), 2800);
}

async function kopieer(tekst, bericht = 'Gekopieerd! Plak het in je Claude-project.') {
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
  melding(bericht);
}

const vraagOpId = id => DATA.vragen.find(v => v.id === id);
const onderwerpen = () => [...new Set(DATA.vragen.map(v => v.onderwerp))].sort((a, b) => a.localeCompare(b, 'nl'));
const dagSleutel = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function groet() {
  const u = new Date().getHours();
  if (u < 6) return 'Goedenacht';
  if (u < 12) return 'Goedemorgen';
  if (u < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

/* =========================================================
   Voortgang berekenen
   ========================================================= */
function alleToetsen() { return opslag.lees(SLEUTEL.toetsen, []); }
const isProeftoets = t => t.modus !== 'oefen';

function registreerDag() {
  const dagen = opslag.lees(SLEUTEL.dagen, []);
  const vandaag = dagSleutel();
  if (!dagen.includes(vandaag)) { dagen.push(vandaag); opslag.schrijf(SLEUTEL.dagen, dagen.slice(-400)); }
}

function dagenOpRij() {
  const dagen = new Set(opslag.lees(SLEUTEL.dagen, []));
  const d = new Date();
  if (!dagen.has(dagSleutel(d))) d.setDate(d.getDate() - 1); // vandaag nog niet geoefend? tel vanaf gisteren
  let n = 0;
  while (dagen.has(dagSleutel(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** Laatste poging per vraag: goed of fout. */
function laatstePogingen() {
  const laatst = {};
  alleToetsen().forEach(t => t.items.forEach(it => { if (it.gekozen) laatst[it.id] = it.gekozen === it.juist; })); // overgeslagen telt niet als poging
  return laatst;
}

function beheersing() {
  const laatst = laatstePogingen();
  const beheerst = DATA.vragen.filter(v => laatst[v.id]).length;
  const fout = DATA.vragen.filter(v => laatst[v.id] === false).length;
  return { beheerst, fout, totaal: DATA.vragen.length };
}

function begrippenGeleerd() {
  const st = opslag.lees(SLEUTEL.kaarten, {});
  return DATA.begrippen.filter(b => st[b.id] && st[b.id].bak >= INSTELLINGEN.geleerdVanafBakje).length;
}

function strookHTML() {
  const b = beheersing();
  const geleerd = begrippenGeleerd();
  const proef = alleToetsen().filter(isProeftoets);
  const laatste = proef[proef.length - 1];
  const vorige = proef[proef.length - 2];
  let trend = '';
  if (laatste && vorige) trend = laatste.cijfer > vorige.cijfer ? '<span class="trend-op" aria-label="omhoog">↑</span>'
    : laatste.cijfer < vorige.cijfer ? '<span class="trend-neer" aria-label="omlaag">↓</span>' : '<span class="zacht">→</span>';
  const reeks = dagenOpRij();
  const item = (ic, kleur, label, waarde, deel, totaal) => `
    <div class="strook-item">
      ${icoonChip(ic, kleur, 'strook-icoon')}
      <span class="strook-label">${label}</span>
      <span class="strook-waarde">${waarde}
        ${totaal !== undefined ? `<span class="mini-balk kleur-${kleur}" style="background:var(--vlak-2)" aria-hidden="true"><div style="width:${procent(deel, totaal)}%"></div></span>` : ''}</span>
    </div>`;
  return `<div class="strook-binnen">
    ${item('check', 1, 'Vragen onder de knie', `${b.beheerst}/${b.totaal}`, b.beheerst, b.totaal)}
    ${item('kaarten', 3, 'Begrippen geleerd', `${geleerd}/${DATA.begrippen.length}`, geleerd, DATA.begrippen.length)}
    ${item('ster', 2, 'Laatste proeftoets', laatste ? `${cijferTekst(laatste.cijfer)} ${trend}` : '–')}
    ${item('vlam', 4, 'Dagen op rij', reeks ? `${reeks} ${reeks === 1 ? 'dag' : 'dagen'}` : '–')}
  </div>`;
}

function stofProcent() {
  const b = beheersing();
  const bg = DATA.begrippen.length;
  const deelVragen = b.totaal ? b.beheerst / b.totaal : 0;
  const deelBegrip = bg ? begrippenGeleerd() / bg : deelVragen;
  return Math.round(100 * (0.65 * deelVragen + 0.35 * deelBegrip));
}

function ringHTML(pct) {
  const r = 52, omtrek = 2 * Math.PI * r;
  return `<div class="ring" role="img" aria-label="${pct} procent van de stof onder de knie">
    <svg viewBox="0 0 120 120"><circle class="ring-spoor" cx="60" cy="60" r="${r}"></circle>
      <circle class="ring-vul" cx="60" cy="60" r="${r}" stroke-dasharray="${omtrek}" stroke-dashoffset="${omtrek}" data-doel="${omtrek * (1 - pct / 100)}"></circle></svg>
    <div class="ring-tekst"><b>${pct}%</b><span>van de stof<br>onder de knie</span></div>
  </div>`;
}

function animeerRing() {
  const vul = app.querySelector('.ring-vul');
  if (vul) requestAnimationFrame(() => requestAnimationFrame(() => { vul.style.strokeDashoffset = vul.dataset.doel; }));
}

function toonStrook(zichtbaar) {
  strook.hidden = !zichtbaar;
  if (zichtbaar) strook.innerHTML = strookHTML();
}

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
      juist: v.juist, uitleg: v.uitleg || '', denkfouten: v.denkfouten || {}, herkennen: v.herkennen || '',
      simpel: v.simpel || '', stappen: Array.isArray(v.stappen) ? v.stappen : [],
      zoekterm: v.zoekterm || '', bronnen: Array.isArray(v.bronnen) ? v.bronnen : []
    };
  });
  const ids = vragen.map(v => v.id);
  ids.filter((id, i) => ids.indexOf(id) !== i).forEach(id => fouten.push(`Het id "${id}" komt meer dan één keer voor.`));

  const begrippen = (ruw.begrippen || []).map((b, i) => ({
    id: b.id || `begrip-${i + 1}`, begrip: b.begrip || '', definitie: b.definitie || '', voorbeeld: b.voorbeeld || ''
  }));
  const spss = (ruw.spss || []).map((s, i) => ({
    id: s.id || `spss-${i + 1}`, onderwerp: s.onderwerp || 'SPSS', vraag: s.vraag || '', output: s.output || '',
    richtlijn: s.richtlijn || '', bronnen: Array.isArray(s.bronnen) ? s.bronnen : []
  }));
  if (!vragen.length) fouten.push('Er staan geen vragen in het bestand (lijst "vragen").');
  return { data: { vragen, begrippen, spss, bronnenPerOnderwerp: ruw.bronnenPerOnderwerp || {} }, fouten };
}

function leesExtra() {
  const e = opslag.lees(SLEUTEL.extra, null) || {};
  return { vragen: e.vragen || [], begrippen: e.begrippen || [], spss: e.spss || [] };
}

/** vragenbank + zelf toegevoegde vragen (die nog niet in vragen.json staan) */
function samengevoegd(ruw) {
  const extra = leesExtra();
  const voeg = (basis, erbij) => {
    const ids = new Set((basis || []).map(x => x.id));
    return [...(basis || []), ...erbij.filter(x => !ids.has(x.id))];
  };
  return { ...ruw, vragen: voeg(ruw.vragen, extra.vragen), begrippen: voeg(ruw.begrippen, extra.begrippen), spss: voeg(ruw.spss, extra.spss) };
}

function zetData(ruw, bron) {
  RUW_BASIS = ruw;
  const { data, fouten } = normaliseer(samengevoegd(ruw));
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
      <h1>${groet()}, ${esc(NAAM)}!</h1>
      <p>Nog één klein stapje voordat je kunt beginnen. De site kon <code>vragen.json</code> niet automatisch openen.
      Dat gebeurt vaak als je <code>index.html</code> direct vanaf je computer opent.</p>
      <p>Kies hieronder het bestand <code>vragen.json</code> uit dezelfde map. De browser onthoudt het daarna.</p>
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
  if (!DATA) { strook.hidden = true; laadScherm(); return; }

  const [view, arg] = (location.hash.slice(1) || 'start').split('/');
  const menuView = view === 'resultaat' ? 'voortgang' : view;
  document.querySelectorAll('.menu a').forEach(a => a.classList.toggle('actief', a.dataset.view === menuView));

  // tijdens een proeftoets geen afleiding bovenaan
  toonStrook(!(view === 'toets' && TOETS && TOETS.modus === 'toets'));

  switch (view) {
    case 'toets': toetsScherm(arg); break;
    case 'resultaat': resultaatScherm(arg); break;
    case 'kaarten': kaartenScherm(); break;
    case 'spss': spssScherm(); break;
    case 'voortgang': voortgangScherm(); break;
    case 'nieuw': nieuwScherm(); break;
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
  const toetsen = alleToetsen();
  const proef = toetsen.filter(isProeftoets);
  const laatste = proef[proef.length - 1];
  const zwak = zwakkeOnderwerpen(toetsen).filter(z => z.score < INSTELLINGEN.zwakGrens);
  const kaartSessie = opslag.lees(SLEUTEL.kaartSessie, null);
  const teHerhalen = kaartenTeHerhalen().length;
  const b = beheersing();

  let zin;
  if (TOETS) zin = `Je was gebleven bij vraag ${TOETS.huidig + 1} van ${TOETS.vragen.length}. Zullen we daar verdergaan?`;
  else if (!toetsen.length) zin = 'Fijn dat je er bent! Begin rustig met een oefenronde: bij elke fout krijg je meteen uitleg in gewone taal.';
  else if (laatste && laatste.cijfer >= INSTELLINGEN.voldoende) zin = `Je laatste proeftoets was een ${cijferTekst(laatste.cijfer)}. Goed bezig, ga zo door!`;
  else if (laatste) zin = `Je laatste proeftoets was een ${cijferTekst(laatste.cijfer)}. Geen zorgen: elke fout is iets wat je nú leert, en niet straks op de toets.`;
  else zin = `Je hebt al ${b.beheerst} van de ${b.totaal} vragen onder de knie. Mooi!`;

  const verder = [];
  if (TOETS) verder.push(`
    <div class="kaart verder banner">
      ${icoonChip(TOETS.modus === 'toets' ? 'toets' : 'oefenen', 1)}
      <div class="banner-tekst"><strong>${TOETS.modus === 'toets' ? 'Je proeftoets staat nog open' : 'Je oefenronde staat nog open'}</strong>
        <span class="zacht klein">Vraag ${TOETS.huidig + 1} van ${TOETS.vragen.length} · ${Object.keys(TOETS.antwoorden).length} beantwoord${TOETS.modus === 'toets' ? ` · nog ${klok(TOETS.rest)} tijd` : ''}</span></div>
      <a class="knop" href="#toets">Verder waar je was</a>
    </div>`);
  if (kaartSessie && kaartSessie.rij && kaartSessie.rij.length && (kaartSessie.goed + kaartSessie.fout) > 0) verder.push(`
    <div class="kaart verder banner">
      ${icoonChip('kaarten', 3)}
      <div class="banner-tekst"><strong>Je flitskaarten-ronde staat nog open</strong><span class="zacht klein">Nog ${kaartSessie.rij.length} kaarten in deze ronde</span></div>
      <a class="knop licht" href="#kaarten">Verder met kaarten</a>
    </div>`);

  app.innerHTML = `
    <section class="hero">
      <div class="hero-tekst">
        <div class="dagdeel">${new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1>${groet()}, ${esc(NAAM)}!</h1>
        <p>${esc(zin)}</p>
        <div class="trots">${icoon('hart')} ${TROTS}</div>
      </div>
      <span class="ster ster-1" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/></svg></span>
      <span class="ster ster-2" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/></svg></span>
      <span class="ster ster-3" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/></svg></span>
      ${ringHTML(stofProcent())}
      ${!TOETS ? `<div class="rij hero-actie"><a class="knop groot" href="#toets">${icoon('oefenen')} Begin met oefenen</a></div>` : ''}
    </section>

    ${verder.join('')}

    ${!TOETS && zwak.length ? `
      <div class="kaart tip-kaart banner">
        ${icoonChip('lamp', 2)}
        <div class="banner-tekst"><strong>Tip voor vandaag</strong>
          <span class="klein">Oefen <strong style="display:inline">${esc(zwak[0].onderwerp)}</strong>: daar had je ${procent(zwak[0].goed, zwak[0].totaal)}% goed. Met uitleg bij elke vraag.</span></div>
        <button class="knop" id="oefenZwak">Oefen dit onderwerp</button>
      </div>` : ''}

    ${!TOETS && b.fout ? `
      <div class="kaart banner">
        ${icoonChip('doel', 4)}
        <div class="banner-tekst"><strong>${b.fout} ${b.fout === 1 ? 'vraag' : 'vragen'} nog niet goed</strong>
          <span class="zacht klein">Oefen precies de vragen die je de laatste keer fout had.</span></div>
        <button class="knop licht" id="oefenFouten">Mijn fouten oefenen</button>
      </div>` : ''}

    <div class="raster">
      <a class="tegel" href="#toets">${icoonChip('oefenen', 1)}<h3>Oefenen of proeftoets</h3><p>Meteen uitleg bij elke vraag, of een proeftoets met timer en cijfer.</p><span class="pijl">Starten →</span></a>
      <a class="tegel" href="#kaarten">${icoonChip('kaarten', 3)}<h3>Flitskaarten</h3><p>${teHerhalen ? `${teHerhalen} begrippen staan klaar om te herhalen.` : 'Alles herhaald voor vandaag!'}</p><span class="pijl">Naar de kaarten →</span></a>
      <a class="tegel" href="#spss">${icoonChip('spss', 2)}<h3>SPSS-opdrachten</h3><p>De juiste analyse kiezen en output leren lezen.</p><span class="pijl">Opdrachten →</span></a>
      <a class="tegel" href="#voortgang">${icoonChip('voortgang', 4)}<h3>Voortgang</h3><p>Je cijfers over tijd en waar je nog op kunt letten.</p><span class="pijl">Bekijken →</span></a>
      <a class="tegel tegel-nieuw" href="#nieuw">${icoonChip('plus', 2)}<h3>Nieuwe vragen</h3><p>Laat Claude elke week nieuwe vragen maken over jouw zwakke plekken.</p><span class="pijl">Vragen maken →</span></a>
    </div>

    <details class="kaart" style="margin-top:16px">
      <summary style="cursor:pointer;font-weight:600">Over de vragenbank</summary>
      <p class="zacht klein" style="margin-top:10px">Geladen uit: ${esc(DATABRON)}<br>
      ${DATA.vragen.length} meerkeuzevragen · ${DATA.begrippen.length} begrippen · ${DATA.spss.length} SPSS-opdrachten · ${onderwerpen().length} onderwerpen
      ${aantalExtra() ? `<br>Waarvan ${aantalExtra()} zelf toegevoegd via <a href="#nieuw">Nieuwe vragen</a>.` : ''}</p>
      ${WAARSCHUWINGEN.length ? `<div class="waarschuwing" style="margin-bottom:12px"><strong>Let op, er klopt iets niet in het vragenbestand:</strong>
        <ul>${WAARSCHUWINGEN.slice(0, 15).map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        ${WAARSCHUWINGEN.length > 15 ? `<p class="klein">…en nog ${WAARSCHUWINGEN.length - 15} meldingen.</p>` : ''}</div>` : ''}
      <label class="knop licht" style="cursor:pointer">Ander vragenbestand kiezen
        <input type="file" accept=".json,application/json" hidden id="bestandKiezer"></label>
    </details>`;

  document.getElementById('bestandKiezer').addEventListener('change', e => leesBestand(e.target));
  animeerRing();
  const oz = document.getElementById('oefenZwak');
  if (oz) oz.addEventListener('click', () => startSessie('oefen', 20, zwak[0].onderwerp));
  const of = document.getElementById('oefenFouten');
  if (of) of.addEventListener('click', () => startSessie('oefen', 40, '__fouten'));
}

/* =========================================================
   Oefenen en proeftoets
   ========================================================= */
function bewaarToets() {
  if (TOETS) opslag.schrijf(SLEUTEL.actief, TOETS); else opslag.wis(SLEUTEL.actief);
}

function laadActieveToets() {
  const t = opslag.lees(SLEUTEL.actief, null);
  if (!t) return null;
  // oudere versie gebruikte een eindtijd; omzetten naar resterende tijd
  if (t.rest === undefined) {
    t.modus = t.modus || 'toets';
    t.rest = t.eind ? Math.max(0, t.eind - Date.now()) : 0;
    t.totaalMs = t.eind && t.start ? t.eind - t.start : t.rest;
  }
  return t;
}

function vragenPool(keuze) {
  if (keuze === '__fouten') {
    const laatst = laatstePogingen();
    return DATA.vragen.filter(v => laatst[v.id] === false);
  }
  return DATA.vragen.filter(v => !keuze || v.onderwerp === keuze);
}

function startSessie(modus, n, keuze) {
  const pool = vragenPool(keuze);
  const gekozen = schud(pool).slice(0, n);
  if (!gekozen.length) { melding(keuze === '__fouten' ? 'Je hebt geen foute vragen meer. Knap!' : 'Geen vragen beschikbaar.'); return; }
  const totaalMs = modus === 'toets' ? Math.round(gekozen.length * INSTELLINGEN.minutenPerVraag * 60000) : 0;
  TOETS = {
    modus,
    vragen: gekozen.map(v => v.id),
    antwoorden: {},
    huidig: 0,
    start: new Date().toISOString(),
    rest: totaalMs,
    totaalMs,
    onderwerp: keuze === '__fouten' ? 'Mijn foute vragen' : (keuze || '')
  };
  bewaarToets();
  if (location.hash === '#toets') route(); else location.hash = '#toets';
}

function toetsScherm() {
  if (TOETS) { toetsVraag(); return; }

  const opties = onderwerpen();
  const aantalFout = beheersing().fout;
  app.innerHTML = `
    <h1>Oefenen of proeftoets</h1>
    <div class="kaart">
      <div class="veld"><span>Wat wil je doen, ${esc(NAAM)}?</span>
        <div class="modus-keuze" role="radiogroup">
          <label><input type="radio" name="modus" value="oefen" checked>${icoonChip('lamp', 1)}
            <span><strong>Oefenen met uitleg</strong><br><span class="zacht klein">Na elke vraag zie je meteen of het goed is. Bij een fout krijg je uitleg in gewone taal, rekenstappen en links naar goede uitleg online. Geen tijdsdruk.</span></span></label>
          <label><input type="radio" name="modus" value="toets">${icoonChip('toets', 2)}
            <span><strong>Proeftoets</strong><br><span class="zacht klein">Net als de echte bloktoets: met timer, en pas aan het eind je cijfer en de uitleg.</span></span></label>
        </div>
      </div>
      <div class="veld"><span>Aantal vragen</span>
        <div class="keuze" role="radiogroup">
          <label><input type="radio" name="aantal" value="10" checked><span>10</span></label>
          <label><input type="radio" name="aantal" value="20"><span>20</span></label>
          <label><input type="radio" name="aantal" value="40"><span>40</span></label>
        </div>
      </div>
      <label class="veld"><span>Welke vragen?</span>
        <select id="onderwerp">
          <option value="">Alle onderwerpen</option>
          ${aantalFout ? `<option value="__fouten">Mijn foute vragen opnieuw (${aantalFout})</option>` : ''}
          ${opties.map(o => `<option value="${esc(o)}">Alleen ${esc(o)}</option>`).join('')}
        </select>
      </label>
      <p class="zacht klein" id="toetsInfo"></p>
      <button class="knop groot" id="startToets">Start</button>
    </div>
    <p class="zacht klein">Je kunt altijd op <strong>Pauzeren</strong> drukken (of de site gewoon sluiten). Alles wordt bewaard en je gaat later verder waar je was. Bij een proeftoets staat de timer dan ook stil.</p>`;

  const keuzes = () => ({
    modus: document.querySelector('input[name=modus]:checked').value,
    n: Number(document.querySelector('input[name=aantal]:checked').value),
    ow: document.getElementById('onderwerp').value
  });
  const info = () => {
    const { modus, n, ow } = keuzes();
    const beschikbaar = vragenPool(ow).length;
    const echt = Math.min(n, beschikbaar);
    let t = modus === 'toets'
      ? `Tijd: ${Math.round(echt * INSTELLINGEN.minutenPerVraag)} minuten voor ${echt} vragen.`
      : `${echt} vragen, zonder tijdsdruk.`;
    if (beschikbaar < n) t += ` Er zijn ${beschikbaar} vragen beschikbaar${ow ? ' in deze keuze' : ''}, dus de ronde wordt wat korter.`;
    document.getElementById('toetsInfo').textContent = t;
  };
  app.querySelectorAll('input[name=aantal], input[name=modus], #onderwerp').forEach(el => el.addEventListener('change', info));
  info();

  document.getElementById('startToets').addEventListener('click', () => {
    const { modus, n, ow } = keuzes();
    startSessie(modus, n, ow);
  });
}

function toetsVraag() {
  const t = TOETS;
  const oefen = t.modus === 'oefen';
  const n = t.vragen.length;
  const v = vraagOpId(t.vragen[t.huidig]);
  const gekozen = t.antwoorden[t.huidig];
  const vergrendeld = oefen && !!gekozen; // bij oefenen ligt je antwoord vast zodra je de uitleg hebt gezien
  const aantalBeantwoord = Object.keys(t.antwoorden).length;
  const aantalGoed = oefen ? Object.entries(t.antwoorden).filter(([i, L]) => { const q = vraagOpId(t.vragen[i]); return q && q.juist === L; }).length : 0;

  const optieKlasse = L => {
    if (!vergrendeld) return gekozen === L ? 'gekozen' : '';
    if (L === v.juist) return 'is-juist';
    if (L === gekozen) return 'is-fout';
    return 'uit';
  };

  app.innerHTML = `
    <div class="toets-kop">
      <strong>Vraag ${t.huidig + 1} van ${n}</strong>
      <div class="voortgangsbalk" aria-hidden="true"><div style="width:${procent(aantalBeantwoord, n)}%"></div></div>
      ${oefen
        ? `<span class="timer">${aantalGoed} goed</span>`
        : `<span class="timer" id="timer" aria-label="Resterende tijd">${klok(t.rest)}</span>`}
    </div>

    <div class="kaart">
      ${v ? `
        <span class="onderwerp-label">${esc(v.onderwerp)}</span>
        <div class="vraagtekst">${tekstHTML(v.vraag)}</div>
        <div class="opties">
          ${LETTERS.map(L => `
            <button class="optie ${optieKlasse(L)}" data-letter="${L}" aria-pressed="${gekozen === L}" ${vergrendeld ? 'disabled' : ''}>
              <span class="letter">${L}</span><span>${tekstHTML(v.opties[L])}</span>
            </button>`).join('')}
        </div>
        ${vergrendeld ? `<div class="feedback">${uitlegHTML(v, gekozen, true, `${v.id}|${t.start}`)}${reeksHTML(t)}</div>` : ''}
        ` : '<p>Deze vraag staat niet meer in de vragenbank. Ga door naar de volgende.</p>'}
    </div>

    <div class="rij-tussen">
      <button class="knop licht" id="vorige" ${t.huidig === 0 ? 'disabled' : ''}>← Vorige</button>
      ${t.huidig < n - 1
        ? `<button class="knop" id="volgende">${oefen && !gekozen ? 'Overslaan →' : 'Volgende →'}</button>`
        : `<button class="knop" id="inleveren2">${oefen ? 'Ronde afronden' : 'Toets inleveren'}</button>`}
    </div>

    <div class="kaart" style="margin-top:16px">
      <div class="rij-tussen">
        <span class="klein zacht">${aantalBeantwoord} van ${n} beantwoord</span>
        <div class="rij">
          <button class="knop licht" id="pauze">${icoon('pauze')} Pauzeren</button>
          <button class="knop licht" id="inleveren">${oefen ? 'Afronden' : 'Inleveren'}</button>
        </div>
      </div>
      <div class="nummers">
        ${t.vragen.map((id, i) => {
          let k = t.antwoorden[i] ? 'beantwoord' : '';
          if (oefen && t.antwoorden[i]) { const q = vraagOpId(id); k = q && q.juist === t.antwoorden[i] ? 'nr-goed' : 'nr-fout'; }
          return `<button data-nr="${i}" class="${k} ${i === t.huidig ? 'huidig' : ''}" aria-label="Ga naar vraag ${i + 1}">${i + 1}</button>`;
        }).join('')}
      </div>
      <p class="klein zacht" style="margin:12px 0 0">
        <button class="linkknop" id="stoppen">${oefen ? 'Ronde' : 'Toets'} weggooien (telt niet mee)</button>
      </p>
    </div>`;

  const ga = i => { t.huidig = Math.max(0, Math.min(n - 1, i)); bewaarToets(); toetsVraag(); window.scrollTo(0, 0); };
  const kies = L => {
    if (vergrendeld || !v) return;
    t.antwoorden[t.huidig] = L;
    bewaarToets();
    registreerDag();
    toetsVraag();
    if (oefen) {
      const fb = app.querySelector('.feedback');
      if (fb) fb.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (L === v.juist) confetti(reeksGoed(t) >= 3 ? 90 : 35);
    }
  };

  app.querySelectorAll('.optie').forEach(b => b.addEventListener('click', () => kies(b.dataset.letter)));
  app.querySelectorAll('.nummers button').forEach(b => b.addEventListener('click', () => ga(Number(b.dataset.nr))));
  document.getElementById('vorige').addEventListener('click', () => ga(t.huidig - 1));
  const volgende = document.getElementById('volgende');
  if (volgende) volgende.addEventListener('click', () => ga(t.huidig + 1));
  const inleveren = () => {
    const open = n - Object.keys(t.antwoorden).length;
    const vraag = open
      ? `Je hebt nog ${open} ${open === 1 ? 'vraag' : 'vragen'} niet beantwoord. Toch ${oefen ? 'afronden' : 'inleveren'}?`
      : `Weet je zeker dat je wilt ${oefen ? 'afronden' : 'inleveren'}?`;
    if (confirm(vraag)) rondToetsAf(false);
  };
  document.getElementById('inleveren').addEventListener('click', inleveren);
  const inl2 = document.getElementById('inleveren2');
  if (inl2) inl2.addEventListener('click', inleveren);
  document.getElementById('pauze').addEventListener('click', () => {
    stopTimer();
    bewaarToets();
    melding(`Opgeslagen! Later ga je verder bij vraag ${t.huidig + 1}. ${TROTS}`);
    location.hash = '#start';
  });
  document.getElementById('stoppen').addEventListener('click', () => {
    if (confirm('Weet je het zeker? Je antwoorden van deze ronde worden niet bewaard.')) {
      stopTimer(); TOETS = null; bewaarToets(); route();
    }
  });
  app.querySelectorAll('[data-claude]').forEach(b => b.addEventListener('click', () =>
    kopieer(claudeVraagTekst(vraagOpId(b.dataset.claude), b.dataset.gekozen), 'Gekopieerd! Plak het in Claude voor extra uitleg.')));

  toetsHandler = e => {
    const k = e.key.toUpperCase();
    const idx = ['1', '2', '3', '4'].indexOf(k);
    if (LETTERS.includes(k)) kies(k);
    else if (idx >= 0) kies(LETTERS[idx]);
    else if (e.key === 'ArrowRight') ga(t.huidig + 1);
    else if (e.key === 'ArrowLeft') ga(t.huidig - 1);
  };

  if (!oefen) startTimer();
}

/** hoeveel vragen op rij goed, tot en met de huidige */
function reeksGoed(t) {
  let n = 0;
  for (let i = t.huidig; i >= 0; i--) {
    const q = vraagOpId(t.vragen[i]);
    if (q && t.antwoorden[i] === q.juist) n++; else break;
  }
  return n;
}
function reeksHTML(t) {
  const n = reeksGoed(t);
  if (n < 3) return '';
  const zin = n >= 5 ? `${n} op rij goed! Je bent niet te stoppen. ${TROTS}` : `${n} op rij goed! Lekker bezig, ${NAAM}.`;
  return `<p class="reeks">${icoon('vlam')} ${esc(zin)}</p>`;
}

/* De timer loopt alleen als de toets open op het scherm staat.
   Ga je weg of sluit je de site, dan blijft de resterende tijd bewaard. */
let timerEind = 0;
function startTimer() {
  if (timerId) return; // loopt al
  timerEind = Date.now() + TOETS.rest;
  let tel = 0;
  const tik = () => {
    if (!TOETS) { stopTimer(); return; }
    TOETS.rest = Math.max(0, timerEind - Date.now());
    if (++tel % 5 === 0) bewaarToets();
    const el = document.getElementById('timer');
    if (TOETS.rest <= 0) { stopTimer(); rondToetsAf(true); return; }
    if (el) {
      el.textContent = klok(TOETS.rest);
      el.classList.toggle('bijna', TOETS.rest < INSTELLINGEN.waarschuwingMinuten * 60000);
    }
  };
  tik();
  timerId = setInterval(tik, 1000);
}
function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    if (TOETS) { TOETS.rest = Math.max(0, timerEind - Date.now()); bewaarToets(); }
  }
}
// bij wegklikken of sluiten: tijd vastleggen
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && timerId && TOETS) { TOETS.rest = Math.max(0, timerEind - Date.now()); bewaarToets(); }
  if (document.visibilityState === 'hidden') { stopTimer(); }
  else if (TOETS && TOETS.modus === 'toets' && location.hash === '#toets') startTimer();
});
window.addEventListener('pagehide', () => stopTimer());

function rondToetsAf(tijdOp) {
  const t = TOETS;
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
    modus: t.modus,
    datum: new Date().toISOString(),
    aantal, goed,
    cijfer: Math.round((1 + 9 * goed / aantal) * 10) / 10,
    duurSec: t.modus === 'toets' ? Math.round((t.totaalMs - t.rest) / 1000) : null,
    tijdOp,
    onderwerp: t.onderwerp || '',
    items
  };
  const toetsen = alleToetsen();
  toetsen.push(resultaat);
  opslag.schrijf(SLEUTEL.toetsen, toetsen);
  TOETS = null;
  bewaarToets();
  if (tijdOp) melding('De tijd is op. Je toets is ingeleverd.');
  location.hash = `#resultaat/${resultaat.id}`;
}

/* =========================================================
   Uitleg bij een vraag (oefenen én resultaat)
   ========================================================= */
function bronnenVoor(v) {
  const eigen = v.bronnen.length ? v.bronnen : (DATA.bronnenPerOnderwerp[v.onderwerp] || []);
  const zoek = v.zoekterm || `${v.onderwerp} psychometrie uitleg`;
  return { eigen, zoek };
}

function bronnenHTML(eigen, zoek) {
  const q = encodeURIComponent(zoek);
  return `
    <div class="regel online">
      <strong>MEER UITLEG ONLINE</strong>
      <ul class="bronnen">
        ${eigen.map(b => `<li><a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.titel)}</a></li>`).join('')}
        <li><a href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">Zoek een uitlegvideo op YouTube</a></li>
        <li><a href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener">Zoek op Google: “${esc(zoek)}”</a></li>
      </ul>
    </div>`;
}

/** volledige uitleg: eerst in gewone taal, dan pas de technische kant */
function uitlegHTML(v, gekozen, metKop, zaad = v.id) {
  const goed = gekozen && gekozen === v.juist;
  const { eigen, zoek } = bronnenVoor(v);
  const lof = metNaam(kiesUit(GOED_ZINNEN, zaad));
  const oeps = metNaam(kiesUit(FOUT_ZINNEN, zaad));
  const metMopje = hashGetal(zaad + 'kans') % 2 === 0; // ongeveer de helft van de keren een mopje
  if (goed) {
    return `
      ${metKop ? `<p class="feedback-kop goed-kop"><span class="bol">${icoon('check')}</span>${esc(lof)}</p>` : ''}
      <div class="regel juist"><strong>WAAROM ${v.juist} KLOPT</strong>${tekstHTML(v.uitleg)}</div>
      ${v.herkennen ? `<div class="regel tip"><strong>ONTHOUD DIT TRUCJE</strong>${tekstHTML(v.herkennen)}</div>` : ''}`;
  }
  return `
    ${metKop ? `<div class="feedback-kop fout-kop"><span class="bol">${icoon('lamp')}</span><span>${gekozen ? esc(oeps) : 'Deze heb je overgeslagen.'}<small>Het juiste antwoord is ${v.juist}. Zo zit het:</small></span></div>` : ''}
    ${v.simpel ? `<div class="regel simpel"><strong>IN GEWONE TAAL</strong>${tekstHTML(v.simpel)}</div>` : ''}
    ${v.stappen.length ? `<div class="regel stappen"><strong>STAP VOOR STAP UITGEREKEND</strong>
      <ol>${v.stappen.map(s => `<li>${tekstHTML(s)}</li>`).join('')}</ol></div>` : ''}
    ${gekozen ? `<div class="regel jouw"><strong>WAAROM ${gekozen} NIET KLOPT</strong>${tekstHTML(v.denkfouten[gekozen] || 'Vergelijk je antwoord met de uitleg hieronder.')}</div>` : ''}
    <div class="regel juist"><strong>JUIST: ${v.juist}. ${esc(v.opties[v.juist])}</strong>${tekstHTML(v.uitleg)}</div>
    ${v.herkennen ? `<div class="regel tip"><strong>ZO HERKEN JE HET VOLGENDE KEER</strong>${tekstHTML(v.herkennen)}</div>` : ''}
    ${metMopje ? `<div class="regel mopje"><strong>EVEN EEN MOPJE, OM DE FOUT WEG TE LACHEN</strong>${esc(grapjeVoor(v.onderwerp, zaad))}</div>` : ''}
    ${bronnenHTML(eigen, zoek)}
    <button class="knop licht klein-knop" data-claude="${esc(v.id)}" data-gekozen="${esc(gekozen || '')}">Nog niet duidelijk? Kopieer deze vraag voor Claude</button>`;
}

function claudeVraagTekst(v, gekozen) {
  return [
    `Hoi Claude, ik ben ${NAAM} en ik oefen voor het vak psychometrie. Ik snap deze vraag nog niet goed.`,
    WISKUNDE_ZIN,
    '',
    `Onderwerp: ${v.onderwerp}`,
    `Vraag: ${v.vraag}`,
    ...LETTERS.map(L => `${L}. ${v.opties[L]}`),
    '',
    `Mijn antwoord: ${gekozen ? `${gekozen}. ${v.opties[gekozen]}` : 'niet beantwoord'}`,
    `Juiste antwoord: ${v.juist}. ${v.opties[v.juist]}`,
    '',
    'Leg uit waarom het juiste antwoord klopt en waar mijn denkfout zat. Geef me daarna één vergelijkbare oefenvraag (zonder meteen het antwoord te geven).'
  ].join('\n');
}

/* =========================================================
   Resultaat na een toets of oefenronde
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
  const toetsen = alleToetsen();
  const r = toetsen.find(x => x.id === id) || toetsen[toetsen.length - 1];
  if (!r) { app.innerHTML = '<div class="kaart"><p>Nog niets gevonden.</p><a class="knop" href="#toets">Begin met oefenen</a></div>'; return; }

  const oefen = r.modus === 'oefen';
  const voldoende = r.cijfer >= INSTELLINGEN.voldoende;
  const fouten = r.items.filter(it => it.gekozen !== it.juist);
  const per = scorePerOnderwerp(r.items);
  let boodschap;
  let trotsZin;
  if (r.goed === r.aantal) { boodschap = `Alles goed, ${NAAM}! Wat knap. Zelfs Cronbach is jaloers.`; trotsZin = `${TROTS} Echt héél trots.`; }
  else if (voldoende) { boodschap = `Voldoende, ${NAAM}! Goed bezig. Kijk hieronder nog even naar de vragen die fout gingen.`; trotsZin = TROTS; }
  else { boodschap = `Nog geen voldoende, ${NAAM}, maar dat is precies waarom je oefent. Elke fout hier is er één minder op de echte toets.`; trotsZin = `${TROTS} Ook nu, omdat je doorzet.`; }

  app.innerHTML = `
    <h1>${oefen ? 'Oefenronde klaar' : 'Resultaat proeftoets'}</h1>
    <div class="kaart">
      <div class="cijfer-blok">
        <div class="cijfer ${voldoende ? 'voldoende' : 'onvoldoende'}">${cijferTekst(r.cijfer)}</div>
        <div>
          <p style="margin:0 0 4px"><strong>${r.goed} van ${r.aantal} goed</strong> (${procent(r.goed, r.aantal)}%)</p>
          <p class="zacht klein" style="margin:0">${datumTekst(r.datum)}${r.duurSec !== null && r.duurSec !== undefined ? ` · tijd: ${duurTekst(r.duurSec)}` : ''}${r.tijdOp ? ' · tijd was op' : ''}${r.onderwerp ? ` · ${esc(r.onderwerp)}` : ''}</p>
          <p style="margin:8px 0 0">${esc(boodschap)}</p>
          <div class="trots" style="margin-top:12px">${icoon('hart')} ${esc(trotsZin)}</div>
        </div>
      </div>
      <div class="rij" style="margin-top:16px">
        <button class="knop" id="kopieer">Kopieer resultaten voor Claude</button>
        ${fouten.length ? '<button class="knop licht" id="foutenOpnieuw">Oefen deze fouten opnieuw</button>' : ''}
        <a class="knop licht" href="#toets">Nieuwe ronde</a>
      </div>
    </div>

    <div class="kaart">
      <h2>Score per onderwerp</h2>
      ${balkenHTML(per)}
    </div>

    <h2 style="margin-top:24px">${fouten.length ? `Je fouten, met uitleg (${fouten.length})` : 'Geen fouten!'}</h2>
    ${fouten.map((it, i) => foutKaart(it, i)).join('')}

    ${r.goed ? `<details class="kaart"><summary style="cursor:pointer;font-weight:600">Bekijk ook de vragen die je goed had (${r.goed})</summary>
      ${r.items.filter(it => it.gekozen === it.juist).map(it => {
        const v = vraagOpId(it.id);
        return v ? `<div style="margin-top:14px"><span class="onderwerp-label">${esc(v.onderwerp)}</span>
          <p>${tekstHTML(v.vraag)}</p><p class="klein"><strong>${it.juist}. ${esc(v.opties[it.juist])}</strong><br><span class="zacht">${tekstHTML(v.uitleg)}</span></p></div>` : '';
      }).join('')}</details>` : ''}`;

  document.getElementById('kopieer').addEventListener('click', () => kopieer(resultaatTekst(r)));
  if (voldoende && r.id === (toetsen[toetsen.length - 1] || {}).id && Date.now() - new Date(r.datum).getTime() < 15000) confetti(140);
  const fo = document.getElementById('foutenOpnieuw');
  if (fo) fo.addEventListener('click', () => {
    const ids = fouten.map(f => f.id).filter(vraagOpId);
    if (TOETS && !confirm('Je hebt nog een ronde openstaan. Die wordt dan vervangen. Doorgaan?')) return;
    TOETS = { modus: 'oefen', vragen: schud(ids), antwoorden: {}, huidig: 0, start: new Date().toISOString(), rest: 0, totaalMs: 0, onderwerp: 'Fouten opnieuw' };
    bewaarToets();
    location.hash = '#toets';
  });
  app.querySelectorAll('[data-claude]').forEach(b => b.addEventListener('click', () =>
    kopieer(claudeVraagTekst(vraagOpId(b.dataset.claude), b.dataset.gekozen), 'Gekopieerd! Plak het in Claude voor extra uitleg.')));
}

function foutKaart(it, i) {
  const v = vraagOpId(it.id);
  if (!v) return `<div class="kaart fout-item"><p>Deze vraag (${esc(it.id)}) staat niet meer in de vragenbank.</p></div>`;
  return `
    <details class="kaart fout-item" ${i === 0 ? 'open' : ''}>
      <summary>
        <div class="fout-samenvatting">
          <span class="onderwerp-label">${esc(v.onderwerp)}</span>
          <p><strong>${i + 1}.</strong> ${tekstHTML(v.vraag)}</p>
          <div class="antwoord-pillen">
            <span class="pil-fout">Jij: ${it.gekozen ? esc(it.gekozen) : 'open gelaten'}</span>
            <span class="pil-goed">Juist: ${esc(v.juist)}</span>
            <span class="uitleg-open">Uitleg</span>
          </div>
        </div>
      </summary>
      ${!it.gekozen ? '<div class="regel jouw"><strong>NIET BEANTWOORD</strong>Deze vraag heb je open gelaten.</div>' : ''}
      ${uitlegHTML(v, it.gekozen, false, `${v.id}|res${i}`)}
    </details>`;
}

function resultaatTekst(r) {
  const per = scorePerOnderwerp(r.items);
  const fouten = r.items.filter(it => it.gekozen !== it.juist);
  const regels = [
    `PSYCHOMETRIE – ${r.modus === 'oefen' ? 'OEFENRONDE' : 'PROEFTOETS'} VAN ${NAAM.toUpperCase()}`,
    `Datum: ${datumTekst(r.datum)}`,
    `Score: ${r.goed}/${r.aantal} goed (${procent(r.goed, r.aantal)}%) – cijfer ${cijferTekst(r.cijfer)}`,
    r.duurSec !== null && r.duurSec !== undefined ? `Tijd: ${duurTekst(r.duurSec)}${r.tijdOp ? ' (tijd was op)' : ''}` : '',
    r.onderwerp ? `Vragen: ${r.onderwerp}` : 'Vragen: alle onderwerpen',
    '',
    'SCORE PER ONDERWERP',
    ...per.map(p => `- ${p.onderwerp}: ${p.goed}/${p.totaal} (${procent(p.goed, p.totaal)}%)`),
    '',
    `FOUTE ANTWOORDEN (${fouten.length})`
  ].filter((r2, i) => r2 !== '' || i > 4);
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
    `Ik ben ${NAAM}. Maak een foutenanalyse van deze ronde. Welke denkfouten komen vaker terug? Welke onderwerpen moet ik eerst herhalen?`,
    WISKUNDE_ZIN,
    'Geef me daarna 3 nieuwe oefenvragen over mijn zwakste onderwerp (zonder meteen het antwoord te geven).'
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
const bewaarKaartSessie = () => opslag.schrijf(SLEUTEL.kaartSessie, kaartSessie);

function kaartenScherm() {
  if (!DATA.begrippen.length) {
    app.innerHTML = '<h1>Flitskaarten</h1><div class="kaart"><p>Er staan nog geen begrippen in <code>vragen.json</code> (lijst "begrippen").</p></div>';
    return;
  }
  if (!kaartSessie) kaartSessie = opslag.lees(SLEUTEL.kaartSessie, null);
  if (kaartSessie) kaartSessie.rij = kaartSessie.rij.filter(id => DATA.begrippen.some(b => b.id === id));
  if (!kaartSessie || (!kaartSessie.rij.length && kaartSessie.afgesloten)) {
    const st = kaartStatus();
    const teDoen = kaartenTeHerhalen();
    const bak = b => (st[b.id] ? st[b.id].bak : 0);
    kaartSessie = { rij: schud(teDoen).sort((a, b) => bak(a) - bak(b)).map(b => b.id), omgedraaid: false, goed: 0, fout: 0, klaar: !teDoen.length };
    bewaarKaartSessie();
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
    <p class="zacht klein" style="margin:8px 0 0">Bakje 1 = nieuw of fout (komt steeds terug). Goed? De kaart schuift een bakje op en komt later terug: na ${INSTELLINGEN.kaartIntervallenDagen.slice(2).join(', ')} dagen. Vanaf bakje ${INSTELLINGEN.geleerdVanafBakje} telt een begrip als geleerd.</p>`;
}

function tekenKaart() {
  const s = kaartSessie;
  if (!s.rij.length) {
    s.afgesloten = true;
    bewaarKaartSessie();
    const st = kaartStatus();
    const volgende = Math.min(...DATA.begrippen.map(b => (st[b.id] ? st[b.id].volgende : 0)));
    app.innerHTML = `
      <h1>Flitskaarten</h1>
      <div class="kaart">
        <h2>${s.klaar ? `Je bent helemaal bij, ${esc(NAAM)}!` : `Ronde klaar, goed gedaan ${esc(NAAM)}!`}</h2>
        <div class="trots" style="margin-bottom:12px">${icoon('hart')} ${TROTS}</div>
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
      bewaarKaartSessie();
      tekenKaart();
    });
    document.getElementById('opnieuw').addEventListener('click', () => { kaartSessie = null; opslag.wis(SLEUTEL.kaartSessie); kaartenScherm(); });
    return;
  }

  const b = DATA.begrippen.find(x => x.id === s.rij[0]);
  app.innerHTML = `
    <div class="rij-tussen" style="margin-bottom:12px">
      <h1 style="margin:0">Flitskaarten</h1>
      <span class="zacht klein">Nog ${s.rij.length} in deze ronde · ${s.goed} goed · ${s.fout} fout</span>
    </div>
    <div class="kaart flitskaart ${s.omgedraaid ? 'omgedraaid' : ''}" id="kaart" role="button" tabindex="0" aria-label="Kaart omdraaien">
      ${s.omgedraaid
        ? `<div class="zacht klein" style="margin-bottom:8px">${esc(b.begrip)}</div>
           <div class="definitie">${tekstHTML(b.definitie)}</div>
           ${b.voorbeeld ? `<div class="voorbeeld"><strong>Voorbeeld:</strong> ${tekstHTML(b.voorbeeld)}</div>` : ''}`
        : `<div class="begrip">${esc(b.begrip)}</div><div class="hint">Wat betekent dit? Zeg het hardop of in je hoofd, en tik dan om om te draaien.</div>`}
    </div>
    ${s.omgedraaid ? `
      <div class="rij" style="justify-content:center">
        <button class="knop fout" id="fout">✗ Wist ik niet</button>
        <button class="knop goed" id="goed">✓ Wist ik</button>
      </div>` : `
      <div class="rij" style="justify-content:center"><button class="knop" id="draai">Omdraaien</button></div>`}
    <p class="zacht klein alleen-laptop" style="text-align:center;margin-top:10px">Laptop: spatie = omdraaien, 1 = wist ik niet, 2 = wist ik</p>
    <p class="zacht klein" style="text-align:center;margin-top:6px">Je voortgang wordt na elke kaart bewaard. Je kunt dus altijd stoppen.</p>
    <div class="kaart" style="margin-top:16px">${bakjesHTML()}</div>`;

  const draai = () => { if (!s.omgedraaid) { s.omgedraaid = true; bewaarKaartSessie(); tekenKaart(); } };
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
  bewaarKaartSessie();
  registreerDag();
  toonStrook(true);
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
      <p>Open vragen over het kiezen van de juiste analyse en het lezen van SPSS-output. Schrijf gewoon in je eigen woorden, ${esc(NAAM)}:
      het hoeft niet perfect. Je antwoorden worden automatisch bewaard. Kopieer een antwoord en plak het in Claude om het te laten nakijken.</p>
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
          <p style="margin:8px 0 0">${tekstHTML(s.richtlijn)}</p>
          ${s.bronnen.length ? `<p class="klein" style="margin:10px 0 0"><strong>Meer uitleg online:</strong></p>
            <ul class="bronnen">${s.bronnen.map(b => `<li><a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.titel)}</a></li>`).join('')}</ul>` : ''}
          </details>` : ''}
      </div>`;
    }).join('')}`;

  const bewaar = (id, tekst, statusEl) => {
    const alles = opslag.lees(SLEUTEL.spss, {});
    if ((alles[id] ? alles[id].tekst : '') === tekst) return;
    alles[id] = { tekst, datum: new Date().toISOString() };
    opslag.schrijf(SLEUTEL.spss, alles);
    if (tekst.trim()) registreerDag();
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
    `Hoi Claude, ik ben ${NAAM} en ik oefen voor het vak psychometrie. Kijk mijn antwoord(en) op de SPSS-opdracht(en) hieronder na.`,
    'Geef per opdracht: wat er goed is, wat ontbreekt of niet klopt, een cijfer van 1 tot 10, en een verbeterd modelantwoord.',
    WISKUNDE_ZIN,
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
  const toetsen = alleToetsen();
  if (!toetsen.length) {
    app.innerHTML = `<h1>Voortgang</h1><div class="kaart"><p>Je hebt nog geen ronde gemaakt, ${esc(NAAM)}. Na je eerste oefenronde of proeftoets zie je hier hoe je vooruitgaat.</p>
      <a class="knop" href="#toets">Begin met oefenen</a></div>`;
    return;
  }
  const proef = toetsen.filter(isProeftoets);
  const per = zwakkeOnderwerpen(toetsen);
  const zwak = per.filter(p => p.score < INSTELLINGEN.zwakGrens);
  const b = beheersing();

  app.innerHTML = `
    <h1>Jouw voortgang, ${esc(NAAM)}</h1>

    <div class="kaart">
      <h2>Vragen onder de knie</h2>
      <p class="klein">Van de ${b.totaal} vragen in de vragenbank had je er <strong>${b.beheerst}</strong> goed bij je laatste poging${b.fout ? `, en <strong>${b.fout}</strong> nog fout` : ''}.
      ${b.totaal - b.beheerst - b.fout > 0 ? `${b.totaal - b.beheerst - b.fout} heb je nog niet gezien.` : ''}</p>
      <div class="stapel" role="img" aria-label="${b.beheerst} goed, ${b.fout} fout, ${b.totaal - b.beheerst - b.fout} nog niet gezien">
        <div class="s-goed" style="width:${procent(b.beheerst, b.totaal)}%"></div>
        <div class="s-fout" style="width:${procent(b.fout, b.totaal)}%"></div>
      </div>
      <div class="legenda klein"><span><i class="s-goed"></i>goed</span><span><i class="s-fout"></i>nog fout</span><span><i class="s-leeg"></i>nog niet gezien</span></div>
    </div>

    <div class="kaart">
      <div class="rij-tussen" style="margin-bottom:6px">
        <h2 style="margin:0">Cijfers proeftoetsen</h2>
        ${proef.length ? `<span class="zacht klein">gemiddeld ${cijferTekst(proef.reduce((s, t) => s + t.cijfer, 0) / proef.length)} · hoogste ${cijferTekst(Math.max(...proef.map(t => t.cijfer)))}</span>` : ''}
      </div>
      ${proef.length
        ? `<div class="grafiek-wrap" id="grafiekWrap"></div>
           <p class="zacht klein" style="margin:6px 0 0">De stippellijn is de grens voor een voldoende (${cijferTekst(INSTELLINGEN.voldoende)}).</p>`
        : '<p class="zacht">Nog geen proeftoets gemaakt. Als je je klaar voelt, probeer er een: dan zie je hier je cijfers over tijd.</p>'}
    </div>

    <div class="kaart">
      <h2>Score per onderwerp (alles samen)</h2>
      ${zwak.length ? `<p>Hier mag je nog extra aandacht aan geven: <strong>${zwak.map(z => esc(z.onderwerp)).join(', ')}</strong>.</p>` : '<p>Geen zwakke onderwerpen. Mooi!</p>'}
      ${balkenHTML(per)}
    </div>

    <div class="kaart">
      <h2>Alle rondes</h2>
      <div class="tabel-scroll">
        <table class="lijst">
          <thead><tr><th>Datum</th><th>Soort</th><th>Goed</th><th>Cijfer</th><th></th></tr></thead>
          <tbody>
            ${toetsen.slice().reverse().map(t => `
              <tr>
                <td>${datumTekst(t.datum)}${t.onderwerp ? `<br><span class="zacht klein">${esc(t.onderwerp)}</span>` : ''}</td>
                <td><span class="soort ${isProeftoets(t) ? 'kleur-2' : 'kleur-1'}">${isProeftoets(t) ? 'Proeftoets' : 'Oefenen'}</span></td>
                <td class="getal">${t.goed}/${t.aantal}</td>
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
        <button class="knop gevaar" id="wisToetsen">Resultaten wissen</button>
        <button class="knop gevaar" id="wisKaarten">Flitskaartvoortgang wissen</button>
      </div>
    </div>`;

  if (proef.length) {
    const wrap = document.getElementById('grafiekWrap');
    GRAFIEK.b = Math.max(280, Math.round(wrap.clientWidth));
    GRAFIEK.h = GRAFIEK.b < 500 ? 200 : 230;
    wrap.innerHTML = grafiekSVG(proef) + '<div class="tooltip" id="tooltip"></div>';
    koppelGrafiek(proef);
  }
  document.getElementById('wisToetsen').addEventListener('click', () => {
    if (confirm('Alle resultaten wissen?')) { opslag.wis(SLEUTEL.toetsen); route(); }
  });
  document.getElementById('wisKaarten').addEventListener('click', () => {
    if (confirm('Voortgang van alle flitskaarten wissen?')) {
      opslag.wis(SLEUTEL.kaarten); opslag.wis(SLEUTEL.kaartSessie); kaartSessie = null;
      toonStrook(true); melding('Flitskaarten staan weer op nul.');
    }
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
    <svg class="grafiek" viewBox="0 0 ${g.b} ${g.h}" role="img" aria-label="Lijngrafiek van je proeftoetscijfers over tijd">
      ${[1, 4, 7, 10].map(c => `
        <line class="rasterlijn" x1="${g.l}" x2="${g.b - g.r}" y1="${yVan(c)}" y2="${yVan(c)}"></line>
        <text class="as-tekst" x="${g.l - 8}" y="${yVan(c) + 4}" text-anchor="end">${c}</text>`).join('')}
      <line class="grens" x1="${g.l}" x2="${g.b - g.r}" y1="${yVan(INSTELLINGEN.voldoende)}" y2="${yVan(INSTELLINGEN.voldoende)}"></line>
      ${p.map((q, i) => (i % stap === 0 || i === p.length - 1) ? `<text class="as-tekst" x="${q.x}" y="${g.h - 8}" text-anchor="middle">${new Date(q.t.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</text>` : '').join('')}
      ${p.length > 1 ? `<polygon class="vlak-onder" points="${p[0].x},${yVan(1)} ${p.map(q => `${q.x},${q.y}`).join(' ')} ${p[p.length - 1].x},${yVan(1)}"></polygon>` : ''}
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
   Nieuwe vragen maken (doorlopend, met Claude)
   ========================================================= */
const aantalExtra = () => { const e = leesExtra(); return e.vragen.length + e.begrippen.length + e.spss.length; };

function volgendId(prefix, lijst) {
  const nrs = lijst.map(x => String(x.id || '')).filter(id => id.startsWith(prefix)).map(id => parseInt(id.slice(prefix.length), 10)).filter(n => !isNaN(n));
  const n = (nrs.length ? Math.max(...nrs) : 0) + 1;
  return prefix + String(n).padStart(3, '0');
}

function claudeMaakPrompt(n, keuze, metBegrippen) {
  const per = zwakkeOnderwerpen(alleToetsen());
  let onderwerpTekst;
  if (keuze === '__zwak') {
    const zwak = per.filter(p => p.score < INSTELLINGEN.zwakGrens).slice(0, 3);
    onderwerpTekst = zwak.length
      ? `mijn zwakste onderwerpen: ${zwak.map(z => `${z.onderwerp} (${procent(z.goed, z.totaal)}% goed)`).join(', ')}. Verdeel de vragen over deze onderwerpen.`
      : `een mix van alle onderwerpen (${onderwerpen().join(', ')}).`;
  } else if (keuze) onderwerpTekst = keuze;
  else onderwerpTekst = `een mix van alle onderwerpen (${onderwerpen().join(', ')}). Nieuwe onderwerpen uit het vak psychometrie mogen ook.`;

  const voorbeeld = RUW_BASIS && RUW_BASIS.vragen && (RUW_BASIS.vragen.find(v => v.stappen) || RUW_BASIS.vragen[0]);
  const vbBegrip = RUW_BASIS && RUW_BASIS.begrippen && RUW_BASIS.begrippen[0];
  const bestaand = DATA.vragen.map(v => `- ${v.id}: ${v.vraag.slice(0, 90)}${v.vraag.length > 90 ? '…' : ''}`).join('\n');
  const eerstVrij = volgendId('v', DATA.vragen);
  const eerstBegrip = volgendId('b', DATA.begrippen);

  return `Hoi Claude! Ik ben ${NAAM} en ik studeer voor het vak psychometrie (bachelor psychologie). Maak ${n} NIEUWE meerkeuzevragen voor mijn oefensite, op het niveau van de echte bloktoets.

Onderwerp: ${onderwerpTekst}

Belangrijk:
- Ik vind wiskunde lastig. Geef bij elke vraag in "simpel" een uitleg in gewone taal met een voorbeeld uit het dagelijks leven. Bij rekenvragen geef je in "stappen" de berekening stap voor stap (elke stap een aparte regel, met een controle aan het eind). Bij vragen zonder rekenwerk laat je "stappen" weg.
- Elk fout antwoord krijgt in "denkfouten" een eigen uitleg: welke redenering leidt tot dat foute antwoord.
- "herkennen": een kort trucje om dit soort vraag op de toets te herkennen.
- Precies vier opties (A t/m D) en precies één juist antwoord. Wissel af welke letter juist is.
- Controleer elke berekening en elk antwoord zorgvuldig: de vragen moeten inhoudelijk kloppen.
- Maak geen vragen die lijken op deze bestaande vragen:
${bestaand}
- Gebruik oplopende ids vanaf "${eerstVrij}".
- "bronnen": alleen links waarvan je zeker weet dat ze bestaan (bijv. Scribbr NL of Wikipedia), anders een lege lijst [].
${metBegrippen ? `- Maak ook 5 nieuwe begrippen voor flitskaarten (ids vanaf "${eerstBegrip}"), met een "voorbeeld" in gewone taal.\n` : ''}
Geef ALLEEN geldige JSON terug, zonder tekst ervoor of erna, in precies dit formaat:
{
  "vragen": [
${JSON.stringify(voorbeeld, null, 2).replace(/^/gm, '    ')}
  ]${metBegrippen && vbBegrip ? `,
  "begrippen": [
${JSON.stringify(vbBegrip, null, 2).replace(/^/gm, '    ')}
  ]` : ''}
}`;
}

/** plakte tekst van Claude omzetten naar vragen */
function verwerkPlak(tekst) {
  let t = tekst.trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const start = t.search(/[[{]/);
  if (start < 0) throw new Error('Ik zie geen JSON in de geplakte tekst.');
  const eind = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  t = t.slice(start, eind + 1);
  let ruw = JSON.parse(t);
  if (Array.isArray(ruw)) ruw = { vragen: ruw };
  if (ruw.vraag && ruw.opties) ruw = { vragen: [ruw] };

  const extra = leesExtra();
  const bezet = new Set([...DATA.vragen.map(v => v.id), ...extra.vragen.map(v => v.id)]);
  const bezetB = new Set([...DATA.begrippen.map(b => b.id), ...extra.begrippen.map(b => b.id)]);
  const bekendeTeksten = new Set(DATA.vragen.map(v => v.vraag.trim().toLowerCase()));
  const verslag = { vragen: 0, begrippen: 0, overgeslagen: [] };

  (ruw.vragen || []).forEach((v, i) => {
    const naam = `Vraag ${i + 1}`;
    const opties = v.opties || {};
    if (!v.vraag || LETTERS.some(L => !opties[L]) || !LETTERS.includes(v.juist)) {
      verslag.overgeslagen.push(`${naam}: vraagtekst, vier opties of het juiste antwoord ontbreekt.`); return;
    }
    if (bekendeTeksten.has(String(v.vraag).trim().toLowerCase())) { verslag.overgeslagen.push(`${naam}: staat al in de vragenbank.`); return; }
    const kopie = { ...v };
    if (!kopie.id || bezet.has(kopie.id)) kopie.id = volgendId('v', [...DATA.vragen, ...extra.vragen]);
    if (!kopie.onderwerp) kopie.onderwerp = 'Overig';
    bezet.add(kopie.id);
    extra.vragen.push(kopie);
    verslag.vragen++;
  });
  (ruw.begrippen || []).forEach(b => {
    if (!b.begrip || !b.definitie) return;
    if (DATA.begrippen.some(x => x.begrip.toLowerCase() === String(b.begrip).toLowerCase())) return;
    const kopie = { ...b };
    if (!kopie.id || bezetB.has(kopie.id)) kopie.id = volgendId('b', [...DATA.begrippen, ...extra.begrippen]);
    bezetB.add(kopie.id);
    extra.begrippen.push(kopie);
    verslag.begrippen++;
  });
  opslag.schrijf(SLEUTEL.extra, extra);
  zetData(RUW_BASIS, DATABRON);
  return verslag;
}

function downloadVragenbank() {
  const alles = samengevoegd(RUW_BASIS);
  const blob = new Blob([JSON.stringify(alles, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vragen.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function nieuwScherm() {
  const extra = leesExtra();
  const opties = onderwerpen();
  app.innerHTML = `
    <h1>Nieuwe vragen maken</h1>
    <p class="zacht">Hoe meer verschillende vragen je oefent, hoe beter. Doe dit bijvoorbeeld elke week: Claude maakt nieuwe vragen, vooral over de onderwerpen die je nog lastig vindt.</p>

    <div class="kaart stap-kaart">
      <div class="stap-nr">1</div>
      <div class="stap-inhoud">
        <h2>Kopieer de opdracht voor Claude</h2>
        <div class="rij" style="gap:14px;align-items:flex-end">
          <label class="veld" style="flex:1;min-width:200px;margin:0"><span>Waarover?</span>
            <select id="nwOnderwerp">
              <option value="__zwak">Mijn zwakste onderwerpen (aanrader)</option>
              <option value="">Alle onderwerpen door elkaar</option>
              ${opties.map(o => `<option value="${esc(o)}">Alleen ${esc(o)}</option>`).join('')}
            </select>
          </label>
          <div class="veld" style="margin:0"><span>Hoeveel?</span>
            <div class="keuze">
              <label><input type="radio" name="nwAantal" value="5"><span>5</span></label>
              <label><input type="radio" name="nwAantal" value="10" checked><span>10</span></label>
              <label><input type="radio" name="nwAantal" value="20"><span>20</span></label>
            </div>
          </div>
        </div>
        <label class="vinkje"><input type="checkbox" id="nwBegrippen" checked> Ook 5 nieuwe begrippen voor de flitskaarten</label>
        <div class="rij" style="margin-top:14px">
          <button class="knop" id="nwKopieer">${icoon('kopie')} Kopieer opdracht voor Claude</button>
        </div>
        <p class="zacht klein" style="margin:10px 0 0">Plak de opdracht in Claude (bijvoorbeeld in je Claude-project voor psychometrie). Claude geeft een blok tekst terug dat begint met <code>{</code>. Kopieer dat helemaal.</p>
      </div>
    </div>

    <div class="kaart stap-kaart">
      <div class="stap-nr">2</div>
      <div class="stap-inhoud">
        <h2>Plak hier het antwoord van Claude</h2>
        <textarea id="nwPlak" placeholder='{ "vragen": [ … ] }' spellcheck="false" style="font-family:var(--mono);font-size:.85rem"></textarea>
        <div class="rij" style="margin-top:12px">
          <button class="knop" id="nwToevoegen">${icoon('plus')} Vragen toevoegen</button>
        </div>
        <div id="nwVerslag"></div>
      </div>
    </div>

    <div class="kaart stap-kaart">
      <div class="stap-nr">3</div>
      <div class="stap-inhoud">
        <h2>Bewaar ze voorgoed (af en toe)</h2>
        <p>Toegevoegde vragen staan nu alleen in deze browser${extra.vragen.length || extra.begrippen.length ? ` (<strong>${extra.vragen.length} vragen, ${extra.begrippen.length} begrippen</strong>)` : ''}.
        Wil je ze ook op je telefoon én laptop, en nooit kwijtraken? Download dan de complete vragenbank en zet dat bestand op GitHub in plaats van de oude <code>vragen.json</code>.</p>
        <div class="rij">
          <button class="knop licht" id="nwDownload">${icoon('download')} Download complete vragen.json</button>
          ${aantalExtra() ? '<button class="knop gevaar" id="nwWis">Zelf toegevoegde vragen wissen</button>' : ''}
        </div>
        <p class="zacht klein" style="margin:10px 0 0">Staan ze eenmaal in <code>vragen.json</code> op GitHub? Dan herkent de site ze vanzelf en telt ze niet dubbel.</p>
      </div>
    </div>`;

  const instellingen = () => ({
    n: Number(document.querySelector('input[name=nwAantal]:checked').value),
    keuze: document.getElementById('nwOnderwerp').value,
    begrippen: document.getElementById('nwBegrippen').checked
  });
  document.getElementById('nwKopieer').addEventListener('click', () => {
    const { n, keuze, begrippen } = instellingen();
    kopieer(claudeMaakPrompt(n, keuze, begrippen), 'Opdracht gekopieerd! Plak hem in Claude.');
  });
  document.getElementById('nwToevoegen').addEventListener('click', () => {
    const vak = document.getElementById('nwPlak');
    const uit = document.getElementById('nwVerslag');
    if (!vak.value.trim()) { melding('Plak eerst het antwoord van Claude.'); return; }
    try {
      const v = verwerkPlak(vak.value);
      uit.innerHTML = `
        <div class="regel ${v.vragen || v.begrippen ? 'juist' : 'jouw'}" style="margin-top:14px">
          <strong>${v.vragen || v.begrippen ? 'GELUKT!' : 'NIETS TOEGEVOEGD'}</strong>
          ${v.vragen} ${v.vragen === 1 ? 'nieuwe vraag' : 'nieuwe vragen'} en ${v.begrippen} ${v.begrippen === 1 ? 'nieuw begrip' : 'nieuwe begrippen'} toegevoegd.
          ${v.overgeslagen.length ? `<br>Overgeslagen: <ul>${v.overgeslagen.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
          ${v.vragen ? '<br><a class="knop klein-knop" href="#toets" style="margin-top:10px">Meteen oefenen</a>' : ''}
        </div>`;
      if (v.vragen || v.begrippen) { vak.value = ''; confetti(80); toonStrook(true); }
    } catch (e) {
      uit.innerHTML = `<div class="regel jouw" style="margin-top:14px"><strong>DAT LUKTE NIET</strong>
        De tekst is geen geldige JSON (${esc(e.message)}). Vraag Claude: "Geef alleen de JSON, zonder uitleg." en plak het opnieuw.</div>`;
    }
  });
  document.getElementById('nwDownload').addEventListener('click', downloadVragenbank);
  const wis = document.getElementById('nwWis');
  if (wis) wis.addEventListener('click', () => {
    if (confirm('Zelf toegevoegde vragen en begrippen uit deze browser wissen? (Doe dit pas als ze in vragen.json op GitHub staan.)')) {
      opslag.wis(SLEUTEL.extra); zetData(RUW_BASIS, DATABRON); route();
    }
  });
}

/* =========================================================
   Starten
   ========================================================= */
window.addEventListener('hashchange', route);
laadData().then(() => {
  if (DATA) TOETS = laadActieveToets();
  route();
});
