# 🥔 Superpotatisen vs Zombieapokalypsen

2D-arkadspel i retrostil. Du är Superpotatisen — brun, bemantlad och beväpnad med en Maising Gun. Zombiehordarna kommer i vågor och de slutar inte komma.

Spela: **[valter.lol/games/superpotatis/](https://valter.lol/games/superpotatis/)**

---

## Starta spelet

Dubbelklicka på `index.html`. Det fungerar direkt från hårddisken — inget bygge, inga beroenden, ingen installation.

Vill du köra en riktig lokal server:

```bash
python -m http.server 8000
```

Öppna sedan `http://localhost:8000/games/superpotatis/`.

> **Ingen `requirements.txt`** — det här är ren HTML, CSS och JavaScript utan bibliotek. Enda externa resursen är typsnittet Press Start 2P från Google Fonts, och spelet fungerar även utan det (faller tillbaka på monospace).

---

## Kontroller

| Tangent | Gör |
|---|---|
| **WASD** / **piltangenter** | 8-vägs rörelse |
| **Mus** | siktar |
| **Vänsterklick** (håll) | skjuter mot muspekaren |
| **Z** | skjuter rakt fram — för den som hellre kör helt på tangentbord |
| **X** / **Mellanslag** | Potatismos-bomb (när mätaren är full) |
| **P** | paus |
| **M** | ljud av/på |
| **R** | starta om efter game over |

---

## Spelet

**Mashing Power** laddas av varje besegrad zombie. När mätaren är full blinkar den och **X** spränger hela skärmen i en Potatismos-bomb.

**Zombietyper:**

| Typ | Utseende | Beteende |
|---|---|---|
| Zombie | mörkgrön, röda ögon | medelsnabb, 3 HP |
| Röten Potatisskalare | ljusgrön, skinnig | snabb men 1 HP — kommer från våg 2 |
| Mögligt Zombie-pumpahuvud | orange huvud, grön kropp | långsam tank, 14 HP — kommer från våg 4 |

**Power-ups** som zombier ibland tappar:

- **Smör & Salt** — läker 1 HP. Tappas aldrig när du redan har fullt.
- **Fritös-Turbo** — mer än dubbla skjuthastigheten i 8 sekunder.

High score sparas i webbläsarens `localStorage`.

---

## Filer

```
superpotatis/
├── index.html          canvas, CRT-lager, laddar skripten i ordning
├── README.md
├── js/
│   ├── config.js       palett, upplösning och ALL balans
│   ├── sprites.js      pixelkonsten som teckenrutnät
│   ├── sound.js        8-bitarsljud genererat med Web Audio
│   ├── entities.js     spelare, zombier, skott, power-ups — ren logik
│   └── main.js         game loop, vågor, UI, rendering
└── test/
    └── superpotatis_test.js
```

Upplösningen är **400×300 internt** och skalas upp med heltalsfaktor utan utjämning, så varje pixel blir en skarp fyrkant. CRT-scanlines ligger som ett CSS-lager ovanpå canvasen.

---

## Ändra balansen

Allt som styr känslan ligger i `js/config.js` — rör inte logikfilerna.

```js
PLAYER:  { speed: 74, maxHp: 5, fireRate: 0.22, turboRate: 0.09, ... }
ZOMBIES: { std: { speed: 26, hp: 3, ... }, peeler: {...}, pumpkin: {...} }
WAVE:    { baseBudget: 6, budgetGrow: 2.6, spawnGap: 0.75, ... }
```

Vill du ha en ny zombietyp: lägg till den i `CFG.ZOMBIES`, rita en sprite i `SPRITE_DATA` med samma namn som `sprite`-fältet, och lägg in den i `CFG.WAVE.mix` med från-vilken-våg och en vikt.

---

## Testa

```bash
node test/superpotatis_test.js
```

52 tester som kör spellogiken headless i Node — utan webbläsare, utan att rita en pixel. De kontrollerar pixelkonsten (att varje sprite är rektangulär och bara använder färger som finns), rörelse och kollision, vågbygget, power-ups, Mashing Power och hela botspelade omgångar.

**Två saker testerna redan fångat:**

- **Skott på nära håll.** Skottet föddes 8 px ut från spelaren, men den snabba skalarens träffradie är 7 px — så en zombie som stod klistrad på dig var *helt omöjlig* att skjuta, och vågen kunde aldrig ta slut. Numera prövas hela sträckan skottet färdats under bildrutan, inte en punkt, och mynningen sitter 4 px ut. Testet `en peeler som står på spelaren går att döda` vaktar det.
- Samma sträckprövning gör att skott inte kan hoppa förbi en fiende mellan två bildrutor när bildfrekvensen sjunker.

Ändrar du en träffradie eller skotthastighet: kör testet.
