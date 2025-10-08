'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

type AdminNoteImportantToggleProps = {
  userId: string
  noteId: string
  important: boolean
}

export function AdminNoteImportantToggle({ userId, noteId, important }: AdminNoteImportantToggleProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [optimisticImportant, setOptimisticImportant] = useState(important)

  const handleToggle = () => {
    if (isPending) return

    const nextValue = !optimisticImportant
    setOptimisticImportant(nextValue)

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/notes/${noteId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ important: nextValue }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error ?? 'Unable to update note importance')
        }

        toast({
          title: nextValue ? 'Marked as important' : 'Removed important flag',
          description: nextValue
            ? 'The note now appears at the top of the customer history.'
            : 'The note will appear in chronological order.',
        })
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update note'
        setOptimisticImportant((prev) => !prev) // revert
        toast({
          variant: 'destructive',
          title: 'Update failed',
          description: message,
        })
      }
    })
  }

  return (
    <Button
      type="button"
      variant={optimisticImportant ? 'default' : 'ghost'}
      size="sm"
      className={optimisticImportant ? 'bg-amber-500 text-white hover:bg-amber-600' : 'text-muted-foreground'}
      onClick={handleToggle}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Star className={`mr-1 h-4 w-4 ${optimisticImportant ? 'fill-current' : ''}`} aria-hidden="true" />
      )}
      <span>{optimisticImportant ? 'Important' : 'Mark important'}</span>
    </Button>
  )
}
