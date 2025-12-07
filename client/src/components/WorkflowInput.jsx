import React, { useState } from 'react'

const styles = {
  label: {
    display: 'block',
    color: '#888',
    fontSize: '0.85rem',
    marginBottom: '8px'
  },
  textarea: {
    width: '100%',
    minHeight: '150px',
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleGenerate()
    }
  }

  return (
    <div>
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
        disabled={isGenerating}
      />

      <button
        style={{
          ...styles.button,
          ...((!description.trim() || isGenerating) ? styles.buttonDisabled : {})
        }}
        onClick={handleGenerate}
        disabled={!description.trim() || isGenerating}
      >
        {isGenerating ? 'Parsowanie...' : 'Parsuj workflow'}
      </button>
    </div>
  )
}

export default WorkflowInput
