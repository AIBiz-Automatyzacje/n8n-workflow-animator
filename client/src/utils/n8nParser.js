// Kolory dla różnych typów nodes
const NODE_COLORS = {
  // Triggers
  'manualTrigger': '#00b050',
  'webhook': '#00b050',
  'schedule': '#00b050',
  'trigger': '#00b050',

  // HTTP
  'httpRequest': '#0066cc',
  'http': '#0066cc',

  // Code
  'code': '#ff6d00',
  'function': '#ff6d00',
  'functionItem': '#ff6d00',

  // Logic
  'if': '#7c3aed',
  'switch': '#7c3aed',
  'splitInBatches': '#7c3aed',
  'merge': '#6b7280',
  'set': '#6b7280',

  // Databases
  'airtable': '#fcbf24',
  'postgres': '#336791',
  'mysql': '#4479a1',
  'mongodb': '#47a248',

  // AI/LangChain
  'chainLlm': '#ff6bb3',
  'lmChatOpenAi': '#10a37f',
  'lmChatGoogleGemini': '#4285f4',
  'outputParserStructured': '#ff6bb3',

  // Communication
  'slack': '#4a154b',
  'discord': '#5865f2',
  'telegram': '#0088cc',
  'gmail': '#ea4335',

  // Default
  'default': '#6b7280'
}

// Wyciągnij typ node'a z pełnej nazwy
function getNodeType(fullType) {
  // np. "n8n-nodes-base.airtable" -> "airtable"
  // lub "@n8n/n8n-nodes-langchain.chainLlm" -> "chainLlm"
  const parts = fullType.split('.')
  return parts[parts.length - 1]
}

// Pobierz kolor dla node'a
function getNodeColor(fullType) {
  const type = getNodeType(fullType)

  // Szukaj dokładnego dopasowania
  if (NODE_COLORS[type]) {
    return NODE_COLORS[type]
  }

  // Szukaj częściowego dopasowania
  for (const [key, color] of Object.entries(NODE_COLORS)) {
    if (type.toLowerCase().includes(key.toLowerCase())) {
      return color
    }
  }

  return NODE_COLORS.default
}

// Sprawdź czy to trigger
function isTrigger(fullType) {
  const type = getNodeType(fullType).toLowerCase()
  return type.includes('trigger') || type.includes('webhook') || type.includes('schedule')
}

// Parsuj workflow i oblicz layout
export function parseN8nWorkflow(json, aspectRatio = '16:9') {
  const { name, nodes: rawNodes, connections } = json

  // Mapuj nodes
  const nodesMap = new Map()
  const nodes = rawNodes.map(node => {
    const parsed = {
      id: node.id,
      name: node.name,
      type: node.type,
      shortType: getNodeType(node.type),
      color: getNodeColor(node.type),
      isTrigger: isTrigger(node.type),
      originalPosition: node.position
    }
    nodesMap.set(node.name, parsed)
    return parsed
  })

  // Parsuj connections
  const edges = []
  for (const [sourceName, outputs] of Object.entries(connections)) {
    for (const outputType of Object.keys(outputs)) {
      for (const outputIndex of outputs[outputType]) {
        for (const target of outputIndex) {
          edges.push({
            source: sourceName,
            target: target.node,
            type: target.type
          })
        }
      }
    }
  }

  // Oblicz layout z Dagre
  const layout = calculateLayout(nodes, edges, aspectRatio)

  // Oblicz kolejność animacji (BFS od triggerów)
  const animationOrder = calculateAnimationOrder(nodes, edges)

  return {
    name,
    nodes: layout.nodes,
    edges: layout.edges,
    animationOrder,
    bounds: layout.bounds,
    aspectRatio
  }
}

// Oblicz layout - PROSTA LINIA POZIOMA
function calculateLayout(nodes, edges, aspectRatio) {
  const isVertical = aspectRatio === '9:16'

  // Rozmiary nodes
  const nodeWidth = 180
  const nodeHeight = 60
  const nodeSpacing = 100 // odstep miedzy nodes

  // Oblicz kolejnosc nodes (BFS od triggerow)
  const order = calculateAnimationOrder(nodes, edges)

  // Uklad w jednej linii poziomej
  const layoutNodes = []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  // Srodkowa linia Y
  const centerY = 200

  order.forEach((nodeName, index) => {
    const node = nodes.find(n => n.name === nodeName)
    if (!node) return

    // Pozycja X - kolejne nodes w JEDNEJ LINII PROSTEJ
    const x = 100 + index * (nodeWidth + nodeSpacing)
    const y = centerY // ZAWSZE ta sama wysokosc!

    console.log(`[Layout] Node ${index}: "${nodeName}" at x=${x}, y=${y}`)

    layoutNodes.push({
      ...node,
      x: x,
      y: y,
      width: nodeWidth,
      height: nodeHeight
    })

    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + nodeWidth)
    maxY = Math.max(maxY, y + nodeHeight)
  })

  // Wygeneruj edges jako proste linie poziome
  const layoutEdges = []
  const nodePositionMap = new Map(layoutNodes.map(n => [n.name, n]))

  edges.forEach(edge => {
    const sourceNode = nodePositionMap.get(edge.source)
    const targetNode = nodePositionMap.get(edge.target)

    if (sourceNode && targetNode) {
      // Prosta linia od prawej strony source do lewej strony target
      const sourceX = sourceNode.x + nodeWidth
      const sourceY = sourceNode.y + nodeHeight / 2
      const targetX = targetNode.x
      const targetY = targetNode.y + nodeHeight / 2

      layoutEdges.push({
        source: edge.source,
        target: edge.target,
        points: [
          { x: sourceX, y: sourceY },
          { x: targetX, y: targetY }
        ]
      })
    }
  })

  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }
}

// Oblicz kolejność animacji (BFS)
function calculateAnimationOrder(nodes, edges) {
  const order = []
  const visited = new Set()

  // Znajdź triggery (punkty startowe)
  const triggers = nodes.filter(n => n.isTrigger)
  const startNodes = triggers.length > 0 ? triggers : [nodes[0]]

  // Buduj mapę następników
  const successors = new Map()
  edges.forEach(edge => {
    if (!successors.has(edge.source)) {
      successors.set(edge.source, [])
    }
    successors.get(edge.source).push(edge.target)
  })

  // BFS
  const queue = startNodes.map(n => n.name)
  while (queue.length > 0) {
    const current = queue.shift()
    if (visited.has(current)) continue

    visited.add(current)
    order.push(current)

    const next = successors.get(current) || []
    next.forEach(n => {
      if (!visited.has(n)) {
        queue.push(n)
      }
    })
  }

  // Dodaj pozostałe nodes (nie połączone)
  nodes.forEach(n => {
    if (!visited.has(n.name)) {
      order.push(n.name)
    }
  })

  return order
}

export { NODE_COLORS, getNodeColor, getNodeType }
