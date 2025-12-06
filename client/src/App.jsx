import React, { useState, useCallback } from 'react'
import WorkflowInput from './components/WorkflowInput.jsx'
import Settings from './components/Settings.jsx'
import NarrationPanel from './components/NarrationPanel.jsx'

const styles = {
  container: {
    minHeight: '100vh',
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#ff6b6b',
    marginBottom: '8px'
  },
  subtitle: {
    color: '#888',
    fontSize: '1rem'
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    gap: '20px',
    minHeight: '600px'
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  previewArea: {
    background: '#16213e',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  exportButton: {
    width: '100%',
    padding: '16px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #ff6b6b, #ee5a5a)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  exportButtonDisabled: {
    background: '#444',
    cursor: 'not-allowed'
  },
  progressBar: {
    width: '100%',
    height: '8px',
    background: '#333',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '10px'
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #ff6b6b, #feca57)',
    transition: 'width 0.3s'
  }
}

function App() {
  const [workflow, setWorkflow] = useState(null)
  const [settings, setSettings] = useState({
    aspectRatio: '16:9',
    speed: 'normal',
    animationMode: 'narrated'
  })
  const [isExporting, setIsExporting] = useState(false)
  const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [narration, setNarration] = useState(null)
  const [audioSegments, setAudioSegments] = useState(null)

  const handleGenerateWorkflow = useCallback(async (description) => {
    setIsGeneratingWorkflow(true)

    try {
      const replicateApiKey = localStorage.getItem('replicateApiKey')
      if (!replicateApiKey) {
        alert('Podaj Replicate API Key w panelu narracji')
        return
      }

      const response = await fetch('/api/generate-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          replicateApiToken: replicateApiKey
        })
      })

      const data = await response.json()

      if (data.success) {
        setWorkflow(data.workflow)
      } else {
        alert('Błąd generowania workflow: ' + data.error)
      }
    } catch (err) {
      alert('Błąd: ' + err.message)
    } finally {
      setIsGeneratingWorkflow(false)
    }
  }, [])

  const handleSettingsChange = useCallback((newSettings) => {
    setSettings(newSettings)
    if (workflow) {
      // Re-parse z nowym aspect ratio
      setWorkflow(prev => ({
        ...prev,
        aspectRatio: newSettings.aspectRatio
      }))
    }
  }, [workflow])

  const handleExportWithAudio = async () => {
    if (!workflow || !audioSegments) return

    setIsExporting(true)
    setExportProgress(0)

    try {
      // Wybierz endpoint w zależności od trybu animacji
      const endpoint = settings.animationMode === 'narrated'
        ? '/api/export-narrated'
        : '/api/export-with-audio'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow,
          settings,
          audioSegments
        })
      })

      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const suffix = settings.animationMode === 'narrated' ? '-narrated' : '-animation-with-audio'
      a.download = `${workflow.name || 'workflow'}${suffix}.mp4`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Błąd eksportu: ' + err.message)
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>N8N Workflow Animator</h1>
        <p style={styles.subtitle}>Opisz workflow tekstem i wygeneruj animowane wideo</p>
      </header>

      <div style={styles.mainGrid}>
        <div style={styles.sidebar}>
          <WorkflowInput
            onGenerate={handleGenerateWorkflow}
            isGenerating={isGeneratingWorkflow}
          />

          <Settings
            settings={settings}
            onChange={handleSettingsChange}
            disabled={!workflow || isGeneratingWorkflow}
          />

          <NarrationPanel
            workflow={workflow}
            settings={settings}
            disabled={!workflow}
            onNarrationGenerated={setNarration}
            onAudioGenerated={setAudioSegments}
          />

          {audioSegments && (
            <button
              style={{
                ...styles.exportButton,
                marginTop: '10px',
                background: settings.animationMode === 'narrated'
                  ? 'linear-gradient(135deg, #9b59b6, #8e44ad)'
                  : 'linear-gradient(135deg, #3498db, #2980b9)',
                ...(isExporting ? styles.exportButtonDisabled : {})
              }}
              onClick={handleExportWithAudio}
              disabled={isExporting}
            >
              {isExporting
                ? 'Eksportowanie...'
                : settings.animationMode === 'narrated'
                  ? 'Generuj MP4 z narracja (sync)'
                  : 'Generuj MP4 z audio (klasyczny)'}
            </button>
          )}

          {isExporting && (
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${exportProgress}%`
                }}
              />
            </div>
          )}

          {workflow && (
            <div style={{ color: '#888', fontSize: '0.9rem' }}>
              Workflow: <strong>{workflow.name}</strong><br/>
              Nodes: <strong>{workflow.nodes.length}</strong>
            </div>
          )}
        </div>

        <div style={styles.previewArea}>
          {workflow ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🎬</div>
              <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>
                Workflow wygenerowany: <strong style={{ color: '#fff' }}>{workflow.name}</strong>
              </div>
              <div style={{ fontSize: '0.9rem' }}>
                Nodes: {workflow.nodes.length} • Edges: {workflow.edges.length}
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '20px', color: '#666' }}>
                Wygeneruj narrację i wyeksportuj do MP4 z lewego panelu
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📝</div>
              <div style={{ fontSize: '1rem' }}>
                Opisz workflow w lewym panelu i wygeneruj
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
