# N8N Workflow Animator - Specyfikacja Techniczna

## Opis projektu

Aplikacja do generowania animowanych wideo (MP4) z workflow n8n. Obsługuje dwa formaty: YouTube (16:9) i TikTok (9:16), z opcjonalną narracją AI i syntezą mowy.

## Architektura

```
n8n-workflow-animator/
├── client/                    # Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx           # Główny komponent
│   │   ├── components/
│   │   │   ├── DropZone.jsx      # Upuszczanie plików JSON
│   │   │   ├── Settings.jsx      # Ustawienia (format, prędkość, tryb)
│   │   │   ├── NarrationPanel.jsx # Panel AI narracji
│   │   │   └── Preview.jsx       # Podgląd animacji
│   │   ├── hooks/
│   │   └── utils/
│   │       └── n8nParser.js      # Parser workflow n8n -> struktura wewnętrzna
│   └── index.html
├── server/                    # Backend Node.js + Express
│   ├── index.js              # Serwer Express, endpointy API
│   ├── renderer.js           # Renderer klasyczny (node po node)
│   ├── narratedRenderer.js   # Renderer z narracją (zoom + popup)
│   ├── aiService.js          # Integracja z Claude via Replicate
│   └── elevenLabsService.js  # Integracja z ElevenLabs TTS
├── output/                    # Wygenerowane pliki
│   ├── audio/                # Pliki audio narracji
│   └── sfx/                  # Efekty dźwiękowe (whoosh, pop)
└── package.json
```

## Tryby animacji

### 1. Klasyczny (`classic`)
- Workflow buduje się kafelek po kafelku
- Nodes pojawiają się sekwencyjnie
- Strzałki animują się po pojawieniu się node'ów
- Audio nakładane z opóźnieniem per segment

### 2. Z narracją (`narrated`)
- Cały workflow widoczny od początku
- Kamera wykonuje intro scroll (lewo -> prawo) z zoom-out
- Zoom do każdego node'a z efektem whoosh
- Info-popup z emoji, polską nazwą i opisem
- Efekt pop przy pojawieniu się popup
- Audio zsynchronizowane z timeline

## API Endpoints

### `POST /api/export`
Eksport wideo bez audio (tryb klasyczny).

```json
{
  "workflow": { ... },
  "settings": {
    "aspectRatio": "16:9" | "9:16",
    "speed": "slow" | "normal" | "fast",
    "animationMode": "classic"
  }
}
```

### `POST /api/export-with-audio`
Eksport z audio (tryb klasyczny).

### `POST /api/export-narrated`
Eksport z pełną synchronizacją audio (tryb narrated).

### `POST /api/generate-narration`
Generuje narrację przez Claude AI.

```json
{
  "workflow": { ... },
  "replicateApiToken": "r8_...",
  "context": "Opis workflow - opcjonalny kontekst dla AI",
  "style": "marketing" | "tutorial" | "technical"
}
```

Odpowiedź:
```json
{
  "success": true,
  "narration": {
    "intro": "Wprowadzenie do workflow",
    "nodes": [
      {
        "name": "Oryginalna nazwa node'a",
        "namePL": "Polska nazwa akcji",
        "typePL": "Polski typ node'a",
        "narration": "Co robi ten krok"
      }
    ],
    "outro": "Podsumowanie"
  }
}
```

### `POST /api/generate-segmented-audio`
Generuje audio dla każdego segmentu przez ElevenLabs.

### `POST /api/elevenlabs/usage`
Sprawdza limit znaków ElevenLabs.

### `POST /api/elevenlabs/voices`
Lista dostępnych głosów.

## Style narracji

### Marketing
- Entuzjastyczny ton
- Podkreśla korzyści i oszczędność czasu
- "Zobacz jak łatwo...", "automatycznie", "bez Twojej ingerencji"

### Tutorial
- Spokojny, edukacyjny ton
- Tłumaczy DLACZEGO każdy krok jest potrzebny
- "teraz zobaczymy...", "zwróć uwagę..."
- Wskazówki praktyczne

### Technical
- Precyzyjny, rzeczowy ton
- Terminologia techniczna (API, endpoint, payload)
- Opis przepływu danych
- Dla programistów

## Tłumaczenia node'ów

| Angielski | Polski |
|-----------|--------|
| Schedule Trigger | Harmonogram |
| HTTP Request | Żądanie HTTP |
| Google Sheets | Arkusze Google |
| Code | Kod JavaScript |
| Webhook | Webhook (zostaje) |
| IF | Warunek |
| Switch | Przełącznik |
| Set | Ustaw dane |
| Merge | Połącz dane |
| Split In Batches | Podziel na partie |
| Wait | Czekaj |
| Execute Workflow | Uruchom workflow |
| Manual Trigger | Ręczny start |

## Struktura wewnętrzna workflow

