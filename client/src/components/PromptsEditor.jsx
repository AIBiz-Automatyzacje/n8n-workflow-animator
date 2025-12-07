import React, { useState, useEffect } from 'react'

const styles = {
  container: {
    marginBottom: '16px'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px'
  },
  tab: {
    padding: '10px 16px',
    background: '#0f0f23',
    border: '2px solid #333',
    borderRadius: '8px',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.9rem',
    transition: 'all 0.2s'
  },
  tabActive: {
    background: '#1a1a3e',
    borderColor: '#ff6b6b',
    color: '#fff'
  },
  textarea: {
    width: '100%',
    minHeight: '400px',
    padding: '12px',
    background: '#0f0f23',
    border: '2px solid #333',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.85rem',
    fontFamily: 'monospace',
    lineHeight: '1.5',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box'
  },
  textareaFocused: {
    borderColor: '#feca57'
  },
  hint: {
    fontSize: '0.75rem',
    color: '#666',
    marginTop: '8px'
  },
  variablesList: {
    marginTop: '12px',
    padding: '12px',
    background: '#0f0f23',
    borderRadius: '8px',
    fontSize: '0.8rem'
  },
  variablesTitle: {
    color: '#feca57',
    fontWeight: 'bold',
    marginBottom: '8px'
  },
  variable: {
    color: '#4ecdc4',
    marginBottom: '4px'
  },
  resetButton: {
    marginTop: '12px',
    padding: '8px 16px',
    background: '#333',
    border: 'none',
    borderRadius: '6px',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.85rem'
  }
}

// Domyślny prompt do generowania workflow
const DEFAULT_WORKFLOW_PROMPT = `Jesteś ekspertem od automatyzacji n8n. Na podstawie opisu workflow wygeneruj strukturę JSON z nodes i połączeniami.

OPIS WORKFLOW:
{{description}}

ZASADY GENEROWANIA:
1. Workflow czytamy od LEWEJ do PRAWEJ (linia prosta)
2. Pierwszy node (trigger) jest PO LEWEJ
3. Kolejne akcje idą W PRAWO
4. Pomijaj techniczne nodes (wait, split, if, merge) - tylko główne akcje
5. Każdy node musi mieć emoji odpowiedni do akcji

UKŁAD WSPÓŁRZĘDNYCH:
- Nodes w linii prostej: x rośnie, y=300 (stałe)
- Odstęp między nodes: x += 400

EMOJI DO NARZĘDZI:
- Schedule Trigger: ⏰
- HTTP Request: 🌐
- Facebook: 📘
- Gmail: 📧
- Google Sheets: 📊
- Airtable: 🗃️
- OpenAI/Claude: 🤖
- Code: 💻
- Webhook: 🔗
- Database: 🗄️
- Slack: 💬
- Twitter: 🐦
- API: 🔌
- YouTube: 📹
- Instagram: 📷

FORMAT ODPOWIEDZI (TYLKO CZYSTY JSON):
{
  "name": "Nazwa workflow",
  "nodes": [
    {
      "name": "Unikalna nazwa node'a",
      "type": "n8n-nodes-base.schedule",
      "shortType": "Schedule Trigger",
      "emoji": "⏰",
      "tileTitle": "Uruchom harmonogram",
      "popupTitle": "Automatyczny trigger",
      "popupDescription": "Workflow uruchamia się automatycznie co 15 minut, sprawdzając czy są nowe dane do przetworzenia.",
      "x": 200,
      "y": 500,
      "color": "#ff6b6b"
    }
  ],
  "edges": [
    { "source": "Unikalna nazwa node'a", "target": "Nazwa drugiego node'a" }
  ]
}

POLA NODES:
- tileTitle: Krótki tytuł wyświetlany na kafelku (2-4 słowa, np. "Pobierz komentarze")
- popupTitle: Tytuł w chmurce informacyjnej (2-3 słowa, np. "Facebook API")
- popupDescription: Opis w pop-upie (1-2 zdania, co dokładnie robi ten krok)

KOLORY NODES (losuj z palety):
["#ff6b6b", "#4ecdc4", "#feca57", "#9b59b6", "#3498db", "#e74c3c", "#2ecc71", "#f39c12"]

WAŻNE:
- Odpowiedz TYLKO czystym JSON bez \`\`\`json
- "name" node'a musi być unikalny
- edges łączą nodes po "name"
- tileTitle: tytuł na kafelku (2-4 słowa)
- popupTitle: tytuł pop-upu (2-3 słowa)
- popupDescription: opis (1-2 zdania)
- Każdy node musi mieć emoji
- Slalom: co drugi node zmienia y (góra/dół/środek)
- Workflow od LEWEJ do PRAWEJ
- WSZYSTKO PO POLSKU`

