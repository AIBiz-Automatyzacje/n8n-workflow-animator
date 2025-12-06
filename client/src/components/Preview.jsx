import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { Stage, Layer, Group, Rect, Text, Line, Circle, Path } from 'react-konva'

// Rozmiary canvas
const CANVAS_SIZES = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 }
}

// Czas animacji per node (ms)
const SPEED_SETTINGS = {
  slow: { nodeDelay: 1500, edgeDelay: 800 },
  normal: { nodeDelay: 1000, edgeDelay: 500 },
  fast: { nodeDelay: 600, edgeDelay: 300 }
}

// Kolory n8n
const N8N_COLORS = {
  background: '#1a1a2e',
  gridDot: '#2a2a4a',
  nodeBg: '#262640',
  nodeBorder: '#404060',
  nodeText: '#ffffff',
  nodeSubtext: '#8888aa',
  edge: '#6b7280',
  edgeActive: '#ff6b6b'
}

// Ścieżki SVG dla ikon
const ICON_PATHS = {
  manualTrigger: 'M8 5v14l11-7z',
  webhook: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  schedule: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  httpRequest: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  code: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
  if: 'M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1 6h2v2h-2zm0 4h2v6h-2z',
  switch: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
  splitInBatches: 'M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z',
  merge: 'M17 20.41L18.41 19 15 15.59 13.59 17 17 20.41zM7.5 8H11v5.59L5.59 19 7 20.41l6-6V8h3.5L12 3.5 7.5 8z',
  set: 'M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
  airtable: 'M11.992 1.966L2.46 5.675a.351.351 0 0 0 .007.635l9.476 3.895a1.26 1.26 0 0 0 .975-.001l9.483-3.9a.35.35 0 0 0 .006-.634l-9.54-3.707a.96.96 0 0 0-.875.003z',
  chainLlm: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  openai: 'M22.28 9.82a5.99 5.99 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18 5.99 5.99 0 0 0 .98 7.08a6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9 5.99 5.99 0 0 0 4.5 2.01 6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.74-7.07z',
  gemini: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  slack: 'M5.04 15.17a2.53 2.53 0 0 1-2.52 2.52A2.53 2.53 0 0 1 0 15.17a2.53 2.53 0 0 1 2.52-2.52h2.52v2.52z',
  gmail: 'M24 5.46v13.9c0 .9-.73 1.64-1.64 1.64h-3.82V11.73L12 16.64l-6.55-4.91v9.27H1.64A1.64 1.64 0 0 1 0 19.37V5.46c0-2.02 2.31-3.18 3.93-1.96l1.53 1.18L12 9.55l6.55-4.91 1.53-1.15C21.69 2.28 24 3.43 24 5.46z',
  default: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'
}

function getIconPath(fullType) {
  const parts = fullType.split('.')
  const type = parts[parts.length - 1].toLowerCase()

  for (const [key, path] of Object.entries(ICON_PATHS)) {
    if (type.includes(key.toLowerCase())) {
      return path
    }
  }
  return ICON_PATHS.default
}

// Funkcja do obcinania tekstu
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

// Dźwięki
const createAudioContext = () => {
  if (typeof window !== 'undefined' && window.AudioContext) {
    return new (window.AudioContext || window.webkitAudioContext)()
  }
  return null
}

const playNodeSound = (audioContext) => {
  if (!audioContext) return
  try {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1)

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  } catch (e) {}
}

const playEdgeSound = (audioContext) => {
  if (!audioContext) return
  try {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime)
    oscillator.frequency.linearRampToValueAtTime(600, audioContext.currentTime + 0.15)

    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.15)
  } catch (e) {}
}

// Komponent grida kropkowanego
function DottedGrid({ width, height, spacing = 25, dotSize = 1.5, color }) {
  const dots = useMemo(() => {
    const result = []
    for (let x = spacing; x < width; x += spacing) {
      for (let y = spacing; y < height; y += spacing) {
        result.push({ x, y, key: `${x}-${y}` })
      }
    }
    return result
  }, [width, height, spacing])

  return (
    <>
      {dots.map(dot => (
        <Circle key={dot.key} x={dot.x} y={dot.y} radius={dotSize} fill={color} />
      ))}
    </>
  )
}

