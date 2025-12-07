import React, { useState, useEffect } from 'react'

const styles = {
  container: {
    background: '#16213e',
    borderRadius: '12px',
    padding: '20px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer'
  },
  title: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  icon: {
    color: '#888'
  },
  arrow: {
    color: '#888',
    transition: 'transform 0.2s'
  },
  arrowOpen: {
    transform: 'rotate(180deg)'
  },
  content: {
    marginTop: '16px'
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
  inputFocused: {
    borderColor: '#feca57'
  },
  hint: {
    fontSize: '0.75rem',
    color: '#666',
    marginTop: '4px'
  },
  usageInfo: {
    fontSize: '0.75rem',
    color: '#4ecdc4',
    marginTop: '4px'
  },
  saveButton: {
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(135deg, #4ecdc4, #44a08d)',
    color: '#fff',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    marginTop: '8px'
  },
  savedMessage: {
    textAlign: 'center',
    color: '#4ecdc4',
    fontSize: '0.85rem',
    marginTop: '8px'
  }
}

function ApiKeys() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [replicateApiKey, setReplicateApiKey] = useState(() => localStorage.getItem('replicateApiKey') || '')
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(() => localStorage.getItem('elevenLabsApiKey') || '')
  const [voiceId, setVoiceId] = useState(() => localStorage.getItem('voiceId') || '3gtL0ar0RJdNhYpZ7pNZ')
  const [saved, setSaved] = useState(false)
  const [usage, setUsage] = useState(null)

  // Sprawdź usage ElevenLabs
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

  const handleSave = () => {
    localStorage.setItem('replicateApiKey', replicateApiKey)
    localStorage.setItem('elevenLabsApiKey', elevenLabsApiKey)
    localStorage.setItem('voiceId', voiceId)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    checkUsage()
  }

  // Automatyczny zapis przy zmianie
  useEffect(() => {
    localStorage.setItem('replicateApiKey', replicateApiKey)
  }, [replicateApiKey])

  useEffect(() => {
    localStorage.setItem('elevenLabsApiKey', elevenLabsApiKey)
  }, [elevenLabsApiKey])

  useEffect(() => {
    localStorage.setItem('voiceId', voiceId)
  }, [voiceId])

  const hasKeys = replicateApiKey || elevenLabsApiKey

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <h3 style={styles.title}>
          <span style={styles.icon}>🔑</span>
          Klucze API
          {hasKeys && !isExpanded && <span style={{ color: '#4ecdc4', fontSize: '0.8rem' }}> (skonfigurowane)</span>}
        </h3>
        <span style={{
          ...styles.arrow,
          ...(isExpanded ? styles.arrowOpen : {})
        }}>
          ▼
        </span>
      </div>

      {isExpanded && (
        <div style={styles.content}>
          <div style={styles.group}>
            <label style={styles.label}>Replicate API Key (Claude AI)</label>
            <input
              type="password"
              style={styles.input}
              value={replicateApiKey}
              onChange={(e) => setReplicateApiKey(e.target.value)}
              placeholder="r8_..."
            />
            <div style={styles.hint}>Do generowania workflow i narracji przez AI</div>
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
            <div style={styles.hint}>Do generowania audio voice-over</div>
          </div>

          <div style={styles.group}>
            <label style={styles.label}>Voice ID (ElevenLabs)</label>
            <input
              type="text"
              style={styles.input}
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              placeholder="Voice ID"
            />
            <div style={styles.hint}>ID głosu z ElevenLabs (domyślnie: polski głos)</div>
          </div>

          <button style={styles.saveButton} onClick={handleSave}>
            Zapisz klucze
          </button>

          {saved && (
            <div style={styles.savedMessage}>
              ✓ Zapisano
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ApiKeys