Po parsowaniu przez `n8nParser.js`:

```javascript
{
  name: "Nazwa workflow",
  nodes: [
    {
      name: "Node name",
      type: "n8n-nodes-base.httpRequest",
      shortType: "HTTP Request",
      x: 100,
      y: 200,
      color: "#ff6b6b"
    }
  ],
  edges: [
    { source: "Node1", target: "Node2" }
  ],
  animationOrder: ["Node1", "Node2", "Node3"], // Kolejność animacji (topologiczna)
  bounds: { x, y, width, height }
}
```

## Efekty dźwiękowe (SFX)

Generowane przez FFmpeg lavfi:

### Whoosh (przy zoomowaniu)
```bash
ffmpeg -f lavfi -i 'anoisesrc=d=0.3:c=pink:a=0.3' \
  -af 'lowpass=f=2000,afade=t=in:ss=0:d=0.1,afade=t=out:st=0.15:d=0.15,volume=0.4' \
  -t 0.3 whoosh.mp3
```

### Pop (przy popup)
```bash
ffmpeg -f lavfi -i 'sine=f=800:d=0.15' \
  -af 'afade=t=in:ss=0:d=0.02,afade=t=out:st=0.05:d=0.1,volume=0.3' \
  -t 0.15 pop.mp3
```

## Timeline (tryb narrated)

```javascript
[
  {
    phase: 'intro_scroll',
    startTime: 0,
    endTime: 4000,
    audioPath: '/path/to/intro.mp3'
  },
  {
    phase: 'zoom_to_node',
    nodeName: 'HTTP Request',
    nodeIndex: 0,
    startTime: 4000,
    endTime: 4600,
    sfxPath: '/path/to/whoosh.mp3'
  },
  {
    phase: 'node_narration',
    nodeName: 'HTTP Request',
    nodeIndex: 0,
    startTime: 4600,
    endTime: 7600,
    audioPath: '/path/to/node0.mp3',
    namePL: 'Żądanie HTTP',
    typePL: 'Pobierz dane',
    emoji: '🌐',
    sfxPath: '/path/to/pop.mp3'
  },
  {
    phase: 'pause',
    startTime: 7600,
    endTime: 7900
  },
  // ... kolejne nodes
  {
    phase: 'outro',
    startTime: 45000,
    endTime: 48000,
    audioPath: '/path/to/outro.mp3'
  }
]
```

## Renderowanie

1. **Puppeteer** - renderuje SVG do PNG frame po frame
2. **FFmpeg** - składa frames w wideo + audio

### Parametry FFmpeg

```bash
ffmpeg -y \
  -framerate 30 \
  -i frame_%05d.png \
  -i intro.mp3 \
  -i node0.mp3 \
  ... \
  -filter_complex '[1:a]adelay=0|0[a0];[2:a]adelay=4600|4600[a1];...;[a0][a1]...amix=inputs=N:duration=longest:normalize=0[aout]' \
  -map 0:v \
  -map '[aout]' \
  -c:v libx264 \
  -c:a aac \
  -b:a 192k \
  -pix_fmt yuv420p \
  -preset medium \
  -crf 18 \
  output.mp4
```

## Konfiguracja

### Zmienne środowiskowe (localStorage w kliencie)
- `replicateApiKey` - klucz API Replicate (Claude)
- `elevenLabsApiKey` - klucz API ElevenLabs
- `voiceId` - ID głosu ElevenLabs (domyślnie: `3gtL0ar0RJdNhYpZ7pNZ`)
- `workflowContext` - ostatni kontekst workflow
- `narrationStyle` - ostatni styl narracji

## Uruchomienie

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Zależności

### Backend
- `express` - serwer HTTP
- `puppeteer` - renderowanie SVG do PNG
- `dagre` - layout grafu (auto-rozmieszczenie nodes)
- `replicate` - API Claude (nieużywane bezpośrednio, fetch)

### Frontend
- `react` - UI
- `vite` - bundler/dev server

### System
- `ffmpeg` - musi być zainstalowany globalnie

## Znane ograniczenia

1. Duże workflow (34+ nodes) wymagają więcej tokenów dla Claude
2. JSON parsing może się nie powieść gdy odpowiedź AI jest obcięta
3. ElevenLabs ma limit znaków (zależny od planu)
4. Puppeteer wymaga headless Chrome

## Rozwiązywanie problemów

### "Unexpected end of JSON input"
- Zwiększ `max_tokens` w `aiService.js`
- Sprawdź czy odpowiedź nie jest owrapowana w ```json

### Brak audio w wideo
- Sprawdź czy pliki audio istnieją
- Sprawdź logi FFmpeg
- Upewnij się że indeksy audio są poprawne (zaczynają od 1)

### Błąd ElevenLabs 401
- Sprawdź klucz API
- Usuń spacje z klucza i voiceId