// Domyślny prompt do generowania narracji
const DEFAULT_NARRATION_PROMPT = `Jesteś ekspertem od automatyzacji n8n. Wygeneruj angażującą narrację PO POLSKU dla wideo prezentującego workflow automatyzacji.

WORKFLOW:
Nazwa: {{workflowName}}
Liczba kroków do opisania: {{nodeCount}}
Kroki (tylko najważniejsze akcje):
{{nodesDescription}}

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

function PromptsEditor({ onPromptsChange }) {
  const [activeTab, setActiveTab] = useState('workflow')
  const [workflowPrompt, setWorkflowPrompt] = useState(() =>
    localStorage.getItem('customWorkflowPrompt') || DEFAULT_WORKFLOW_PROMPT
  )
  const [narrationPrompt, setNarrationPrompt] = useState(() =>
    localStorage.getItem('customNarrationPrompt') || DEFAULT_NARRATION_PROMPT
  )
  const [isFocused, setIsFocused] = useState(false)

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem('customWorkflowPrompt', workflowPrompt)
  }, [workflowPrompt])

  useEffect(() => {
    localStorage.setItem('customNarrationPrompt', narrationPrompt)
  }, [narrationPrompt])

  // Notify parent of changes
  useEffect(() => {
    if (onPromptsChange) {
      onPromptsChange({
        workflowPrompt,
        narrationPrompt
      })
    }
  }, [workflowPrompt, narrationPrompt, onPromptsChange])

  const handleReset = () => {
    if (activeTab === 'workflow') {
      setWorkflowPrompt(DEFAULT_WORKFLOW_PROMPT)
    } else {
      setNarrationPrompt(DEFAULT_NARRATION_PROMPT)
    }
  }

  const workflowVariables = [
    { name: '{{description}}', desc: 'Opis workflow podany przez użytkownika' }
  ]

  const narrationVariables = [
    { name: '{{workflowName}}', desc: 'Nazwa workflow' },
    { name: '{{nodeCount}}', desc: 'Liczba kroków' },
    { name: '{{nodesDescription}}', desc: 'Lista nodes z typami' }
  ]

  const currentVariables = activeTab === 'workflow' ? workflowVariables : narrationVariables

  return (
    <div style={styles.container}>
      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'workflow' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('workflow')}
        >
          Prompt: Workflow
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'narration' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('narration')}
        >
          Prompt: Narracja
        </button>
      </div>

      {/* Editor */}
      <textarea
        style={{
          ...styles.textarea,
          ...(isFocused ? styles.textareaFocused : {})
        }}
        value={activeTab === 'workflow' ? workflowPrompt : narrationPrompt}
        onChange={(e) => activeTab === 'workflow'
          ? setWorkflowPrompt(e.target.value)
          : setNarrationPrompt(e.target.value)
        }
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />

      {/* Variables info */}
      <div style={styles.variablesList}>
        <div style={styles.variablesTitle}>Dostępne zmienne:</div>
        {currentVariables.map((v, i) => (
          <div key={i} style={styles.variable}>
            <code>{v.name}</code> - {v.desc}
          </div>
        ))}
      </div>

      <div style={styles.hint}>
        Zmiany są zapisywane automatycznie. Zmienne w podwójnych klamrach {'{{}}'} zostaną podstawione.
      </div>

      <button style={styles.resetButton} onClick={handleReset}>
        Przywróć domyślny prompt
      </button>
    </div>
  )
}

export default PromptsEditor
export { DEFAULT_WORKFLOW_PROMPT, DEFAULT_NARRATION_PROMPT }
