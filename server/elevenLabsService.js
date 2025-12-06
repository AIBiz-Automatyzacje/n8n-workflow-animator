import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'

// Generuj audio z tekstu przez ElevenLabs
export async function generateAudio(text, apiKey, voiceId, outputPath) {
  try {
    // Usuń ewentualne spacje z voiceId i apiKey
    const cleanVoiceId = voiceId.trim()
    const cleanApiKey = apiKey.trim()

    console.log(`[ElevenLabs] Generating audio for text: "${text.substring(0, 50)}..."`)
    console.log(`[ElevenLabs] Voice ID: "${cleanVoiceId}"`)

    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${cleanVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': cleanApiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
    }

    const audioBuffer = await response.arrayBuffer()
    writeFileSync(outputPath, Buffer.from(audioBuffer))

    console.log(`[ElevenLabs] Audio saved to: ${outputPath}`)

    return {
      success: true,
      path: outputPath,
      size: audioBuffer.byteLength
    }
  } catch (error) {
    console.error('[ElevenLabs] Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Generuj audio dla każdego segmentu narracji (zwraca base64 dla podglądu)
export async function generateSegmentedAudio(segments, apiKey, voiceId, outputDir) {
  const results = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (!segment.text || segment.text.trim() === '') continue

    const filename = `segment_${i.toString().padStart(3, '0')}_${segment.type}.mp3`
    const outputPath = join(outputDir, filename)

    // Generuj audio i zapisz do pliku
    const result = await generateAudioWithBase64(segment.text, apiKey, voiceId, outputPath)

    if (result.success) {
      results.push({
        ...segment,
        audioPath: outputPath,
        audioSize: result.size,
        audio: result.base64, // base64 dla podglądu w przeglądarce
        duration: result.duration
      })
    } else {
      console.error(`[ElevenLabs] Failed to generate segment ${i}: ${result.error}`)
    }

    // Mały delay żeby nie przekroczyć rate limit
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return results
}

// Generuj audio i zwróć też base64
async function generateAudioWithBase64(text, apiKey, voiceId, outputPath) {
  try {
    const cleanVoiceId = voiceId.trim()
    const cleanApiKey = apiKey.trim()

    console.log(`[ElevenLabs] Generating audio for text: "${text.substring(0, 50)}..."`)
    console.log(`[ElevenLabs] Voice ID: "${cleanVoiceId}"`)

    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${cleanVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': cleanApiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
    }

    const audioBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(audioBuffer)

    // Zapisz do pliku
    writeFileSync(outputPath, buffer)

    // Konwertuj na base64
    const base64 = buffer.toString('base64')

    // Oszacuj czas trwania (przybliżenie: ~12KB/s dla MP3 128kbps)
    const duration = Math.round((audioBuffer.byteLength / 12000) * 1000)

    console.log(`[ElevenLabs] Audio saved to: ${outputPath}`)

    return {
      success: true,
      path: outputPath,
      size: audioBuffer.byteLength,
      base64: base64,
      duration: duration
    }
  } catch (error) {
    console.error('[ElevenLabs] Error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Generuj jedno długie audio dla całej narracji
export async function generateFullAudio(fullText, apiKey, voiceId, outputPath) {
  return generateAudio(fullText, apiKey, voiceId, outputPath)
}

// Generuj jedno ciągłe audio z pauzami SSML dla całej narracji
export async function generateAudioWithPauses(narration, apiKey, voiceId, outputPath) {
  try {
    console.log('[ElevenLabs] Generating audio with SSML pauses...')

    // Zbuduj tekst z pauzami SSML
    const parts = []

    // Intro
    parts.push(narration.intro)
    parts.push('<break time="0.8s" />') // Pauza po intro

    // Nodes z pauzami między nimi
    narration.nodes.forEach((node, index) => {
      parts.push(node.narration)

      // Pauza między node'ami (krótsza niż po intro)
      if (index < narration.nodes.length - 1) {
        parts.push('<break time="0.5s" />')
      } else {
        // Dłuższa pauza przed outro
        parts.push('<break time="1.0s" />')
      }
    })

    // Outro
    parts.push(narration.outro)

    const ssmlText = parts.join(' ')

    console.log('[ElevenLabs] SSML text length:', ssmlText.length)
    console.log('[ElevenLabs] SSML preview:', ssmlText.substring(0, 200))

    const cleanVoiceId = voiceId.trim()
    const cleanApiKey = apiKey.trim()

    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${cleanVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': cleanApiKey
      },
      body: JSON.stringify({
        text: ssmlText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
    }

    const audioBuffer = await response.arrayBuffer()
    writeFileSync(outputPath, Buffer.from(audioBuffer))

    console.log(`[ElevenLabs] Audio with pauses saved to: ${outputPath}`)
    console.log(`[ElevenLabs] Audio size: ${(audioBuffer.byteLength / 1024).toFixed(2)} KB`)

    return {
      success: true,
      path: outputPath,
      size: audioBuffer.byteLength,
      ssmlUsed: true
    }
  } catch (error) {
    console.error('[ElevenLabs] Error generating audio with pauses:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Pobierz listę dostępnych głosów
export async function getVoices(apiKey) {
  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'xi-api-key': apiKey
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`)
    }

    const data = await response.json()
    return {
      success: true,
      voices: data.voices.map(v => ({
        id: v.voice_id,
        name: v.name,
        category: v.category
      }))
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

// Sprawdź limit użycia
export async function getUsage(apiKey) {
  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
      headers: {
        'xi-api-key': apiKey
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch usage: ${response.status}`)
    }

    const data = await response.json()
    return {
      success: true,
      characterCount: data.character_count,
      characterLimit: data.character_limit,
      remaining: data.character_limit - data.character_count
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}
