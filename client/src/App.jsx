import React, { useState, useCallback } from 'react'
import WorkflowInput from './components/WorkflowInput.jsx'
import Settings from './components/Settings.jsx'
import WorkflowSteps from './components/WorkflowSteps.jsx'
import NarrationEditor from './components/NarrationEditor.jsx'
import AudioPreview from './components/AudioPreview.jsx'
import ApiKeys from './components/ApiKeys.jsx'
import PromptsEditor from './components/PromptsEditor.jsx'

const styles = {
  container: {
    minHeight: '100vh',
    padding: '20px 40px',
    maxWidth: '1000px',
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
  section: {
    marginBottom: '24px'
  },
  card: {
    background: '#16213e',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  stepNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#ff6b6b',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    fontWeight: 'bold'
  },
  stepNumberDisabled: {
    background: '#444'
  },
  stepNumberCompleted: {
    background: '#4ecdc4'
  },
  button: {
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
  buttonDisabled: {
    background: '#444',
    cursor: 'not-allowed'
  },
  buttonSecondary: {
    background: 'linear-gradient(135deg, #9b59b6, #8e44ad)'
  },
  buttonTertiary: {
    background: 'linear-gradient(135deg, #3498db, #2980b9)'
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
  },
  status: {
    fontSize: '0.9rem',
    color: '#888',
    marginTop: '12px',
    textAlign: 'center'
  },
  statusSuccess: {
    color: '#4ecdc4'
  },
  statusError: {
    color: '#ff6b6b'
  }
}

function App() {
  // Stan główny
  const [workflow, setWorkflow] = useState(null)
  const [workflowSteps, setWorkflowSteps] = useState(null) // Edytowalne etapy workflow
  const [narration, setNarration] = useState(null)
  const [audioSegments, setAudioSegments] = useState(null)

  // Prompty (customowe z etapu 0)
  const [customPrompts, setCustomPrompts] = useState({
    workflowPrompt: localStorage.getItem('customWorkflowPrompt') || '',
    narrationPrompt: localStorage.getItem('customNarrationPrompt') || ''
  })

  // Input narracji (gotowy tekst do parsowania)
  const [narrationInput, setNarrationInput] = useState(() => localStorage.getItem('narrationInput') || '')

  // Stan UI
  const [settings, setSettings] = useState({
    aspectRatio: '16:9',
    speed: 'normal'
  })
  const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState(false)
  const [isGeneratingNarration, setIsGeneratingNarration] = useState(false)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isCombiningAvatar, setIsCombiningAvatar] = useState(false)
  const [generatedFiles, setGeneratedFiles] = useState(null) // { videoFileName, audioFileName }
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('')

  // Klucze API (z localStorage)
  const getApiKeys = () => ({
    replicateApiKey: localStorage.getItem('replicateApiKey') || '',
    elevenLabsApiKey: localStorage.getItem('elevenLabsApiKey') || '',
    voiceId: localStorage.getItem('voiceId') || '3gtL0ar0RJdNhYpZ7pNZ'
  })

  // KROK 1: Generowanie workflow
  const handleGenerateWorkflow = useCallback(async (description, context) => {
    const { replicateApiKey } = getApiKeys()
    if (!replicateApiKey) {
      setStatus('Podaj Replicate API Key w sekcji Klucze API')
      setStatusType('error')
      return
    }

    setIsGeneratingWorkflow(true)
    setStatus('Generowanie workflow...')
    setStatusType('')

    // Reset kolejnych kroków
    setWorkflowSteps(null)
    setNarration(null)
    setAudioSegments(null)

    try {
      const response = await fetch('/api/generate-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          context,
          replicateApiToken: replicateApiKey,
          customPrompt: customPrompts.workflowPrompt || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        setWorkflow(data.workflow)

        // Stwórz edytowalne etapy z wygenerowanego workflow (z danymi AI)
        const steps = data.workflow.nodes.map((node, index) => ({
          id: node.id || `node-${index}`,
          name: node.name,
          type: node.shortType || node.type,
          tileTitle: node.tileTitle || node.actionTitle || node.name,
          popupTitle: node.popupTitle || node.toolName || node.shortType || '',
          popupDescription: node.popupDescription || ''
        }))
        setWorkflowSteps(steps)

        setStatus('Workflow wygenerowany! Możesz edytować etapy.')
        setStatusType('success')
      } else {
        setStatus(`Błąd: ${data.error}`)
        setStatusType('error')
      }
    } catch (err) {
      setStatus(`Błąd: ${err.message}`)
      setStatusType('error')
    } finally {
      setIsGeneratingWorkflow(false)
    }
  }, [customPrompts.workflowPrompt])

  // KROK 2: Generowanie narracji
  const handleGenerateNarration = useCallback(async (context, inputText) => {
    const { replicateApiKey } = getApiKeys()
    if (!workflow) return

    // Jeśli jest gotowy input narracji, sparsuj go bez AI
    if (inputText && inputText.trim()) {
      setIsGeneratingNarration(true)
      setStatus('Parsowanie narracji...')
      setStatusType('')
      setAudioSegments(null)

      try {
        const response = await fetch('/api/parse-narration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow,
            workflowSteps,
            narrationInput: inputText
          })
        })

        const data = await response.json()

        if (data.success) {
          setNarration(data.narration)
          setStatus('Narracja sparsowana! Możesz edytować teksty.')
          setStatusType('success')
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
      return
    }

    // Brak inputu - generuj przez AI
    if (!replicateApiKey) {
      setStatus('Podaj Replicate API Key lub wklej gotową narrację')
      setStatusType('error')
      return
    }

    setIsGeneratingNarration(true)
    setStatus('Generowanie narracji AI...')
    setStatusType('')

    // Reset audio
    setAudioSegments(null)

    try {
      const response = await fetch('/api/generate-narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow,
          workflowSteps, // Przekaż edytowane etapy
          replicateApiToken: replicateApiKey,
          context,
          customPrompt: customPrompts.narrationPrompt || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        setNarration(data.narration)
        setStatus('Narracja wygenerowana! Możesz edytować teksty.')
        setStatusType('success')
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
  }, [workflow, workflowSteps, customPrompts.narrationPrompt])

  // KROK 3: Generowanie audio
  const handleGenerateAudio = useCallback(async (segmentIndex = null) => {
    const { elevenLabsApiKey, voiceId } = getApiKeys()
    if (!elevenLabsApiKey || !narration) return

    setIsGeneratingAudio(true)
    const isRegenerate = segmentIndex !== null
    setStatus(isRegenerate ? `Regenerowanie audio #${segmentIndex + 1}...` : 'Generowanie audio...')
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
          voiceId,
          regenerateIndex: segmentIndex
        })
      })

      const data = await response.json()

      if (data.success) {
        if (isRegenerate && audioSegments) {
          // Podmień tylko jeden segment
          const newSegments = { ...audioSegments }
          newSegments.segments[segmentIndex] = data.segments[0]
          setAudioSegments(newSegments)
        } else {
          setAudioSegments(data)
        }
        setStatus('Audio wygenerowane!')
        setStatusType('success')
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
  }, [narration, workflow, settings, audioSegments])

  // KROK 4: Generuj wideo + audio (oba naraz)
  const handleExport = async () => {
    if (!workflow || !audioSegments) return

    setIsExporting(true)
    setGeneratedFiles(null)
    setStatus('Generowanie wideo i audio...')
    setStatusType('')

    try {
      // Połącz workflow z edytowanymi danymi z workflowSteps
      // WAŻNE: NIE zmieniamy node.name bo jest używane wewnętrznie do linkowania!
      // Zamiast tego dodajemy displayName i displayShortType
      const enrichedWorkflow = {
        ...workflow,
        nodes: workflow.nodes.map((node, index) => {
          // Szukaj po indeksie (bardziej niezawodne) lub po ID
          const step = workflowSteps?.[index] || workflowSteps?.find(s => s.id === node.id || s.name === node.name)
          if (step) {
            return {
              ...node,
              // Zachowuj oryginalne name do wewnętrznego użytku
              // Dodaj displayName i shortType dla wyświetlania
              displayName: step.tileTitle && step.tileTitle.trim() ? step.tileTitle : node.name,
              shortType: step.tileSubtitle && step.tileSubtitle.trim() ? step.tileSubtitle : (step.type || node.shortType)
            }
          }
          return node
        })
      }

      const response = await fetch('/api/export-with-audio-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: enrichedWorkflow,
          settings,
          audioSegments
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Export failed')
      }

      // Zapisz info o plikach
      setGeneratedFiles({
        videoFileName: data.videoFileName,
        audioFileName: data.audioFileName
      })

      setStatus('Gotowe! Możesz pobrać wideo i/lub audio.')
      setStatusType('success')
    } catch (err) {
      setStatus(`Błąd eksportu: ${err.message}`)
      setStatusType('error')
    } finally {
      setIsExporting(false)
    }
  }

  // Pobierz wideo
  const handleDownloadVideo = () => {
    if (!generatedFiles?.videoFileName) return
    const a = document.createElement('a')
    a.href = `/api/download-video/${generatedFiles.videoFileName}`
    a.download = `${workflow.name || 'workflow'}-narrated.mp4`
    a.click()
  }

  // Pobierz audio
  const handleDownloadAudio = () => {
    if (!generatedFiles?.audioFileName) return
    const a = document.createElement('a')
    a.href = `/api/download-audio/${generatedFiles.audioFileName}`
    a.download = `${workflow.name || 'workflow'}-audio.mp3`
    a.click()
  }

  // Upload awatara i montaż
  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsCombiningAvatar(true)
    setStatus('Łączenie wideo z awatarem...')
    setStatusType('')

    try {
      const formData = new FormData()
      formData.append('avatarVideo', file)

      const response = await fetch('/api/combine-uploaded-avatar', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Combine failed')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${workflow.name || 'workflow'}-with-avatar.mp4`
      a.click()
      URL.revokeObjectURL(url)

      setStatus('Wideo z awatarem pobrane!')
      setStatusType('success')
    } catch (err) {
      setStatus(`Błąd: ${err.message}`)
      setStatusType('error')
    } finally {
      setIsCombiningAvatar(false)
    }
  }

  // Helpers
  const getStepStatus = (stepNum) => {
    if (stepNum === 0) return 'active' // Prompty - zawsze aktywne
    if (stepNum === 1) return workflow ? 'completed' : 'active'
    if (stepNum === 2) return narration ? 'completed' : workflow ? 'active' : 'disabled'
    if (stepNum === 3) return audioSegments ? 'completed' : narration ? 'active' : 'disabled'
    if (stepNum === 4) return audioSegments ? 'active' : 'disabled' // Eksport
    return 'disabled'
  }

  // Auto-save narration input
  const handleNarrationInputChange = (value) => {
    setNarrationInput(value)
    localStorage.setItem('narrationInput', value)
  }

  const getStepNumberStyle = (stepNum) => {
    const status = getStepStatus(stepNum)
    if (status === 'completed') return { ...styles.stepNumber, ...styles.stepNumberCompleted }
    if (status === 'disabled') return { ...styles.stepNumber, ...styles.stepNumberDisabled }
    return styles.stepNumber
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>N8N Workflow Animator</h1>
      </header>

      {/* KROK 0: Prompty */}
      <div style={styles.section}>
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>
            <span style={getStepNumberStyle(0)}>0</span>
            Prompty AI (opcjonalne)
          </h2>
          <PromptsEditor onPromptsChange={setCustomPrompts} />
        </div>
      </div>

      {/* KROK 1: Opis workflow */}
      <div style={styles.section}>
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>
            <span style={getStepNumberStyle(1)}>1</span>
            Opis Workflow
          </h2>
          <WorkflowInput
            onGenerate={handleGenerateWorkflow}
            isGenerating={isGeneratingWorkflow}
          />
        </div>
      </div>

      {/* Edytowalne etapy workflow (po wygenerowaniu) */}
      {workflowSteps && (
        <div style={styles.section}>
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <span style={getStepNumberStyle(1)}>✓</span>
              Etapy workflow
            </h2>
            <WorkflowSteps
              steps={workflowSteps}
              onChange={setWorkflowSteps}
            />
          </div>
        </div>
      )}

      {/* KROK 2: Narracja */}
      {workflow && (
        <div style={styles.section}>
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <span style={getStepNumberStyle(2)}>2</span>
              Narracja
            </h2>

            {/* Input do narracji - gotowy tekst */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#888', fontSize: '0.85rem', marginBottom: '8px' }}>
                Input narracji (opcjonalnie - wklej gotowy tekst lub zostaw puste dla AI)
              </label>
              <textarea
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '12px',
                  background: '#0f0f23',
                  border: '2px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                value={narrationInput}
                onChange={(e) => handleNarrationInputChange(e.target.value)}
                placeholder={`Format JSON lub tekstowy:

{
  "intro": "Hook wstepny...",
  "nodes": [
    {"name": "Nazwa node", "narration": "Co robi...", "description": "Opis popup..."}
  ],
  "outro": "Podsumowanie..."
}`}
              />
              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                Wklej JSON z intro/nodes/outro lub zostaw puste - AI wygeneruje narrację
              </div>
            </div>

            <button
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
                ...(isGeneratingNarration ? styles.buttonDisabled : {})
              }}
              onClick={() => handleGenerateNarration('', narrationInput)}
              disabled={isGeneratingNarration}
            >
              {isGeneratingNarration
                ? 'Przetwarzanie...'
                : narrationInput.trim()
                  ? 'Użyj wklejonej narracji'
                  : 'Generuj narrację (AI)'}
            </button>
          </div>
        </div>
      )}

      {/* Edytor narracji (po wygenerowaniu) */}
      {narration && (
        <div style={styles.section}>
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <span style={getStepNumberStyle(2)}>✓</span>
              Edycja narracji
            </h2>
            <NarrationEditor
              narration={narration}
              onChange={setNarration}
            />
          </div>
        </div>
      )}

      {/* KROK 3: Audio */}
      {narration && (
        <div style={styles.section}>
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <span style={getStepNumberStyle(3)}>3</span>
              Audio (ElevenLabs)
            </h2>
            <button
              style={{
                ...styles.button,
                ...styles.buttonTertiary,
                ...(isGeneratingAudio ? styles.buttonDisabled : {})
              }}
              onClick={() => handleGenerateAudio()}
              disabled={isGeneratingAudio}
            >
              {isGeneratingAudio ? 'Generowanie...' : 'Generuj audio'}
            </button>
          </div>
        </div>
      )}

      {/* Podgląd audio (po wygenerowaniu) */}
      {audioSegments && (
        <div style={styles.section}>
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <span style={getStepNumberStyle(3)}>✓</span>
              Podgląd audio
            </h2>
            <AudioPreview
              audioSegments={audioSegments}
              narration={narration}
              onRegenerate={handleGenerateAudio}
              isRegenerating={isGeneratingAudio}
            />
          </div>
        </div>
      )}

      {/* KROK 4: Eksport */}
      {audioSegments && (
        <div style={styles.section}>
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              <span style={getStepNumberStyle(4)}>4</span>
              Generuj wideo
            </h2>

            {/* Przycisk generowania */}
            <button
              style={{
                ...styles.button,
                ...(isExporting ? styles.buttonDisabled : {}),
                marginBottom: '12px'
              }}
              onClick={handleExport}
              disabled={isExporting || isCombiningAvatar}
            >
              {isExporting ? 'Generowanie wideo i audio...' : 'Generuj wideo'}
            </button>

            {isExporting && (
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: '50%' }} />
              </div>
            )}

            {/* Po wygenerowaniu - przyciski pobierania */}
            {generatedFiles && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: '#1a3a1a',
                borderRadius: '8px',
                border: '1px solid #4ecdc4'
              }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#4ecdc4', marginBottom: '12px' }}>
                  Pliki gotowe do pobrania
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                  <button
                    style={{
                      ...styles.button,
                      flex: 1,
                      padding: '12px'
                    }}
                    onClick={handleDownloadVideo}
                  >
                    Pobierz MP4
                  </button>
                  <button
                    style={{
                      ...styles.button,
                      ...styles.buttonSecondary,
                      flex: 1,
                      padding: '12px'
                    }}
                    onClick={handleDownloadAudio}
                  >
                    Pobierz audio (MP3)
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                  Audio zsynchronizowane z animacją - użyj go do generowania awatara w HeyGen
                </div>
              </div>
            )}

            {/* Sekcja awatara - aktywna po wygenerowaniu */}
            {generatedFiles && (
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#1a1a3e',
                borderRadius: '8px',
                border: '1px solid #333'
              }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#e74c3c', marginBottom: '12px' }}>
                  Dodaj awatara AI (opcjonalnie)
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '12px' }}>
                  1. Pobierz audio powyżej<br/>
                  2. Wygeneruj awatara na stronie HeyGen używając tego audio<br/>
                  3. Wgraj wideo awatara poniżej
                </div>

                <label style={{
                  display: 'block',
                  width: '100%',
                  padding: '14px',
                  background: isCombiningAvatar
                    ? '#333'
                    : 'linear-gradient(135deg, #e74c3c, #c0392b)',
                  color: '#fff',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  borderRadius: '8px',
                  cursor: isCombiningAvatar ? 'not-allowed' : 'pointer',
                  opacity: isCombiningAvatar ? 0.5 : 1
                }}>
                  {isCombiningAvatar ? 'Łączenie wideo z awatarem...' : 'Wgraj awatara (MP4)'}
                  <input
                    type="file"
                    accept="video/mp4,video/*"
                    onChange={handleAvatarUpload}
                    disabled={isCombiningAvatar}
                    style={{ display: 'none' }}
                  />
                </label>
                <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '8px' }}>
                  Awatar zostanie zamontowany w lewym dolnym rogu (chroma key dla zielonego tła)
                </div>

                {isCombiningAvatar && (
                  <div style={{ ...styles.progressBar, marginTop: '12px' }}>
                    <div style={{ ...styles.progressFill, width: '50%' }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ustawienia */}
      <div style={styles.section}>
        <Settings
          settings={settings}
          onChange={setSettings}
        />
      </div>

      {/* Klucze API - na końcu */}
      <div style={styles.section}>
        <ApiKeys />
      </div>

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
    </div>
  )
}

export default App
