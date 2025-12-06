import React, { useState, useEffect } from 'react'

const styles = {
  container: {
    background: '#16213e',
    borderRadius: '12px',
    padding: '20px'
  },
  title: {
    fontSize: '1rem',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  aiIcon: {
    color: '#feca57'
  },
  group: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    color: '#888',
    fontSize: '0.85rem',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: '#0f0f23',
    border: '2px solid #333',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box'
  },
  button: {
    width: '100%',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #feca57, #f39c12)',
    color: '#1a1a2e',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '0.95rem',
    marginBottom: '10px'
  },
  buttonDisabled: {
    background: '#444',
    color: '#888',
    cursor: 'not-allowed'
  },
  buttonSecondary: {
    background: 'linear-gradient(135deg, #9b59b6, #8e44ad)'
  },
  textPreview: {
    background: '#0f0f23',
    borderRadius: '8px',
    padding: '12px',
    maxHeight: '200px',
    overflowY: 'auto',
    fontSize: '0.85rem',
    lineHeight: '1.5',
    color: '#ccc'
  },
  nodeNarration: {
    marginBottom: '8px',
    paddingBottom: '8px',
    borderBottom: '1px solid #333'
  },
  nodeName: {
    color: '#ff6b6b',
    fontWeight: 'bold'
  },
  nodeNamePL: {
    color: '#feca57',
    fontSize: '0.8rem'
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer'
  },
  toggleSwitch: {
    width: '44px',
    height: '24px',
    background: '#333',
    borderRadius: '12px',
    position: 'relative',
    transition: 'background 0.2s'
  },
  toggleSwitchActive: {
    background: '#4ecdc4'
  },
  toggleKnob: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '20px',
    height: '20px',
    background: '#fff',
    borderRadius: '50%',
    transition: 'transform 0.2s'
  },
  toggleKnobActive: {
    transform: 'translateX(20px)'
  },
  status: {
    fontSize: '0.8rem',
    color: '#888',
    marginTop: '8px'
  },
  statusSuccess: {
    color: '#4ecdc4'
  },
  statusError: {
    color: '#ff6b6b'
  },
  usageInfo: {
    fontSize: '0.75rem',
    color: '#666',
    marginTop: '4px'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    background: '#0f0f23',
    border: '2px solid #333',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '80px',
    fontFamily: 'inherit',
    lineHeight: '1.4'
  },
  styleButtonGroup: {
    display: 'flex',
    gap: '6px',
    marginBottom: '12px'
  },
  styleButton: {
    flex: 1,
    padding: '8px 10px',
    border: '2px solid #333',
    background: 'transparent',
    color: '#888',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '0.8rem'
  },
  styleButtonActive: {
    borderColor: '#feca57',
    color: '#feca57',
    background: 'rgba(254, 202, 87, 0.1)'
  },
  collapsible: {
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  arrow: {
    transition: 'transform 0.2s'
  },
  arrowOpen: {
    transform: 'rotate(180deg)'
  }
}

