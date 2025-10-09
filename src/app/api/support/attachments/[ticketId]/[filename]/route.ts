import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

import { getAuthSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string; filename: string }> }
) {
  const session = await getAuthSession()
  const paramsResolved = await params
  const { ticketId, filename } = paramsResolved

  // Check if user is authenticated
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  try {
    // Get the ticket
    const ticket = await (prisma as any).supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        requesterId: true,
        assigneeId: true,
        createdById: true,
      },
    })

    if (!ticket) {
      logger.warn('Attempted to access attachment for non-existent ticket', {
        ticketId,
        userId: session.user.id,
      })
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Check if user has permission to view this attachment
    const isAdmin = session.user.accountType === 'admin' || session.user.accountType === 'support'
    const isRequester = ticket.requesterId === session.user.id
    const isAssignee = ticket.assigneeId === session.user.id
    const isCreator = ticket.createdById === session.user.id

    if (!isAdmin && !isRequester && !isAssignee && !isCreator) {
      logger.warn('Unauthorized attachment access attempt', {
        ticketId,
        userId: session.user.id,
        userType: session.user.accountType,
      })
      const redirectUrl = session.user.accountType === 'customer' ? '/dashboard' : '/admin'
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    // Construct the file path
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'support', ticketId, filename)

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch {
      logger.error('Attachment file not found', {
        ticketId,
        filename,
        filePath,
      })
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read the file
    const fileBuffer = await fs.readFile(filePath)
    const uint8Array = new Uint8Array(fileBuffer)

    // Determine content type
    const ext = path.extname(filename).toLowerCase()
    const contentTypeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
    }
    const contentType = contentTypeMap[ext] || 'application/octet-stream'

    logger.info('Attachment accessed', {
      ticketId,
      filename,
      userId: session.user.id,
    })

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    logger.error('Failed to retrieve attachment', {
      ticketId,
      filename,
      error,
    })
    return NextResponse.json({ error: 'Failed to retrieve attachment' }, { status: 500 })
  }
}
