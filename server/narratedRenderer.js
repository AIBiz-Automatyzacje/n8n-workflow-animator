import puppeteer from 'puppeteer'
import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, existsSync, rmSync, writeFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Folder na efekty dzwiekowe
const sfxDir = join(__dirname, '..', 'output', 'sfx')
if (!existsSync(sfxDir)) mkdirSync(sfxDir, { recursive: true })

// Generuj dzwiek whoosh (swist przy zoomowaniu)
async function generateWhooshSound(outputPath) {
  return new Promise((resolve, reject) => {
    // Generuj szum bialy z opadajaca czestotliwoscia - efekt whoosh
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'anoisesrc=d=0.3:c=pink:a=0.3',
      '-af', 'lowpass=f=2000,afade=t=in:ss=0:d=0.1,afade=t=out:st=0.15:d=0.15,volume=0.4',
      '-t', '0.3',
      outputPath
    ])

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(outputPath)
      else reject(new Error(`FFmpeg whoosh failed with code ${code}`))
    })
    ffmpeg.on('error', reject)
  })
}

// Generuj dzwiek pop (klikniecie przy popup)
async function generatePopSound(outputPath) {
  return new Promise((resolve, reject) => {
    // Krotki sinusoidalny dzwiek z szybkim opadaniem - efekt pop/click
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'sine=f=800:d=0.15',
      '-af', 'afade=t=in:ss=0:d=0.02,afade=t=out:st=0.05:d=0.1,volume=0.3',
      '-t', '0.15',
      outputPath
    ])

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(outputPath)
      else reject(new Error(`FFmpeg pop failed with code ${code}`))
    })
    ffmpeg.on('error', reject)
  })
}

// Przygotuj efekty dzwiekowe (cache)
let cachedSfx = null
async function ensureSfxGenerated() {
  if (cachedSfx) return cachedSfx

  const whooshPath = join(sfxDir, 'whoosh.mp3')
  const popPath = join(sfxDir, 'pop.mp3')

  if (!existsSync(whooshPath)) {
    console.log('[SFX] Generating whoosh sound...')
    await generateWhooshSound(whooshPath)
  }

  if (!existsSync(popPath)) {
    console.log('[SFX] Generating pop sound...')
    await generatePopSound(popPath)
  }

  cachedSfx = { whooshPath, popPath }
  return cachedSfx
}

const CANVAS_SIZES = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 }
}

// Rozmiary kafelkow - zwiększone dla lepszej czytelności
const NODE_WIDTH_YOUTUBE = 320
const NODE_HEIGHT_YOUTUBE = 95
const NODE_WIDTH_TIKTOK = 280
const NODE_HEIGHT_TIKTOK = 88

// KRYTYCZNE: Przelicz layout workflow na LINIE PROSTA
function recalculateLayout(workflow, isVertical) {
  const nodeWidth = isVertical ? NODE_WIDTH_TIKTOK : NODE_WIDTH_YOUTUBE
  const nodeHeight = isVertical ? NODE_HEIGHT_TIKTOK : NODE_HEIGHT_YOUTUBE
  const nodeSpacing = 120

  // Srodkowa linia Y - wszystkie nodes na tej samej wysokosci
  const centerY = 300

  console.log('[Layout] Recalculating to straight line...')

  // Przelicz pozycje wszystkich nodes
  workflow.animationOrder.forEach((nodeName, index) => {
    const node = workflow.nodes.find(n => n.name === nodeName)
    if (!node) return

    // Nowe pozycje - LINIA PROSTA
    node.x = 100 + index * (nodeWidth + nodeSpacing)
    node.y = centerY

    console.log(`[Layout] Node ${index}: "${nodeName}" -> x=${node.x}, y=${node.y}`)
  })

  // Przelicz bounds
  const firstNode = workflow.nodes[0]
  const lastNode = workflow.nodes[workflow.nodes.length - 1]

  if (firstNode && lastNode) {
    workflow.bounds = {
      x: 100,
      y: centerY,
      width: lastNode.x + nodeWidth - 100,
      height: nodeHeight
    }
    console.log(`[Layout] New bounds: x=${workflow.bounds.x}, y=${workflow.bounds.y}, w=${workflow.bounds.width}, h=${workflow.bounds.height}`)
  }

  return workflow
}

// Ikony SVG
const NODE_ICONS = {
  manualTrigger: '<path d="M8 5v14l11-7z" fill="white"/>',
  webhook: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="white"/>',
  schedule: '<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" fill="white"/>',
  httpRequest: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93z" fill="white"/>',
  code: '<path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" fill="white"/>',
  airtable: '<path d="M11.992 1.966L2.46 5.675a.351.351 0 0 0 .007.635l9.476 3.895a1.26 1.26 0 0 0 .975-.001l9.483-3.9a.35.35 0 0 0 .006-.634l-9.54-3.707a.96.96 0 0 0-.875.003z" fill="white"/>',
  chainLlm: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="white"/>',
  splitInBatches: '<path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z" fill="white"/>',
  default: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="white"/>'
}

// Emoji dla roznych typow nodow
const NODE_EMOJIS = {
  trigger: '🚀',
  manualTrigger: '👆',
  webhook: '🌐',
  schedule: '⏰',
  httpRequest: '📡',
  code: '💻',
  airtable: '📊',
  googleSheets: '📑',
  slack: '💬',
  email: '📧',
  set: '📝',
  if: '🔀',
  switch: '🔀',
  merge: '🔗',
  split: '✂️',
  function: '⚙️',
  chainLlm: '🤖',
  openAi: '🤖',
  splitInBatches: '📦',
  default: '🔧'
}

