import React from 'react'

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
    color: '#fff'
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
  buttonGroup: {
    display: 'flex',
    gap: '8px'
  },
  button: {
    flex: 1,
    padding: '10px 12px',
    border: '2px solid #333',
    background: 'transparent',
    color: '#888',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '0.9rem'
  },
  buttonActive: {
    borderColor: '#ff6b6b',
    color: '#ff6b6b',
    background: 'rgba(255, 107, 107, 0.1)'
  },
  buttonActiveNarrated: {
    borderColor: '#9b59b6',
    color: '#9b59b6',
    background: 'rgba(155, 89, 182, 0.1)'
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  modeDescription: {
    fontSize: '0.75rem',
    color: '#666',
    marginTop: '6px',
    lineHeight: '1.4'
  }
}

function Settings({ settings, onChange, disabled }) {
  const handleSpeedChange = (speed) => {
    if (disabled) return
    onChange({ ...settings, speed })
  }

  return (
    <div style={{
      ...styles.container,
      ...(disabled ? { opacity: 0.6 } : {})
    }}>
      <h3 style={styles.title}>Ustawienia</h3>

      <div style={styles.group}>
        <label style={styles.label}>Tempo animacji</label>
        <div style={styles.buttonGroup}>
          <button
            style={{
              ...styles.button,
              ...(settings.speed === 'slow' ? styles.buttonActive : {}),
              ...(disabled ? styles.buttonDisabled : {})
            }}
            onClick={() => handleSpeedChange('slow')}
          >
            Wolno
          </button>
          <button
            style={{
              ...styles.button,
              ...(settings.speed === 'normal' ? styles.buttonActive : {}),
              ...(disabled ? styles.buttonDisabled : {})
            }}
            onClick={() => handleSpeedChange('normal')}
          >
            Normalnie
          </button>
          <button
            style={{
              ...styles.button,
              ...(settings.speed === 'fast' ? styles.buttonActive : {}),
              ...(disabled ? styles.buttonDisabled : {})
            }}
            onClick={() => handleSpeedChange('fast')}
          >
            Szybko
          </button>
        </div>
      </div>
    </div>
  )
}

export default Settings
