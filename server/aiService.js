// Serwis do generowania narracji przez Claude (via Replicate HTTP API)

import { buildNarrationPrompt, selectImportantNodes } from './aiPrompts.js'

export async function generateNarration(workflow, apiToken, context = '') {
  // Wybierz tylko najważniejsze nodes (pomijając techniczne elementy)
  const selectedNodes = selectImportantNodes(workflow)

  console.log('[AI] Selected important nodes:', selectedNodes.length, 'out of', workflow.animationOrder.length)

  // Zbuduj prompt używając wybranych nodes
  const prompt = buildNarrationPrompt(workflow, selectedNodes, context)

  try {
    console.log('[AI] Calling Replicate HTTP API...')
    console.log('[AI] Workflow nodes:', workflow.animationOrder.length)

    // Krok 1: Utwórz prediction
    // Zwiększamy max_tokens dla dużych workflow (34+ nodes = dużo tekstu)
    const maxTokens = Math.max(4000, workflow.animationOrder.length * 150)
    console.log(`[AI] Using max_tokens: ${maxTokens}`)

    const createResponse = await fetch('https://api.replicate.com/v1/models/anthropic/claude-4.5-sonnet/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          prompt,
          max_tokens: maxTokens
        }
      })
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('[AI] Create prediction error:', createResponse.status, errorText)
      throw new Error(`Replicate API error: ${createResponse.status} - ${errorText}`)
    }

    const prediction = await createResponse.json()
    console.log('[AI] Prediction created:', prediction.id)
    console.log('[AI] Status:', prediction.status)

    // Krok 2: Czekaj na zakończenie (polling)
    let result = prediction
    let attempts = 0
    const maxAttempts = 60 // Max 60 sekund

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
        console.log(`[AI] Waiting... status: ${result.status}, attempt: ${attempts}`)
      }
    }

    if (result.status === 'failed') {
      console.error('[AI] Prediction failed:', result.error)
      throw new Error(result.error || 'Prediction failed')
    }

    if (result.status !== 'succeeded') {
      throw new Error('Prediction timeout')
    }

    console.log('[AI] Prediction succeeded!')
    console.log('[AI] Output type:', typeof result.output)

    // Output może być stringiem lub tablicą
    let fullResponse = ''
    if (Array.isArray(result.output)) {
      fullResponse = result.output.join('')
    } else if (typeof result.output === 'string') {
      fullResponse = result.output
    } else {
      fullResponse = JSON.stringify(result.output)
    }

    console.log('[AI] Response length:', fullResponse.length)
    console.log('[AI] Response preview:', fullResponse.substring(0, 300))

    // Usuń markdown code blocks (```json ... ```)
    let cleanedResponse = fullResponse
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    console.log('[AI] Cleaned response preview:', cleanedResponse.substring(0, 200))

    // Parsuj JSON z odpowiedzi
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const narration = JSON.parse(jsonMatch[0])
        console.log('[AI] Parsed narration successfully')
        console.log('[AI] Nodes in narration:', narration.nodes?.length)
        return {
          success: true,
          narration
        }
      } catch (parseError) {
        console.error('[AI] JSON parse error:', parseError.message)
        console.error('[AI] JSON that failed:', jsonMatch[0].substring(0, 500))

        // Spróbuj naprawić obcięty JSON
        let jsonStr = jsonMatch[0]

        // Jeśli JSON jest obcięty, spróbuj go zamknąć
        const openBraces = (jsonStr.match(/\{/g) || []).length
        const closeBraces = (jsonStr.match(/\}/g) || []).length
        const openBrackets = (jsonStr.match(/\[/g) || []).length
        const closeBrackets = (jsonStr.match(/\]/g) || []).length

        if (openBraces > closeBraces || openBrackets > closeBrackets) {
          console.log('[AI] Attempting to fix truncated JSON...')
          // Dodaj brakujące zamknięcia
          jsonStr = jsonStr + ']}'.repeat(openBraces - closeBraces + openBrackets - closeBrackets)

          try {
            const narration = JSON.parse(jsonStr)
            console.log('[AI] Fixed and parsed narration, nodes:', narration.nodes?.length)
            return {
              success: true,
              narration
            }
          } catch (e) {
            throw new Error('Odpowiedź AI została obcięta. Spróbuj z mniejszym workflow.')
          }
        }

        throw parseError
      }
    } else {
      console.error('[AI] Could not find JSON in response')
      throw new Error('Nie udało się sparsować odpowiedzi jako JSON')
    }
  } catch (error) {
    console.error('[AI] Error:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

// Generuj tekst dla całej narracji (do audio)
export function buildFullNarrationText(narration) {
  const parts = []

  // Intro
  parts.push(narration.intro)

  // Każdy node
  narration.nodes.forEach((node, index) => {
    parts.push(node.narration)
  })

  // Outro
  parts.push(narration.outro)

  return parts.join('. ')
}

// Generuj narrację per segment (z timingiem)
export function buildSegmentedNarration(narration, workflow, speedConfig) {
  const segments = []
  let currentTime = 300 // start delay

  // Intro
  segments.push({
    type: 'intro',
    text: narration.intro,
    startTime: 0,
    endTime: currentTime
  })

  // Każdy node
  workflow.animationOrder.forEach((nodeName, index) => {
    const nodeNarration = narration.nodes.find(n => n.name === nodeName) ||
                          narration.nodes[index]

    const nodeStartTime = currentTime
    currentTime += speedConfig.nodeDelay

    // Dodaj czas na edge'y
    const outgoingEdges = workflow.edges.filter(e => e.source === nodeName)
    currentTime += outgoingEdges.length * speedConfig.edgeDelay * 0.6

    segments.push({
      type: 'node',
      name: nodeName,
      namePL: nodeNarration?.namePL || nodeName,
      typePL: nodeNarration?.typePL || '',
      text: nodeNarration?.narration || '',
      description: nodeNarration?.description || nodeNarration?.narration || '',
      startTime: nodeStartTime,
      endTime: currentTime
    })
  })

  // Outro (podczas scroll/zoom out)
  segments.push({
    type: 'outro',
    text: narration.outro,
    startTime: currentTime,
    endTime: currentTime + 3000
  })

  return segments
}
