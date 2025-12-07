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
import multer from 'multer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Folder na audio i uploady
const audioDir = join(__dirname, '..', 'output', 'audio')
const uploadDir = join(__dirname, '..', 'output', 'uploads')
if (!existsSync(audioDir)) mkdirSync(audioDir, { recursive: true })
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

// Konfiguracja multer do uploadu plików
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `avatar_${Date.now()}.mp4`)
})
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }) // 500MB limit

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
    const { description, replicateApiToken, customPrompt } = req.body

    if (!description || !replicateApiToken) {
      return res.status(400).json({ error: 'Missing description or API token' })
    }

    console.log(`[WorkflowGen] Generating workflow from description...`)
    console.log(`[WorkflowGen] Custom prompt: ${customPrompt ? 'yes' : 'no'}`)

    const result = await generateWorkflowFromText(description, replicateApiToken, customPrompt)

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

// Parsuj gotową narrację (bez AI)
app.post('/api/parse-narration', async (req, res) => {
  try {
    const { workflow, workflowSteps, narrationInput } = req.body

    if (!workflow || !narrationInput) {
      return res.status(400).json({ error: 'Missing workflow or narration input' })
    }

    console.log(`[Parse Narration] Parsing input for "${workflow.name}"...`)

    // Spróbuj sparsować jako JSON
    let parsedNarration = null

    try {
      // Usuń ewentualne markdown backticks
      let cleanInput = narrationInput.trim()
      if (cleanInput.startsWith('```json')) {
        cleanInput = cleanInput.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanInput.startsWith('```')) {
        cleanInput = cleanInput.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }

      // Sparsuj JSON
      parsedNarration = JSON.parse(cleanInput)
      console.log(`[Parse Narration] Successfully parsed as JSON`)
    } catch (jsonError) {
      console.log(`[Parse Narration] Not valid JSON, using raw text`)
      // Jeśli nie JSON, użyj jako intro z pustą resztą
      parsedNarration = {
        intro: narrationInput.trim(),
        nodes: [],
        outro: ''
      }
    }

    // Upewnij się że mamy poprawną strukturę
    const narration = {
      intro: parsedNarration.intro || '',
      nodes: [],
      outro: parsedNarration.outro || ''
    }

    // Mapuj nodes z parsowanego na workflow nodes
    if (parsedNarration.nodes && Array.isArray(parsedNarration.nodes)) {
      // Pobierz listę nodes z workflow
      const workflowNodes = workflow.nodes || []

      narration.nodes = parsedNarration.nodes.map((parsedNode, index) => {
        // Znajdź odpowiadający node w workflow
        const matchingWorkflowNode = workflowNodes.find(wn =>
          wn.name === parsedNode.name ||
          wn.name?.toLowerCase() === parsedNode.name?.toLowerCase()
        ) || workflowNodes[index]

        return {
          name: parsedNode.name || matchingWorkflowNode?.name || `Node ${index + 1}`,
          namePL: parsedNode.namePL || parsedNode.name || matchingWorkflowNode?.tileTitle || '',
          typePL: parsedNode.typePL || matchingWorkflowNode?.shortType || '',
          narration: parsedNode.narration || '',
          description: parsedNode.description || ''
        }
      })
    } else {
      // Brak nodes w parsowanym - stwórz puste dla każdego workflow node
      narration.nodes = (workflow.nodes || []).map((wn, index) => ({
        name: wn.name,
        namePL: wn.tileTitle || wn.name,
        typePL: wn.shortType || '',
        narration: '',
        description: ''
      }))
    }

    // Wymuś kropki na końcu zdań
    if (narration.intro && !narration.intro.trim().endsWith('.')) {
      narration.intro = narration.intro.trim() + '.'
    }
    narration.nodes.forEach(node => {
      if (node.narration && !node.narration.trim().endsWith('.')) {
        node.narration = node.narration.trim() + '.'
      }
    })
    if (narration.outro && !narration.outro.trim().endsWith('.')) {
      narration.outro = narration.outro.trim() + '.'
    }

    console.log(`[Parse Narration] Parsed ${narration.nodes.length} nodes`)

    res.json({
      success: true,
      narration
    })
  } catch (error) {
    console.error('[Parse Narration] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Generuj narrację przez Claude
app.post('/api/generate-narration', async (req, res) => {
  try {
    const { workflow, replicateApiToken, context, customPrompt } = req.body

    if (!workflow || !replicateApiToken) {
      return res.status(400).json({ error: 'Missing workflow or API token' })
    }

    console.log(`[AI] Generating narration for "${workflow.name}"...`)
    console.log(`[AI] Context length: ${context?.length || 0}`)
    console.log(`[AI] Custom prompt: ${customPrompt ? 'yes' : 'no'}`)

    const result = await generateNarration(workflow, replicateApiToken, context, customPrompt)

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
    const { narration, workflow, settings, elevenLabsApiKey, voiceId, useSSML, regenerateIndex } = req.body

    if (!narration || !workflow || !elevenLabsApiKey || !voiceId) {
      return res.status(400).json({ error: 'Missing required data' })
    }

    // Regeneracja pojedynczego segmentu
    if (regenerateIndex !== null && regenerateIndex !== undefined) {
      console.log(`[Audio] Regenerating single segment ${regenerateIndex}...`)

      const SPEED_SETTINGS = {
        slow: { nodeDelay: 1500, edgeDelay: 800 },
        normal: { nodeDelay: 1000, edgeDelay: 500 },
        fast: { nodeDelay: 600, edgeDelay: 300 }
      }
      const speedConfig = SPEED_SETTINGS[settings?.speed] || SPEED_SETTINGS.normal
      const segments = buildSegmentedNarration(narration, workflow, speedConfig)

      if (regenerateIndex >= segments.length) {
        return res.status(400).json({ error: 'Invalid segment index' })
      }

      const segment = segments[regenerateIndex]
      const segmentDir = join(audioDir, `segment_regen_${Date.now()}`)
      mkdirSync(segmentDir, { recursive: true })

      const results = await generateSegmentedAudio([segment], elevenLabsApiKey, voiceId, segmentDir)

      return res.json({
        success: true,
        segments: results,
        ssmlUsed: false
      })
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

    // renderNarratedVideo teraz zwraca obiekt { videoPath, cleanAudioPath }
    const result = await renderNarratedVideo(workflow, settings, audioSegments)
    const videoPath = typeof result === 'string' ? result : result.videoPath

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

// === NOWY FLOW: Ręczny upload awatara ===

// Przechowuj ostatnio renderowane wideo (ścieżka) i wyciągnięte audio
let lastRenderedVideoPath = null
let lastCleanAudioPath = null

// Eksport wideo + ekstrakcja audio (generuje oba naraz)
// Zwraca JSON z info o plikach (użytkownik może pobrać oba)
// WAŻNE:
// - Wideo do pobrania = pełne (voiceover + SFX)
// - Wideo do montażu z awatarem = tylko SFX (bez voiceover)
// - Audio do pobrania = wyodrębnione z wideo VOICEOVER-ONLY (czyste bez SFX, z przerwami)
app.post('/api/export-with-audio-extract', async (req, res) => {
  try {
    const { workflow, settings, audioSegments } = req.body

    if (!workflow || !workflow.nodes) {
      return res.status(400).json({ error: 'Invalid workflow data' })
    }

    if (!audioSegments) {
      return res.status(400).json({ error: 'Audio data required' })
    }

    console.log(`[Export+Audio] Rendering videos...`)

    // 1. Renderuj wideo PEŁNE (voiceover + SFX) - do pobrania
    console.log(`[Export+Audio] Rendering full video (voiceover + SFX)...`)
    const fullResult = await renderNarratedVideo(workflow, settings, audioSegments, { sfxOnly: false, voiceoverOnly: false })
    const fullVideoPath = typeof fullResult === 'string' ? fullResult : fullResult.videoPath

    console.log(`[Export+Audio] Full video rendered: ${fullVideoPath}`)

    // 2. Renderuj wideo SFX-ONLY (tylko efekty dźwiękowe) - do montażu z awatarem
    console.log(`[Export+Audio] Rendering SFX-only video (for avatar montage)...`)
    const sfxResult = await renderNarratedVideo(workflow, settings, audioSegments, { sfxOnly: true, voiceoverOnly: false })
    const sfxVideoPath = typeof sfxResult === 'string' ? sfxResult : sfxResult.videoPath

    // Zapisz ścieżkę do wideo SFX-only (będzie użyte przy montażu awatara)
    lastRenderedVideoPath = sfxVideoPath
    console.log(`[Export+Audio] SFX-only video rendered: ${sfxVideoPath}`)

    // 3. Renderuj wideo VOICEOVER-ONLY (tylko naracja, bez SFX) - do ekstrakcji czystego audio
    console.log(`[Export+Audio] Rendering voiceover-only video (for clean audio extraction)...`)
    const voiceResult = await renderNarratedVideo(workflow, settings, audioSegments, { sfxOnly: false, voiceoverOnly: true })
    const voiceVideoPath = typeof voiceResult === 'string' ? voiceResult : voiceResult.videoPath

    console.log(`[Export+Audio] Voiceover-only video rendered: ${voiceVideoPath}`)

    // 4. Wyodrębnij CZYSTE audio (tylko voiceover, bez SFX) z wideo voiceover-only
    // To gwarantuje że audio ma prawidłowe przerwy zsynchronizowane z animacją
    console.log(`[Export+Audio] Extracting clean voiceover audio (no SFX)...`)
    const audioPath = await extractAudioFromVideo(voiceVideoPath, audioDir)

    lastCleanAudioPath = audioPath
    console.log(`[Export+Audio] Clean audio extracted: ${audioPath}`)

    // Zwróć info o plikach - wideo pełne do pobrania, ale montaż używa SFX-only
    res.json({
      success: true,
      videoPath: fullVideoPath,           // Pełne wideo do pobrania (voiceover + SFX)
      videoFileName: fullVideoPath.split('/').pop(),
      sfxVideoPath: sfxVideoPath,         // SFX-only do montażu z awatarem
      sfxVideoFileName: sfxVideoPath.split('/').pop(),
      audioPath,                          // Czyste audio (tylko voiceover, bez SFX)
      audioFileName: audioPath.split('/').pop()
    })
  } catch (error) {
    console.error('[Export+Audio] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Pobierz wideo (po wygenerowaniu przez export-with-audio-extract)
app.get('/api/download-video/:filename', (req, res) => {
  const { filename } = req.params
  const videoPath = join(__dirname, '..', 'output', filename)

  if (!existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video file not found' })
  }

  res.download(videoPath, filename, (err) => {
    if (err) {
      console.error('[Download Video] Error:', err)
    }
  })
})

// Pobierz audio (po wygenerowaniu przez export-with-audio-extract)
app.get('/api/download-audio/:filename', (req, res) => {
  const { filename } = req.params

  // Sprawdź w output/audio/ (stara lokalizacja)
  let audioPath = join(audioDir, filename)

  // Jeśli nie ma w audio/, sprawdź w głównym output/ (tu zapisuje mergeCleanAudioSegments)
  if (!existsSync(audioPath)) {
    const outputPath = join(__dirname, '..', 'output', filename)
    if (existsSync(outputPath)) {
      audioPath = outputPath
    }
  }

  if (!existsSync(audioPath)) {
    console.error(`[Download Audio] File not found: ${filename}`)
    console.error(`[Download Audio] Checked: ${join(audioDir, filename)}`)
    console.error(`[Download Audio] Checked: ${join(__dirname, '..', 'output', filename)}`)
    return res.status(404).json({ error: 'Audio file not found' })
  }

  console.log(`[Download Audio] Serving: ${audioPath}`)
  res.download(audioPath, filename, (err) => {
    if (err) {
      console.error('[Download Audio] Error:', err)
    }
  })
})

// Upload awatara i montaż z wideo
app.post('/api/combine-uploaded-avatar', upload.single('avatarVideo'), async (req, res) => {
  try {
    const avatarVideoPath = req.file?.path

    if (!avatarVideoPath) {
      return res.status(400).json({ error: 'Avatar video file required' })
    }

    // Sprawdź czy mamy renderowane wideo
    if (!lastRenderedVideoPath || !existsSync(lastRenderedVideoPath)) {
      return res.status(400).json({ error: 'No rendered video found. Generate video first.' })
    }

    console.log(`[Combine Avatar] Combining...`)
    console.log(`[Combine Avatar] Main video: ${lastRenderedVideoPath}`)
    console.log(`[Combine Avatar] Avatar: ${avatarVideoPath}`)

    // Połącz wideo z awatarem (awatar w lewym dolnym rogu, audio z main video bez duplikacji)
    const outputPath = await combineVideoWithUploadedAvatar(lastRenderedVideoPath, avatarVideoPath, audioDir)

    console.log(`[Combine Avatar] Final video: ${outputPath}`)

    // Zwróć finalny plik
    res.download(outputPath, `workflow-with-avatar.mp4`, (err) => {
      if (err) {
        console.error('[Combine Avatar] Download error:', err)
      }
    })
  } catch (error) {
    console.error('[Combine Avatar] Error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Pomocnicza funkcja do łączenia segmentów audio
async function mergeAudioSegments(audioData, outputDir) {
  const { spawn } = await import('child_process')

  const segments = audioData.segments || audioData
  if (!segments || segments.length === 0) {
    throw new Error('No audio segments to merge')
  }

  // Zbierz ścieżki audio
  const audioPaths = []

  // Intro
  const intro = segments.find(s => s.type === 'intro')
  if (intro?.path && existsSync(intro.path)) {
    audioPaths.push(intro.path)
  }

  // Node segments
  const nodeSegments = segments.filter(s => s.type === 'node')
  for (const seg of nodeSegments) {
    if (seg.path && existsSync(seg.path)) {
      audioPaths.push(seg.path)
    }
  }

  // Outro
  const outro = segments.find(s => s.type === 'outro')
  if (outro?.path && existsSync(outro.path)) {
    audioPaths.push(outro.path)
  }

  if (audioPaths.length === 0) {
    throw new Error('No valid audio files found')
  }

  console.log(`[MergeAudio] Merging ${audioPaths.length} audio files...`)

  // Użyj FFmpeg do połączenia
  const outputPath = join(outputDir, `merged_${Date.now()}.mp3`)

  // Stwórz plik listy
  const listPath = join(outputDir, `list_${Date.now()}.txt`)
  const listContent = audioPaths.map(p => `file '${p}'`).join('\n')
  const { writeFileSync } = await import('fs')
  writeFileSync(listPath, listContent)

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      outputPath
    ])

    ffmpeg.on('close', (code) => {
      // Usuń plik listy
      try { require('fs').unlinkSync(listPath) } catch (e) {}

      if (code === 0) {
        console.log('[MergeAudio] Audio merged successfully')
        resolve(outputPath)
      } else {
        reject(new Error(`FFmpeg merge failed with code ${code}`))
      }
    })

    ffmpeg.on('error', reject)
  })
}

// Wyciągnij audio z wideo (FFmpeg)
async function extractAudioFromVideo(videoPath, outputDir) {
  const { spawn } = await import('child_process')

  const outputPath = join(outputDir, `extracted_${Date.now()}.mp3`)

  console.log(`[ExtractAudio] Extracting audio from video...`)

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-vn',                    // Bez wideo
      '-acodec', 'libmp3lame',  // Kodek MP3
      '-q:a', '2',              // Jakość (0-9, niższy = lepszy)
      outputPath
    ])

    let stderr = ''
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('[ExtractAudio] Audio extracted successfully')
        resolve(outputPath)
      } else {
        console.error('[ExtractAudio] FFmpeg stderr:', stderr)
        reject(new Error(`FFmpeg extract failed with code ${code}`))
      }
    })

    ffmpeg.on('error', reject)
  })
}

// Połącz wideo z uploadowanym awatarem (overlay w lewym dolnym rogu)
// WAŻNE: Audio pochodzi z AWATARA (voiceover), SFX z głównego wideo są MIKSOWANE
// Awatar powinien być już przygotowany (zaokrąglone rogi itp.) przed uploadem
async function combineVideoWithUploadedAvatar(mainVideoPath, avatarVideoPath, outputDir) {
  const { spawn } = await import('child_process')

  const outputPath = join(outputDir, `final_${Date.now()}.mp4`)

  console.log(`[CombineVideo] Combining videos with uploaded avatar...`)
  console.log(`[CombineVideo] Main video (SFX): ${mainVideoPath}`)
  console.log(`[CombineVideo] Avatar (voiceover): ${avatarVideoPath}`)

  // Ustawienia awatara
  const avatarScale = 0.30        // 30% szerokości
  const margin = 40               // 40px margines

  // Pozycja awatara: lewy dolny róg z marginesem
  const overlayPosition = `${margin}:H-h-${margin}`

  return new Promise((resolve, reject) => {
    // FFmpeg command - UPROSZCZONY (bez zaokrągleń i glow):
    // 1. Przeskaluj awatara
    // 2. Usuń zielone tło (chroma key)
    // 3. Overlay na głównym wideo
    // 4. Miksuj audio: SFX + voiceover
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', mainVideoPath,      // Input 0: główne wideo (z SFX)
      '-i', avatarVideoPath,    // Input 1: awatar (z voiceover)
      '-filter_complex',
      // === VIDEO ===
      // 1. Przeskaluj awatara do 30% szerokości
      `[1:v]scale=iw*${avatarScale}:-1[scaled];` +
      // 2. Usuń zielone tło (chroma key)
      `[scaled]chromakey=0x00FF00:0.25:0.08[avatar];` +
      // 3. Overlay awatara na głównym wideo (bez efektów)
      `[0:v][avatar]overlay=${overlayPosition}:format=auto,format=yuv420p[outv];` +
      // === AUDIO ===
      // 4. Miksuj SFX (główne wideo) + voiceover (awatar)
      `[0:a]volume=1.0[sfx];` +
      `[1:a]volume=1.0[voice];` +
      `[sfx][voice]amix=inputs=2:duration=longest:normalize=0[aout]`,
      '-map', '[outv]',         // Użyj połączonego wideo
      '-map', '[aout]',         // Użyj zmiksowanego audio (SFX + voiceover)
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',    // Kompatybilność z QuickTime
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',              // Zakończ gdy krótsze wideo się skończy
      outputPath
    ])

    let stderr = ''
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('[CombineVideo] Videos combined successfully')
        resolve(outputPath)
      } else {
        console.error('[CombineVideo] FFmpeg stderr:', stderr)
        reject(new Error(`FFmpeg combine failed with code ${code}`))
      }
    })

    ffmpeg.on('error', reject)
  })
}

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`)
  console.log(`[Server] Endpoints:`)
  console.log(`  POST /api/export - Export video`)
  console.log(`  POST /api/export-narrated - Export video with narration`)
  console.log(`  POST /api/export-with-audio-extract - Generate video + extract audio`)
  console.log(`  GET  /api/download-video/:filename - Download video file`)
  console.log(`  GET  /api/download-audio/:filename - Download audio file`)
  console.log(`  POST /api/combine-uploaded-avatar - Combine with uploaded avatar`)
})
