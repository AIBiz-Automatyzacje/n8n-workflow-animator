import React, { useState } from 'react'

const styles = {
  container: {
    background: '#16213e',
    borderRadius: '12px',
    padding: '20px'
  },
  title: {
    fontSize: '1rem',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#fff'
  },
  label: {
    display: 'block',
    color: '#888',
    fontSize: '0.85rem',
    marginBottom: '8px'
  },
  textarea: {
    width: '100%',
    minHeight: '200px',
    padding: '12px',
    background: '#0f0f23',
    border: '2px solid #333',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box'
  },
  textareaFocused: {
    borderColor: '#ff6b6b'
  },
  button: {
    width: '100%',
    marginTop: '12px',
    padding: '14px',
    background: 'linear-gradient(135deg, #feca57, #f39c12)',
    color: '#1a1a2e',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'transform 0.2s'
  },
  buttonDisabled: {
    background: '#444',
    color: '#888',
    cursor: 'not-allowed'
  },
  hint: {
    fontSize: '0.75rem',
    color: '#666',
    marginTop: '8px',
    lineHeight: '1.4'
  },
  example: {
    marginTop: '12px',
    padding: '12px',
    background: '#0f0f23',
    borderRadius: '6px',
    borderLeft: '3px solid #feca57'
  },
  exampleTitle: {
    fontSize: '0.8rem',
    color: '#feca57',
    fontWeight: 'bold',
    marginBottom: '6px'
  },
  exampleText: {
    fontSize: '0.75rem',
    color: '#888',
    lineHeight: '1.5'
  }
}

function WorkflowInput({ onGenerate, isGenerating }) {
  const [description, setDescription] = useState(() => localStorage.getItem('workflowDescription') || '')
  const [isFocused, setIsFocused] = useState(false)

  const handleGenerate = () => {
    if (!description.trim() || isGenerating) return
    localStorage.setItem('workflowDescription', description)
    onGenerate(description)
  }

  const handleKeyDown = (e) => {
    // Ctrl/Cmd + Enter to generate
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleGenerate()
    }
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Opis Workflow</h3>

      <label style={styles.label}>
        Opisz workflow które chcesz zwizualizować
      </label>

      <textarea
        style={{
          ...styles.textarea,
          ...(isFocused ? styles.textareaFocused : {})
        }}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder="Przykład:&#10;&#10;Workflow automatycznie odpowiada na komentarze na Facebooku.&#10;&#10;1. Trigger: Harmonogram (co 15 minut)&#10;2. Facebook: Pobierz nowe komentarze&#10;3. OpenAI: Wygeneruj odpowiedź&#10;4. Facebook: Opublikuj odpowiedź&#10;5. Airtable: Zapisz do bazy danych"
        disabled={isGenerating}
      />

      <div style={styles.hint}>
        💡 Opisz trigger i kolejne akcje. AI zbuduje workflow i stworzy narrację.
      </div>

      <button
        style={{
          ...styles.button,
          ...((!description.trim() || isGenerating) ? styles.buttonDisabled : {})
        }}
        onClick={handleGenerate}
        disabled={!description.trim() || isGenerating}
      >
        {isGenerating ? 'Generowanie workflow...' : 'Wygeneruj workflow'}
      </button>

      <div style={styles.example}>
        <div style={styles.exampleTitle}>📝 Format opisu:</div>
        <div style={styles.exampleText}>
          • Krótki opis co robi workflow (1 zdanie)<br/>
          • Lista kroków: trigger + akcje w narzędziach<br/>
          • Możesz dodać szczegóły konfiguracji
        </div>
      </div>
    </div>
  )
}

export default WorkflowInput
