// HeyGen Avatar Service - generowanie wideo z awatarem AI

const HEYGEN_API_BASE = 'https://api.heygen.com'

// Domyślny awatar "Kacper"
const KACPER_AVATAR_ID = '80b3f9e68e6b4830be01fef7809de096'

/**
 * Lista dostępnych awatarów
 */
export async function listAvatars(apiKey) {
  try {
    const response = await fetch(`${HEYGEN_API_BASE}/v2/avatars`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HeyGen API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      success: true,
      avatars: data.data?.avatars || []
    }
  } catch (error) {
    console.error('[HeyGen] listAvatars error:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Generuje wideo z awatarem na podstawie audio URL
 * @param {string} audioUrl - URL do pliku audio (musi być publicznie dostępny)
 * @param {string} apiKey - klucz API HeyGen
 * @param {object} options - opcje
 */
export async function generateAvatarVideo(audioUrl, apiKey, options = {}) {
  const {
    avatarId = KACPER_AVATAR_ID,
    aspectRatio = '16:9',
    test = false
  } = options

  try {
    console.log('[HeyGen] Generating avatar video...')
    console.log('[HeyGen] Avatar ID:', avatarId)
    console.log('[HeyGen] Audio URL:', audioUrl)

    // Wymiary wideo na podstawie aspect ratio
    const dimension = aspectRatio === '9:16'
      ? { width: 1080, height: 1920 }
      : { width: 1920, height: 1080 }

    const response = await fetch(`${HEYGEN_API_BASE}/v2/video/generate`, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_inputs: [{
          character: {
            type: 'avatar',
            avatar_id: avatarId,
            avatar_style: 'normal'
          },
          voice: {
            type: 'audio',
            audio_url: audioUrl
          },
          background: {
            type: 'color',
            value: '#00FF00' // Green screen dla łatwego keying
          }
        }],
        dimension,
        test // Tryb testowy - szybszy ale z watermarkiem
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HeyGen API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('[HeyGen] Video generation started:', data.data?.video_id)

    return {
      success: true,
      videoId: data.data?.video_id,
      status: 'processing'
    }
  } catch (error) {
    console.error('[HeyGen] generateAvatarVideo error:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Sprawdza status generowania wideo
 */
export async function checkVideoStatus(videoId, apiKey) {
  try {
    const response = await fetch(`${HEYGEN_API_BASE}/v1/video_status.get?video_id=${videoId}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HeyGen API error: ${response.status}`)
    }

    const data = await response.json()
    const videoData = data.data || {}

    return {
      success: true,
      status: videoData.status, // pending, processing, completed, failed
      videoUrl: videoData.video_url,
      thumbnailUrl: videoData.thumbnail_url,
      duration: videoData.duration,
      error: videoData.error
    }
  } catch (error) {
    console.error('[HeyGen] checkVideoStatus error:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Czeka na zakończenie generowania wideo (polling)
 */
export async function waitForVideo(videoId, apiKey, maxAttempts = 120) {
  console.log('[HeyGen] Waiting for video completion...')

  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkVideoStatus(videoId, apiKey)

    if (!result.success) {
      return result
    }

    if (result.status === 'completed') {
      console.log('[HeyGen] Video completed!')
      return result
    }

    if (result.status === 'failed') {
      const errorMsg = typeof result.error === 'object'
        ? JSON.stringify(result.error)
        : (result.error || 'Video generation failed')
      return {
        success: false,
        error: errorMsg
      }
    }

    // Log co 10 sekund
    if (i % 10 === 0) {
      console.log(`[HeyGen] Status: ${result.status} (attempt ${i + 1}/${maxAttempts})`)
    }

    // Czekaj 1 sekundę
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return {
    success: false,
    error: 'Video generation timeout'
  }
}

/**
 * Pobiera wideo z URL i zapisuje do pliku
 */
export async function downloadVideo(videoUrl, outputPath) {
  const fs = await import('fs')
  const { pipeline } = await import('stream/promises')

  try {
    console.log('[HeyGen] Downloading video from:', videoUrl)

    const response = await fetch(videoUrl)
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`)
    }

    const fileStream = fs.createWriteStream(outputPath)
    await pipeline(response.body, fileStream)

    console.log('[HeyGen] Video downloaded to:', outputPath)

    return {
      success: true,
      path: outputPath
    }
  } catch (error) {
    console.error('[HeyGen] downloadVideo error:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

export { KACPER_AVATAR_ID }
