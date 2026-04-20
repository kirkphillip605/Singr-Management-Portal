'use client'

import * as React from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  LEGAL_LAST_UPDATED,
  POLICIES,
  PolicyContent,
  type PolicyKey,
} from '@/lib/legal-content'

interface PolicyDialogProps {
  policy: PolicyKey
  trigger: React.ReactNode
}

export function PolicyDialog({ policy, trigger }: PolicyDialogProps) {
  const meta = POLICIES[policy]
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>
            Last updated {LEGAL_LAST_UPDATED}
          </DialogDescription>
        </DialogHeader>
        <div className="prose prose-sm max-w-none">
          <PolicyContent policy={policy} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