function getNodeEmoji(fullType) {
  const parts = fullType.split('.')
  const type = parts[parts.length - 1].toLowerCase()

  for (const [key, emoji] of Object.entries(NODE_EMOJIS)) {
    if (type.includes(key.toLowerCase())) {
      return emoji
    }
  }
  return NODE_EMOJIS.default
}

function getNodeIcon(fullType) {
  const parts = fullType.split('.')
  const type = parts[parts.length - 1].toLowerCase()

  for (const [key, icon] of Object.entries(NODE_ICONS)) {
    if (type.includes(key.toLowerCase())) {
      return icon
    }
  }
  return NODE_ICONS.default
}

// Pobierz dlugosc audio w ms
async function getAudioDuration(audioPath) {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      audioPath
    ])

    let output = ''
    ffprobe.stdout.on('data', (data) => {
      output += data.toString()
    })

    ffprobe.on('close', () => {
      const duration = parseFloat(output.trim()) * 1000 // Convert to ms
      resolve(isNaN(duration) ? 3000 : duration) // Default 3s if error
    })

    ffprobe.on('error', () => {
      resolve(3000) // Default 3s on error
    })
  })
}

// Oblicz timing dla trybu narrated z SSML (jedno audio z pauzami)
export async function calculateNarratedTimingSSML(workflow, singleAudioPath, settings) {
  const isVertical = settings.aspectRatio === '9:16'
  const timeline = []

  // Przygotuj efekty dzwiekowe
  const sfx = await ensureSfxGenerated()

  // Całkowity czas trwania audio
  const totalAudioDuration = await getAudioDuration(singleAudioPath)
  console.log('[NarratedRenderer] SSML audio duration:', totalAudioDuration, 'ms')

  // Estymuj czasy na podstawie liczby nodes
  // Intro scroll: ~15% całkowitego czasu
  const introScrollDuration = Math.max(totalAudioDuration * 0.15, 3000)

  timeline.push({
    phase: 'intro_scroll',
    startTime: 0,
    endTime: introScrollDuration,
    description: 'Scroll przez caly workflow z intro audio'
  })

  let currentTime = introScrollDuration

  // Dla każdego node: zoom (0.6s) + narration (auto-dopasowane)
  const numNodes = workflow.animationOrder.length
  const zoomDuration = 600
  const pauseBetweenNodes = 300

  // Pozostały czas po intro i outro dla nodes
  const outroDuration = Math.max(totalAudioDuration * 0.12, 2000)
  const availableTimeForNodes = totalAudioDuration - introScrollDuration - outroDuration
  const avgTimePerNode = availableTimeForNodes / numNodes

  for (let i = 0; i < numNodes; i++) {
    const nodeName = workflow.animationOrder[i]
    const node = workflow.nodes.find(n => n.name === nodeName)

    // Zoom do node'a
    timeline.push({
      phase: 'zoom_to_node',
      nodeName,
      nodeIndex: i,
      startTime: currentTime,
      endTime: currentTime + zoomDuration,
      sfxPath: sfx.whooshPath,
      sfxType: 'whoosh'
    })
    currentTime += zoomDuration

    // Narration node'a (auto-dopasowane)
    const nodeDuration = avgTimePerNode - zoomDuration - pauseBetweenNodes

    timeline.push({
      phase: 'node_narration',
      nodeName,
      nodeIndex: i,
      startTime: currentTime,
      endTime: currentTime + nodeDuration,
      emoji: getNodeEmoji(node.type),
      sfxPath: sfx.popPath,
      sfxType: 'pop'
    })
    currentTime += nodeDuration

    // Pauza
    timeline.push({
      phase: 'pause',
      startTime: currentTime,
      endTime: currentTime + pauseBetweenNodes
    })
    currentTime += pauseBetweenNodes
  }

  // Outro
  timeline.push({
    phase: 'outro',
    startTime: currentTime,
    endTime: currentTime + outroDuration,
    description: 'Outro z zoom out'
  })
  currentTime += outroDuration

  // Final zoom out
  timeline.push({
    phase: 'final_zoom_out',
    startTime: currentTime,
    endTime: currentTime + 1000
  })
  currentTime += 1000

  return {
    timeline,
    totalDuration: currentTime,
    singleAudioPath,
    useSSML: true
  }
}

