// AWS S3 Service - upload plików audio dla HeyGen

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync } from 'fs'
import { basename } from 'path'

let s3Client = null

/**
 * Inicjalizacja klienta S3
 */
function initS3Client(config) {
  if (!config.accessKeyId || !config.secretAccessKey || !config.region || !config.bucket) {
    throw new Error('Missing S3 configuration')
  }

  s3Client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  })

  return s3Client
}

/**
 * Upload pliku audio na S3
 * @param {string} filePath - lokalna ścieżka do pliku
 * @param {object} config - konfiguracja S3
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function uploadAudioToS3(filePath, config) {
  try {
    console.log('[S3] Uploading audio to S3...')
    console.log('[S3] File:', filePath)

    // Inicjalizuj klienta jeśli nie istnieje
    if (!s3Client) {
      initS3Client(config)
    }

    const fileName = basename(filePath)
    const key = `heygen-audio/${Date.now()}_${fileName}`

    // Odczytaj plik
    const fileContent = readFileSync(filePath)

    // Określ content type
    const contentType = fileName.endsWith('.mp3') ? 'audio/mpeg'
      : fileName.endsWith('.wav') ? 'audio/wav'
      : 'audio/mpeg'

    // Upload na S3
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      ACL: 'public-read' // Publiczny dostęp dla HeyGen
    })

    await s3Client.send(command)

    // Zbuduj publiczny URL
    const publicUrl = `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`

    console.log('[S3] Upload successful!')
    console.log('[S3] Public URL:', publicUrl)

    return {
      success: true,
      url: publicUrl,
      key
    }
  } catch (error) {
    console.error('[S3] Upload error:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Usuń plik z S3 (cleanup po użyciu)
 * @param {string} key - klucz pliku na S3
 * @param {object} config - konfiguracja S3
 */
export async function deleteFromS3(key, config) {
  try {
    if (!s3Client) {
      initS3Client(config)
    }

    const command = new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key
    })

    await s3Client.send(command)
    console.log('[S3] File deleted:', key)

    return { success: true }
  } catch (error) {
    console.error('[S3] Delete error:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Sprawdź czy konfiguracja S3 jest prawidłowa
 */
export function validateS3Config(config) {
  const required = ['accessKeyId', 'secretAccessKey', 'region', 'bucket']
  const missing = required.filter(key => !config[key])

  if (missing.length > 0) {
    return {
      valid: false,
      missing
    }
  }

  return { valid: true }
}
