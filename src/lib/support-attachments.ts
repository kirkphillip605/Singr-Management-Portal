import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_PREFIXES = ['image/', 'video/']
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
])
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.rtf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.heic',
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
])

export type SavedSupportAttachment = {
  fileName: string
  mimeType?: string
  byteSize: number
  storageUrl: string
}

export class AttachmentValidationError extends Error {}

function ensureAttachmentType(file: File) {
  const mimeType = file.type || undefined
  const extension = path.extname(file.name || '').toLowerCase()

  const isAllowedMimePrefix = mimeType ? ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix)) : false
  const isAllowedMimeType = mimeType ? ALLOWED_MIME_TYPES.has(mimeType) : false
  const isAllowedExtension = extension ? ALLOWED_EXTENSIONS.has(extension) : false

  if (!(isAllowedMimePrefix || isAllowedMimeType || isAllowedExtension)) {
    throw new AttachmentValidationError('Unsupported attachment type. Upload images, videos, or document files only.')
  }
}

export async function persistSupportAttachment(ticketId: string, file: File): Promise<SavedSupportAttachment> {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new AttachmentValidationError('Attachments must be 10MB or smaller.')
  }

  ensureAttachmentType(file)

  const buffer = Buffer.from(await file.arrayBuffer())
  const extension = path.extname(file.name || '').toLowerCase() || ''
  const safeExtension = extension.replace(/[^a-z0-9.]/g, '')
  const storedFileName = `${randomUUID()}${safeExtension}`
  const relativeDir = path.join('uploads', 'support', ticketId)
  const absoluteDir = path.join(process.cwd(), 'public', relativeDir)

  await fs.mkdir(absoluteDir, { recursive: true })

  const absolutePath = path.join(absoluteDir, storedFileName)
  await fs.writeFile(absolutePath, buffer)

  return {
    fileName: file.name || storedFileName,
    mimeType: file.type || undefined,
    byteSize: buffer.length,
    storageUrl: `/${relativeDir.replace(/\\/g, '/')}/${storedFileName}`,
  }
}