// Oblicz timing dla trybu narrated (osobne segmenty - stara metoda)
export async function calculateNarratedTiming(workflow, audioSegments, settings) {
  const isVertical = settings.aspectRatio === '9:16'
  const timeline = []

  // Przygotuj efekty dzwiekowe
  const sfx = await ensureSfxGenerated()

  // Faza 1: Intro scroll z audio - audio zaczyna sie od razu podczas scrolla
  const introSegment = audioSegments?.find(s => s.type === 'intro')
  let introScrollDuration = 4000 // Default 4 sekundy

  if (introSegment?.audioPath && existsSync(introSegment.audioPath)) {
    const introDuration = await getAudioDuration(introSegment.audioPath)
    // Scroll trwa co najmniej tyle co intro audio + padding
    introScrollDuration = Math.max(introDuration + 800, 4000)

    timeline.push({
      phase: 'intro_scroll',
      startTime: 0,
      endTime: introScrollDuration,
      audioPath: introSegment.audioPath, // Audio zaczyna sie od razu
      text: introSegment.text,
      description: 'Scroll przez caly workflow z intro audio'
    })
  } else {
    timeline.push({
      phase: 'intro_scroll',
      startTime: 0,
      endTime: introScrollDuration,
      description: 'Scroll przez caly workflow'
    })
  }

  let currentTime = introScrollDuration

  // Faza 3: Kazdy node z audio
  const nodeSegments = audioSegments?.filter(s => s.type === 'node') || []

  for (let i = 0; i < workflow.animationOrder.length; i++) {
    const nodeName = workflow.animationOrder[i]
    const node = workflow.nodes.find(n => n.name === nodeName)
    // Znajdz segment po nazwie lub po indeksie
    const nodeSegment = nodeSegments.find(s => s.name === nodeName) || nodeSegments[i]

    console.log(`[Timeline] Node ${i}: ${nodeName}, segment text: "${nodeSegment?.text?.substring(0, 50) || 'BRAK'}"...`)

    // Czas na zoom do node'a (z dzwiekiem whoosh)
    const zoomDuration = 600
    timeline.push({
      phase: 'zoom_to_node',
      nodeName,
      nodeIndex: i,
      startTime: currentTime,
      endTime: currentTime + zoomDuration,
      sfxPath: sfx.whooshPath, // Whoosh przy zoomowaniu
      sfxType: 'whoosh'
    })
    currentTime += zoomDuration

    // Czas na wyswietlenie info-popup i audio (z dzwiekiem pop)
    let nodeDuration = 3000 // Default
    if (nodeSegment?.audioPath && existsSync(nodeSegment.audioPath)) {
      nodeDuration = await getAudioDuration(nodeSegment.audioPath) + 300 // +300ms padding
    }

    timeline.push({
      phase: 'node_narration',
      nodeName,
      nodeIndex: i,
      startTime: currentTime,
      endTime: currentTime + nodeDuration,
      audioPath: nodeSegment?.audioPath,
      text: nodeSegment?.description || nodeSegment?.text || nodeSegment?.narration || '',
      namePL: nodeSegment?.namePL,
      typePL: nodeSegment?.typePL,
      emoji: getNodeEmoji(node.type),
      sfxPath: sfx.popPath, // Pop przy pojawieniu sie popup
      sfxType: 'pop'
    })

    console.log(`[Timeline] Node ${i} popup text: "${(nodeSegment?.description || nodeSegment?.text || '').substring(0, 50)}..."`);
    currentTime += nodeDuration

    // Pauza przed nastepnym node'em
    timeline.push({
      phase: 'pause',
      startTime: currentTime,
      endTime: currentTime + 300
    })
    currentTime += 300
  }

  // Faza 4: Outro
  const outroSegment = audioSegments?.find(s => s.type === 'outro')
  if (outroSegment?.audioPath && existsSync(outroSegment.audioPath)) {
    const outroDuration = await getAudioDuration(outroSegment.audioPath)
    timeline.push({
      phase: 'outro',
      startTime: currentTime,
      endTime: currentTime + outroDuration + 500,
      audioPath: outroSegment.audioPath,
      text: outroSegment.text
    })
    currentTime += outroDuration + 500
  }

  // Final zoom out
  timeline.push({
    phase: 'final_zoom_out',
    startTime: currentTime,
    endTime: currentTime + 1000
  })
  currentTime += 1000

  return {
    timeline,
    totalDuration: currentTime
  }
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]))
}

