import React from 'react'

const styles = {
  section: {
    marginBottom: '20px'
  },
  sectionTitle: {
    color: '#feca57',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    marginBottom: '8px'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    background: '#0f0f23',
    border: '2px solid #333',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '60px',
    fontFamily: 'inherit',
    lineHeight: '1.4'
  },
  nodeCard: {
    background: '#0f0f23',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '12px',
    border: '1px solid #333'
  },
  nodeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px'
  },
  nodeNumber: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: '#9b59b6',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    flexShrink: 0
  },
  nodeName: {
    color: '#ff6b6b',
    fontWeight: 'bold',
    fontSize: '0.85rem'
  },
  nodeNamePL: {
    color: '#feca57',
    fontSize: '0.8rem',
    marginLeft: '8px'
  },
  label: {
    display: 'block',
    color: '#888',
    fontSize: '0.75rem',
    marginBottom: '4px'
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box'
  },
  hint: {
    fontSize: '0.7rem',
    color: '#666',
    marginTop: '4px'
  }
}

function NarrationEditor({ narration, onChange }) {
  const handleIntroChange = (value) => {
    onChange({ ...narration, intro: value })
  }

  const handleOutroChange = (value) => {
    onChange({ ...narration, outro: value })
  }

  const handleNodeChange = (index, field, value) => {
    const newNodes = [...narration.nodes]
    newNodes[index] = { ...newNodes[index], [field]: value }
    onChange({ ...narration, nodes: newNodes })
  }

  return (
    <div>
      {/* Hook / Intro */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>HOOK (intro)</div>
        <textarea
          style={styles.textarea}
          value={narration.intro || ''}
          onChange={(e) => handleIntroChange(e.target.value)}
          placeholder="Hook - zachęcające intro"
        />
        <div style={styles.hint}>Czytane na początku wideo jako voice-over</div>
      </div>

      {/* Etapy - tylko narracja voice-over */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>ETAPY (voice-over)</div>
        {narration.nodes?.map((node, index) => (
          <div key={index} style={styles.nodeCard}>
            <div style={styles.nodeHeader}>
              <span style={styles.nodeNumber}>{index + 1}</span>
              <span style={styles.nodeName}>{node.name}</span>
              {node.namePL && <span style={styles.nodeNamePL}>({node.namePL})</span>}
            </div>

            <div>
              <label style={styles.label}>Narracja (tekst czytany przez lektora)</label>
              <input
                type="text"
                style={styles.input}
                value={node.narration || ''}
                onChange={(e) => handleNodeChange(index, 'narration', e.target.value)}
                placeholder="Tekst voice-over dla tego kroku"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Podsumowanie / Outro */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>PODSUMOWANIE (outro)</div>
        <textarea
          style={styles.textarea}
          value={narration.outro || ''}
          onChange={(e) => handleOutroChange(e.target.value)}
          placeholder="Podsumowanie - co osiągnęliśmy"
        />
        <div style={styles.hint}>Czytane na końcu wideo jako voice-over</div>
      </div>
    </div>
  )
}

export default NarrationEditor
