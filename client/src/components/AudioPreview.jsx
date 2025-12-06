import React, { useState, useRef } from 'react'

const styles = {
  segmentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  segmentCard: {
    background: '#0f0f23',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #333'
  },
  segmentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px'
  },
  segmentNumber: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: '#3498db',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    flexShrink: 0
  },
  segmentType: {
    color: '#888',
    fontSize: '0.8rem'
  },
  segmentText: {
    color: '#ccc',
    fontSize: '0.85rem',
    marginBottom: '10px',
    lineHeight: '1.4'
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  playButton: {
    padding: '8px 16px',
    background: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  playButtonPlaying: {
    background: '#e74c3c'
  },
  regenerateButton: {
    padding: '8px 16px',
    background: 'transparent',
    color: '#feca57',
    border: '1px solid #feca57',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  regenerateButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  duration: {
    color: '#888',
    fontSize: '0.75rem',
    marginLeft: 'auto'
  },
  introOutroLabel: {
    color: '#feca57',
    fontWeight: 'bold',
    fontSize: '0.8rem'
  },
  nodeLabel: {
    color: '#ff6b6b',
    fontWeight: 'bold',
    fontSize: '0.8rem'
  }
}

function AudioPreview({ audioSegments, narration, onRegenerate, isRegenerating }) {
  const [playingIndex, setPlayingIndex] = useState(null)
  const audioRef = useRef(null)

  const segments = audioSegments?.segments || []

  const getSegmentLabel = (index) => {
    if (index === 0) return { type: 'intro', label: 'INTRO', style: styles.introOutroLabel }
    if (index === segments.length - 1) return { type: 'outro', label: 'OUTRO', style: styles.introOutroLabel }
    return { type: 'node', label: `Etap ${index}`, style: styles.nodeLabel }
  }

  const getSegmentText = (index) => {
    if (index === 0) return narration?.intro || ''
    if (index === segments.length - 1) return narration?.outro || ''
    const nodeIndex = index - 1
    return narration?.nodes?.[nodeIndex]?.narration || ''
  }

  const handlePlay = (index, audioData) => {
    if (playingIndex === index) {
      // Stop
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setPlayingIndex(null)
      return
    }

    // Stop previous
    if (audioRef.current) {
      audioRef.current.pause()
    }

    // Play new
    const audio = new Audio(`data:audio/mp3;base64,${audioData}`)
    audio.onended = () => setPlayingIndex(null)
    audio.play()
    audioRef.current = audio
    setPlayingIndex(index)
  }

  const handleRegenerate = (index) => {
    if (isRegenerating) return
    onRegenerate(index)
  }

  const formatDuration = (durationMs) => {
    if (!durationMs) return ''
    const seconds = Math.round(durationMs / 1000)
    return `${seconds}s`
  }

  return (
    <div style={styles.segmentsList}>
      {segments.map((segment, index) => {
        const { label, style } = getSegmentLabel(index)
        const text = getSegmentText(index)
        const isPlaying = playingIndex === index

        return (
          <div key={index} style={styles.segmentCard}>
            <div style={styles.segmentHeader}>
              <span style={styles.segmentNumber}>{index + 1}</span>
              <span style={style}>{label}</span>
              <span style={styles.duration}>{formatDuration(segment.duration)}</span>
            </div>

            <div style={styles.segmentText}>{text}</div>

            <div style={styles.controls}>
              <button
                style={{
                  ...styles.playButton,
                  ...(isPlaying ? styles.playButtonPlaying : {})
                }}
                onClick={() => handlePlay(index, segment.audio)}
              >
                {isPlaying ? '■ Stop' : '▶ Odtwórz'}
              </button>

              <button
                style={{
                  ...styles.regenerateButton,
                  ...(isRegenerating ? styles.regenerateButtonDisabled : {})
                }}
                onClick={() => handleRegenerate(index)}
                disabled={isRegenerating}
              >
                Regeneruj
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default AudioPreview
