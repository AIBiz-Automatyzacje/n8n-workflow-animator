import puppeteer from 'puppeteer'
import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, existsSync, rmSync, writeFileSync, readFileSync } from 'fs'

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

// Emoji dla roznych typow nodow - z brandowymi ikonami SVG
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
  gmail: '📧',
  set: '📝',
  if: '🔀',
  switch: '🔀',
  merge: '🔗',
  split: '✂️',
  function: '⚙️',
  chainLlm: '🤖',
  openAi: '🤖',
  splitInBatches: '📦',
  // Social media
  facebook: 'brand:facebook',
  instagram: 'brand:instagram',
  twitter: 'brand:twitter',
  linkedin: 'brand:linkedin',
  youtube: 'brand:youtube',
  tiktok: 'brand:tiktok',
  // Narzędzia
  n8n: 'brand:n8n',
  notion: 'brand:notion',
  discord: 'brand:discord',
  telegram: 'brand:telegram',
  whatsapp: 'brand:whatsapp',
  github: 'brand:github',
  stripe: 'brand:stripe',
  shopify: 'brand:shopify',
  default: '🔧'
}

// SVG ikony brandowe (inline SVG paths) - do użycia w animacji
const BRAND_ICONS = {
  facebook: '<path fill="#fff" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>',
  instagram: '<path fill="#fff" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>',
  twitter: '<path fill="#fff" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
  linkedin: '<path fill="#fff" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
  youtube: '<path fill="#fff" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>',
  tiktok: '<path fill="#fff" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>',
  n8n: '<path fill="#fff" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>',
  notion: '<path fill="#fff" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.746-.886l-15.18.887c-.56.047-.746.327-.746.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933zM2.24 1.688l13.683-.886c1.215-.094 1.541.047 2.055.467l3.64 2.616c.42.327.56.606.56 1.12v15.49c0 .98-.373 1.54-1.634 1.633l-15.506.934c-.935.046-1.4-.047-1.868-.607L.467 18.98c-.42-.56-.606-.98-.606-1.494V3.127c0-.74.373-1.346 1.308-1.439z"/>',
  discord: '<path fill="#fff" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>',
  telegram: '<path fill="#fff" d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>',
  whatsapp: '<path fill="#fff" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>',
  github: '<path fill="#fff" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>',
  stripe: '<path fill="#fff" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>',
  shopify: '<path fill="#fff" d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.756c-.022-.143-.153-.239-.281-.239s-1.307-.089-1.307-.089-.9-.895-1.15-1.101c-.058-.049-.108-.076-.155-.094l-.686 21.839zm-3.049-1.528l-.848.256s-.9-.315-.9-.315c-.21.095-.407.146-.59.158l.484 2.48 2.851-.619-1.001-1.96h.004zm-1.157-1.555l-.012.081c-.016.11-.028.22-.041.328-.011.086-.023.172-.035.255-.025.188-.051.374-.079.555-.014.097-.028.191-.044.284a25.925 25.925 0 01-.12.68c-.013.062-.027.124-.04.186-.058.267-.122.522-.191.768l.847-.255c.108-.325.221-.669.318-1.015.064-.231.125-.465.179-.697.032-.136.062-.271.089-.405.025-.124.049-.248.07-.371.025-.147.046-.292.063-.435.014-.111.026-.223.036-.333l-1.04-.626zm-1.698-.461l-.027.164c-.077.501-.175.99-.294 1.464-.048.19-.099.376-.153.559a11.21 11.21 0 01-.216.677l.901.315c.095-.281.183-.579.263-.889.089-.342.169-.695.24-1.057.023-.115.045-.232.064-.349.023-.133.043-.267.061-.401l-1.839-3.598 1 1.115zm-.966-.534a10.39 10.39 0 01-.208 1.21 10.07 10.07 0 01-.162.629l2.851-.619-1.002-1.957-.686-.262c.128-.503.232-1.019.311-1.547.031-.208.058-.418.081-.63.019-.174.035-.348.048-.524l-2.074-3.146.791.88c.047.479.1.973.133 1.459.019.287.033.575.04.867.007.274.008.551-.003.829a11.893 11.893 0 01-.073.859 11.71 11.71 0 01-.047.388v.564zm-.574-4.365l-.016.128-.027.211-.024.185-.042.313-.024.178-.027.205-.025.183-.03.218-.026.182-.031.213-.015.101-.067.449-.04.266-.039.247-.044.266-.042.248-.048.268-.045.249-.052.271-.048.245-.056.271-.053.245-.06.272-.056.244-.066.272-.06.243-.071.27-.066.24-.076.266-.071.238-.082.266-.076.235-.088.261-.083.233-.094.256-.09.23-.1.252-.097.227-.108.248-.103.223-.115.242-.111.22-.122.236-.119.215-.129.229-.127.212-.136.223-.135.208-.144.217-.143.204-.152.21-.152.199-.16.203-.161.195-.168.196-.17.19-.177.189-.179.183-.186.181-.19.177-.194.173-.2.168-.206.163-.21.158-.219.152-.225.146-.231.139-.238.133-.244.126-.252.118-.258.111-.266.103-.275.095-.282.086-.291.078-.299.068-.309.059-.319.049-.329.039-.341.029-.352.018-.364.008-.378-.003-.391-.015-.407-.028-.422-.04-.44-.055-.457-.069-.477-.085-.497-.101-.521-.118-.545-.137-.572-.157-.6-.179-.631-.203-.665-.228-.702-.256-.742-.287-.786-.32-.834-.356-.887-.396-.945-.439-1.01-.486-1.081-.537-1.158-.593-1.245-.654 1.044 1.162c.017.019.036.038.054.057.04.041.081.081.123.12.037.034.075.067.114.1.042.036.086.071.131.105.04.03.082.06.124.089.046.032.093.063.141.093.044.028.088.054.134.08.048.028.098.054.148.08.047.024.095.047.144.069.052.024.104.046.158.067.051.02.102.039.154.056.055.018.111.034.168.048.055.015.111.027.168.037.058.011.117.018.176.024.06.005.12.008.181.007.061-.001.122-.006.184-.012.062-.007.124-.017.187-.029.063-.013.125-.029.188-.047.064-.019.127-.041.191-.065.065-.025.129-.053.193-.084.066-.031.13-.066.195-.103.066-.038.131-.08.196-.123.066-.045.131-.093.195-.144.066-.051.13-.106.194-.162.066-.058.13-.118.194-.181.065-.064.128-.131.191-.201a7.1 7.1 0 00.187-.22c.062-.074.123-.151.183-.23a9.23 9.23 0 00.353-.494c.056-.084.111-.171.166-.258.054-.087.107-.176.159-.266l.076-.134.075-.134.073-.134.073-.134.07-.135.07-.134.068-.135.067-.134.066-.135.064-.135.063-.135.062-.135.06-.135.059-.135.057-.135.056-.135.054-.135.053-.135.052-.135.05-.135.049-.135.047-.136.046-.136.044-.136.043-.136.042-.136.04-.137.039-.137.037-.137.036-.137.035-.138.033-.138.031-.138.03-.139.029-.139.027-.139.026-.14.024-.14.023-.14.022-.141.02-.141.019-.142.017-.142.016-.143.015-.143.013-.144.012-.144.01-.145.009-.146.008-.146.006-.147.005-.148.003-.149.002-.149v-.15l-.001-.152zm1.562-.7l1.34 1.491c.059.507.1 1.034.114 1.568l-2.074-3.147c.153-.009.323-.033.495-.067.042-.008.085-.017.125-.026zm2.118-.598l1.044 1.161.778-.168c.004.315-.003.637-.019.965a18.068 18.068 0 01-.048.728l-1.038-2.03.717-.156c-.146-.163-.287-.325-.426-.49l-.008-.01zm2.179-.471l.705-.153-.063-.07-.072-.08-.073-.082-.074-.083-.076-.085-.077-.086-.078-.088-.08-.089-.08-.091-.082-.092-.083-.093-.084-.094-.085-.096-.086-.097-.087-.098-.089-.099-.089-.1-.091-.101-.091-.101-.093-.102-.094-.103-.095-.104-.096-.104-.097-.105-.098-.106-.099-.106-.1-.107-.101-.107-.102-.107-.103-.107-.104-.108-.105-.108-.106-.108-.107-.108-.108-.108-.108-.108-.109-.107-.11-.107-.111-.107-.112-.107-.113-.106-.113-.106-.114-.105-.114-.105-.115-.104-.116-.103-.117-.103-.117-.102-.118-.101-.118-.1-.119-.1-.119-.098-.12-.098-.121-.097-.121-.095-.121-.095-.122-.093-.122-.092-.123-.091-.123-.09-.123-.088-.124-.087-.124-.085-.124-.084-.125-.082-.125-.081-.125-.079-.125-.078-.125-.076-.126-.074-.126-.073-.126-.071-.126-.069-.126-.067-.126-.065-.126-.063-.126-.061-.126-.059-.126-.057-.126-.055-.126-.052-.126-.05-.125-.048-.126-.046-.125-.043-.125-.041-.125-.039-.124-.036-.124-.034-.124-.031-.123-.029-.123-.026-.122-.024-.122-.021-.122-.018-.121-.016-.12-.013-.12-.01-.12-.008-.118-.005-.118-.002-.117.001-.116.003-.116.006-.114.009-.114.012-.113.015-.112.017-.111.02-.11.023-.109.026-.108.029-.106.031-.106.034-.104.037-.103.04-.102.042-.1.045-.099.048-.098.05-.096.053-.095.056-.093.058-.091.061-.09.063-.088.066-.087.068-.085.071-.083.073-.082.075-.08.078-.078.08-.077.082-.074.085-.073.087-.071.089-.069.091-.067.093-.065.095-.063.097-.061.099-.059.101-.057.103-.055.105-.053.106-.051.108-.048.11-.046.111-.044.113-.042.114-.039.116-.037.117-.034.119-.032.12-.03.121-.027.122-.024.124-.022.125-.019.126-.016.127-.014.128-.011.129-.008.13-.005.13-.002.131.001.132.004.132.007.133.01.133.013.134.017.134.02.134.023.134.027.134.03.134.034.134.037.134.041.133.044.133.048.132.052.132.056.131.06.131.063.13.067.129.072.128.075.127.08.126.083.125.088.124.092.122.096.121.1.12.105.118.109.116.114.115.118.113.123.111.127.109.132.107.137.104.141.102.146.1.151.097.156.094.161.092.166.089.171.086.176.083.182.08.187.077.192.074.198.071.203.067.209.064.214.06.22.057.226.053.231.049.237.046.243.041.248.038.254.033.26.029.265.024.27.02.276.015.282.01.287.005.292 0 .297-.005.302-.011.307-.016.312-.023.316-.029.32-.035.325-.042.329-.049.333-.056.336-.063.339-.071.342-.078.345-.086.348-.094.35-.102.351-.11.353-.119.354-.127.355-.136.355-.145.355-.154.355-.164.354-.173.353-.183.352-.192.35-.202.348-.212.345-.222.342-.232.339-.242.335-.252.331-.262.326-.272.321-.282.315-.292.31-.302.303-.312.296-.321.289-.331.281-.34.274-.35.265-.359.257-.368.248-.377.239-.386.229-.394.22-.403.21-.411.2-.419.189-.426.179-.434.168-.441.157-.448.147-.455.135-.461.124-.467.113-.473.101-.479.089-.484.077-.489.066-.493.053-.498.041-.502.029-.505.016-.509.004-.512-.009-.515-.022-.517-.035-.52-.048-.521-.061-.523-.075-.524-.088-.524-.102-.525-.116-.525-.13-.524-.144-.524-.158-.522-.173-.521-.187-.519-.201-.517-.216-.514-.23-.511-.245-.507-.26-.503-.274-.499-.289-.494-.304-.489-.318-.483-.333-.478-.348-.471-.362-.465-.377-.458-.392-.45-.406-.443-.421-.435-.435-.426-.449-.418-.463-.409-.477-.4-.491-.39-.505-.38-.518-.37-.532-.36-.545-.349-.558-.338-.571-.327-.584-.316-.596-.304-.609-.293-.621-.28-.633-.269-.644-.256-.656-.244-.667-.231-.678-.219-.688-.206-.699-.193-.709-.18-.719-.167-.728-.153-.737-.14-.747-.126-.755-.112-.764-.098-.772-.084-.78-.07-.787-.056-.795-.041-.801-.027-.808-.012-.814.003-.819.017-.824.033-.829.048-.834.063-.838.078-.842.094-.845.11-.848.126-.851.142-.854.159-.855.175-.857.192-.858.209-.858.226-.859.243-.858.26-.858.278-.857.295-.856.313-.854.331-.852.348-.85.366-.847.384-.843.402-.84.42-.835.438-.831.456-.826.474-.82.492-.815.51-.808.528-.802.546-.795.563-.787.581-.78.599-.771.616-.763.634-.753.651-.744.668-.734.686-.723.702-.713.719-.701.736-.69.752-.678.768-.665.784-.653.8-.64.815-.626.83-.613.845-.598.86-.584.874-.569.888-.553.902-.537.915-.521.928-.505.941-.488.953-.47.965-.453.977-.435.988-.416.999-1 1.114c-.101-.112-.201-.225-.299-.338z"/>',
}

