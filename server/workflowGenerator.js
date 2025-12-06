// Generator workflow z opisu tekstowego przez AI

/**
 * Prompt do generowania workflow z opisu tekstowego
 */
export function buildWorkflowGeneratorPrompt(description) {
  return `Jesteś ekspertem od automatyzacji n8n. Na podstawie opisu workflow wygeneruj strukturę JSON z nodes i połączeniami.

OPIS WORKFLOW:
${description}

ZASADY GENEROWANIA:
1. Workflow czytamy od LEWEJ do PRAWEJ
2. Pierwszy node (trigger) jest PO LEWEJ
3. Kolejne akcje idą W PRAWO
4. Nodes układaj w SLALOM (góra-dół) dla lepszego efektu wizualnego
5. Pomijaj techniczne nodes (wait, split, if, merge) - tylko główne akcje
6. Każdy node musi mieć emoji odpowiedni do akcji

UKŁAD WSPÓŁRZĘDNYCH (16:9, 1920x1080):
- Trigger: x=200, y=400-600 (lewa strona, środek)
- Akcje idą w prawo: x += 350-400 każdy krok
- Slalom: y zmienia się +150/-150 co drugi node
- Maksymalnie 70-80% ekranu (x: 200-1500, y: 200-880)

PRZYKŁADOWY SLALOM:
Node 1 (trigger): x=200, y=500
Node 2: x=550, y=350 (w górę)
Node 3: x=900, y=500 (środek)
Node 4: x=1250, y=650 (w dół)
Node 5: x=1600, y=500 (środek)

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
      "actionTitle": "Uruchom co 15 minut",
      "toolName": "Harmonogram",
      "x": 200,
      "y": 500,
      "color": "#ff6b6b"
    },
    {
      "name": "Pobierz komentarze",
      "type": "n8n-nodes-base.facebook",
      "shortType": "Facebook",
      "emoji": "📘",
      "actionTitle": "Pobierz nowe komentarze",
      "toolName": "Facebook API",
      "x": 550,
      "y": 350,
      "color": "#4ecdc4"
    }
  ],
  "edges": [
    { "source": "Unikalna nazwa node'a", "target": "Pobierz komentarze" }
  ]
}

KOLORY NODES (losuj z palety):
["#ff6b6b", "#4ecdc4", "#feca57", "#9b59b6", "#3498db", "#e74c3c", "#2ecc71", "#f39c12"]

WAŻNE:
- Odpowiedz TYLKO czystym JSON bez \`\`\`json
- "name" node'a musi być unikalny
- edges łączą nodes po "name"
- actionTitle: krótki opis CO robi (np. "Pobierz nowe komentarze")
- toolName: nazwa narzędzia (np. "Facebook API", "OpenAI", "Airtable")
- Każdy node musi mieć emoji
- Slalom: co drugi node zmienia y (góra/dół/środek)
- Workflow od LEWEJ do PRAWEJ`
}

/**
 * Generuje workflow z opisu tekstowego przez AI
 */
export async function generateWorkflowFromText(description, apiToken) {
  const prompt = buildWorkflowGeneratorPrompt(description)

  try {
    console.log('[WorkflowGen] Generating workflow from description...')
    console.log('[WorkflowGen] Description length:', description.length)

    const createResponse = await fetch('https://api.replicate.com/v1/models/anthropic/claude-4.5-sonnet/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          prompt,
          max_tokens: 3000
        }
      })
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      throw new Error(`Replicate API error: ${createResponse.status} - ${errorText}`)
    }

    const prediction = await createResponse.json()
    console.log('[WorkflowGen] Prediction created:', prediction.id)

    // Poll dla wyniku
    let result = prediction
    let attempts = 0
    const maxAttempts = 60

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000))

      const statusResponse = await fetch(result.urls.get, {
        headers: {
          'Authorization': `Bearer ${apiToken}`
        }
      })

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`)
      }

      result = await statusResponse.json()
      attempts++

      if (attempts % 5 === 0) {
        console.log(`[WorkflowGen] Waiting... status: ${result.status}`)
      }
    }

    if (result.status === 'failed') {
      throw new Error(result.error || 'Prediction failed')
    }

    if (result.status !== 'succeeded') {
      throw new Error('Prediction timeout')
    }

    // Parsuj odpowiedź
    let fullResponse = ''
    if (Array.isArray(result.output)) {
      fullResponse = result.output.join('')
    } else if (typeof result.output === 'string') {
      fullResponse = result.output
    } else {
      fullResponse = JSON.stringify(result.output)
    }

    console.log('[WorkflowGen] Response length:', fullResponse.length)

    // Usuń markdown
    let cleanedResponse = fullResponse
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    // Parsuj JSON
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Nie znaleziono JSON w odpowiedzi')
    }

    const workflowData = JSON.parse(jsonMatch[0])

    // Dodaj bounds
    const xs = workflowData.nodes.map(n => n.x)
    const ys = workflowData.nodes.map(n => n.y)

    const bounds = {
      x: Math.min(...xs) - 100,
      y: Math.min(...ys) - 100,
      width: Math.max(...xs) - Math.min(...xs) + 300,
      height: Math.max(...ys) - Math.min(...ys) + 200
    }

    // Dodaj animationOrder (od lewej do prawej)
    const animationOrder = workflowData.nodes
      .sort((a, b) => a.x - b.x)
      .map(n => n.name)

    const workflow = {
      ...workflowData,
      bounds,
      animationOrder
    }

    console.log('[WorkflowGen] Workflow generated successfully')
    console.log('[WorkflowGen] Nodes:', workflow.nodes.length)

    return {
      success: true,
      workflow
    }

  } catch (error) {
    console.error('[WorkflowGen] Error:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}