// Generuj HTML dla trybu narrated
function generateNarratedHTML(workflow, settings, canvasSize, timeline) {
  const isVertical = canvasSize.height > canvasSize.width
  const NODE_WIDTH = isVertical ? NODE_WIDTH_TIKTOK : NODE_WIDTH_YOUTUBE
  const NODE_HEIGHT = isVertical ? NODE_HEIGHT_TIKTOK : NODE_HEIGHT_YOUTUBE

  // Grid pattern
  const gridDots = []
  const spacing = 30
  for (let x = spacing; x < canvasSize.width; x += spacing) {
    for (let y = spacing; y < canvasSize.height; y += spacing) {
      gridDots.push(`<circle cx="${x}" cy="${y}" r="2" fill="#2a2a4a"/>`)
    }
  }

  // Funkcja do zawijania tekstu na 2 linie
  const wrapNodeText = (text, maxCharsPerLine = 26) => {
    if (text.length <= maxCharsPerLine) return [text, '']

    const words = text.split(' ')
    let line1 = ''
    let line2 = ''

    for (const word of words) {
      if (line1.length === 0) {
        line1 = word
      } else if ((line1 + ' ' + word).length <= maxCharsPerLine) {
        line1 += ' ' + word
      } else {
        line2 += (line2 ? ' ' : '') + word
      }
    }

    // Skróć line2 jeśli za długi
    if (line2.length > maxCharsPerLine) {
      line2 = line2.substring(0, maxCharsPerLine - 3) + '...'
    }

    return [line1, line2]
  }

  // Nodes - wszystkie widoczne od poczatku
  const nodesHtml = workflow.nodes.map(node => {
    const index = workflow.animationOrder.indexOf(node.name)
    const emoji = getNodeEmoji(node.type)
    const [nameLine1, nameLine2] = wrapNodeText(node.name, 26)

    return `
      <g class="node" data-name="${node.name}" data-index="${index}" data-x="${node.x}" data-y="${node.y}" transform="translate(${node.x}, ${node.y})">
        <!-- Glow -->
        <rect class="node-glow" x="-20" y="-20" width="${NODE_WIDTH + 40}" height="${NODE_HEIGHT + 40}" rx="25" fill="${node.color}" opacity="0" filter="url(#glow)"/>

        <!-- Shadow z efektem 3D -->
        <rect x="6" y="8" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="#000" opacity="0.5"/>

        <!-- Background -->
        <rect class="node-bg" x="0" y="0" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="#262640" stroke="#404060" stroke-width="2"/>

        <!-- Color bar - zintegrowany z zaokragleniami -->
        <path d="M0,12 Q0,0 12,0 L6,0 L6,${NODE_HEIGHT} L12,${NODE_HEIGHT} Q0,${NODE_HEIGHT} 0,${NODE_HEIGHT - 12} Z" fill="${node.color}"/>

        <!-- Icon bg -->
        <rect x="16" y="${(NODE_HEIGHT - 42) / 2}" width="42" height="42" rx="10" fill="${node.color}"/>

        <!-- Emoji instead of SVG icon -->
        <text x="37" y="${NODE_HEIGHT / 2 + 8}" font-size="28" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${emoji}</text>

        <!-- Name - 2 linie -->
        ${nameLine2 ? `
          <text x="74" y="${NODE_HEIGHT / 2 - 10}" fill="#ffffff" font-size="14" font-weight="600" font-family="Inter, system-ui, sans-serif">${escapeHtml(nameLine1)}</text>
          <text x="74" y="${NODE_HEIGHT / 2 + 6}" fill="#ffffff" font-size="14" font-weight="600" font-family="Inter, system-ui, sans-serif">${escapeHtml(nameLine2)}</text>
          <text x="74" y="${NODE_HEIGHT / 2 + 24}" fill="#8888aa" font-size="10" font-family="Inter, system-ui, sans-serif">${node.shortType}</text>
        ` : `
          <text x="74" y="${NODE_HEIGHT / 2 - 2}" fill="#ffffff" font-size="15" font-weight="600" font-family="Inter, system-ui, sans-serif">${escapeHtml(nameLine1)}</text>
          <text x="74" y="${NODE_HEIGHT / 2 + 16}" fill="#8888aa" font-size="12" font-family="Inter, system-ui, sans-serif">${node.shortType}</text>
        `}

        <!-- Input port -->
        ${!node.isTrigger ? `
          <circle cx="0" cy="${NODE_HEIGHT / 2}" r="10" fill="#262640" stroke="#404060" stroke-width="2"/>
          <circle cx="0" cy="${NODE_HEIGHT / 2}" r="5" fill="#8888aa"/>
        ` : ''}

        <!-- Output port -->
        <circle cx="${NODE_WIDTH}" cy="${NODE_HEIGHT / 2}" r="10" fill="#262640" stroke="#404060" stroke-width="2"/>
        <circle cx="${NODE_WIDTH}" cy="${NODE_HEIGHT / 2}" r="5" fill="#8888aa"/>
      </g>
    `
  }).join('')

  // Edges - wszystkie widoczne od poczatku
  const edgesHtml = workflow.edges.map(edge => {
    const sourceNode = workflow.nodes.find(n => n.name === edge.source)
    const targetNode = workflow.nodes.find(n => n.name === edge.target)
    if (!sourceNode || !targetNode) return ''

    // Punkty startowe i koncowe - zaczynaja od krawedzi kola (promien 10px)
    const portRadius = 10
    const startX = sourceNode.x + NODE_WIDTH + portRadius // Po zewnetrznej stronie kolka
    const startY = sourceNode.y + NODE_HEIGHT / 2
    const endX = targetNode.x - portRadius // Przed zewnetrzna strona kolka wejsciowego
    const endY = targetNode.y + NODE_HEIGHT / 2
    const controlOffset = Math.min(Math.abs(endX - startX) / 2, 100)

    return `
      <g class="edge">
        <path class="edge-path" d="M${startX},${startY} C${startX + controlOffset},${startY} ${endX - controlOffset},${endY} ${endX},${endY}"
              fill="none" stroke="#6b7280" stroke-width="3" opacity="0.7"/>
        <!-- Strzalka dotykajaca kolka -->
        <path class="edge-arrow" d="M${endX-10},${endY-5} L${endX},${endY} L${endX-10},${endY+5}"
              fill="none" stroke="#6b7280" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    `
  }).join('')

  // Container dla wszystkich popupów (będą zostawały na ekranie)
  const popupsContainer = `<g id="popups-container"></g>`

  // Przygotuj dane node'ow dla JS
  const nodePositions = workflow.animationOrder.map(name => {
    const node = workflow.nodes.find(n => n.name === name)
    return { name, x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2, nodeX: node.x, nodeY: node.y }
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; }
    body {
      background: #1a1a2e;
      overflow: hidden;
      font-family: 'Inter', system-ui, sans-serif;
    }
    svg {
      display: block;
    }
    .node {
      transition: opacity 0.2s ease;
    }
  </style>
</head>
<body>
  <svg width="${canvasSize.width}" height="${canvasSize.height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="12" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="popup-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="6" stdDeviation="10" flood-opacity="0.5"/>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="100%" height="100%" fill="#1a1a2e"/>

    <!-- Grid (za content) -->
    <g id="grid">${gridDots.join('')}</g>

    <!-- Content z kamera -->
    <g id="content">
      <g id="edges">${edgesHtml}</g>
      <g id="nodes">${nodesHtml}</g>
      ${popupsContainer}
    </g>
  </svg>

  <script>
    const canvasWidth = ${canvasSize.width};
    const canvasHeight = ${canvasSize.height};
    const nodePositions = ${JSON.stringify(nodePositions)};
    const bounds = ${JSON.stringify(workflow.bounds)};
    const timeline = ${JSON.stringify(timeline)};
    const nodeWidth = ${NODE_WIDTH};
    const nodeHeight = ${NODE_HEIGHT};
    const isVertical = ${isVertical};

    const content = document.getElementById('content');
    const popupsContainer = document.getElementById('popups-container');
    const activePopups = new Map(); // Śledzimy aktywne popupy (pozostaną na ekranie)

    // Oblicz zoom dla calego workflow
    const padding = 100;
    const fullZoomX = canvasWidth / (bounds.width + padding * 2);
    const fullZoomY = canvasHeight / (bounds.height + padding * 2);
    const fullZoom = Math.min(fullZoomX, fullZoomY, 1);
    const fullCenterX = bounds.x + bounds.width / 2;
    const fullCenterY = bounds.y + bounds.height / 2;

    // Zoom dla intro - workflow widoczne i czytelne (przyblizone)
    // fullZoom * 1.5 = workflow wieksze na ekranie
    const introZoom = Math.min(fullZoom * 1.8, 1.5);

    // Zoom dla pojedynczego node'a - MNIEJSZY zeby dymek sie miescil
    // Dymek jest nad/pod node'em, potrzebujemy miejsca
    const nodeZoom = isVertical ? 1.8 : 1.5;

    function wrapText(text, maxCharsPerLine) {
      if (!text) return [];
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';

      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
          currentLine = (currentLine + ' ' + word).trim();
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Max 4 linie
      if (lines.length > 4) {
        lines.length = 4;
        lines[3] = lines[3].substring(0, maxCharsPerLine - 3) + '...';
      }

      return lines;
    }

    function createInfoPopup(nodeName, emoji, title, typePLText, text, nodeIndex) {
      // Jeśli popup już istnieje, nie twórz nowego
      if (activePopups.has(nodeName)) return;

      const nodePos = nodePositions.find(n => n.name === nodeName);
      if (!nodePos) return;

      // Dynamiczne dopasowanie szerokosci do tytulu
      const titleLength = (title || nodeName).length;
      const minWidth = 300;
      const maxWidth = 450;
      const charWidth = 9;
      const titleWidth = titleLength * charWidth + 90;
      const boxWidth = Math.min(maxWidth, Math.max(minWidth, titleWidth));

      // Oblicz max znakow na linie
      const maxCharsPerLine = Math.floor((boxWidth - 80) / 7);
      const lines = wrapText(text, maxCharsPerLine);
      const numLines = lines.length || 1;

      // Dynamiczna wysokosc
      const hasType = typePLText && typePLText.length > 0;
      const boxHeight = 30 + (hasType ? 20 : 0) + (numLines * 20) + 45;

      // Pozycja popup - ZAWSZE NAD node'em
      const popupY = nodePos.nodeY - boxHeight - 35;
      const arrowY1 = popupY + boxHeight;
      const arrowY2 = nodePos.nodeY - 5;
      const popupX = nodePos.nodeX + nodeWidth / 2 - boxWidth / 2;

      // Twórz SVG element dla popup - PROSTY, BEZ ANIMACJI
      const popupGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      popupGroup.setAttribute('class', 'info-popup');
      popupGroup.setAttribute('data-node', nodeName);
      popupGroup.setAttribute('opacity', '1');

      // Strzalka przerywana
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      arrow.setAttribute('x1', nodePos.nodeX + nodeWidth / 2);
      arrow.setAttribute('y1', arrowY1);
      arrow.setAttribute('x2', nodePos.nodeX + nodeWidth / 2);
      arrow.setAttribute('y2', arrowY2);
      arrow.setAttribute('stroke', '#ff6b6b');
      arrow.setAttribute('stroke-width', '3');
      arrow.setAttribute('stroke-dasharray', '8 4');
      popupGroup.appendChild(arrow);

      // Box group
      const boxGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      boxGroup.setAttribute('transform', 'translate(' + popupX + ',' + popupY + ')');
      boxGroup.setAttribute('filter', 'url(#popup-shadow)');

      // Background rectangle
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', boxWidth);
      bg.setAttribute('height', boxHeight);
      bg.setAttribute('rx', '14');
      bg.setAttribute('fill', '#1a1a2e');
      bg.setAttribute('stroke', '#ff6b6b');
      bg.setAttribute('stroke-width', '3');
      boxGroup.appendChild(bg);

      // Emoji
      const emojiText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      emojiText.setAttribute('x', '25');
      emojiText.setAttribute('y', '50');
      emojiText.setAttribute('font-size', '36');
      emojiText.setAttribute('font-family', 'Apple Color Emoji, Segoe UI Emoji, sans-serif');
      emojiText.textContent = emoji || '🔧';
      boxGroup.appendChild(emojiText);

      // Title
      const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      titleText.setAttribute('x', '75');
      titleText.setAttribute('y', '32');
      titleText.setAttribute('fill', '#ff6b6b');
      titleText.setAttribute('font-size', '16');
      titleText.setAttribute('font-weight', 'bold');
      titleText.setAttribute('font-family', 'Inter, system-ui, sans-serif');
      titleText.textContent = title || nodeName;
      boxGroup.appendChild(titleText);

      // Type (jeśli jest)
      if (hasType) {
        const typeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        typeText.setAttribute('x', '75');
        typeText.setAttribute('y', '50');
        typeText.setAttribute('fill', '#999999');
        typeText.setAttribute('font-size', '12');
        typeText.setAttribute('font-style', 'italic');
        typeText.setAttribute('font-family', 'Inter, system-ui, sans-serif');
        typeText.textContent = typePLText;
        boxGroup.appendChild(typeText);
      }

      // Description lines
      const descText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      descText.setAttribute('x', '75');
      descText.setAttribute('y', hasType ? 75 : 65);
      descText.setAttribute('fill', '#dddddd');
      descText.setAttribute('font-size', '14');
      descText.setAttribute('font-family', 'Inter, system-ui, sans-serif');

      lines.forEach((line, i) => {
        const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', '75');
        tspan.setAttribute('dy', i === 0 ? '0' : '20');
        tspan.textContent = line;
        descText.appendChild(tspan);
      });

      boxGroup.appendChild(descText);
      popupGroup.appendChild(boxGroup);

      // Dodaj do kontenera - PROSTY, BEZ ANIMACJI
      popupsContainer.appendChild(popupGroup);

      // Zapisz referencję
      activePopups.set(nodeName, popupGroup);
    }

    function highlightNode(nodeName, active) {
      const nodes = document.querySelectorAll('.node');
      nodes.forEach(node => {
        const glow = node.querySelector('.node-glow');
        const bg = node.querySelector('.node-bg');

        if (node.dataset.name === nodeName && active) {
          // PROSTY HIGHLIGHT - tylko glow i border, bez animacji
          glow.style.opacity = 0.5;
          bg.setAttribute('stroke', '#ff6b6b');
          bg.setAttribute('stroke-width', '4');
        } else {
          glow.style.opacity = 0;
          bg.setAttribute('stroke', '#404060');
          bg.setAttribute('stroke-width', '2');
        }
      });
    }

    window.setAnimationTime = function(time) {
      // Znajdz aktualny phase
      let currentPhase = null;
      for (const phase of timeline) {
        if (time >= phase.startTime && time < phase.endTime) {
          currentPhase = phase;
          break;
        }
      }

      // Last phase
      if (!currentPhase && timeline.length > 0) {
        currentPhase = timeline[timeline.length - 1];
      }

      let cameraX, cameraY, cameraZoom;

      if (!currentPhase) {
        cameraX = fullCenterX;
        cameraY = fullCenterY;
        cameraZoom = fullZoom;
      } else if (currentPhase.phase === 'intro_scroll') {
        // Intro: przyblizone workflow, scroll od lewej do prawej
        const progress = (time - currentPhase.startTime) / (currentPhase.endTime - currentPhase.startTime);
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Scroll od lewej strony workflow do prawej
        const startX = bounds.x + bounds.width * 0.15; // Zaczynamy od lewej
        const endX = bounds.x + bounds.width * 0.85;   // Konczymy na prawej

        cameraX = startX + (endX - startX) * eased;
        cameraY = fullCenterY;

        // Zoom: workflow przyblizone i czytelne (nie za daleko!)
        cameraZoom = introZoom;

        highlightNode('', false);

      } else if (currentPhase.phase === 'zoom_to_node') {
        // Animacja zoom do node'a
        const nodePos = nodePositions[currentPhase.nodeIndex];
        const progress = (time - currentPhase.startTime) / (currentPhase.endTime - currentPhase.startTime);
        const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        // Znajdz poprzednia pozycje
        let prevX, prevY, prevZoom;
        if (currentPhase.nodeIndex === 0) {
          // Pierwszy node - zaczynamy z pozycji po intro scroll
          prevX = bounds.x + bounds.width * 0.85; // Koniec intro scroll (prawa strona)
          prevY = fullCenterY;
          prevZoom = introZoom;
        } else {
          const prevNode = nodePositions[currentPhase.nodeIndex - 1];
          prevX = prevNode.x;
          prevY = prevNode.y;
          prevZoom = nodeZoom;
        }

        cameraX = prevX + (nodePos.x - prevX) * eased;
        cameraY = prevY + (nodePos.y - prevY) * eased;
        cameraZoom = prevZoom + (nodeZoom - prevZoom) * eased;

        highlightNode('', false);

      } else if (currentPhase.phase === 'node_narration') {
        // Stale na node'ie z info-popup
        const nodePos = nodePositions[currentPhase.nodeIndex];
        cameraX = nodePos.x;
        cameraY = nodePos.y;
        cameraZoom = nodeZoom;

        highlightNode(currentPhase.nodeName, true);
        // Utwórz popup (zostanie na ekranie) - przekaz nodeIndex dla gora/dol
        createInfoPopup(
          currentPhase.nodeName,
          currentPhase.emoji,
          currentPhase.namePL || currentPhase.nodeName,
          currentPhase.typePL || '',
          currentPhase.text,
          currentPhase.nodeIndex
        );

      } else if (currentPhase.phase === 'pause') {
        // Trzymaj pozycje
        const lastNodePhase = timeline.filter(p => p.phase === 'node_narration' && p.endTime <= currentPhase.startTime).pop();
        if (lastNodePhase) {
          const nodePos = nodePositions[lastNodePhase.nodeIndex];
          cameraX = nodePos.x;
          cameraY = nodePos.y;
          cameraZoom = nodeZoom;
        } else {
          cameraX = fullCenterX;
          cameraY = fullCenterY;
          cameraZoom = fullZoom;
        }
        highlightNode('', false);

      } else if (currentPhase.phase === 'outro') {
        // Outro: scroll od lewej do prawej przez CALE workflow z opisami
        const progress = (time - currentPhase.startTime) / (currentPhase.endTime - currentPhase.startTime);
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Scroll od lewej do prawej - pokazujemy wszystkie popupy
        const startX = bounds.x + bounds.width * 0.1;
        const endX = bounds.x + bounds.width * 0.9;

        cameraX = startX + (endX - startX) * eased;
        cameraY = fullCenterY;
        // Zoom taki sam jak intro - workflow czytelne
        cameraZoom = introZoom;

        highlightNode('', false);

      } else if (currentPhase.phase === 'final_zoom_out') {
        // Final zoom out - podsumowanie calego workflow
        const progress = (time - currentPhase.startTime) / (currentPhase.endTime - currentPhase.startTime);
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Z pozycji outro do pelnego widoku
        const startX = bounds.x + bounds.width * 0.9;
        const startZoom = introZoom;

        cameraX = startX + (fullCenterX - startX) * eased;
        cameraY = fullCenterY;
        cameraZoom = startZoom + (fullZoom - startZoom) * eased;

        highlightNode('', false);
      } else {
        cameraX = fullCenterX;
        cameraY = fullCenterY;
        cameraZoom = fullZoom;
      }

      // Aplikuj transformacje kamery
      const offsetX = canvasWidth / 2 - cameraX * cameraZoom;
      const offsetY = canvasHeight / 2 - cameraY * cameraZoom;
      content.setAttribute('transform', 'translate(' + offsetX + ',' + offsetY + ') scale(' + cameraZoom + ')');
    };

    window.setAnimationTime(0);
  </script>
</body>
</html>
  `
}

// Glowna funkcja renderowania
export async function renderNarratedVideo(workflow, settings, audioData) {
  const outputDir = join(__dirname, '..', 'output')
  const framesDir = join(outputDir, 'frames')

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  if (existsSync(framesDir)) rmSync(framesDir, { recursive: true })
  mkdirSync(framesDir, { recursive: true })

  const canvasSize = CANVAS_SIZES[settings.aspectRatio]
  const isVertical = settings.aspectRatio === '9:16'
  const fps = 30

  // KRYTYCZNE: Przelicz layout na LINIE PROSTA przed renderowaniem!
  recalculateLayout(workflow, isVertical)

  let timeline, totalDuration, singleAudioPath = null

  // Sprawdź czy mamy SSML audio czy osobne segmenty
  if (audioData.ssmlUsed && audioData.audioPath) {
    // SSML audio - jedno ciągłe z pauzami
    console.log('[NarratedRenderer] Using SSML audio with pauses')
    const result = await calculateNarratedTimingSSML(workflow, audioData.audioPath, settings)
    timeline = result.timeline
    totalDuration = result.totalDuration
    singleAudioPath = result.singleAudioPath
  } else {
    // Stara metoda - osobne segmenty
    console.log('[NarratedRenderer] Using segmented audio')
    const result = await calculateNarratedTiming(workflow, audioData.segments || audioData, settings)
    timeline = result.timeline
    totalDuration = result.totalDuration
  }

  console.log('[NarratedRenderer] Timeline phases:', timeline.length)
  console.log('[NarratedRenderer] Total duration:', totalDuration, 'ms')

  console.log('[NarratedRenderer] Launching browser...')
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  await page.setViewport({
    width: canvasSize.width,
    height: canvasSize.height,
    deviceScaleFactor: 1
  })

  const html = generateNarratedHTML(workflow, settings, canvasSize, timeline)
  await page.setContent(html, { waitUntil: 'networkidle0' })

  const totalFrames = Math.ceil((totalDuration / 1000) * fps)

  console.log(`[NarratedRenderer] Capturing ${totalFrames} frames (${totalDuration}ms @ ${fps}fps)...`)

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = (frame / fps) * 1000

    await page.evaluate((t) => {
      window.setAnimationTime(t)
    }, time)

    const framePath = join(framesDir, `frame_${String(frame).padStart(5, '0')}.png`)
    await page.screenshot({ path: framePath })

    if (frame % 30 === 0) {
      console.log(`[NarratedRenderer] Frame ${frame}/${totalFrames} (${Math.round(frame/totalFrames*100)}%)`)
    }
  }

  await browser.close()
  console.log('[NarratedRenderer] Frames captured, encoding video with audio...')

  const outputPath = join(outputDir, `workflow_narrated_${Date.now()}.mp4`)

  // Koduj z audio - przekaż singleAudioPath jeśli używamy SSML
  await encodeNarratedVideo(framesDir, outputPath, fps, timeline, singleAudioPath)

  rmSync(framesDir, { recursive: true })

  return outputPath
}

// Koduj wideo z audio zsynchronizowanym do timeline
async function encodeNarratedVideo(framesDir, outputPath, fps, timeline, singleAudioPath = null) {
  // Jeśli mamy pojedyncze SSML audio, użyj prostszej metody
  if (singleAudioPath && existsSync(singleAudioPath)) {
    console.log('[NarratedRenderer] Encoding with single SSML audio file')

    // Zbierz tylko SFX (whoosh i pop)
    const sfxPhases = timeline.filter(p => p.sfxPath && existsSync(p.sfxPath))

    if (sfxPhases.length === 0) {
      // Tylko jedno audio bez SFX - najprostsze
      return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-y',
          '-framerate', String(fps),
          '-i', join(framesDir, 'frame_%05d.png'),
          '-i', singleAudioPath,
          '-map', '0:v',
          '-map', '1:a',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-pix_fmt', 'yuv420p',
          '-preset', 'medium',
          '-crf', '18',
          '-shortest',
          outputPath
        ])

        ffmpeg.stderr.on('data', (data) => {
          const msg = data.toString()
          if (msg.includes('frame=')) {
            process.stdout.write(`\r[NarratedRenderer] ${msg.trim().split('\n').pop()}`)
          }
        })

        ffmpeg.on('close', (code) => {
          console.log('')
          if (code === 0) {
            console.log('[NarratedRenderer] Encoding complete!')
            resolve(outputPath)
          } else {
            reject(new Error(`FFmpeg exited with code ${code}`))
          }
        })

        ffmpeg.on('error', reject)
      })
    }

    // SSML audio + SFX - mix together
    console.log(`[NarratedRenderer] Mixing SSML audio with ${sfxPhases.length} SFX`)

    const filterParts = []
    const inputArgs = []

    // Audio główne (SSML)
    inputArgs.push('-i', singleAudioPath)
    filterParts.push('[1:a]volume=1.0[a0]')

    // SFX z delay
    sfxPhases.forEach((phase, index) => {
      inputArgs.push('-i', phase.sfxPath)
      const inputIndex = index + 2 // +2 bo 0=video, 1=main audio
      const delayMs = Math.max(0, phase.startTime || 0)
      filterParts.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs},volume=0.4[a${index + 1}]`)
    })

    const numInputs = sfxPhases.length + 1
    const mixInputs = Array.from({ length: numInputs }, (_, i) => `[a${i}]`).join('')
    const filterComplex = filterParts.join(';') + `;${mixInputs}amix=inputs=${numInputs}:duration=longest:normalize=0[aout]`

    const ffmpegArgs = [
      '-y',
      '-framerate', String(fps),
      '-i', join(framesDir, 'frame_%05d.png'),
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '0:v',
      '-map', '[aout]',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      '-preset', 'medium',
      '-crf', '18',
      '-shortest',
      outputPath
    ]

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs)

      ffmpeg.stderr.on('data', (data) => {
        const msg = data.toString()
        if (msg.includes('frame=')) {
          process.stdout.write(`\r[NarratedRenderer] ${msg.trim().split('\n').pop()}`)
        }
      })

      ffmpeg.on('close', (code) => {
        console.log('')
        if (code === 0) {
          console.log('[NarratedRenderer] Encoding complete!')
          resolve(outputPath)
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`))
        }
      })

      ffmpeg.on('error', reject)
    })
  }

  // Stara metoda: osobne segmenty audio
  const audioPhases = timeline.filter(p => p.audioPath && existsSync(p.audioPath))
  const sfxPhases = timeline.filter(p => p.sfxPath && existsSync(p.sfxPath))

  const totalAudioCount = audioPhases.length + sfxPhases.length

  if (totalAudioCount === 0) {
    console.log('[NarratedRenderer] No audio, encoding without sound')
    return encodeVideoWithoutAudio(framesDir, outputPath, fps)
  }

  console.log(`[NarratedRenderer] Found ${audioPhases.length} audio segments + ${sfxPhases.length} SFX`)

  // Buduj filter_complex
  const filterParts = []
  const inputArgs = []
  let inputIndex = 0

  // Dodaj narracje
  audioPhases.forEach((phase) => {
    inputArgs.push('-i', phase.audioPath)
    inputIndex++
    const audioIndex = inputIndex // +1 bo 0 to wideo
    const delayMs = Math.max(0, phase.startTime || 0)
    filterParts.push(`[${audioIndex}:a]adelay=${delayMs}|${delayMs}[a${inputIndex - 1}]`)
    console.log(`[NarratedRenderer] Audio ${inputIndex - 1}: ${phase.audioPath} @ ${delayMs}ms`)
  })

  // Dodaj SFX
  sfxPhases.forEach((phase) => {
    inputArgs.push('-i', phase.sfxPath)
    inputIndex++
    const audioIndex = inputIndex
    const delayMs = Math.max(0, phase.startTime || 0)
    filterParts.push(`[${audioIndex}:a]adelay=${delayMs}|${delayMs}[a${inputIndex - 1}]`)
    console.log(`[NarratedRenderer] SFX ${inputIndex - 1} (${phase.sfxType}): @ ${delayMs}ms`)
  })

  const mixInputs = filterParts.map((_, i) => `[a${i}]`).join('')
  const filterComplex = filterParts.join(';') + `;${mixInputs}amix=inputs=${totalAudioCount}:duration=longest:normalize=0[aout]`

  const ffmpegArgs = [
    '-y',
    '-framerate', String(fps),
    '-i', join(framesDir, 'frame_%05d.png'),
    ...inputArgs,
    '-filter_complex', filterComplex,
    '-map', '0:v',
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-pix_fmt', 'yuv420p',
    '-preset', 'medium',
    '-crf', '18',
    '-shortest',
    outputPath
  ]

  console.log('[NarratedRenderer] FFmpeg command:', 'ffmpeg', ffmpegArgs.slice(0, 20).join(' '), '...')

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ffmpegArgs)

    let stderrOutput = ''

    ffmpeg.stderr.on('data', (data) => {
      const msg = data.toString()
      stderrOutput += msg
      if (msg.includes('frame=')) {
        process.stdout.write(`\r[NarratedRenderer] ${msg.trim().split('\n').pop()}`)
      }
    })

    ffmpeg.on('close', (code) => {
      console.log('')
      if (code === 0) {
        console.log('[NarratedRenderer] Encoding complete!')
        resolve(outputPath)
      } else {
        console.error('[NarratedRenderer] FFmpeg failed with code:', code)
        console.error(stderrOutput)
        // Fallback bez audio
        encodeVideoWithoutAudio(framesDir, outputPath, fps).then(resolve).catch(reject)
      }
    })

    ffmpeg.on('error', (err) => {
      console.error('[NarratedRenderer] FFmpeg error:', err)
      encodeVideoWithoutAudio(framesDir, outputPath, fps).then(resolve).catch(reject)
    })
  })
}

async function encodeVideoWithoutAudio(framesDir, outputPath, fps) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-framerate', String(fps),
      '-i', join(framesDir, 'frame_%05d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'medium',
      '-crf', '18',
      outputPath
    ])

    ffmpeg.stderr.on('data', (data) => {
      const msg = data.toString()
      if (msg.includes('frame=')) {
        process.stdout.write(`\r[NarratedRenderer] ${msg.trim().split('\n').pop()}`)
      }
    })

    ffmpeg.on('close', (code) => {
      console.log('')
      if (code === 0) {
        console.log('[NarratedRenderer] Encoding complete!')
        resolve(outputPath)
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })

    ffmpeg.on('error', reject)
  })
}