function getNodeEmoji(fullType) {
  const parts = fullType.split('.')
  const type = parts[parts.length - 1].toLowerCase()

  for (const [key, value] of Object.entries(NODE_EMOJIS)) {
    if (type.includes(key.toLowerCase())) {
      return value
    }
  }
  return NODE_EMOJIS.default
}

// Sprawdź czy to ikona brandowa (format: brand:nazwa)
function isBrandIcon(emojiOrBrand) {
  return typeof emojiOrBrand === 'string' && emojiOrBrand.startsWith('brand:')
}

// Pobierz SVG path dla brandowej ikony
function getBrandIconSvg(brandKey) {
  const key = brandKey.replace('brand:', '')
  return BRAND_ICONS[key] || BRAND_ICONS.n8n // Fallback do n8n
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

  // Faza 4: Outro (scroll w lewo do pierwszego node'a)
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

  // Faza 5: CTA (scroll po skosie do brandingu z powiększeniem)
  // Stała długość animacji: 3 sekundy (niezależnie od długości audio)
  const CTA_ANIMATION_DURATION = 3000
  const ctaSegment = audioSegments?.find(s => s.type === 'cta')
  if (ctaSegment?.audioPath && existsSync(ctaSegment.audioPath)) {
    timeline.push({
      phase: 'cta',
      startTime: currentTime,
      endTime: currentTime + CTA_ANIMATION_DURATION,
      audioPath: ctaSegment.audioPath,
      text: ctaSegment.text,
      sfxPath: sfx.whooshPath, // Efekt dźwiękowy whoosh przy animacji CTA
      sfxType: 'whoosh'
    })
    currentTime += CTA_ANIMATION_DURATION
  }

  // Final zoom out (tylko jeśli nie było CTA)
  if (!ctaSegment) {
    timeline.push({
      phase: 'final_zoom_out',
      startTime: currentTime,
      endTime: currentTime + 1000
    })
    currentTime += 1000
  }

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

// Cache dla logo base64
let cachedLogoBase64 = null

function getLogoBase64() {
  if (cachedLogoBase64) return cachedLogoBase64

  const logoPath = join(__dirname, '..', 'img', 'aa logo.png')
  if (existsSync(logoPath)) {
    const logoBuffer = readFileSync(logoPath)
    cachedLogoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`
    console.log('[Branding] Logo loaded and cached')
  } else {
    console.warn('[Branding] Logo not found at:', logoPath)
    cachedLogoBase64 = '' // Pusty fallback
  }
  return cachedLogoBase64
}

// Generuj branding w prawym dolnym rogu
function generateBrandingHTML(canvasSize) {
  const margin = 40 // Taki sam jak dla awatara po lewej

  // Logo 600x200 (proporcje 3:1) - zachowujemy oryginalne aspect ratio
  const logoWidth = 340
  const logoHeight = 113 // 340 / 3 = ~113
  const brandingWidth = logoWidth // Szerokość = szerokość logo (bez dodatkowego paddingu)
  const cornerRadius = 8 // Zaokrąglenie takie jak kafelki

  // Zmniejszone odstępy między elementami (o połowę)
  const spacing = 10
  const textTopFontSize = 22 // Większy tekst górny
  const textBottomFontSize = 24 // Większy tekst dolny

  // Pozycja - prawy dolny róg (bez strzałek)
  const totalHeight = textTopFontSize + spacing + logoHeight + spacing + textBottomFontSize
  const x = canvasSize.width - brandingWidth - margin
  const y = canvasSize.height - totalHeight - margin

  // Logo jako base64
  const logoBase64 = getLogoBase64()

  return `
    <g id="branding" transform="translate(${x}, ${y})">
      <!-- Styles dla animacji -->
      <style>
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.25; }
        }
        #branding .glow-rect {
          animation: pulse-glow 3s ease-in-out infinite;
        }
      </style>

      <!-- Tekst nad logo: "Naucz się automatyzacji i AI" -->
      <text x="${brandingWidth / 2}" y="${textTopFontSize}" fill="#ffffff" font-size="${textTopFontSize}" font-weight="600"
            font-family="Inter, system-ui, sans-serif" text-anchor="middle" opacity="0.95">
        Naucz się automatyzacji i AI
      </text>

      <!-- Logo container z subtelnym glow i zaokrągleniem -->
      <g transform="translate(0, ${textTopFontSize + spacing})">
        <!-- Subtelne pomarańczowe podświetlenie (glow) - mniejszy blur -->
        <rect class="glow-rect" x="-4" y="-4" width="${logoWidth + 8}" height="${logoHeight + 8}"
              rx="${cornerRadius + 4}" fill="#fe6f00" filter="url(#branding-glow)"/>

        <!-- Tło logo z zaokrągleniem - BEZ paddingu -->
        <rect x="0" y="0" width="${logoWidth}" height="${logoHeight}" rx="${cornerRadius}"
              fill="#1a1a2e" stroke="#fe6f00" stroke-width="1.5" opacity="0.95"/>

        <!-- Logo jako clipPath do zaokrąglenia -->
        <defs>
          <clipPath id="logo-clip">
            <rect x="0" y="0" width="${logoWidth}" height="${logoHeight}" rx="${cornerRadius}"/>
          </clipPath>
        </defs>

        <!-- Logo grafika - wypełnia całą przestrzeń bez paddingu -->
        <image href="${logoBase64}" x="0" y="0" width="${logoWidth}" height="${logoHeight}"
               clip-path="url(#logo-clip)" preserveAspectRatio="xMidYMid slice"/>
      </g>

      <!-- Tekst pod logo: AkademiaAutomatyzacji.com (bez strzałki) -->
      <text x="${brandingWidth / 2}" y="${textTopFontSize + spacing + logoHeight + spacing + textBottomFontSize}"
            font-size="${textBottomFontSize}" font-weight="700" font-family="Inter, system-ui, sans-serif" text-anchor="middle">
        <tspan fill="#fe6f00">Akademia</tspan><tspan fill="#ffffff">Automatyzacji</tspan><tspan fill="#aaaaaa">.com</tspan>
      </text>
    </g>
  `
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
    const stepNumber = index + 1 // Numer etapu 1, 2, 3...
    // Użyj displayName do wyświetlania (jeśli istnieje), otherwise name
    const displayName = node.displayName || node.name
    const [nameLine1, nameLine2] = wrapNodeText(displayName, 26)

    // Numer etapu zamiast emoji/ikony - biały na kolorowym tle
    const numberHtml = `<text x="37" y="${NODE_HEIGHT / 2 + 10}" font-size="26" font-weight="bold" text-anchor="middle" fill="#ffffff" font-family="Inter, system-ui, sans-serif">${stepNumber}.</text>`

    return `
      <g class="node" data-name="${node.name}" data-index="${index}" data-x="${node.x}" data-y="${node.y}" transform="translate(${node.x}, ${node.y})">
        <!-- Glow -->
        <rect class="node-glow" x="-20" y="-20" width="${NODE_WIDTH + 40}" height="${NODE_HEIGHT + 40}" rx="25" fill="#fe6f00" opacity="0" filter="url(#glow)"/>

        <!-- Shadow z efektem 3D -->
        <rect x="6" y="8" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="#000" opacity="0.5"/>

        <!-- Background -->
        <rect class="node-bg" x="0" y="0" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="#262640" stroke="#404060" stroke-width="2"/>

        <!-- Color bar - zintegrowany z zaokragleniami -->
        <path class="node-color-bar" d="M0,12 Q0,0 12,0 L6,0 L6,${NODE_HEIGHT} L12,${NODE_HEIGHT} Q0,${NODE_HEIGHT} 0,${NODE_HEIGHT - 12} Z" fill="${node.color}"/>

        <!-- Icon bg -->
        <rect x="16" y="${(NODE_HEIGHT - 42) / 2}" width="42" height="42" rx="10" fill="${node.color}"/>

        <!-- Numer etapu (1, 2, 3...) zamiast emoji -->
        ${numberHtml}

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
      <!-- Branding glow filter - pomarańczowy (subtelny) -->
      <filter id="branding-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur"/>
        <feFlood flood-color="#fe6f00" flood-opacity="0.35" result="color"/>
        <feComposite in="color" in2="blur" operator="in" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
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

    <!-- BRANDING - prawy dolny róg (stały, nie transformowany przez kamerę) -->
    ${generateBrandingHTML(canvasSize)}
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

    // Brandowe ikony SVG
    window.BRAND_ICONS_DATA = ${JSON.stringify(BRAND_ICONS)};

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

      // Max 5 linii (zwiększone z 4)
      if (lines.length > 5) {
        lines.length = 5;
        lines[4] = lines[4].substring(0, maxCharsPerLine - 3) + '...';
      }

      return lines;
    }

    function createInfoPopup(nodeName, emoji, title, typePLText, text, nodeIndex) {
      // Jeśli popup już istnieje, nie twórz nowego
      if (activePopups.has(nodeName)) return;

      const nodePos = nodePositions.find(n => n.name === nodeName);
      if (!nodePos) return;

      // Równomierne paddingi
      const padding = 20;
      const emojiSize = 42;
      const emojiMargin = 15;
      const contentStartX = padding + emojiSize + emojiMargin;

      // Szerszy popup (zwiększone wartości)
      const titleLength = (title || nodeName).length;
      const minWidth = 380;   // Zwiększone z 300
      const maxWidth = 520;   // Zwiększone z 450
      const charWidth = 9;
      const titleWidth = titleLength * charWidth + contentStartX + padding;
      const boxWidth = Math.min(maxWidth, Math.max(minWidth, titleWidth));

      // Oblicz max znakow na linie - więcej miejsca
      const maxCharsPerLine = Math.floor((boxWidth - contentStartX - padding) / 7);
      const lines = wrapText(text, maxCharsPerLine);
      const numLines = lines.length || 1;

      // Dynamiczna wysokosc z równymi paddingami (góra i dół taki sam)
      const hasType = typePLText && typePLText.length > 0;
      const titleHeight = 22;
      const typeHeight = hasType ? 18 : 0;
      const lineHeight = 20;
      const bottomPadding = padding + 10; // Dodatkowy padding dolny dla wyrównania wizualnego
      const boxHeight = padding + titleHeight + typeHeight + (numLines * lineHeight) + bottomPadding;

      // Pozycja popup - ZAWSZE NAD node'em (2x większy margines = 50px)
      const popupY = nodePos.nodeY - boxHeight - 50;
      const arrowY1 = popupY + boxHeight;
      const arrowY2 = nodePos.nodeY - 5;
      const popupX = nodePos.nodeX + nodeWidth / 2 - boxWidth / 2;

      // Twórz SVG element dla popup - PROSTY, BEZ ANIMACJI
      const popupGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      popupGroup.setAttribute('class', 'info-popup');
      popupGroup.setAttribute('data-node', nodeName);
      popupGroup.setAttribute('opacity', '1');

      // Strzalka przerywana - w kolorze brandowym
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      arrow.setAttribute('x1', nodePos.nodeX + nodeWidth / 2);
      arrow.setAttribute('y1', arrowY1);
      arrow.setAttribute('x2', nodePos.nodeX + nodeWidth / 2);
      arrow.setAttribute('y2', arrowY2);
      arrow.setAttribute('stroke', '#fe6f00');
      arrow.setAttribute('stroke-width', '3');
      arrow.setAttribute('stroke-dasharray', '8 4');
      popupGroup.appendChild(arrow);

      // Box group
      const boxGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      boxGroup.setAttribute('transform', 'translate(' + popupX + ',' + popupY + ')');
      boxGroup.setAttribute('filter', 'url(#popup-shadow)');

      // Background rectangle - ramka w kolorze brandowym
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', boxWidth);
      bg.setAttribute('height', boxHeight);
      bg.setAttribute('rx', '14');
      bg.setAttribute('fill', '#1a1a2e');
      bg.setAttribute('stroke', '#fe6f00');
      bg.setAttribute('stroke-width', '3');
      boxGroup.appendChild(bg);

      // Ikona - emoji lub SVG brand
      const emojiCenterY = padding + (titleHeight + typeHeight + numLines * lineHeight) / 2 + 10;
      const isBrandIconFlag = emoji && emoji.startsWith('brand:');

      if (isBrandIconFlag) {
        // SVG ikona brandowa
        const brandKey = emoji.replace('brand:', '');
        const brandIcons = window.BRAND_ICONS_DATA;
        const svgPath = brandIcons[brandKey] || brandIcons['n8n'];

        const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgIcon.setAttribute('x', String(padding + 4));
        svgIcon.setAttribute('y', String(emojiCenterY - 18));
        svgIcon.setAttribute('width', '36');
        svgIcon.setAttribute('height', '36');
        svgIcon.setAttribute('viewBox', '0 0 24 24');
        svgIcon.innerHTML = svgPath;
        boxGroup.appendChild(svgIcon);
      } else {
        // Emoji tekst
        const emojiText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        emojiText.setAttribute('x', String(padding + emojiSize / 2));
        emojiText.setAttribute('y', String(emojiCenterY));
        emojiText.setAttribute('font-size', '36');
        emojiText.setAttribute('text-anchor', 'middle');
        emojiText.setAttribute('font-family', 'Apple Color Emoji, Segoe UI Emoji, sans-serif');
        emojiText.textContent = emoji || '🔧';
        boxGroup.appendChild(emojiText);
      }

      // Title - z paddingiem, w kolorze brandowym
      const titleY = padding + 18;
      const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      titleText.setAttribute('x', String(contentStartX));
      titleText.setAttribute('y', String(titleY));
      titleText.setAttribute('fill', '#fe6f00');
      titleText.setAttribute('font-size', '16');
      titleText.setAttribute('font-weight', 'bold');
      titleText.setAttribute('font-family', 'Inter, system-ui, sans-serif');
      titleText.textContent = title || nodeName;
      boxGroup.appendChild(titleText);

      // Type (jeśli jest)
      let currentY = titleY;
      if (hasType) {
        currentY += typeHeight;
        const typeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        typeText.setAttribute('x', String(contentStartX));
        typeText.setAttribute('y', String(currentY));
        typeText.setAttribute('fill', '#999999');
        typeText.setAttribute('font-size', '12');
        typeText.setAttribute('font-style', 'italic');
        typeText.setAttribute('font-family', 'Inter, system-ui, sans-serif');
        typeText.textContent = typePLText;
        boxGroup.appendChild(typeText);
      }

      // Description lines - z paddingiem
      currentY += lineHeight + 5;
      const descText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      descText.setAttribute('x', String(contentStartX));
      descText.setAttribute('y', String(currentY));
      descText.setAttribute('fill', '#dddddd');
      descText.setAttribute('font-size', '14');
      descText.setAttribute('font-family', 'Inter, system-ui, sans-serif');

      lines.forEach((line, i) => {
        const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', String(contentStartX));
        tspan.setAttribute('dy', i === 0 ? '0' : String(lineHeight));
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
        const colorBar = node.querySelector('.node-color-bar');

        if (node.dataset.name === nodeName && active) {
          // PROSTY HIGHLIGHT - glow i border w kolorze brandowym #fe6f00
          glow.style.opacity = 0.5;
          bg.setAttribute('stroke', '#fe6f00');
          bg.setAttribute('stroke-width', '4');
          // Ukryj kolorowy pasek podczas podświetlenia
          if (colorBar) colorBar.style.opacity = '0';
        } else {
          glow.style.opacity = 0;
          bg.setAttribute('stroke', '#404060');
          bg.setAttribute('stroke-width', '2');
          // Przywróć kolorowy pasek
          if (colorBar) colorBar.style.opacity = '1';
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
        // Outro: scroll od PRAWEJ do LEWEJ (do pierwszego node'a)
        const progress = (time - currentPhase.startTime) / (currentPhase.endTime - currentPhase.startTime);
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Scroll od prawej do lewej - kończymy na pierwszym node
        const startX = bounds.x + bounds.width * 0.9; // Prawa strona (ostatni node)
        const endX = bounds.x + bounds.width * 0.1;   // Lewa strona (pierwszy node)

        cameraX = startX + (endX - startX) * eased;
        cameraY = fullCenterY;
        // Zoom taki sam jak intro - workflow czytelne
        cameraZoom = introZoom;

        highlightNode('', false);

      } else if (currentPhase.phase === 'cta') {
        // CTA: branding przesuwa się na środek i powiększa, workflow znika
        const progress = (time - currentPhase.startTime) / (currentPhase.endTime - currentPhase.startTime);
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Kamera - zostaje na miejscu (pierwszy node) ale przesuwamy workflow w lewo
        cameraX = bounds.x + bounds.width * 0.1;
        cameraY = fullCenterY;
        cameraZoom = introZoom;

        // Workflow przesuwa się w lewo i zanika
        const workflowOffsetX = -canvasWidth * 1.2 * eased; // Przesunięcie daleko w lewo
        const workflowOpacity = 1 - eased; // Całkowite zanikanie
        content.setAttribute('transform', 'translate(' + (canvasWidth / 2 - cameraX * cameraZoom + workflowOffsetX) + ',' + (canvasHeight / 2 - cameraY * cameraZoom) + ') scale(' + cameraZoom + ')');
        content.style.opacity = workflowOpacity;

        // Branding - przesuwa się na środek i powiększa
        const branding = document.getElementById('branding');
        if (branding) {
          // Wymiary brandingu (z generateBrandingHTML)
          const brandingWidth = 340;
          const brandingHeight = 179; // 22 + 10 + 113 + 10 + 24
          const margin = 40;

          // Pozycja startowa (prawy dolny róg - oryginalna pozycja)
          const brandingStartX = canvasWidth - brandingWidth - margin;
          const brandingStartY = canvasHeight - brandingHeight - margin;
          const brandingStartScale = 1;

          // Pozycja docelowa (środek ekranu) - z uwzględnieniem skali
          // Po skalowaniu, branding będzie większy, więc musimy to uwzględnić
          const brandingEndScale = 1.5; // Powiększenie do 150%
          const scaledWidth = brandingWidth * brandingEndScale;
          const scaledHeight = brandingHeight * brandingEndScale;
          const brandingEndX = (canvasWidth - scaledWidth) / 2;
          const brandingEndY = (canvasHeight - scaledHeight) / 2;

          const brandingX = brandingStartX + (brandingEndX - brandingStartX) * eased;
          const brandingY = brandingStartY + (brandingEndY - brandingStartY) * eased;
          const brandingScale = brandingStartScale + (brandingEndScale - brandingStartScale) * eased;

          branding.setAttribute('transform', 'translate(' + brandingX + ',' + brandingY + ') scale(' + brandingScale + ')');
        }

        highlightNode('', false);
        return; // Skip normal camera transform

      } else if (currentPhase.phase === 'final_zoom_out') {
        // Final zoom out - podsumowanie calego workflow
        const progress = (time - currentPhase.startTime) / (currentPhase.endTime - currentPhase.startTime);
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Z pozycji outro do pelnego widoku
        const startX = bounds.x + bounds.width * 0.1; // Teraz kończymy na lewej stronie
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
// Zwraca obiekt { videoPath, cleanAudioPath } - cleanAudioPath to czyste audio bez SFX
// options.sfxOnly = true -> generuje wideo TYLKO z SFX (bez voiceover) - do montażu z awatarem
// options.voiceoverOnly = true -> generuje wideo TYLKO z voiceover (bez SFX) - do ekstrakcji czystego audio
export async function renderNarratedVideo(workflow, settings, audioData, options = {}) {
  const outputDir = join(__dirname, '..', 'output')
  const framesDir = join(outputDir, 'frames')

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  if (existsSync(framesDir)) rmSync(framesDir, { recursive: true })
  mkdirSync(framesDir, { recursive: true })

  const canvasSize = CANVAS_SIZES[settings.aspectRatio]
  const isVertical = settings.aspectRatio === '9:16'
  const fps = 30
  const sfxOnly = options.sfxOnly || false
  const voiceoverOnly = options.voiceoverOnly || false

  // KRYTYCZNE: Przelicz layout na LINIE PROSTA przed renderowaniem!
  recalculateLayout(workflow, isVertical)

  let timeline, totalDuration, singleAudioPath = null, cleanAudioPath = null

  // Sprawdź czy mamy SSML audio czy osobne segmenty
  if (audioData.ssmlUsed && audioData.audioPath) {
    // SSML audio - jedno ciągłe z pauzami
    console.log('[NarratedRenderer] Using SSML audio with pauses')
    const result = await calculateNarratedTimingSSML(workflow, audioData.audioPath, settings)
    timeline = result.timeline
    totalDuration = result.totalDuration
    singleAudioPath = result.singleAudioPath
    // SSML audio jest już czyste (bez SFX)
    cleanAudioPath = audioData.audioPath
  } else {
    // Stara metoda - osobne segmenty
    console.log('[NarratedRenderer] Using segmented audio')
    const result = await calculateNarratedTiming(workflow, audioData.segments || audioData, settings)
    timeline = result.timeline
    totalDuration = result.totalDuration

    // Dla segmentów - połącz je w jedno czyste audio (bez SFX)
    cleanAudioPath = await mergeCleanAudioSegments(audioData.segments || audioData, outputDir)
  }

  console.log('[NarratedRenderer] Timeline phases:', timeline.length)
  console.log('[NarratedRenderer] Total duration:', totalDuration, 'ms')
  console.log('[NarratedRenderer] Clean audio path:', cleanAudioPath)
  console.log('[NarratedRenderer] SFX only mode:', sfxOnly)
  console.log('[NarratedRenderer] Voiceover only mode:', voiceoverOnly)

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
  // Jeśli sfxOnly=true, generujemy wideo TYLKO z SFX (bez voiceover)
  // Jeśli voiceoverOnly=true, generujemy wideo TYLKO z voiceover (bez SFX)
  await encodeNarratedVideo(framesDir, outputPath, fps, timeline, singleAudioPath, sfxOnly, voiceoverOnly)

  rmSync(framesDir, { recursive: true })

  // Zwróć obiekt z obiema ścieżkami
  return { videoPath: outputPath, cleanAudioPath }
}

// Połącz segmenty audio w jedno czyste audio (BEZ SFX)
async function mergeCleanAudioSegments(segments, outputDir) {
  if (!segments || segments.length === 0) {
    console.log('[MergeCleanAudio] No segments to merge')
    return null
  }

  // Zbierz ścieżki audio (tylko narracja, bez SFX)
  const audioPaths = []

  // Intro
  const intro = segments.find(s => s.type === 'intro')
  if (intro?.audioPath && existsSync(intro.audioPath)) {
    audioPaths.push(intro.audioPath)
  } else if (intro?.path && existsSync(intro.path)) {
    audioPaths.push(intro.path)
  }

  // Node segments
  const nodeSegments = segments.filter(s => s.type === 'node')
  for (const seg of nodeSegments) {
    if (seg.audioPath && existsSync(seg.audioPath)) {
      audioPaths.push(seg.audioPath)
    } else if (seg.path && existsSync(seg.path)) {
      audioPaths.push(seg.path)
    }
  }

  // Outro
  const outro = segments.find(s => s.type === 'outro')
  if (outro?.audioPath && existsSync(outro.audioPath)) {
    audioPaths.push(outro.audioPath)
  } else if (outro?.path && existsSync(outro.path)) {
    audioPaths.push(outro.path)
  }

  if (audioPaths.length === 0) {
    console.log('[MergeCleanAudio] No valid audio files found')
    return null
  }

  console.log(`[MergeCleanAudio] Merging ${audioPaths.length} clean audio segments...`)

  // Użyj FFmpeg concat do połączenia
  const outputPath = join(outputDir, `clean_audio_${Date.now()}.mp3`)
  const listPath = join(outputDir, `clean_list_${Date.now()}.txt`)
  const listContent = audioPaths.map(p => `file '${p}'`).join('\n')
  writeFileSync(listPath, listContent)

  return new Promise((resolve, reject) => {
    // Użyj re-encoding zamiast copy - copy powoduje problemy z nagłówkami MP3
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c:a', 'libmp3lame',
      '-b:a', '192k',
      '-ar', '44100',
      outputPath
    ])

    ffmpeg.on('close', (code) => {
      // Usuń plik listy
      try { rmSync(listPath) } catch (e) {}

      if (code === 0) {
        console.log('[MergeCleanAudio] Clean audio merged successfully:', outputPath)
        resolve(outputPath)
      } else {
        console.error('[MergeCleanAudio] FFmpeg merge failed with code:', code)
        resolve(null)
      }
    })

    ffmpeg.on('error', (err) => {
      console.error('[MergeCleanAudio] FFmpeg error:', err)
      resolve(null)
    })
  })
}

// Koduj wideo z audio zsynchronizowanym do timeline
// sfxOnly = true -> generuje wideo TYLKO z SFX (bez voiceover) - do montażu z awatarem
// voiceoverOnly = true -> generuje wideo TYLKO z voiceover (bez SFX) - do ekstrakcji czystego audio
async function encodeNarratedVideo(framesDir, outputPath, fps, timeline, singleAudioPath = null, sfxOnly = false, voiceoverOnly = false) {
  // Zbierz tylko SFX (whoosh i pop)
  const sfxPhases = timeline.filter(p => p.sfxPath && existsSync(p.sfxPath))

  // === TRYB VOICEOVER ONLY (do ekstrakcji czystego audio bez SFX) ===
  if (voiceoverOnly) {
    console.log('[NarratedRenderer] VOICEOVER ONLY mode - encoding without SFX')

    if (singleAudioPath && existsSync(singleAudioPath)) {
      // Użyj SSML audio - tylko voiceover bez SFX
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
            console.log('[NarratedRenderer] Voiceover-only encoding complete!')
            resolve(outputPath)
          } else {
            reject(new Error(`FFmpeg exited with code ${code}`))
          }
        })

        ffmpeg.on('error', reject)
      })
    } else {
      // Brak SSML - użyj segmentów audio (tylko narracja)
      const voicePhases = timeline.filter(p => p.audioPath && existsSync(p.audioPath))

      if (voicePhases.length === 0) {
        console.log('[NarratedRenderer] No voiceover found, encoding without sound')
        return encodeVideoWithoutAudio(framesDir, outputPath, fps)
      }

      const filterParts = []
      const inputArgs = []

      voicePhases.forEach((phase, index) => {
        inputArgs.push('-i', phase.audioPath)
        const inputIndex = index + 1
        const delayMs = Math.max(0, phase.startTime || 0)
        filterParts.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs},volume=1.0[a${index}]`)
      })

      const mixInputs = Array.from({ length: voicePhases.length }, (_, i) => `[a${i}]`).join('')
      const filterComplex = filterParts.join(';') + `;${mixInputs}amix=inputs=${voicePhases.length}:duration=longest:normalize=0[aout]`

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
            console.log('[NarratedRenderer] Voiceover-only encoding complete!')
            resolve(outputPath)
          } else {
            reject(new Error(`FFmpeg exited with code ${code}`))
          }
        })

        ffmpeg.on('error', reject)
      })
    }
  }

  // === TRYB SFX ONLY (do montażu z awatarem) ===
  if (sfxOnly) {
    console.log(`[NarratedRenderer] SFX ONLY mode - encoding with ${sfxPhases.length} SFX effects (no voiceover)`)

    if (sfxPhases.length === 0) {
      // Brak SFX - wideo bez dźwięku
      console.log('[NarratedRenderer] No SFX found, encoding without sound')
      return encodeVideoWithoutAudio(framesDir, outputPath, fps)
    }

    // Tylko SFX - bez voiceover
    const filterParts = []
    const inputArgs = []

    sfxPhases.forEach((phase, index) => {
      inputArgs.push('-i', phase.sfxPath)
      const inputIndex = index + 1 // +1 bo 0=video
      const delayMs = Math.max(0, phase.startTime || 0)
      filterParts.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs},volume=0.5[a${index}]`)
    })

    const mixInputs = Array.from({ length: sfxPhases.length }, (_, i) => `[a${i}]`).join('')
    // WAŻNE: duration=longest dla audio + apad aby wypełnić ciszą do końca wideo
    const filterComplex = filterParts.join(';') + `;${mixInputs}amix=inputs=${sfxPhases.length}:duration=longest:normalize=0,apad[aout]`

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
      '-shortest',  // Teraz bezpieczne bo audio jest przedłużone przez apad
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
          console.log('[NarratedRenderer] SFX-only encoding complete!')
          resolve(outputPath)
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`))
        }
      })

      ffmpeg.on('error', reject)
    })
  }

  // === TRYB NORMALNY (voiceover + SFX) ===
  // Jeśli mamy pojedyncze SSML audio, użyj prostszej metody
  if (singleAudioPath && existsSync(singleAudioPath)) {
    console.log('[NarratedRenderer] Encoding with single SSML audio file')

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
