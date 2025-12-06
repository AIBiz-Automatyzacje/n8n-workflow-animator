import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { renderVideo, renderVideoWithAudio } from './renderer.js'
import { renderNarratedVideo } from './narratedRenderer.js'
import { generateNarration, buildSegmentedNarration } from './aiService.js'
import { generateAudio, generateSegmentedAudio, generateAudioWithPauses, getVoices, getUsage } from './elevenLabsService.js'
import { generateWorkflowFromText } from './workflowGenerator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Folder na audio
const audioDir = join(__dirname, '..', 'output', 'audio')
if (!existsSync(audioDir)) mkdirSync(audioDir, { recursive: true })

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// API endpoint do eksportu wideo
app.post('/api/export', async (req, res) => {
  try {
    const { workflow, settings } = req.body

    if (!workflow || !workflow.nodes) {
      return res.status(400).json({ error: 'Invalid workflow data' })
    }

    console.log(`[Export] Starting export for "${workflow.name}"`)
    console.log(`[Export] Nodes: ${workflow.nodes.length}, Aspect: ${settings.aspectRatio}, Speed: ${settings.speed}`)

    const videoPath = await renderVideo(workflow, settings)

    console.log(`[Export] Video ready: ${videoPath}`)

    res.download(videoPath, `${workflow.name || 'workflow'}-animation.mp4`, (err) => {
      if (err) {
        console.error('[Export] Download error:', err)
      }
    })
  } catch (error) {
    console.error('[Export] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// === API GENEROWANIA WORKFLOW ===

// Generuj workflow z opisu tekstowego
app.post('/api/generate-workflow', async (req, res) => {
  try {
    const { description, replicateApiToken } = req.body

    if (!description || !replicateApiToken) {
      return res.status(400).json({ error: 'Missing description or API token' })
    }

    console.log(`[WorkflowGen] Generating workflow from description...`)

    const result = await generateWorkflowFromText(description, replicateApiToken)

    if (result.success) {
      console.log(`[WorkflowGen] Workflow generated successfully`)
      res.json(result)
    } else {
      console.error(`[WorkflowGen] Failed: ${result.error}`)
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('[WorkflowGen] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// === API NARRACJI AI ===

// Generuj narrację przez Claude
app.post('/api/generate-narration', async (req, res) => {
  try {
    const { workflow, replicateApiToken, context } = req.body

    if (!workflow || !replicateApiToken) {
      return res.status(400).json({ error: 'Missing workflow or API token' })
    }

    console.log(`[AI] Generating narration for "${workflow.name}"...`)
    console.log(`[AI] Context length: ${context?.length || 0}`)

    const result = await generateNarration(workflow, replicateApiToken, context)

    if (result.success) {
      // KRYTYCZNE: WYMUSZAJ kropki na końcu każdego zdania (AI ich nie dodaje!)
      // Bez kropek TTS brzmi nienaturalnie
      if (result.narration.intro && !result.narration.intro.trim().endsWith('.')) {
        result.narration.intro = result.narration.intro.trim() + '.'
        console.log('[AI] Added missing period to intro')
      }

      if (result.narration.nodes) {
        result.narration.nodes.forEach((node, index) => {
          if (node.narration && !node.narration.trim().endsWith('.')) {
            node.narration = node.narration.trim() + '.'
            console.log(`[AI] Added missing period to node ${index + 1}: "${node.name}"`)
          }
        })
      }

      if (result.narration.outro && !result.narration.outro.trim().endsWith('.')) {
        result.narration.outro = result.narration.outro.trim() + '.'
        console.log('[AI] Added missing period to outro')
      }

      console.log(`[AI] Narration generated successfully (periods enforced)`)
      res.json(result)
    } else {
      console.error(`[AI] Failed: ${result.error}`)
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('[AI] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// === API ELEVENLABS ===

// Generuj audio dla całej narracji
app.post('/api/generate-audio', async (req, res) => {
  try {
    const { text, elevenLabsApiKey, voiceId } = req.body

    if (!text || !elevenLabsApiKey || !voiceId) {
      return res.status(400).json({ error: 'Missing text, API key, or voice ID' })
    }

    const outputPath = join(audioDir, `narration_${Date.now()}.mp3`)
    console.log(`[Audio] Generating audio...`)

    const result = await generateAudio(text, elevenLabsApiKey, voiceId, outputPath)

    if (result.success) {
      res.json({ ...result, url: `/api/audio/${result.path.split('/').pop()}` })
    } else {
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('[Audio] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Generuj audio per segment (zsynchronizowane z animacją)
app.post('/api/generate-segmented-audio', async (req, res) => {
  try {
    const { narration, workflow, settings, elevenLabsApiKey, voiceId, useSSML } = req.body

    if (!narration || !workflow || !elevenLabsApiKey || !voiceId) {
      return res.status(400).json({ error: 'Missing required data' })
    }

    // SSML wyłączone - segmenty lepiej się synchronizują z animacją
    if (useSSML === true) { // Domyślnie wyłączone - używamy segmentów
      console.log('[Audio] Generating single audio with SSML pauses...')

      const outputPath = join(audioDir, `narration_ssml_${Date.now()}.mp3`)
      const result = await generateAudioWithPauses(narration, elevenLabsApiKey, voiceId, outputPath)

      if (result.success) {
        // Zwróć informację o pojedynczym pliku audio
        res.json({
          success: true,
          audioPath: outputPath,
          audioSize: result.size,
          ssmlUsed: true,
          url: `/api/audio/${outputPath.split('/').pop()}`
        })
      } else {
        res.status(500).json(result)
      }
      return
    }

    // Stara metoda: osobne segmenty (dla compatibility)
    const SPEED_SETTINGS = {
      slow: { nodeDelay: 1500, edgeDelay: 800 },
      normal: { nodeDelay: 1000, edgeDelay: 500 },
      fast: { nodeDelay: 600, edgeDelay: 300 }
    }

    const speedConfig = SPEED_SETTINGS[settings.speed] || SPEED_SETTINGS.normal

    // Buduj segmenty z timingiem
    const segments = buildSegmentedNarration(narration, workflow, speedConfig)

    console.log(`[Audio] Generating ${segments.length} audio segments (legacy mode)...`)

    // Generuj audio dla każdego segmentu
    const segmentDir = join(audioDir, `segments_${Date.now()}`)
    mkdirSync(segmentDir, { recursive: true })

    const results = await generateSegmentedAudio(segments, elevenLabsApiKey, voiceId, segmentDir)

    res.json({
      success: true,
      segments: results,
      segmentDir,
      ssmlUsed: false
    })
  } catch (error) {
    console.error('[Audio] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Sprawdź limit ElevenLabs
app.post('/api/elevenlabs/usage', async (req, res) => {
  try {
    const { apiKey } = req.body
    if (!apiKey) return res.status(400).json({ error: 'Missing API key' })

    const result = await getUsage(apiKey)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Pobierz dostępne głosy
app.post('/api/elevenlabs/voices', async (req, res) => {
  try {
    const { apiKey } = req.body
    if (!apiKey) return res.status(400).json({ error: 'Missing API key' })

    const result = await getVoices(apiKey)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Serwuj pliki audio
app.use('/api/audio', express.static(audioDir))

// Eksport z audio (tryb klasyczny)
app.post('/api/export-with-audio', async (req, res) => {
  try {
    const { workflow, settings, audioSegments } = req.body

    if (!workflow || !workflow.nodes) {
      return res.status(400).json({ error: 'Invalid workflow data' })
    }

    console.log(`[Export] Starting export with audio for "${workflow.name}"`)

    const videoPath = await renderVideoWithAudio(workflow, settings, audioSegments)

    console.log(`[Export] Video with audio ready: ${videoPath}`)

    res.download(videoPath, `${workflow.name || 'workflow'}-animation.mp4`, (err) => {
      if (err) {
        console.error('[Export] Download error:', err)
      }
    })
  } catch (error) {
    console.error('[Export] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Eksport z narracja (tryb narrated - zsynchronizowany)
app.post('/api/export-narrated', async (req, res) => {
  try {
    const { workflow, settings, audioSegments } = req.body

    if (!workflow || !workflow.nodes) {
      return res.status(400).json({ error: 'Invalid workflow data' })
    }

    if (!audioSegments) {
      return res.status(400).json({ error: 'Audio data required for narrated mode' })
    }

    // KRYTYCZNE: Sprawdź czy mamy SSML (obiekt) czy segmenty (array)
    const isSSML = audioSegments.ssmlUsed && audioSegments.audioPath
    const segmentCount = isSSML ? 1 : (audioSegments.segments?.length || audioSegments.length || 0)

    console.log(`[Export Narrated] Starting export for "${workflow.name}"`)
    console.log(`[Export Narrated] Audio type: ${isSSML ? 'SSML with pauses' : 'segmented'}`)
    console.log(`[Export Narrated] Segments/files: ${segmentCount}`)
    if (isSSML) {
      console.log(`[Export Narrated] SSML audio path: ${audioSegments.audioPath}`)
    }

    const videoPath = await renderNarratedVideo(workflow, settings, audioSegments)

    console.log(`[Export Narrated] Video ready: ${videoPath}`)

    res.download(videoPath, `${workflow.name || 'workflow'}-narrated.mp4`, (err) => {
      if (err) {
        console.error('[Export Narrated] Download error:', err)
      }
    })
  } catch (error) {
    console.error('[Export Narrated] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`)
  console.log(`[Server] Endpoints:`)
  console.log(`  POST /api/export - Export video`)
  console.log(`  POST /api/export-with-audio - Export video with narration`)
  console.log(`  POST /api/generate-narration - Generate AI narration`)
  console.log(`  POST /api/generate-audio - Generate ElevenLabs audio`)
})
