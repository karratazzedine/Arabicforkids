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
  dagen: 'pm_oefendagen'
};

const LETTERS = ['A', 'B', 'C', 'D'];
const NAAM = INSTELLINGEN.naam;
const WISKUNDE_ZIN = `Ik vind wiskunde en formules lastig. Leg het daarom uit in gewone taal, stap voor stap, met een voorbeeld uit het dagelijks leven. Leg elke rekenstap apart uit en gebruik geen formules zonder te zeggen wat ze betekenen.`;

let DATA = null;          // { vragen, begrippen, spss, bronnenPerOnderwerp }
let DATABRON = '';
let WAARSCHUWINGEN = [];
let TOETS = null;         // de toets of oefenronde die nu openstaat
let timerId = null;
let toetsHandler = null;  // sneltoetsen voor het huidige scherm

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
  if (laatste && vorige) trend = laatste.cijfer > vorige.cijfer ? ' ↑' : laatste.cijfer < vorige.cijfer ? ' ↓' : ' →';
  const reeks = dagenOpRij();
  const item = (label, waarde, deel, totaal) => `
    <div class="strook-item">
      <span class="strook-label">${label}</span>
      <span class="strook-waarde">${waarde}</span>
      ${totaal !== undefined ? `<div class="mini-balk" aria-hidden="true"><div style="width:${procent(deel, totaal)}%"></div></div>` : ''}
    </div>`;
  return `<div class="strook-binnen">
    ${item('Vragen onder de knie', `${b.beheerst}/${b.totaal}`, b.beheerst, b.totaal)}
    ${item('Begrippen geleerd', `${geleerd}/${DATA.begrippen.length}`, geleerd, DATA.begrippen.length)}
    ${item('Laatste proeftoets', laatste ? cijferTekst(laatste.cijfer) + trend : '–')}
    ${item('Dagen op rij', reeks ? `${reeks} ${reeks === 1 ? 'dag' : 'dagen'}` : '–')}
  </div>`;
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
    <div class="kaart verder">
      <div class="rij-tussen">
        <div><strong>${TOETS.modus === 'toets' ? 'Proeftoets' : 'Oefenronde'} openstaan</strong><br>
        <span class="zacht klein">Vraag ${TOETS.huidig + 1} van ${TOETS.vragen.length} · ${Object.keys(TOETS.antwoorden).length} beantwoord${TOETS.modus === 'toets' ? ` · nog ${klok(TOETS.rest)} tijd` : ''}</span></div>
        <a class="knop" href="#toets">Verder waar je was</a>
      </div>
    </div>`);
  if (kaartSessie && kaartSessie.rij && kaartSessie.rij.length && (kaartSessie.goed + kaartSessie.fout) > 0) verder.push(`
    <div class="kaart verder">
      <div class="rij-tussen">
        <div><strong>Flitskaarten-ronde openstaan</strong><br><span class="zacht klein">Nog ${kaartSessie.rij.length} kaarten in deze ronde</span></div>
        <a class="knop licht" href="#kaarten">Verder met kaarten</a>
      </div>
    </div>`);

  app.innerHTML = `
    <div class="groet">
      <h1>${groet()}, ${esc(NAAM)}!</h1>
      <p>${esc(zin)}</p>
    </div>

    ${verder.join('')}

    ${!TOETS && zwak.length ? `
      <div class="kaart tip-kaart">
        <div class="rij-tussen">
          <div><strong>Tip voor vandaag</strong><br>
          <span class="klein">Oefen <strong>${esc(zwak[0].onderwerp)}</strong>: daar had je ${procent(zwak[0].goed, zwak[0].totaal)}% goed. Met uitleg bij elke vraag.</span></div>
          <button class="knop" id="oefenZwak">Oefen dit onderwerp</button>
        </div>
      </div>` : ''}

    ${!TOETS && b.fout ? `
      <div class="kaart">
        <div class="rij-tussen">
          <div><strong>${b.fout} ${b.fout === 1 ? 'vraag' : 'vragen'} nog niet goed</strong><br>
          <span class="zacht klein">Oefen precies de vragen die je de laatste keer fout had.</span></div>
          <button class="knop licht" id="oefenFouten">Mijn fouten oefenen</button>
        </div>
      </div>` : ''}

    <div class="raster">
      <a class="tegel" href="#toets"><h3>Oefenen of proeftoets</h3><p>Oefenen: meteen uitleg bij elke vraag. Proeftoets: met timer en cijfer, net als de echte.</p></a>
      <a class="tegel" href="#kaarten"><h3>Flitskaarten</h3><p>${teHerhalen ? `${teHerhalen} begrippen staan klaar om te herhalen.` : 'Alles herhaald voor vandaag!'}</p></a>
      <a class="tegel" href="#spss"><h3>SPSS-opdrachten</h3><p>Open vragen over de juiste analyse kiezen en output lezen.</p></a>
      <a class="tegel" href="#voortgang"><h3>Voortgang</h3><p>Je cijfers over tijd en je zwakke onderwerpen.</p></a>
    </div>

    <details class="kaart" style="margin-top:16px">
      <summary style="cursor:pointer;font-weight:600">Over de vragenbank</summary>
      <p class="zacht klein" style="margin-top:10px">Geladen uit: ${esc(DATABRON)}<br>
      ${DATA.vragen.length} meerkeuzevragen · ${DATA.begrippen.length} begrippen · ${DATA.spss.length} SPSS-opdrachten · ${onderwerpen().length} onderwerpen</p>
      ${WAARSCHUWINGEN.length ? `<div class="waarschuwing" style="margin-bottom:12px"><strong>Let op, er klopt iets niet in het vragenbestand:</strong>
        <ul>${WAARSCHUWINGEN.slice(0, 15).map(w => `<li>${esc(w)}</li>`).join('')}</ul>
        ${WAARSCHUWINGEN.length > 15 ? `<p class="klein">…en nog ${WAARSCHUWINGEN.length - 15} meldingen.</p>` : ''}</div>` : ''}
      <label class="knop licht" style="cursor:pointer">Ander vragenbestand kiezen
        <input type="file" accept=".json,application/json" hidden id="bestandKiezer"></label>
    </details>`;

  document.getElementById('bestandKiezer').addEventListener('change', e => leesBestand(e.target));
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
          <label><input type="radio" name="modus" value="oefen" checked>
            <span><strong>Oefenen met uitleg</strong><br><span class="zacht klein">Na elke vraag zie je meteen of het goed is. Bij een fout krijg je uitleg in gewone taal, rekenstappen en links naar goede uitleg online. Geen tijdsdruk.</span></span></label>
          <label><input type="radio" name="modus" value="toets">
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
      <button class="knop" id="startToets">Start</button>
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
        ${vergrendeld ? `<div class="feedback">${uitlegHTML(v, gekozen, true)}</div>` : ''}
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
          <button class="knop licht" id="pauze">Pauzeren</button>
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
    melding(`Opgeslagen! Je gaat later verder bij vraag ${t.huidig + 1}.`);
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
function uitlegHTML(v, gekozen, metKop) {
  const goed = gekozen && gekozen === v.juist;
  const { eigen, zoek } = bronnenVoor(v);
  const lof = ['Goed zo', 'Helemaal goed', 'Top', 'Precies'][[...v.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 4];
  if (goed) {
    return `
      ${metKop ? `<p class="feedback-kop goed-kop">${lof}, ${esc(NAAM)}!</p>` : ''}
      <div class="regel juist"><strong>WAAROM ${v.juist} KLOPT</strong>${tekstHTML(v.uitleg)}</div>
      ${v.herkennen ? `<div class="regel tip"><strong>ONTHOUD DIT TRUCJE</strong>${tekstHTML(v.herkennen)}</div>` : ''}`;
  }
  return `
    ${metKop ? `<p class="feedback-kop fout-kop">${gekozen ? `Bijna, ${esc(NAAM)}! Het juiste antwoord is ${v.juist}.` : `Het juiste antwoord is ${v.juist}.`} Zo zit het:</p>` : ''}
    ${v.simpel ? `<div class="regel simpel"><strong>IN GEWONE TAAL</strong>${tekstHTML(v.simpel)}</div>` : ''}
    ${v.stappen.length ? `<div class="regel stappen"><strong>STAP VOOR STAP UITGEREKEND</strong>
      <ol>${v.stappen.map(s => `<li>${tekstHTML(s)}</li>`).join('')}</ol></div>` : ''}
    ${gekozen ? `<div class="regel jouw"><strong>WAAROM ${gekozen} NIET KLOPT</strong>${tekstHTML(v.denkfouten[gekozen] || 'Vergelijk je antwoord met de uitleg hieronder.')}</div>` : ''}
    <div class="regel juist"><strong>JUIST: ${v.juist}. ${esc(v.opties[v.juist])}</strong>${tekstHTML(v.uitleg)}</div>
    ${v.herkennen ? `<div class="regel tip"><strong>ZO HERKEN JE HET VOLGENDE KEER</strong>${tekstHTML(v.herkennen)}</div>` : ''}
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
  if (r.goed === r.aantal) boodschap = `Alles goed, ${NAAM}! Wat knap.`;
  else if (voldoende) boodschap = `Voldoende, ${NAAM}! Goed bezig. Kijk hieronder nog even naar de vragen die fout gingen.`;
  else boodschap = `Nog geen voldoende, ${NAAM}, maar dat is precies waarom je oefent. Lees de uitleg bij je fouten rustig door: daar leer je het meest van.`;

  app.innerHTML = `
    <h1>${oefen ? 'Oefenronde klaar' : 'Resultaat proeftoets'}</h1>
    <div class="kaart">
      <div class="cijfer-blok">
        <div class="cijfer ${voldoende ? 'voldoende' : 'onvoldoende'}">${cijferTekst(r.cijfer)}</div>
        <div>
          <p style="margin:0 0 4px"><strong>${r.goed} van ${r.aantal} goed</strong> (${procent(r.goed, r.aantal)}%)</p>
          <p class="zacht klein" style="margin:0">${datumTekst(r.datum)}${r.duurSec !== null && r.duurSec !== undefined ? ` · tijd: ${duurTekst(r.duurSec)}` : ''}${r.tijdOp ? ' · tijd was op' : ''}${r.onderwerp ? ` · ${esc(r.onderwerp)}` : ''}</p>
          <p style="margin:8px 0 0">${esc(boodschap)}</p>
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
    <div class="kaart fout-item">
      <span class="onderwerp-label">${esc(v.onderwerp)}</span>
      <p><strong>${i + 1}.</strong> ${tekstHTML(v.vraag)}</p>
      ${!it.gekozen ? '<div class="regel jouw"><strong>NIET BEANTWOORD</strong>Deze vraag heb je open gelaten.</div>' : ''}
      ${uitlegHTML(v, it.gekozen, false)}
    </div>`;
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
    <div class="kaart flitskaart" id="kaart" role="button" tabindex="0" aria-label="Kaart omdraaien">
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
                <td>${isProeftoets(t) ? 'Proeftoets' : 'Oefenen'}</td>
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
laadData().then(() => {
  if (DATA) TOETS = laadActieveToets();
  route();
});
