// Prompty AI do generowania narracji workflow
// Ten plik zawiera wszystkie prompty używane przez system AI

/**
 * Główny prompt do generowania narracji workflow
 *
 * Struktura narracji:
 * 1. HOOK (1 zdanie) - zachęcające intro o tym co workflow robi i jaki benefit
 * 2. NODES (tylko najważniejsze) - opis kluczowych akcji w narzędziach
 * 3. PODSUMOWANIE (1 zdanie) - co osiągnęliśmy
 *
 * System automatycznie wybiera tylko najważniejsze nodes (akcje w narzędziach),
 * pomijając techniczne elementy jak split, agregatory, czekanie, obsługa błędów.
 */
export function buildNarrationPrompt(workflow, selectedNodes, context = '') {
  // Przygotuj opis tylko wybranych nodes
  const nodesDescription = selectedNodes.map((nodeName, index) => {
    const node = workflow.nodes.find(n => n.name === nodeName)
    return `${index + 1}. "${node.name}" (typ: ${node.shortType})`
  }).join('\n')

  // Sekcja kontekstu (jeśli podany)
  const contextSection = context && context.trim() ? `
KONTEKST WORKFLOW (od użytkownika):
${context.trim()}

Wykorzystaj ten kontekst do stworzenia lepszej narracji.
Jeśli kontekst opisuje problem - podkreśl go w hooku.
Jeśli kontekst opisuje konfigurację - możesz wspomnieć o tym w opisach kroków.
` : ''

  return `Jesteś ekspertem od automatyzacji n8n. Wygeneruj angażującą narrację PO POLSKU dla wideo prezentującego workflow automatyzacji.

WORKFLOW:
Nazwa: ${workflow.name}
Liczba kroków do opisania: ${selectedNodes.length}
Kroki (tylko najważniejsze akcje):
${nodesDescription}
${contextSection}

STRUKTURA NARRACJI:

1. HOOK (1 zdanie, max 20 słów):
   - Format: "Budując tę automatyzację [BENEFIT]."
   - Przykład: "Budując tę automatyzację zaoszczędzisz 10 godzin tygodniowo na obsłudze komentarzy."
   - Podkreśl korzyść i oszczędność czasu
   - ZAWSZE zakończ kropką

2. OPISY NODES (1 zdanie, max 18 słów każdy):
   - Pierwszy node: "Na początku [NARZĘDZIE] [AKCJA]."
   - Kolejne nodes: "Następnie [NARZĘDZIE] [AKCJA]." lub "Teraz [NARZĘDZIE] [AKCJA]."
   - Zawsze podaj nazwę narzędzia i konkretną akcję
   - Przykład: "Na początku webhook wykrywa nowy komentarz na Facebooku."
   - Przykład: "Następnie OpenAI generuje spersonalizowaną odpowiedź na podstawie treści."
   - Przykład: "Teraz Airtable zapisuje dane komentarza do bazy klientów."
   - ABSOLUTNIE WYMAGANE: pole "narration" dla KAŻDEGO node MUSI kończyć się kropką!
   - BEZ KROPKI TTS BRZMI ŹLE - to jest KRYTYCZNE!
   - Sprawdź przed wysłaniem czy KAŻDY node.narration ma kropkę na końcu!

3. PODSUMOWANIE (1 zdanie, max 20 słów):
   - Format: "I w ten sposób [CO OSIĄGNĘLIŚMY]."
   - Przykład: "I w ten sposób w pełni zautomatyzowałeś obsługę komentarzy na koncie firmowym."
   - Konkretne podsumowanie bez marketingowych frazesów
   - ZAWSZE zakończ kropką

FORMAT ODPOWIEDZI (TYLKO CZYSTY JSON, bez \`\`\`json):
{
  "intro": "Hook - co robi workflow i jaki benefit (max 15 słów)",
  "nodes": [
    {
      "name": "dokładna nazwa node'a z workflow",
      "namePL": "polska nazwa akcji (2-3 słowa, np. 'Pobierz komentarze')",
      "typePL": "polski typ (np. 'Facebook', 'Żądanie HTTP', 'Baza danych')",
      "narration": "co robi (max 12 słów) - to jest czytane jako voice-over",
      "description": "krótki opis wyświetlany w okienku info (2-3 zdania, max 40 słów)"
    }
  ],
  "outro": "Podsumowanie - co osiągnęliśmy (max 15 słów)"
}

WAŻNE O POLU "description":
- To jest tekst wyświetlany w okienku informacyjnym przy kafelku
- Powinien wyjaśniać CO DOKŁADNIE robi ten krok i DLACZEGO jest ważny
- Przykład: "Pobiera wszystkie nowe komentarze z ostatnich 24h. Filtruje tylko te wymagające odpowiedzi."
- MUSI być inny niż narration - bardziej szczegółowy i techniczny

ZASADY TŁUMACZEŃ:
- Schedule Trigger → Harmonogram
- HTTP Request → Żądanie HTTP
- Google Sheets → Arkusze Google
- Code → Kod
- Webhook → Webhook (zostaje)
- API → API (zostaje)
- IF → Warunek
- Set → Dane
- Edit Fields → Edycja
- OpenAI → OpenAI (zostaje)
- Facebook → Facebook (zostaje)
- Gmail → Gmail (zostaje)

STYL:
- Prosty język dla osoby nietechnicznej
- Konkretnie i na temat
- Bez zbędnych słów i marketingowych frazesów
- Narracja musi być naturalna do odczytania głosem
- Wszystko po polsku (poza nazwami narzędzi jak API, Facebook, Gmail)

WAŻNE - KLUCZOWE ZASADY:
- KAŻDE zdanie MUSI kończyć się kropką (bez kropki TTS brzmi źle!)
- KRYTYCZNE: Pole "narration" w KAŻDYM obiekcie nodes[] MUSI mieć kropkę na końcu!
- Przykład DOBRY: "narration": "Na początku webhook wykrywa nowy komentarz."
- Przykład ZŁY: "narration": "Na początku webhook wykrywa nowy komentarz"
- Używaj słów przejściowych: "Na początku", "Następnie", "Teraz"
- Zawsze podawaj nazwę narzędzia (Facebook, OpenAI, Airtable)
- Pole "name" musi DOKŁADNIE odpowiadać nazwie node'a z listy
- Odpowiedz TYLKO czystym JSON bez markdown
- Trzymaj się limitów słów
- PRZED WYSŁANIEM: sprawdź czy intro, outro i KAŻDY node.narration ma kropkę!`
}