function Preview({ workflow, settings, isPlaying, onAnimationEnd }) {
  const containerRef = useRef(null)
  const audioContextRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 450 })
  const [animationState, setAnimationState] = useState({
    visibleNodes: [],
    visibleEdges: [],
    activeNode: null,
    edgeProgress: {},
    cameraX: 0,
    cameraY: 0,
    cameraZoom: 2.5 // Duży zoom na początek
  })

  const canvasSize = CANVAS_SIZES[settings.aspectRatio]
  const speedConfig = SPEED_SETTINGS[settings.speed]
  const isVertical = settings.aspectRatio === '9:16'
  // Mniejsze kafelki dla mobile (TikTok)
  const nodeWidth = isVertical ? 210 : 240
  const nodeHeight = isVertical ? 68 : 75

  // Skaluj container do dostępnej przestrzeni
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement
        const maxWidth = parent.clientWidth - 40
        const maxHeight = parent.clientHeight - 40

        const aspectRatio = canvasSize.width / canvasSize.height
        let width = maxWidth
        let height = width / aspectRatio

        if (height > maxHeight) {
          height = maxHeight
          width = height * aspectRatio
        }

        setContainerSize({ width, height })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [canvasSize])

  // Reset animacji przy zmianie workflow
  useEffect(() => {
    if (!workflow) return

    const firstNode = workflow.nodes.find(n => n.name === workflow.animationOrder[0])
    setAnimationState({
      visibleNodes: workflow.animationOrder,
      visibleEdges: workflow.edges.map(e => e.source + '->' + e.target),
      activeNode: null,
      edgeProgress: {},
      cameraX: firstNode ? firstNode.x + nodeWidth / 2 : 0,
      cameraY: firstNode ? firstNode.y + nodeHeight / 2 : 0,
      cameraZoom: 1
    })
  }, [workflow])

  // Animacja
  useEffect(() => {
    if (!isPlaying || !workflow) return

    // Inicjalizuj audio context
    if (!audioContextRef.current) {
      audioContextRef.current = createAudioContext()
    }

    const firstNode = workflow.nodes.find(n => n.name === workflow.animationOrder[0])
    const totalNodes = workflow.animationOrder.length

    // Różne ustawienia dla pionowego (TikTok) vs poziomego (YouTube)
    let startZoom, targetZoom, zoomTransitionNodes

    if (isVertical) {
      // TikTok: jeden duży kafelek na środku
      startZoom = canvasSize.width / 320 // ~2.25 - jeden kafelek wypełnia szerokość
      targetZoom = startZoom // Utrzymuj przez całą animację
      zoomTransitionNodes = 0
    } else {
      // YouTube: 3-4 kafelki na szerokość
      startZoom = canvasSize.width / 350
      targetZoom = canvasSize.width / 900
      zoomTransitionNodes = Math.min(3, totalNodes)
    }

    // Reset z kamerą na pierwszym node
    setAnimationState({
      visibleNodes: [],
      visibleEdges: [],
      activeNode: null,
      edgeProgress: {},
      cameraX: firstNode ? firstNode.x + nodeWidth / 2 : canvasSize.width / 2,
      cameraY: firstNode ? firstNode.y + nodeHeight / 2 : canvasSize.height / 2,
      cameraZoom: startZoom,
      scrollPhase: false // Dla TikTok - czy jesteśmy w fazie scrollowania
    })

    const timeouts = []
    const intervals = []
    let currentTime = 300

    // Animuj każdy node w kolejności
    workflow.animationOrder.forEach((nodeName, index) => {
      const node = workflow.nodes.find(n => n.name === nodeName)
      if (!node) return

      const nodeStartTime = currentTime

      // Przesuń kamerę na ten node
      timeouts.push(setTimeout(() => {
        // Dźwięk pojawienia node'a
        playNodeSound(audioContextRef.current)

        // Oblicz zoom
        let newZoom
        if (isVertical) {
          newZoom = targetZoom // Stały zoom dla TikTok
        } else if (index < zoomTransitionNodes) {
          const zoomProgress = index / zoomTransitionNodes
          newZoom = startZoom - (startZoom - targetZoom) * zoomProgress
        } else {
          newZoom = targetZoom
        }

        setAnimationState(prev => ({
          ...prev,
          visibleNodes: [...prev.visibleNodes, nodeName],
          activeNode: nodeName,
          cameraX: node.x + nodeWidth / 2,
          cameraY: node.y + nodeHeight / 2,
          cameraZoom: newZoom
        }))
      }, nodeStartTime))

      currentTime += speedConfig.nodeDelay

      // Animuj edge'y wychodzące z tego node'a
      const outgoingEdges = workflow.edges.filter(e => e.source === nodeName)
      outgoingEdges.forEach((edge, edgeIndex) => {
        const edgeKey = edge.source + '->' + edge.target
        const edgeStartTime = currentTime

        // Dźwięk strzałki
        timeouts.push(setTimeout(() => {
          playEdgeSound(audioContextRef.current)
        }, edgeStartTime))

        // Animacja rysowania edge'a
        const edgeDuration = speedConfig.edgeDelay
        const steps = 25
        for (let step = 0; step <= steps; step++) {
          timeouts.push(setTimeout(() => {
            setAnimationState(prev => ({
              ...prev,
              edgeProgress: {
                ...prev.edgeProgress,
                [edgeKey]: step / steps
              }
            }))
          }, edgeStartTime + (step * edgeDuration / steps)))
        }

        timeouts.push(setTimeout(() => {
          setAnimationState(prev => ({
            ...prev,
            visibleEdges: [...prev.visibleEdges, edgeKey]
          }))
        }, edgeStartTime + edgeDuration))

        currentTime += edgeDuration * 0.6
      })
    })

    // Koniec animacji
    const endTime = currentTime + 300

    if (isVertical) {
      // TikTok: scroll z zatrzymywaniem na każdej kolumnie
      const padding = 60

      // Grupuj node'y w kolumny na podstawie pozycji X
      const columnThreshold = nodeWidth + 50 // Tolerancja grupowania
      const nodesByColumn = []
      const sortedNodes = [...workflow.nodes].sort((a, b) => a.x - b.x)

      sortedNodes.forEach(node => {
        // Znajdź istniejącą kolumnę lub stwórz nową
        let foundColumn = nodesByColumn.find(col =>
          Math.abs(col.x - node.x) < columnThreshold
        )
        if (foundColumn) {
          foundColumn.nodes.push(node)
          foundColumn.minY = Math.min(foundColumn.minY, node.y)
          foundColumn.maxY = Math.max(foundColumn.maxY, node.y + nodeHeight)
        } else {
          nodesByColumn.push({
            x: node.x,
            nodes: [node],
            minY: node.y,
            maxY: node.y + nodeHeight
          })
        }
      })

      // Sortuj kolumny od lewej do prawej
      nodesByColumn.sort((a, b) => a.x - b.x)

      // Oblicz centrum i zoom dla każdej kolumny
      const columns = nodesByColumn.map(col => {
        const nodesInColumn = col.nodes.length
        const columnHeight = col.maxY - col.minY
        const centerX = col.x + nodeWidth / 2
        const centerY = col.minY + columnHeight / 2

        // Dynamiczny zoom - więcej node'ów = mniejszy zoom
        // 1-2 nodes: duże (prawie cały ekran)
        // 3+ nodes: mniejsze żeby się zmieściły
        let zoom
        if (nodesInColumn <= 2) {
          // Prawie cały ekran dla 1-2 nodes
          zoom = Math.min(
            (canvasSize.width - padding * 2) / (nodeWidth + 40),
            (canvasSize.height - padding * 2) / (columnHeight + 80)
          )
        } else {
          // Zmniejsz zoom dla więcej node'ów
          zoom = Math.min(
            (canvasSize.width - padding * 2) / (nodeWidth + 40),
            (canvasSize.height - padding * 2) / (columnHeight + 40)
          )
        }
        // Ogranicz maksymalny zoom
        zoom = Math.min(zoom, 2.8)

        return { centerX, centerY, zoom, nodesCount: nodesInColumn }
      })

      // Czasy animacji
      const pausePerColumn = 1500 // Czas zatrzymania na każdej kolumnie
      const transitionTime = 600 // Czas przejścia między kolumnami

      let scrollTime = endTime + 500

      // Przejdź przez każdą kolumnę
      columns.forEach((col, index) => {
        // Przejście do tej kolumny (z easingiem)
        if (index > 0) {
          const prevCol = columns[index - 1]
          const transitionSteps = 20

          for (let step = 0; step <= transitionSteps; step++) {
            timeouts.push(setTimeout(() => {
              const progress = step / transitionSteps
              // Ease in-out
              const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2

              setAnimationState(prev => ({
                ...prev,
                cameraX: prevCol.centerX + (col.centerX - prevCol.centerX) * eased,
                cameraY: prevCol.centerY + (col.centerY - prevCol.centerY) * eased,
                cameraZoom: prevCol.zoom + (col.zoom - prevCol.zoom) * eased
              }))
            }, scrollTime + (step * transitionTime / transitionSteps)))
          }
          scrollTime += transitionTime
        } else {
          // Pierwsza kolumna - ustaw początkową pozycję
          timeouts.push(setTimeout(() => {
            setAnimationState(prev => ({
              ...prev,
              activeNode: null,
              scrollPhase: true,
              cameraZoom: col.zoom,
              cameraX: col.centerX,
              cameraY: col.centerY
            }))
          }, scrollTime))
        }

        // Pauza na tej kolumnie
        scrollTime += pausePerColumn
      })

      // Zakończ
      timeouts.push(setTimeout(() => {
        onAnimationEnd?.()
      }, scrollTime + 500))

    } else {
      // YouTube: scroll z zatrzymywaniem na każdej kolumnie (jak TikTok ale poziomo)
      const padding = 60

      // Grupuj node'y w kolumny na podstawie pozycji X
      const columnThreshold = nodeWidth + 50
      const nodesByColumn = []
      const sortedNodes = [...workflow.nodes].sort((a, b) => a.x - b.x)

      sortedNodes.forEach(node => {
        let foundColumn = nodesByColumn.find(col =>
          Math.abs(col.x - node.x) < columnThreshold
        )
        if (foundColumn) {
          foundColumn.nodes.push(node)
          foundColumn.minY = Math.min(foundColumn.minY, node.y)
          foundColumn.maxY = Math.max(foundColumn.maxY, node.y + nodeHeight)
        } else {
          nodesByColumn.push({
            x: node.x,
            nodes: [node],
            minY: node.y,
            maxY: node.y + nodeHeight
          })
        }
      })

      nodesByColumn.sort((a, b) => a.x - b.x)

      // Oblicz centrum i zoom dla każdej kolumny
      // YouTube: pokazuj 2-3 kafelki na szerokość, więc grupujemy po 2-3 kolumny
      const columns = nodesByColumn.map(col => {
        const nodesInColumn = col.nodes.length
        const columnHeight = col.maxY - col.minY
        const centerX = col.x + nodeWidth / 2
        const centerY = col.minY + columnHeight / 2

        // YouTube: więcej miejsca, więc większe kafelki
        let zoom
        if (nodesInColumn <= 2) {
          zoom = Math.min(
            (canvasSize.width - padding * 2) / (nodeWidth * 2.5),
            (canvasSize.height - padding * 2) / (columnHeight + 100)
          )
        } else {
          zoom = Math.min(
            (canvasSize.width - padding * 2) / (nodeWidth * 2.5),
            (canvasSize.height - padding * 2) / (columnHeight + 60)
          )
        }
        zoom = Math.min(zoom, 2.2)

        return { centerX, centerY, zoom, nodesCount: nodesInColumn }
      })

      // Czasy animacji - trochę szybsze dla YouTube
      const pausePerColumn = 1200
      const transitionTime = 500

      let scrollTime = endTime + 400

      // Przejdź przez każdą kolumnę
      columns.forEach((col, index) => {
        if (index > 0) {
          const prevCol = columns[index - 1]
          const transitionSteps = 20

          for (let step = 0; step <= transitionSteps; step++) {
            timeouts.push(setTimeout(() => {
              const progress = step / transitionSteps
              const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2

              setAnimationState(prev => ({
                ...prev,
                cameraX: prevCol.centerX + (col.centerX - prevCol.centerX) * eased,
                cameraY: prevCol.centerY + (col.centerY - prevCol.centerY) * eased,
                cameraZoom: prevCol.zoom + (col.zoom - prevCol.zoom) * eased
              }))
            }, scrollTime + (step * transitionTime / transitionSteps)))
          }
          scrollTime += transitionTime
        } else {
          // Pierwsza kolumna
          timeouts.push(setTimeout(() => {
            setAnimationState(prev => ({
              ...prev,
              activeNode: null,
              scrollPhase: true,
              cameraZoom: col.zoom,
              cameraX: col.centerX,
              cameraY: col.centerY
            }))
          }, scrollTime))
        }

        scrollTime += pausePerColumn
      })

      // Na koniec - zoom out na cały workflow
      const finalPadding = 80
      const finalZoomX = canvasSize.width / (workflow.bounds.width + finalPadding * 2)
      const finalZoomY = canvasSize.height / (workflow.bounds.height + finalPadding * 2)
      const finalZoom = Math.min(finalZoomX, finalZoomY, 1.2)
      const finalCenterX = workflow.bounds.x + workflow.bounds.width / 2
      const finalCenterY = workflow.bounds.y + workflow.bounds.height / 2

      const lastCol = columns[columns.length - 1]
      const finalTransitionSteps = 25

      for (let step = 0; step <= finalTransitionSteps; step++) {
        timeouts.push(setTimeout(() => {
          const progress = step / finalTransitionSteps
          const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2

          setAnimationState(prev => ({
            ...prev,
            cameraX: lastCol.centerX + (finalCenterX - lastCol.centerX) * eased,
            cameraY: lastCol.centerY + (finalCenterY - lastCol.centerY) * eased,
            cameraZoom: lastCol.zoom + (finalZoom - lastCol.zoom) * eased
          }))
        }, scrollTime + (step * 800 / finalTransitionSteps)))
      }

      scrollTime += 800 + 1000 // Transition + pauza na końcu

      timeouts.push(setTimeout(() => {
        onAnimationEnd?.()
      }, scrollTime))
    }

    return () => {
      timeouts.forEach(t => clearTimeout(t))
      intervals.forEach(i => clearInterval(i))
    }
  }, [isPlaying, workflow, speedConfig, onAnimationEnd, canvasSize, isVertical, nodeWidth, nodeHeight])

  if (!workflow) return null

  const stageScale = containerSize.width / canvasSize.width

  // Oblicz transformację kamery
  const cameraScale = animationState.cameraZoom
  const cameraOffsetX = canvasSize.width / 2 - animationState.cameraX * cameraScale
  const cameraOffsetY = canvasSize.height / 2 - animationState.cameraY * cameraScale

  return (
    <div ref={containerRef} style={{ padding: '20px' }}>
      <Stage
        width={containerSize.width}
        height={containerSize.height}
        scaleX={stageScale}
        scaleY={stageScale}
      >
        <Layer>
          {/* Tło */}
          <Rect
            x={0}
            y={0}
            width={canvasSize.width}
            height={canvasSize.height}
            fill={N8N_COLORS.background}
          />

          {/* Grid kropkowany */}
          <DottedGrid
            width={canvasSize.width}
            height={canvasSize.height}
            spacing={25}
            dotSize={1.5}
            color={N8N_COLORS.gridDot}
          />

          {/* Content z kamerą */}
          <Group
            x={cameraOffsetX}
            y={cameraOffsetY}
            scaleX={cameraScale}
            scaleY={cameraScale}
          >
            {/* Edges */}
            {workflow.edges.map(edge => {
              const edgeKey = edge.source + '->' + edge.target
              const isVisible = animationState.visibleEdges.includes(edgeKey)
              const progress = animationState.edgeProgress[edgeKey] || 0

              if (!isVisible && progress === 0) return null

              return (
                <EdgeLine
                  key={edgeKey}
                  edge={edge}
                  progress={isVisible ? 1 : progress}
                  nodes={workflow.nodes}
                  nodeWidth={nodeWidth}
                  nodeHeight={nodeHeight}
                />
              )
            })}

            {/* Nodes */}
            {workflow.nodes.map(node => {
              const isVisible = animationState.visibleNodes.includes(node.name)
              const isActive = animationState.activeNode === node.name

              if (!isVisible) return null

              return (
                <WorkflowNode
                  key={node.id}
                  node={node}
                  isActive={isActive}
                  nodeWidth={nodeWidth}
                  nodeHeight={nodeHeight}
                />
              )
            })}
          </Group>
        </Layer>
      </Stage>
    </div>
  )
}

