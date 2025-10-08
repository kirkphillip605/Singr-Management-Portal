import Link from 'next/link'
import { Paperclip, ImageIcon, VideoIcon, FileText } from 'lucide-react'

type Attachment = {
  id: string
  fileName: string
  mimeType: string | null
  byteSize: bigint | number | null
  storageUrl: string
}

type SupportAttachmentLinkProps = {
  attachment: Attachment
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || Number.isNaN(bytes)) return ''

  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`
}

function iconForMime(mimeType: string | null) {
  if (!mimeType) return Paperclip

  if (mimeType.startsWith('image/')) return ImageIcon
  if (mimeType.startsWith('video/')) return VideoIcon

  return FileText
}

export function SupportAttachmentLink({ attachment }: SupportAttachmentLinkProps) {
  const Icon = iconForMime(attachment.mimeType)
  const fileSize = formatFileSize(typeof attachment.byteSize === 'bigint' ? Number(attachment.byteSize) : attachment.byteSize ?? null)

  return (
    <Link
      href={attachment.storageUrl}
      className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      target="_blank"
      rel="noopener noreferrer"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="truncate" title={attachment.fileName}>
        {attachment.fileName}
      </span>
      {fileSize ? <span className="ml-auto text-xs uppercase tracking-wide">{fileSize}</span> : null}
    </Link>
  )
}
