# Psychometrie oefenen – handleiding

Een oefenwebsite voor het vak psychometrie, gemaakt met alleen HTML, CSS en JavaScript.
Er is geen installatie, geen account en geen server nodig.

## Wat zit erin?

| Bestand       | Wat het is                                                                  |
|---------------|------------------------------------------------------------------------------|
| `index.html`  | De pagina zelf. Deze open je.                                                |
| `style.css`   | Het ontwerp (kleuren, lettertype, opmaak voor telefoon en laptop).           |
| `app.js`      | Alle functies: toets, timer, flitskaarten, SPSS, voortgang.                  |
| `vragen.json` | **De vragenbank.** Alleen dit bestand hoef je aan te passen.                 |

## De site openen

**Op je eigen computer (de makkelijkste manier)**
1. Zet de vier bestanden samen in één map.
2. Dubbelklik op `index.html`.
3. De browser mag bestanden op je computer vaak niet zelf inlezen. Dan zie je de knop
   **"Kies vragen.json"**. Kies daar het bestand `vragen.json` uit dezelfde map.
   De browser onthoudt de vragen daarna.
4. Heb je `vragen.json` aangepast? Kies dan op de startpagina **"Ander vragenbestand kiezen"**
   en kies het bestand opnieuw.

**Gratis online via GitHub Pages**
1. Zet de map `psychometrie` in een GitHub-repository.
2. Ga op GitHub naar *Settings → Pages* en kies bij *Branch* de branch en de map (`/ (root)`).
3. Na een minuut staat de site op `https://<gebruikersnaam>.github.io/<repository>/psychometrie/`.
4. Online wordt `vragen.json` automatisch geladen. Pas je het bestand aan op GitHub,
   dan staan de nieuwe vragen er na een minuut op.

## Nieuwe vragen toevoegen

Open `vragen.json` in een teksteditor (bijvoorbeeld Kladblok, TextEdit of VS Code).
Het bestand heeft drie lijsten: `vragen` (meerkeuze), `begrippen` (flitskaarten) en `spss` (open opdrachten).

### Meerkeuzevraag

Kopieer een bestaande vraag, plak hem eronder en pas de tekst aan:

```json
{
  "id": "v011",
  "onderwerp": "Validiteit",
  "vraag": "Hier komt de vraagtekst.",
  "opties": {
    "A": "Eerste antwoord",
    "B": "Tweede antwoord",
    "C": "Derde antwoord",
    "D": "Vierde antwoord"
  },
  "juist": "C",
  "uitleg": "Waarom C juist is.",
  "denkfouten": {
    "A": "Welke denkfout zit er achter A?",
    "B": "Welke denkfout zit er achter B?",
    "D": "Welke denkfout zit er achter D?"
  },
  "herkennen": "Een tip: hoe herken je dit soort vraag de volgende keer?"
}
```

Let op:
- **`id`** moet uniek zijn (v011, v012, …). Verander het id van een bestaande vraag liever niet,
  anders kan de site die vraag niet meer terugvinden in oude toetsresultaten.
- **`onderwerp`**: gebruik steeds precies dezelfde schrijfwijze (bijv. altijd `Betrouwbaarheid`),
  anders telt de site ze als twee verschillende onderwerpen.
- **`juist`** is één hoofdletter: `A`, `B`, `C` of `D`.
- Bij **`denkfouten`** zet je de drie foute letters (dus niet de juiste).
- `herkennen` mag je weglaten, maar het helpt bij het leren.
- Wil je een nieuwe regel binnen een tekst? Typ dan `\n`.

### Flitskaart

```json
{ "id": "b13", "begrip": "Kanskapitalisatie", "definitie": "De toename van de kans op een Type I-fout als je veel toetsen tegelijk doet." }
```

### SPSS-opdracht

```json
{
  "id": "s05",
  "onderwerp": "Output interpreteren",
  "vraag": "Wat concludeer je uit deze output?",
  "output": "Correlations\n            meting1   meting2\nmeting1     1         .84**",
  "richtlijn": "Het modelantwoord of de nakijkpunten."
}
```
`output` mag leeg blijven (`""`) als er geen SPSS-output bij hoort. Bij output maak je met `\n` een nieuwe regel.

### Veelgemaakte fouten in JSON

- Tussen twee vragen staat een **komma**: `}, {`. Na de **laatste** vraag van een lijst staat **géén** komma.
- Gebruik altijd rechte aanhalingstekens `"`, geen krullende `“ ”` (Word maakt die automatisch!).
- Wil je een `"` in je tekst gebruiken? Typ dan `\"`, of gebruik enkele aanhalingstekens `'`.
- Twijfel je? Plak het bestand op [jsonlint.com](https://jsonlint.com) om het te controleren.
- De startpagina toont een gele melding als er een veld ontbreekt (bijvoorbeeld een denkfout).

**Tip:** laat Claude nieuwe vragen voor je schrijven. Plak het voorbeeld hierboven en vraag bijvoorbeeld:
*"Maak 10 nieuwe vragen over validiteit in precies dit JSON-formaat, met ids v011 t/m v020."*

## Hoe de site werkt

- **Toets:** 20 of 40 vragen, willekeurig uit de vragenbank (eventueel één onderwerp), met
  2¼ minuut per vraag (20 vragen = 45 min, 40 = 90 min). Het cijfer is `1 + 9 × (aantal goed / aantal vragen)`.
  Staan er minder vragen in de bank dan je kiest, dan wordt de toets korter. Voeg dus vragen toe!
  Als je per ongeluk de pagina sluit, loopt de toets gewoon door en kun je verder waar je was.
- **Na de toets:** per fout het juiste antwoord, de denkfout achter jouw antwoord, een herkentip en
  een score per onderwerp. Met **"Kopieer resultaten voor Claude"** kopieer je alles als tekst,
  inclusief een vraag voor een foutenanalyse.
- **Flitskaarten:** werkt met vijf bakjes. Wist je het niet? Dan gaat de kaart naar bakje 1 en komt
  hij in dezelfde ronde snel terug. Wist je het wel? Dan schuift de kaart een bakje op en komt hij pas
  na 1, 3, 7 of 14 dagen terug.
- **SPSS:** je antwoorden worden automatisch bewaard. Met **"Kopieer voor Claude"** kopieer je de opdracht,
  de output, je antwoord en de nakijkrichtlijn.
- **Voortgang:** cijfers over tijd (grafiek), zwakke onderwerpen (onder 60% goed) en alle gemaakte toetsen.

Instellingen zoals de tijd per vraag staan bovenaan in `app.js` onder `INSTELLINGEN`.

## Belangrijk om te weten

Alle voortgang wordt **alleen in de browser op dat apparaat** bewaard. Je telefoon en laptop delen dus
geen voortgang, en als je de browsergeschiedenis/sitegegevens wist of een privévenster gebruikt,
is de voortgang weg. De vragenbank zelf (`vragen.json`) raak je nooit kwijt.
