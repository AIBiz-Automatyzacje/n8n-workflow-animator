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
  const [heygenApiKey, setHeygenApiKey] = useState(() => localStorage.getItem('heygenApiKey') || '')
  const [tunnelUrl, setTunnelUrl] = useState(() => localStorage.getItem('tunnelUrl') || '')
  // S3 config dla HeyGen (zalecane zamiast localtunnel)
  const [s3AccessKey, setS3AccessKey] = useState(() => localStorage.getItem('s3AccessKey') || '')
  const [s3SecretKey, setS3SecretKey] = useState(() => localStorage.getItem('s3SecretKey') || '')
  const [s3Region, setS3Region] = useState(() => localStorage.getItem('s3Region') || 'eu-central-1')
  const [s3Bucket, setS3Bucket] = useState(() => localStorage.getItem('s3Bucket') || '')
  const [workflowContext, setWorkflowContext] = useState(() => localStorage.getItem('workflowContext') || '')
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
    localStorage.setItem('heygenApiKey', heygenApiKey)
    localStorage.setItem('tunnelUrl', tunnelUrl)
    localStorage.setItem('s3AccessKey', s3AccessKey)
    localStorage.setItem('s3SecretKey', s3SecretKey)
    localStorage.setItem('s3Region', s3Region)
    localStorage.setItem('s3Bucket', s3Bucket)
    localStorage.setItem('workflowContext', workflowContext)
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

  useEffect(() => {
    localStorage.setItem('workflowContext', workflowContext)
  }, [workflowContext])

  useEffect(() => {
    localStorage.setItem('heygenApiKey', heygenApiKey)
  }, [heygenApiKey])

  useEffect(() => {
    localStorage.setItem('tunnelUrl', tunnelUrl)
  }, [tunnelUrl])

  useEffect(() => {
    localStorage.setItem('s3AccessKey', s3AccessKey)
  }, [s3AccessKey])

  useEffect(() => {
    localStorage.setItem('s3SecretKey', s3SecretKey)
  }, [s3SecretKey])

  useEffect(() => {
    localStorage.setItem('s3Region', s3Region)
  }, [s3Region])

  useEffect(() => {
    localStorage.setItem('s3Bucket', s3Bucket)
  }, [s3Bucket])

  const hasKeys = replicateApiKey || elevenLabsApiKey || heygenApiKey
  const hasS3Config = s3AccessKey && s3Bucket

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
            <div style={styles.hint}>Do generowania workflow i narracji</div>
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
            <div style={styles.hint}>ID głosu z ElevenLabs</div>
          </div>

          <div style={styles.group}>
            <label style={styles.label}>HeyGen API Key (Awatar AI)</label>
            <input
              type="password"
              style={styles.input}
              value={heygenApiKey}
              onChange={(e) => setHeygenApiKey(e.target.value)}
              placeholder="sk_..."
            />
            <div style={styles.hint}>Do generowania awatara AI "Kacper"</div>
          </div>

          {/* AWS S3 Config - ZALECANE dla HeyGen */}
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            background: '#1a1a3e',
            borderRadius: '8px',
            border: hasS3Config ? '1px solid #4ecdc4' : '1px solid #333'
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#4ecdc4', marginBottom: '12px' }}>
              AWS S3 (ZALECANE dla awatara)
            </div>

            <div style={styles.group}>
              <label style={styles.label}>S3 Access Key ID</label>
              <input
                type="password"
                style={styles.input}
                value={s3AccessKey}
                onChange={(e) => setS3AccessKey(e.target.value)}
                placeholder="AKIA..."
              />
            </div>

            <div style={styles.group}>
              <label style={styles.label}>S3 Secret Access Key</label>
              <input
                type="password"
                style={styles.input}
                value={s3SecretKey}
                onChange={(e) => setS3SecretKey(e.target.value)}
                placeholder="wJalr..."
              />
            </div>

            <div style={styles.group}>
              <label style={styles.label}>S3 Region</label>
              <input
                type="text"
                style={styles.input}
                value={s3Region}
                onChange={(e) => setS3Region(e.target.value)}
                placeholder="eu-central-1"
              />
            </div>

            <div style={styles.group}>
              <label style={styles.label}>S3 Bucket Name</label>
              <input
                type="text"
                style={styles.input}
                value={s3Bucket}
                onChange={(e) => setS3Bucket(e.target.value)}
                placeholder="my-audio-bucket"
              />
              <div style={styles.hint}>
                Bucket musi miec publiczny odczyt (ACL: public-read)
              </div>
            </div>
          </div>

          {/* Alternatywa: Localtunnel */}
          <div style={styles.group}>
            <label style={styles.label}>Tunnel URL (alternatywa dla S3)</label>
            <input
              type="text"
              style={styles.input}
              value={tunnelUrl}
              onChange={(e) => setTunnelUrl(e.target.value)}
              placeholder="https://xxxxx.loca.lt"
            />
            <div style={styles.hint}>
              Fallback jesli nie masz S3. Uruchom: npx localtunnel --port 3001
            </div>
          </div>

          <div style={styles.group}>
            <label style={styles.label}>Kontekst dla AI (opcjonalny)</label>
            <textarea
              style={{
                ...styles.input,
                minHeight: '80px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              value={workflowContext}
              onChange={(e) => setWorkflowContext(e.target.value)}
              placeholder="Dodatkowy kontekst dla AI przy generowaniu narracji (np. branża, grupa docelowa, styl)"
            />
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