/**
 * Filtruje nodes wybierając tylko najważniejsze
 * Pomija techniczne elementy jak split, agregatory, czekanie, obsługa błędów
 */
export function selectImportantNodes(workflow) {
  const allNodes = workflow.animationOrder

  // Typy nodes które POMIJAMY (techniczne, nieistotne dla widza)
  const skipTypes = [
    'merge',
    'split',
    'splitinbatches',
    'aggregate',
    'wait',
    'if',
    'switch',
    'stickynote',
    'executeworkflow',
    'errorworkflow',
    'respondtowebhook',
    'noop'
  ]

  // Zawsze zachowaj pierwszy node (trigger)
  const importantNodes = []

  allNodes.forEach((nodeName, index) => {
    const node = workflow.nodes.find(n => n.name === nodeName)
    if (!node) return

    const nodeType = node.type.toLowerCase().replace('n8n-nodes-base.', '')
    const shortType = (node.shortType || '').toLowerCase()

    // Pierwszy node (trigger) zawsze dodaj
    if (index === 0) {
      importantNodes.push(nodeName)
      return
    }

    // Pomiń techniczne nodes
    const shouldSkip = skipTypes.some(skipType =>
      nodeType.includes(skipType) || shortType.includes(skipType)
    )

    if (!shouldSkip) {
      importantNodes.push(nodeName)
    }
  })

  // Jeśli po filtrowaniu zostało bardzo mało nodes (< 3), weź więcej
  if (importantNodes.length < 3 && allNodes.length > 3) {
    // Weź co drugi node
    return allNodes.filter((_, index) => index % 2 === 0)
  }

  // Jeśli dalej za dużo (> 8), weź co drugi
  if (importantNodes.length > 8) {
    return importantNodes.filter((_, index) => index % 2 === 0)
  }

  return importantNodes
}