// Komponent node'a w stylu n8n
function WorkflowNode({ node, isActive, nodeWidth, nodeHeight }) {
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    if (!isActive) {
      setPulse(0)
      return
    }

    let frame = 0
    const interval = setInterval(() => {
      frame = (frame + 1) % 60
      setPulse(Math.sin(frame / 10) * 0.5 + 0.5)
    }, 16)

    return () => clearInterval(interval)
  }, [isActive])

  const glowRadius = isActive ? 15 + pulse * 10 : 0
  const iconPath = getIconPath(node.type)

  return (
    <Group x={node.x} y={node.y}>
      {/* Glow effect */}
      {isActive && (
        <Rect
          x={-glowRadius}
          y={-glowRadius}
          width={nodeWidth + glowRadius * 2}
          height={nodeHeight + glowRadius * 2}
          fill={node.color}
          opacity={0.2 + pulse * 0.15}
          cornerRadius={16 + glowRadius}
          shadowColor={node.color}
          shadowBlur={30}
          shadowOpacity={0.7}
        />
      )}

      {/* Cień */}
      <Rect
        x={3}
        y={5}
        width={nodeWidth}
        height={nodeHeight}
        fill="#000"
        opacity={0.3}
        cornerRadius={10}
      />

      {/* Tło node'a */}
      <Rect
        x={0}
        y={0}
        width={nodeWidth}
        height={nodeHeight}
        fill={N8N_COLORS.nodeBg}
        stroke={isActive ? node.color : N8N_COLORS.nodeBorder}
        strokeWidth={isActive ? 3 : 1.5}
        cornerRadius={10}
      />

      {/* Kolorowy pasek po lewej */}
      <Rect
        x={0}
        y={0}
        width={5}
        height={nodeHeight}
        fill={node.color}
        cornerRadius={[10, 0, 0, 10]}
      />

      {/* Tło ikony */}
      <Rect
        x={14}
        y={(nodeHeight - 38) / 2}
        width={38}
        height={38}
        fill={node.color}
        cornerRadius={8}
      />

      {/* Ikona */}
      <Path
        x={14 + 7}
        y={(nodeHeight - 38) / 2 + 7}
        data={iconPath}
        fill="white"
        scaleX={1}
        scaleY={1}
      />

      {/* Nazwa node'a - jedna linia z ... */}
      <Text
        x={66}
        y={nodeHeight / 2 - 12}
        text={truncateText(node.name, 20)}
        fontSize={14}
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontStyle="600"
        fill={N8N_COLORS.nodeText}
        wrap="none"
        ellipsis={true}
      />

      {/* Typ node'a */}
      <Text
        x={66}
        y={nodeHeight / 2 + 6}
        text={node.shortType}
        fontSize={11}
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fill={N8N_COLORS.nodeSubtext}
        wrap="none"
      />

      {/* Port wejściowy */}
      {!node.isTrigger && (
        <>
          <Circle
            x={0}
            y={nodeHeight / 2}
            radius={8}
            fill={N8N_COLORS.nodeBg}
            stroke={N8N_COLORS.nodeBorder}
            strokeWidth={2}
          />
          <Circle
            x={0}
            y={nodeHeight / 2}
            radius={4}
            fill={N8N_COLORS.nodeSubtext}
          />
        </>
      )}

      {/* Port wyjściowy */}
      <Circle
        x={nodeWidth}
        y={nodeHeight / 2}
        radius={8}
        fill={N8N_COLORS.nodeBg}
        stroke={N8N_COLORS.nodeBorder}
        strokeWidth={2}
      />
      <Circle
        x={nodeWidth}
        y={nodeHeight / 2}
        radius={4}
        fill={N8N_COLORS.nodeSubtext}
      />
    </Group>
  )
}

