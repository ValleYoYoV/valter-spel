# 🎮 Valter Spel

En retro spelkatalog byggd som en bokhylla. Varje bok på hyllan är ett spel — klicka på ryggen för att läsa om det, tryck **SPELA** för att köra det direkt i webbläsaren.

Live på **[valter.lol](https://valter.lol)**.

Allt är statiskt: ren HTML, CSS och JavaScript. Ingen byggprocess, inga beroenden, inget npm.

---

## Spel i hyllan

| Spel | År | Genre |
|------|-----|-------|
| GAGULK & ELMO: Heroes of Chaos & Compassion | 2026 | Action / Plattform |
| SHAWARMA AB | 2026 | Simulator &mdash; 1&ndash;2 spelare online |

---

## Lägga till ett nytt spel

Tre steg, ingen kodkunskap utöver copy-paste:

**1.** Skapa en mapp under `games/` och lägg spelet där som `index.html`:

```
games/mitt-nya-spel/index.html
```

**2.** Öppna `index.html` i roten och hitta listan `GAMES` (runt rad 230). Kopiera blocket och ändra värdena:

```js
{
  id:     "mitt-nya-spel",
  title:  "MITT NYA SPEL",          // syns på bokryggen — håll den kort
  sub:    "En underrubrik",
  year:   2026,
  genre:  "Pussel",
  players:"1 spelare",
  color:  "#2d6cdf", color2:"#17407f", accent:"#8fd5ff",   // bokens färger
  h: 210, w: 54,                    // höjd/bredd i px — variera för snyggare hylla
  path:   "games/mitt-nya-spel/index.html",
  desc:   "Kort beskrivning som visas i detaljkortet.",
  tags:   ["Pussel","Canvas"],
  controls:[
    ["Rör dig", "Piltangenter"],
    ["Välj",    "Enter"]
  ],
  levels:["Nivå 1","Nivå 2"]
}
```

**3.** Spara, committa, pusha. Hyllan bygger om sig själv — nya hyllplan skapas automatiskt när det blir fler än 6 spel.

### Tips för bokryggarna

- **Titel:** max ~16 tecken, annars svämmar texten över ryggen.
- **Höjd (`h`):** 180–250 px. Blanda höjder så hyllan ser levande ut.
- **Bredd (`w`):** 46–70 px. Tjockare bok = "större" spel.
- **Färger:** `color` är ryggens ovansida, `color2` undersidan, `accent` guldbanden och årtalet.

---

## Köra lokalt

Dubbelklicka bara på `index.html`. Det fungerar direkt från filsystemet.

Vill du ha en riktig lokal server (närmare hur det blir på nätet):

```bash
python -m http.server 8000
```

Öppna sedan `http://localhost:8000`.

---

## Struktur

```
valter-spel/
├── index.html              ← bokhyllan (katalogen)
├── CNAME                   ← domännamnet, för GitHub Pages
├── .nojekyll               ← säger åt GitHub att inte processa filerna
├── README.md
└── games/
    └── gagulk-elmo/
        └── index.html      ← spelet (fristående, körs som det är)
```

Varje spel är helt fristående. Tar du bort en spelmapp och dess rad i `GAMES` försvinner boken från hyllan — inget annat påverkas.

---

## Teknik

- Ingen ramverk, inget bygge — bara statiska filer.
- Typsnitt: **Press Start 2P** och **VT323** från Google Fonts.
- Bokhyllan, träet och CRT-effekten är ren CSS (inga bilder).
- Spelen ritas på `<canvas>`.

## Licens

Spelen och sajten är Valters egna. Fråga innan du återanvänder.
