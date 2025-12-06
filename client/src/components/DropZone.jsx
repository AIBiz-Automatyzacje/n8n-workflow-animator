import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

const styles = {
  dropzone: {
    border: '2px dashed #444',
    borderRadius: '12px',
    padding: '30px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s',
    background: '#16213e'
  },
  dropzoneActive: {
    borderColor: '#ff6b6b',
    background: '#1a1a3e'
  },
  dropzoneHasFile: {
    borderColor: '#4ecdc4',
    background: '#16213e'
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '10px'
  },
  text: {
    color: '#888',
    fontSize: '0.95rem'
  },
  textActive: {
    color: '#ff6b6b'
  }
}

function DropZone({ onFileDrop, hasFile }) {
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onFileDrop(acceptedFiles[0])
    }
  }, [onFileDrop])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json']
    },
    multiple: false
  })

  return (
    <div
      {...getRootProps()}
      style={{
        ...styles.dropzone,
        ...(isDragActive ? styles.dropzoneActive : {}),
        ...(hasFile ? styles.dropzoneHasFile : {})
      }}
    >
      <input {...getInputProps()} />
      <div style={styles.icon}>
        {hasFile ? '✅' : isDragActive ? '📂' : '📄'}
      </div>
      <p style={{
        ...styles.text,
        ...(isDragActive ? styles.textActive : {})
      }}>
        {hasFile
          ? 'Plik załadowany! Przeciągnij inny, aby zmienić'
          : isDragActive
            ? 'Upuść plik tutaj...'
            : 'Przeciągnij plik JSON z n8n lub kliknij'
        }
      </p>
    </div>
  )
}

export default DropZone