// Komponent edge'a (strzałki)
function EdgeLine({ edge, progress, nodes, nodeWidth, nodeHeight }) {
  const sourceNode = nodes.find(n => n.name === edge.source)
  const targetNode = nodes.find(n => n.name === edge.target)

  if (!sourceNode || !targetNode) return null

  // Punkty start i end
  const startX = sourceNode.x + nodeWidth
  const startY = sourceNode.y + nodeHeight / 2
  const endX = targetNode.x
  const endY = targetNode.y + nodeHeight / 2

  // Krzywa Beziera
  const controlOffset = Math.min(Math.abs(endX - startX) / 2, 120)
  const points = [
    startX, startY,
    startX + controlOffset, startY,
    endX - controlOffset, endY,
    endX, endY
  ]

  // Oblicz częściową linię dla animacji
  const partialPoints = progress < 1 ? getPartialBezierPoints(points, progress) : points

  return (
    <Group>
      {/* Linia */}
      <Line
        points={partialPoints}
        stroke={progress < 1 ? N8N_COLORS.edgeActive : N8N_COLORS.edge}
        strokeWidth={3}
        bezier={true}
        lineCap="round"
        opacity={progress < 1 ? 1 : 0.7}
        shadowColor={progress < 1 ? N8N_COLORS.edgeActive : 'transparent'}
        shadowBlur={progress < 1 ? 8 : 0}
      />

      {/* Grot strzałki */}
      {progress >= 0.95 && (
        <Arrow x={endX} y={endY} color={N8N_COLORS.edge} />
      )}

      {/* Animowany punkt na linii */}
      {progress > 0 && progress < 1 && (
        <>
          <Circle
            x={partialPoints[partialPoints.length - 2]}
            y={partialPoints[partialPoints.length - 1]}
            radius={7}
            fill={N8N_COLORS.edgeActive}
            shadowColor={N8N_COLORS.edgeActive}
            shadowBlur={15}
            shadowOpacity={0.9}
          />
          <Circle
            x={partialPoints[partialPoints.length - 2]}
            y={partialPoints[partialPoints.length - 1]}
            radius={3}
            fill="#fff"
          />
        </>
      )}
    </Group>
  )
}

// Grot strzałki
function Arrow({ x, y, color }) {
  const size = 10
  return (
    <Line
      points={[
        x - size, y - size / 2,
        x, y,
        x - size, y + size / 2
      ]}
      stroke={color}
      strokeWidth={3}
      lineCap="round"
      lineJoin="round"
    />
  )
}

// Funkcja do częściowej krzywej Beziera
function getPartialBezierPoints(points, t) {
  if (t >= 1) return points

  const [x0, y0, x1, y1, x2, y2, x3, y3] = points
  const lerp = (a, b, t) => a + (b - a) * t

  const x01 = lerp(x0, x1, t)
  const y01 = lerp(y0, y1, t)
  const x12 = lerp(x1, x2, t)
  const y12 = lerp(y1, y2, t)
  const x23 = lerp(x2, x3, t)
  const y23 = lerp(y2, y3, t)

  const x012 = lerp(x01, x12, t)
  const y012 = lerp(y01, y12, t)
  const x123 = lerp(x12, x23, t)
  const y123 = lerp(y12, y23, t)

  const x0123 = lerp(x012, x123, t)
  const y0123 = lerp(y012, y123, t)

  return [x0, y0, x01, y01, x012, y012, x0123, y0123]
}

export default Preview
