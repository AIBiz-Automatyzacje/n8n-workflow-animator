import puppeteer from 'puppeteer'
import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, existsSync, rmSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const CANVAS_SIZES = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 }
}

const SPEED_SETTINGS = {
  slow: { nodeDelay: 1500, edgeDelay: 800, fps: 30 },
  normal: { nodeDelay: 1000, edgeDelay: 500, fps: 30 },
  fast: { nodeDelay: 600, edgeDelay: 300, fps: 30 }
}

// Rozmiary kafelków - mniejsze dla TikTok (ustawiane dynamicznie)
const NODE_WIDTH_YOUTUBE = 240
const NODE_HEIGHT_YOUTUBE = 75
const NODE_WIDTH_TIKTOK = 210
const NODE_HEIGHT_TIKTOK = 68

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

export async function renderVideo(workflow, settings) {
  const outputDir = join(__dirname, '..', 'output')
  const framesDir = join(outputDir, 'frames')

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  if (existsSync(framesDir)) rmSync(framesDir, { recursive: true })
  mkdirSync(framesDir, { recursive: true })

  const canvasSize = CANVAS_SIZES[settings.aspectRatio]
  const speedConfig = SPEED_SETTINGS[settings.speed]

  console.log('[Renderer] Launching browser...')
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

  const html = generateAnimationHTML(workflow, settings, canvasSize)
  await page.setContent(html, { waitUntil: 'networkidle0' })

  // Oblicz czas animacji
  const totalNodes = workflow.animationOrder.length
  const isVertical = canvasSize.height > canvasSize.width
  let totalDuration = 300 // start delay

  workflow.animationOrder.forEach((nodeName, index) => {
    totalDuration += speedConfig.nodeDelay
    const outgoingEdges = workflow.edges.filter(e => e.source === nodeName)
    totalDuration += outgoingEdges.length * speedConfig.edgeDelay * 0.6
  })

  // Oblicz czas scrollowania z zatrzymywaniem (dla obu formatów)
  const NODE_WIDTH = isVertical ? NODE_WIDTH_TIKTOK : NODE_WIDTH_YOUTUBE
  const columnThreshold = NODE_WIDTH + 50
  const nodesByColumn = []
  const sortedNodes = [...workflow.nodes].sort((a, b) => a.x - b.x)

  sortedNodes.forEach(node => {
    let foundColumn = nodesByColumn.find(col => Math.abs(col.x - node.x) < columnThreshold)
    if (foundColumn) {
      foundColumn.nodes.push(node)
    } else {
      nodesByColumn.push({ x: node.x, nodes: [node] })
    }
  })

  const numColumns = nodesByColumn.length

  if (isVertical) {
    // TikTok: dłuższe pauzy
    const pausePerColumn = 1500
    const transitionTime = 600
    const scrollDuration = numColumns * pausePerColumn + (numColumns - 1) * transitionTime + 1000
    totalDuration += scrollDuration
  } else {
    // YouTube: krótsze pauzy + finalne zoom out
    const pausePerColumn = 1200
    const transitionTime = 500
    const scrollDuration = numColumns * pausePerColumn + (numColumns - 1) * transitionTime + 800 + 1000 + 500
    totalDuration += scrollDuration
  }

  const totalFrames = Math.ceil((totalDuration / 1000) * speedConfig.fps)

  console.log(`[Renderer] Capturing ${totalFrames} frames (${totalDuration}ms @ ${speedConfig.fps}fps)...`)

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = (frame / speedConfig.fps) * 1000

    await page.evaluate((t) => {
      window.setAnimationTime(t)
    }, time)

    const framePath = join(framesDir, `frame_${String(frame).padStart(5, '0')}.png`)
    await page.screenshot({ path: framePath })

    if (frame % 30 === 0) {
      console.log(`[Renderer] Frame ${frame}/${totalFrames} (${Math.round(frame/totalFrames*100)}%)`)
    }
  }

  await browser.close()
  console.log('[Renderer] Frames captured, encoding video...')

  const outputPath = join(outputDir, `workflow_${Date.now()}.mp4`)
  await encodeVideo(framesDir, outputPath, speedConfig.fps)

  rmSync(framesDir, { recursive: true })

  return outputPath
}

