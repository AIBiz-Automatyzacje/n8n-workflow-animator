import React from 'react'

const styles = {
  stepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  stepCard: {
    background: '#0f0f23',
    borderRadius: '8px',
    padding: '16px',
    border: '2px solid #333'
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #333'
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
    fontSize: '0.85rem',
    fontWeight: 'bold',
    flexShrink: 0
  },
  stepName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '1rem'
  },
  stepType: {
    color: '#888',
    fontSize: '0.8rem',
    marginLeft: 'auto',
    background: '#1a1a2e',
    padding: '4px 8px',
    borderRadius: '4px'
  },
  section: {
    marginBottom: '16px'
  },
  sectionTitle: {
    color: '#feca57',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box'
  },
  inputFocused: {
    borderColor: '#feca57'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '70px',
    fontFamily: 'inherit',
    lineHeight: '1.4'
  },
  popupSection: {
    background: '#16213e',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '12px',
    border: '1px dashed #444'
  },
  popupSectionTitle: {
    color: '#4ecdc4',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  }
}

function WorkflowSteps({ steps, onChange }) {
  const handleStepChange = (index, field, value) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    onChange(newSteps)
  }

  return (
    <div style={styles.stepsList}>
      {steps.map((step, index) => (
        <div key={step.id || index} style={styles.stepCard}>
          <div style={styles.stepHeader}>
            <span style={styles.stepNumber}>{index + 1}</span>
            <span style={styles.stepName}>{step.name}</span>
            <span style={styles.stepType}>{step.type}</span>
          </div>

          {/* Tytuł kafelka workflow */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Tytuł kafelka</div>
            <input
              type="text"
              style={styles.input}
              value={step.tileTitle || ''}
              onChange={(e) => handleStepChange(index, 'tileTitle', e.target.value)}
              placeholder={`np. "${step.name}"`}
            />
          </div>

          {/* Podtytuł kafelka workflow (typ/kategoria) */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Podtytuł kafelka</div>
            <input
              type="text"
              style={styles.input}
              value={step.tileSubtitle || step.type || ''}
              onChange={(e) => handleStepChange(index, 'tileSubtitle', e.target.value)}
              placeholder={`np. "${step.type}" lub własny opis`}
            />
            <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '4px' }}>
              Wyświetlany pod tytułem kafelka w animacji (np. "Trigger", "HTTP Request")
            </div>
          </div>

          {/* Sekcja pop-upu informacyjnego */}
          <div style={styles.popupSection}>
            <div style={styles.popupSectionTitle}>
              <span>💬</span> Pop-up informacyjny
            </div>

            {/* Tytuł pop-upu */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Tytuł pop-upu</div>
              <input
                type="text"
                style={styles.input}
                value={step.popupTitle || ''}
                onChange={(e) => handleStepChange(index, 'popupTitle', e.target.value)}
                placeholder="Tytuł wyświetlany w chmurce"
              />
            </div>

            {/* Opis pop-upu */}
            <div style={{ ...styles.section, marginBottom: 0 }}>
              <div style={styles.sectionTitle}>Opis w pop-upie</div>
              <textarea
                style={styles.textarea}
                value={step.popupDescription || ''}
                onChange={(e) => handleStepChange(index, 'popupDescription', e.target.value)}
                placeholder="Szczegółowy opis co robi ten krok..."
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default WorkflowSteps