function NarrationPanel({ workflow, settings, onNarrationGenerated, onAudioGenerated, disabled }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [replicateApiKey, setReplicateApiKey] = useState(() => localStorage.getItem('replicateApiKey') || '')
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(() => localStorage.getItem('elevenLabsApiKey') || '')
  const [voiceId, setVoiceId] = useState(() => localStorage.getItem('voiceId') || '3gtL0ar0RJdNhYpZ7pNZ')
  const [workflowContext, setWorkflowContext] = useState(() => localStorage.getItem('workflowContext') || '')
  const [narration, setNarration] = useState(null)
  const [audioSegments, setAudioSegments] = useState(null)
  const [isGeneratingNarration, setIsGeneratingNarration] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('') // '', 'success', 'error'
  const [showSubtitles, setShowSubtitles] = useState(true)
  const [usage, setUsage] = useState(null)

  // Zapisz klucze do localStorage
  useEffect(() => {
    localStorage.setItem('replicateApiKey', replicateApiKey)
  }, [replicateApiKey])

  useEffect(() => {
    localStorage.setItem('elevenLabsApiKey', elevenLabsApiKey)
  }, [elevenLabsApiKey])

  useEffect(() => {
    localStorage.setItem('voiceId', voiceId)
  }, [voiceId])

  useEffect(() => {
    localStorage.setItem('workflowContext', workflowContext)
  }, [workflowContext])

  // Sprawdź limit ElevenLabs po załadowaniu klucza
  useEffect(() => {
    if (elevenLabsApiKey && elevenLabsApiKey.length > 10) {
      checkUsage()
    }
  }, [elevenLabsApiKey])

  const checkUsage = async () => {
    try {
      const response = await fetch('/api/elevenlabs/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: elevenLabsApiKey })
      })
      const data = await response.json()
      if (data.success) {
        setUsage(data)
      }
    } catch (err) {
      console.error('Usage check failed:', err)
    }
  }

  const handleGenerateNarration = async () => {
    if (!workflow || !replicateApiKey) return

    setIsGeneratingNarration(true)
    setStatus('Generowanie narracji przez AI...')
    setStatusType('')

    try {
      const response = await fetch('/api/generate-narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow,
          replicateApiToken: replicateApiKey,
          context: workflowContext
        })
      })

      const data = await response.json()

      if (data.success) {
        setNarration(data.narration)
        setStatus('Narracja wygenerowana!')
        setStatusType('success')
        onNarrationGenerated?.(data.narration)
      } else {
        setStatus(`Błąd: ${data.error}`)
        setStatusType('error')
      }
    } catch (err) {
      setStatus(`Błąd: ${err.message}`)
      setStatusType('error')
    } finally {
      setIsGeneratingNarration(false)
    }
  }

  const handleGenerateAudio = async () => {
    if (!narration || !elevenLabsApiKey || !voiceId) return

    setIsGeneratingAudio(true)
    setStatus('Generowanie audio ElevenLabs...')
    setStatusType('')

    try {
      const response = await fetch('/api/generate-segmented-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narration,
          workflow,
          settings,
          elevenLabsApiKey,
          voiceId
        })
      })

      const data = await response.json()

      if (data.success) {
        // KRYTYCZNE: Przekaż cały obiekt data (ze ssmlUsed flag), nie tylko segments!
        // To pozwoli exportowi użyć SSML rendering z 3D animacjami i persistent popups
        setAudioSegments(data)

        const segmentCount = data.segments?.length || 1
        const audioType = data.ssmlUsed ? 'SSML z pauzami' : `${segmentCount} segmentów`
        setStatus(`Audio wygenerowane! (${audioType})`)
        setStatusType('success')
        onAudioGenerated?.(data) // Przekaż cały obiekt, nie tylko segments
        checkUsage() // Odśwież limit
      } else {
        setStatus(`Błąd: ${data.error}`)
        setStatusType('error')
      }
    } catch (err) {
      setStatus(`Błąd: ${err.message}`)
      setStatusType('error')
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  return (
    <div style={{
      ...styles.container,
      ...(disabled ? { opacity: 0.6 } : {})
    }}>
      <div
        style={styles.collapsible}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 style={styles.title}>
          <span style={styles.aiIcon}>AI</span> Narracja
        </h3>
        <span style={{
          ...styles.arrow,
          ...(isExpanded ? styles.arrowOpen : {})
        }}>
          ▼
        </span>
      </div>

      {isExpanded && (
        <>
          {/* API Keys */}
          <div style={styles.group}>
            <label style={styles.label}>Replicate API Key (Claude)</label>
            <input
              type="password"
              style={styles.input}
              value={replicateApiKey}
              onChange={(e) => setReplicateApiKey(e.target.value)}
              placeholder="r8_..."
            />
          </div>

          <div style={styles.group}>
            <label style={styles.label}>ElevenLabs API Key</label>
            <input
              type="password"
              style={styles.input}
              value={elevenLabsApiKey}
              onChange={(e) => setElevenLabsApiKey(e.target.value)}
              placeholder="sk_..."
            />
            {usage && (
              <div style={styles.usageInfo}>
                Znaki: {usage.characterCount?.toLocaleString()} / {usage.characterLimit?.toLocaleString()}
                ({usage.remaining?.toLocaleString()} pozostało)
              </div>
            )}
          </div>

          <div style={styles.group}>
            <label style={styles.label}>Voice ID</label>
            <input
              type="text"
              style={styles.input}
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="Voice ID"
            />
          </div>

          {/* Kontekst workflow */}
          <div style={styles.group}>
            <label style={styles.label}>Opis workflow (kontekst dla AI)</label>
            <textarea
              style={styles.textarea}
              value={workflowContext}
              onChange={(e) => setWorkflowContext(e.target.value)}
              placeholder="Opisz co robi ten workflow, dla kogo jest, jakie problemy rozwiązuje, jak się konfiguruje itp. AI wykorzysta te informacje do stworzenia lepszej narracji."
              rows={4}
            />
          </div>

          {/* Generate narration button */}
          <button
            style={{
              ...styles.button,
              ...(disabled || isGeneratingNarration || !replicateApiKey ? styles.buttonDisabled : {})
            }}
            onClick={handleGenerateNarration}
            disabled={disabled || isGeneratingNarration || !replicateApiKey}
          >
            {isGeneratingNarration ? 'Generowanie...' : 'Generuj narrację (Claude)'}
          </button>

          {/* Narration preview */}
          {narration && (
            <div style={styles.group}>
              <label style={styles.label}>Podgląd narracji</label>
              <div style={styles.textPreview}>
                <div style={styles.nodeNarration}>
                  <em>{narration.intro}</em>
                </div>
                {narration.nodes?.map((node, i) => (
                  <div key={i} style={styles.nodeNarration}>
                    <span style={styles.nodeName}>{node.name}</span>
                    {node.namePL && (
                      <span style={styles.nodeNamePL}> ({node.namePL})</span>
                    )}
                    <br/>
                    {node.narration}
                  </div>
                ))}
                <div style={{ marginTop: '8px', fontStyle: 'italic' }}>
                  {narration.outro}
                </div>
              </div>
            </div>
          )}

          {/* Generate audio button */}
          {narration && (
            <button
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
                ...(disabled || isGeneratingAudio || !elevenLabsApiKey ? styles.buttonDisabled : {})
              }}
              onClick={handleGenerateAudio}
              disabled={disabled || isGeneratingAudio || !elevenLabsApiKey}
            >
              {isGeneratingAudio ? 'Generowanie audio...' : 'Generuj audio (ElevenLabs)'}
            </button>
          )}

          {/* Subtitles toggle */}
          {audioSegments && (
            <div style={styles.group}>
              <div
                style={styles.toggle}
                onClick={() => setShowSubtitles(!showSubtitles)}
              >
                <div style={{
                  ...styles.toggleSwitch,
                  ...(showSubtitles ? styles.toggleSwitchActive : {})
                }}>
                  <div style={{
                    ...styles.toggleKnob,
                    ...(showSubtitles ? styles.toggleKnobActive : {})
                  }} />
                </div>
                <span style={styles.label}>Napisy w wideo</span>
              </div>
            </div>
          )}

          {/* Status */}
          {status && (
            <div style={{
              ...styles.status,
              ...(statusType === 'success' ? styles.statusSuccess : {}),
              ...(statusType === 'error' ? styles.statusError : {})
            }}>
              {status}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default NarrationPanel