function generateAnimationHTML(workflow, settings, canvasSize) {
  const speedConfig = SPEED_SETTINGS[settings.speed]
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

  // Nodes
  const nodesHtml = workflow.nodes.map(node => {
    const index = workflow.animationOrder.indexOf(node.name)
    const iconSvg = getNodeIcon(node.type)

    return `
      <g class="node" data-name="${node.name}" data-index="${index}" data-x="${node.x}" data-y="${node.y}" transform="translate(${node.x}, ${node.y})" style="opacity: 0;">
        <!-- Glow -->
        <rect class="node-glow" x="-20" y="-20" width="${NODE_WIDTH + 40}" height="${NODE_HEIGHT + 40}" rx="25" fill="${node.color}" opacity="0" filter="url(#glow)"/>

        <!-- Shadow -->
        <rect x="4" y="6" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="#000" opacity="0.4"/>

        <!-- Background -->
        <rect class="node-bg" x="0" y="0" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="#262640" stroke="#404060" stroke-width="2"/>

        <!-- Color bar -->
        <rect x="0" y="0" width="6" height="${NODE_HEIGHT}" fill="${node.color}" rx="12" ry="0"/>
        <rect x="0" y="6" width="6" height="${NODE_HEIGHT - 12}" fill="${node.color}"/>

        <!-- Icon bg -->
        <rect x="16" y="${(NODE_HEIGHT - 42) / 2}" width="42" height="42" rx="10" fill="${node.color}"/>

        <!-- Icon -->
        <g transform="translate(16, ${(NODE_HEIGHT - 42) / 2})">
          <svg viewBox="0 0 24 24" width="42" height="42">
            <g transform="translate(9, 9) scale(1)">${iconSvg}</g>
          </svg>
        </g>

        <!-- Name -->
        <text x="74" y="${NODE_HEIGHT / 2 - 4}" fill="#ffffff" font-size="14" font-weight="600" font-family="Inter, system-ui, sans-serif">${escapeHtml(node.name.length > 20 ? node.name.substring(0, 17) + '...' : node.name)}</text>

        <!-- Type -->
        <text x="74" y="${NODE_HEIGHT / 2 + 12}" fill="#8888aa" font-size="11" font-family="Inter, system-ui, sans-serif">${node.shortType}</text>

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

  // Edges
  const edgesHtml = workflow.edges.map(edge => {
    const sourceNode = workflow.nodes.find(n => n.name === edge.source)
    const targetNode = workflow.nodes.find(n => n.name === edge.target)
    if (!sourceNode || !targetNode) return ''

    const startX = sourceNode.x + NODE_WIDTH
    const startY = sourceNode.y + NODE_HEIGHT / 2
    const endX = targetNode.x
    const endY = targetNode.y + NODE_HEIGHT / 2
    const controlOffset = Math.min(Math.abs(endX - startX) / 2, 120)

    const sourceIndex = workflow.animationOrder.indexOf(edge.source)

    return `
      <g class="edge" data-source="${edge.source}" data-source-index="${sourceIndex}">
        <path class="edge-path" d="M${startX},${startY} C${startX + controlOffset},${startY} ${endX - controlOffset},${endY} ${endX},${endY}"
              fill="none" stroke="#6b7280" stroke-width="3" stroke-dasharray="3000" stroke-dashoffset="3000" opacity="0.7"/>
        <circle class="edge-dot" cx="${startX}" cy="${startY}" r="8" fill="#ff6b6b" opacity="0"/>
        <circle class="edge-dot-inner" cx="${startX}" cy="${startY}" r="4" fill="white" opacity="0"/>
        <path class="edge-arrow" d="M${endX-12},${endY-6} L${endX},${endY} L${endX-12},${endY+6}"
              fill="none" stroke="#6b7280" stroke-width="3" stroke-linecap="round" opacity="0"/>
      </g>
    `
  }).join('')

  // Oblicz pozycje dla animacji kamery
  const nodePositions = workflow.animationOrder.map(name => {
    const node = workflow.nodes.find(n => n.name === name)
    return { name, x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 }
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    * { margin: 0; padding: 0; }
    body { background: #1a1a2e; overflow: hidden; font-family: 'Inter', system-ui, sans-serif; }
    svg { display: block; }
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
    </defs>

    <!-- Background -->
    <rect width="100%" height="100%" fill="#1a1a2e"/>

    <!-- Grid (za content) -->
    <g id="grid">${gridDots.join('')}</g>

    <!-- Content z kamerą -->
    <g id="content">
      <g id="edges">${edgesHtml}</g>
      <g id="nodes">${nodesHtml}</g>
    </g>
  </svg>

  <script>
    const nodeDelay = ${speedConfig.nodeDelay};
    const edgeDelay = ${speedConfig.edgeDelay};
    const startDelay = 300;
    const animationOrder = ${JSON.stringify(workflow.animationOrder)};
    const nodePositions = ${JSON.stringify(nodePositions)};
    const canvasWidth = ${canvasSize.width};
    const canvasHeight = ${canvasSize.height};
    const boundsCenter = { x: ${workflow.bounds.x + workflow.bounds.width / 2}, y: ${workflow.bounds.y + workflow.bounds.height / 2} };

    const content = document.getElementById('content');

    // Oblicz timing dla każdego node'a
    const nodeTimings = [];
    let currentTime = startDelay;
    animationOrder.forEach((nodeName, index) => {
      nodeTimings.push({ name: nodeName, time: currentTime, index });
      currentTime += nodeDelay;

      const outgoingEdges = document.querySelectorAll(\`.edge[data-source="\${nodeName}"]\`);
      currentTime += outgoingEdges.length * edgeDelay * 0.6;
    });
    const animationEndTime = currentTime + 500;

    // Wykryj czy to format pionowy (TikTok)
    const isVertical = canvasHeight > canvasWidth;

    // Zoom levels - różne dla TikTok vs YouTube
    let startZoom, targetZoom, zoomTransitionNodes;
    if (isVertical) {
      // TikTok: jeden duży kafelek
      startZoom = canvasWidth / 320;
      targetZoom = startZoom;
      zoomTransitionNodes = 0;
    } else {
      // YouTube: 3-4 kafelki
      startZoom = canvasWidth / 350;
      targetZoom = canvasWidth / 900;
      zoomTransitionNodes = Math.min(3, animationOrder.length);
    }

    // Dane node'ów z pozycjami (dla grupowania w kolumny)
    const nodesData = ${JSON.stringify(workflow.nodes.map(n => ({ name: n.name, x: n.x, y: n.y })))};
    const nodeWidth = ${NODE_WIDTH};
    const nodeHeight = ${NODE_HEIGHT};

    // Finalny zoom (YouTube)
    const padding = 100;
    const boundsWidth = ${workflow.bounds.width};
    const boundsHeight = ${workflow.bounds.height};
    const finalZoomX = canvasWidth / (boundsWidth + padding * 2);
    const finalZoomY = canvasHeight / (boundsHeight + padding * 2);
    const finalZoom = Math.min(finalZoomX, finalZoomY, 1);

    // Grupuj node'y w kolumny (dla TikTok scroll)
    const columnThreshold = nodeWidth + 50;
    const nodesByColumn = [];
    const sortedNodes = [...nodesData].sort((a, b) => a.x - b.x);

    sortedNodes.forEach(node => {
      let foundColumn = nodesByColumn.find(col => Math.abs(col.x - node.x) < columnThreshold);
      if (foundColumn) {
        foundColumn.nodes.push(node);
        foundColumn.minY = Math.min(foundColumn.minY, node.y);
        foundColumn.maxY = Math.max(foundColumn.maxY, node.y + nodeHeight);
      } else {
        nodesByColumn.push({
          x: node.x,
          nodes: [node],
          minY: node.y,
          maxY: node.y + nodeHeight
        });
      }
    });

    nodesByColumn.sort((a, b) => a.x - b.x);

    // Oblicz parametry każdej kolumny - różne dla TikTok vs YouTube
    const scrollPadding = 60;
    const columns = nodesByColumn.map(col => {
      const nodesInColumn = col.nodes.length;
      const columnHeight = col.maxY - col.minY;
      const centerX = col.x + nodeWidth / 2;
      const centerY = col.minY + columnHeight / 2;

      let zoom;
      if (isVertical) {
        // TikTok: jeden kafelek na szerokość
        if (nodesInColumn <= 2) {
          zoom = Math.min(
            (canvasWidth - scrollPadding * 2) / (nodeWidth + 40),
            (canvasHeight - scrollPadding * 2) / (columnHeight + 80)
          );
        } else {
          zoom = Math.min(
            (canvasWidth - scrollPadding * 2) / (nodeWidth + 40),
            (canvasHeight - scrollPadding * 2) / (columnHeight + 40)
          );
        }
        zoom = Math.min(zoom, 2.8);
      } else {
        // YouTube: 2-3 kafelki na szerokość
        if (nodesInColumn <= 2) {
          zoom = Math.min(
            (canvasWidth - scrollPadding * 2) / (nodeWidth * 2.5),
            (canvasHeight - scrollPadding * 2) / (columnHeight + 100)
          );
        } else {
          zoom = Math.min(
            (canvasWidth - scrollPadding * 2) / (nodeWidth * 2.5),
            (canvasHeight - scrollPadding * 2) / (columnHeight + 60)
          );
        }
        zoom = Math.min(zoom, 2.2);
      }

      return { centerX, centerY, zoom, nodesCount: nodesInColumn };
    });

    // Timing dla scrollowania kolumn - różne dla formatów
    const pausePerColumn = isVertical ? 1500 : 1200;
    const transitionTime = isVertical ? 600 : 500;
    const scrollStartTime = animationEndTime + (isVertical ? 500 : 400);

    // Oblicz timeline kolumn
    const columnTimeline = [];
    let scrollTime = scrollStartTime;
    columns.forEach((col, index) => {
      if (index > 0) {
        columnTimeline.push({
          startTime: scrollTime,
          endTime: scrollTime + transitionTime,
          type: 'transition',
          fromCol: columns[index - 1],
          toCol: col
        });
        scrollTime += transitionTime;
      }
      columnTimeline.push({
        startTime: scrollTime,
        endTime: scrollTime + pausePerColumn,
        type: 'pause',
        col: col
      });
      scrollTime += pausePerColumn;
    });
    const totalScrollEndTime = scrollTime;

    window.setAnimationTime = function(time) {
      const nodes = document.querySelectorAll('.node');
      const edges = document.querySelectorAll('.edge');

      // Znajdź aktualny node
      let activeNodeIndex = -1;
      let activeNodePos = null;
      for (let i = nodeTimings.length - 1; i >= 0; i--) {
        if (time >= nodeTimings[i].time) {
          activeNodeIndex = i;
          activeNodePos = nodePositions[i];
          break;
        }
      }

      // Oblicz zoom i pozycję kamery
      let cameraZoom, cameraX, cameraY;

      if (isVertical) {
        // TikTok logic - scroll z zatrzymywaniem na kolumnach
        if (time >= totalScrollEndTime) {
          // Po scrollu - ostatnia kolumna
          const lastCol = columns[columns.length - 1];
          cameraZoom = lastCol.zoom;
          cameraX = lastCol.centerX;
          cameraY = lastCol.centerY;
        } else if (time >= scrollStartTime) {
          // Znajdź aktualny segment w timeline
          let segment = columnTimeline.find(seg => time >= seg.startTime && time < seg.endTime);
          if (!segment) segment = columnTimeline[columnTimeline.length - 1];

          if (segment.type === 'pause') {
            cameraZoom = segment.col.zoom;
            cameraX = segment.col.centerX;
            cameraY = segment.col.centerY;
          } else {
            // Transition między kolumnami
            const progress = (time - segment.startTime) / (segment.endTime - segment.startTime);
            const eased = progress < 0.5
              ? 2 * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            cameraX = segment.fromCol.centerX + (segment.toCol.centerX - segment.fromCol.centerX) * eased;
            cameraY = segment.fromCol.centerY + (segment.toCol.centerY - segment.fromCol.centerY) * eased;
            cameraZoom = segment.fromCol.zoom + (segment.toCol.zoom - segment.fromCol.zoom) * eased;
          }
        } else if (activeNodePos) {
          // Animacja node'ów - jeden duży kafelek
          cameraZoom = targetZoom;
          cameraX = activeNodePos.x;
          cameraY = activeNodePos.y;
        } else {
          cameraZoom = startZoom;
          cameraX = nodePositions[0]?.x || canvasWidth / 2;
          cameraY = nodePositions[0]?.y || canvasHeight / 2;
        }
      } else {
        // YouTube logic - scroll z zatrzymywaniem + finalne zoom out
        const finalTransitionTime = 800;
        const finalPauseTime = 1000;
        const youtubeScrollEndTime = totalScrollEndTime;
        const finalZoomStartTime = youtubeScrollEndTime;
        const finalZoomEndTime = finalZoomStartTime + finalTransitionTime;
        const totalEndTime = finalZoomEndTime + finalPauseTime;

        if (time >= finalZoomEndTime) {
          // Po finalnym zoom - pokaż cały workflow
          cameraZoom = finalZoom;
          cameraX = boundsCenter.x;
          cameraY = boundsCenter.y;
        } else if (time >= finalZoomStartTime) {
          // Finalne przejście do zoom out
          const lastCol = columns[columns.length - 1];
          const progress = (time - finalZoomStartTime) / finalTransitionTime;
          const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

          cameraX = lastCol.centerX + (boundsCenter.x - lastCol.centerX) * eased;
          cameraY = lastCol.centerY + (boundsCenter.y - lastCol.centerY) * eased;
          cameraZoom = lastCol.zoom + (finalZoom - lastCol.zoom) * eased;
        } else if (time >= scrollStartTime) {
          // Scroll z zatrzymywaniem (tak samo jak TikTok)
          let segment = columnTimeline.find(seg => time >= seg.startTime && time < seg.endTime);
          if (!segment) segment = columnTimeline[columnTimeline.length - 1];

          if (segment.type === 'pause') {
            cameraZoom = segment.col.zoom;
            cameraX = segment.col.centerX;
            cameraY = segment.col.centerY;
          } else {
            const progress = (time - segment.startTime) / (segment.endTime - segment.startTime);
            const eased = progress < 0.5
              ? 2 * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            cameraX = segment.fromCol.centerX + (segment.toCol.centerX - segment.fromCol.centerX) * eased;
            cameraY = segment.fromCol.centerY + (segment.toCol.centerY - segment.fromCol.centerY) * eased;
            cameraZoom = segment.fromCol.zoom + (segment.toCol.zoom - segment.fromCol.zoom) * eased;
          }
        } else if (activeNodePos) {
          if (activeNodeIndex < zoomTransitionNodes) {
            const zoomProgress = activeNodeIndex / zoomTransitionNodes;
            cameraZoom = startZoom - (startZoom - targetZoom) * zoomProgress;
          } else {
            cameraZoom = targetZoom;
          }
          cameraX = activeNodePos.x;
          cameraY = activeNodePos.y;
        } else {
          cameraZoom = startZoom;
          cameraX = nodePositions[0]?.x || canvasWidth / 2;
          cameraY = nodePositions[0]?.y || canvasHeight / 2;
        }
      }

      // Aplikuj transformację kamery
      const offsetX = canvasWidth / 2 - cameraX * cameraZoom;
      const offsetY = canvasHeight / 2 - cameraY * cameraZoom;
      content.setAttribute('transform', \`translate(\${offsetX}, \${offsetY}) scale(\${cameraZoom})\`);

      // Animuj nodes
      nodes.forEach(node => {
        const index = parseInt(node.dataset.index);
        const nodeTiming = nodeTimings.find(t => t.index === index);
        if (!nodeTiming) return;

        const nodeTime = nodeTiming.time;

        if (time >= nodeTime) {
          node.style.opacity = 1;

          const glow = node.querySelector('.node-glow');
          const bg = node.querySelector('.node-bg');
          const pulseTime = (time - nodeTime) % 1000;
          const pulsePhase = Math.sin(pulseTime / 1000 * Math.PI * 2) * 0.5 + 0.5;

          // Aktywny = pulsuje
          if (time < nodeTime + nodeDelay && index === activeNodeIndex) {
            glow.style.opacity = 0.25 + pulsePhase * 0.15;
            bg.setAttribute('stroke', node.querySelector('rect[fill^="#"]:nth-child(4)')?.getAttribute('fill') || '#ff6b6b');
            bg.setAttribute('stroke-width', '4');
          } else {
            glow.style.opacity = 0;
            bg.setAttribute('stroke', '#404060');
            bg.setAttribute('stroke-width', '2');
          }
        } else {
          node.style.opacity = 0;
        }
      });

      // Animuj edges
      edges.forEach(edge => {
        const sourceIndex = parseInt(edge.dataset.sourceIndex);
        const sourceTiming = nodeTimings.find(t => t.index === sourceIndex);
        if (!sourceTiming) return;

        const edgeStartTime = sourceTiming.time + nodeDelay * 0.5;

        const path = edge.querySelector('.edge-path');
        const dot = edge.querySelector('.edge-dot');
        const dotInner = edge.querySelector('.edge-dot-inner');
        const arrow = edge.querySelector('.edge-arrow');

        if (time >= edgeStartTime) {
          const progress = Math.min((time - edgeStartTime) / edgeDelay, 1);
          const pathLength = path.getTotalLength();
          path.style.strokeDasharray = pathLength;
          path.style.strokeDashoffset = pathLength * (1 - progress);

          if (progress < 1) {
            path.style.stroke = '#ff6b6b';
            path.style.opacity = 1;
            path.setAttribute('filter', 'url(#glow)');
          } else {
            path.style.stroke = '#6b7280';
            path.style.opacity = 0.7;
            path.removeAttribute('filter');
          }

          if (progress < 1 && progress > 0) {
            const point = path.getPointAtLength(pathLength * progress);
            dot.setAttribute('cx', point.x);
            dot.setAttribute('cy', point.y);
            dotInner.setAttribute('cx', point.x);
            dotInner.setAttribute('cy', point.y);
            dot.style.opacity = 1;
            dotInner.style.opacity = 1;
          } else {
            dot.style.opacity = 0;
            dotInner.style.opacity = 0;
            if (progress >= 1) {
              arrow.style.opacity = 1;
            }
          }
        } else {
          path.style.strokeDashoffset = 3000;
          dot.style.opacity = 0;
          dotInner.style.opacity = 0;
          arrow.style.opacity = 0;
        }
      });
    };

    window.setAnimationTime(0);
  </script>
</body>
</html>
  `
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

// Eksport wideo z audio
export async function renderVideoWithAudio(workflow, settings, audioSegments) {
  const outputDir = join(__dirname, '..', 'output')
  const framesDir = join(outputDir, 'frames')

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
  if (existsSync(framesDir)) rmSync(framesDir, { recursive: true })
  mkdirSync(framesDir, { recursive: true })

  const canvasSize = CANVAS_SIZES[settings.aspectRatio]
  const speedConfig = SPEED_SETTINGS[settings.speed]

  console.log('[Renderer] Launching browser (with audio)...')
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

  const html = generateAnimationHTML(workflow, settings, canvasSize)
  await page.setContent(html, { waitUntil: 'networkidle0' })

  // Oblicz czas animacji (tak samo jak w renderVideo)
  const isVertical = canvasSize.height > canvasSize.width
  let totalDuration = 300

  workflow.animationOrder.forEach((nodeName) => {
    totalDuration += speedConfig.nodeDelay
    const outgoingEdges = workflow.edges.filter(e => e.source === nodeName)
    totalDuration += outgoingEdges.length * speedConfig.edgeDelay * 0.6
  })

  const NODE_WIDTH = isVertical ? NODE_WIDTH_TIKTOK : NODE_WIDTH_YOUTUBE
  const columnThreshold = NODE_WIDTH + 50
  const nodesByColumn = []
  const sortedNodes = [...workflow.nodes].sort((a, b) => a.x - b.x)

  sortedNodes.forEach(node => {
    let foundColumn = nodesByColumn.find(col => Math.abs(col.x - node.x) < columnThreshold)
    if (foundColumn) {
      foundColumn.nodes.push(node)
    } else {
      nodesByColumn.push({ x: node.x, nodes: [node] })
    }
  })

  const numColumns = nodesByColumn.length

  if (isVertical) {
    const pausePerColumn = 1500
    const transitionTime = 600
    const scrollDuration = numColumns * pausePerColumn + (numColumns - 1) * transitionTime + 1000
    totalDuration += scrollDuration
  } else {
    const pausePerColumn = 1200
    const transitionTime = 500
    const scrollDuration = numColumns * pausePerColumn + (numColumns - 1) * transitionTime + 800 + 1000 + 500
    totalDuration += scrollDuration
  }

  const totalFrames = Math.ceil((totalDuration / 1000) * speedConfig.fps)

  console.log(`[Renderer] Capturing ${totalFrames} frames (${totalDuration}ms @ ${speedConfig.fps}fps)...`)

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = (frame / speedConfig.fps) * 1000

    await page.evaluate((t) => {
      window.setAnimationTime(t)
    }, time)

    const framePath = join(framesDir, `frame_${String(frame).padStart(5, '0')}.png`)
    await page.screenshot({ path: framePath })

    if (frame % 30 === 0) {
      console.log(`[Renderer] Frame ${frame}/${totalFrames} (${Math.round(frame/totalFrames*100)}%)`)
    }
  }

  await browser.close()
  console.log('[Renderer] Frames captured, encoding video with audio...')

  const outputPath = join(outputDir, `workflow_${Date.now()}.mp4`)

  // Jeśli mamy segmenty audio, połącz je
  if (audioSegments && audioSegments.length > 0) {
    await encodeVideoWithAudio(framesDir, outputPath, speedConfig.fps, audioSegments)
  } else {
    await encodeVideo(framesDir, outputPath, speedConfig.fps)
  }

  rmSync(framesDir, { recursive: true })

  return outputPath
}

// Koduj wideo z segmentami audio
async function encodeVideoWithAudio(framesDir, outputPath, fps, audioSegments) {
  // Zbierz tylko segmenty z istniejącymi plikami audio
  const validSegments = []

  audioSegments.forEach((segment) => {
    if (segment.audioPath && existsSync(segment.audioPath)) {
      validSegments.push(segment)
      console.log(`[FFmpeg] Audio segment: ${segment.audioPath} @ ${segment.startTime}ms`)
    } else {
      console.log(`[FFmpeg] Skipping segment - no audio: ${segment.audioPath}`)
    }
  })

  if (validSegments.length === 0) {
    console.log('[FFmpeg] No valid audio segments, encoding without audio')
    return encodeVideo(framesDir, outputPath, fps)
  }

  console.log(`[FFmpeg] Found ${validSegments.length} valid audio segments`)

  // Buduj filter_complex - WAŻNE: indeksy zaczynają się od 1 bo 0 to wideo
  const filterParts = []
  const inputArgs = []

  validSegments.forEach((segment, index) => {
    inputArgs.push('-i', segment.audioPath)
    // Indeks audio to index + 1 (bo 0 to wideo z ramek)
    const audioIndex = index + 1
    const delayMs = Math.max(0, segment.startTime || 0)
    filterParts.push(`[${audioIndex}:a]adelay=${delayMs}|${delayMs}[a${index}]`)
  })

  // Zmixuj wszystkie audio
  const mixInputs = filterParts.map((_, i) => `[a${i}]`).join('')
  const filterComplex = filterParts.join(';') + `;${mixInputs}amix=inputs=${validSegments.length}:duration=longest:normalize=0[aout]`

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

  console.log('[FFmpeg] Command:', 'ffmpeg', ffmpegArgs.join(' '))

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ffmpegArgs)

    let stderrOutput = ''

    ffmpeg.stderr.on('data', (data) => {
      const msg = data.toString()
      stderrOutput += msg
      if (msg.includes('frame=')) {
        process.stdout.write(`\r[FFmpeg] ${msg.trim().split('\n').pop()}`)
      }
    })

    ffmpeg.on('close', (code) => {
      console.log('')
      if (code === 0) {
        console.log('[FFmpeg] Encoding with audio complete!')
        resolve(outputPath)
      } else {
        // Loguj pełny błąd
        console.error('[FFmpeg] Audio encoding failed with code:', code)
        console.error('[FFmpeg] Full stderr output:')
        console.error(stderrOutput)
        console.warn('[FFmpeg] Trying without audio...')
        encodeVideo(framesDir, outputPath, fps).then(resolve).catch(reject)
      }
    })

    ffmpeg.on('error', (err) => {
      console.error('[FFmpeg] Spawn error:', err)
      encodeVideo(framesDir, outputPath, fps).then(resolve).catch(reject)
    })
  })
}

async function encodeVideo(framesDir, outputPath, fps) {
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
        process.stdout.write(`\r[FFmpeg] ${msg.trim().split('\n').pop()}`)
      }
    })

    ffmpeg.on('close', (code) => {
      console.log('')
      if (code === 0) {
        console.log('[FFmpeg] Encoding complete!')
        resolve(outputPath)
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })

    ffmpeg.on('error', reject)
  })
}
