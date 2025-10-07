'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export type SystemSummary = {
  id: string
  name: string
  openKjSystemId: number
  createdAt: string
  updatedAt: string
}

type Props = {
  initialSystems: SystemSummary[]
}

export function SystemsManager({ initialSystems }: Props) {
  const [systems, setSystems] = useState<SystemSummary[]>(initialSystems)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)

  const maxSystemId = systems.reduce((max, system) => Math.max(max, system.openKjSystemId), 0)

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newName.trim()) {
      setCreateError('Please provide a system name')
      return
    }

    setCreateLoading(true)
    setCreateError(null)

    try {
      const response = await fetch('/api/systems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })

      const data = await response.json()
      if (!response.ok) {
        setCreateError(data.error ?? 'Failed to create system')
        return
      }

      setSystems((prev) =>
        [...prev, data.system].sort((a, b) => a.openKjSystemId - b.openKjSystemId),
      )
      setNewName('')
    } catch (error) {
      console.error('Failed to create system', error)
      setCreateError('Unexpected error creating system')
    } finally {
      setCreateLoading(false)
    }
  }

  function startEditing(system: SystemSummary) {
    setEditingId(system.id)
    setEditingName(system.name)
    setEditError(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditingName('')
    setEditError(null)
  }

  async function handleRename(systemId: string) {
    if (!editingName.trim()) {
      setEditError('Name cannot be empty')
      return
    }

    setEditError(null)

    try {
      const response = await fetch(`/api/systems/${systemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      })

      const data = await response.json()
      if (!response.ok) {
        setEditError(data.error ?? 'Failed to update system')
        return
      }

      setSystems((prev) =>
        prev.map((system) =>
          system.id === systemId ? { ...system, name: data.system.name } : system,
        ),
      )
      setEditingId(null)
      setEditingName('')
    } catch (error) {
      console.error('Failed to update system', error)
      setEditError('Unexpected error updating system')
    }
  }

  async function handleDelete(systemId: string) {
    setDeleteError(null)
    setDeleteLoadingId(systemId)

    try {
      const response = await fetch(`/api/systems/${systemId}`, {
        method: 'DELETE',
      })
      const data = await response.json()
      if (!response.ok) {
        setDeleteError(data.error ?? 'Failed to delete system')
        return
      }

      setSystems((prev) => prev.filter((system) => system.id !== systemId))
    } catch (error) {
      console.error('Failed to delete system', error)
      setDeleteError('Unexpected error deleting system')
    } finally {
      setDeleteLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a system</CardTitle>
          <CardDescription>
            Systems are numbered automatically and must remain gapless. Creating a new system
            increments the next available OpenKJ system ID for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Enter system name"
              className="sm:max-w-xs"
              required
            />
            <Button type="submit" disabled={createLoading}>
              {createLoading ? 'Creating…' : 'Create system'}
            </Button>
          </form>
          {createError && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your systems</CardTitle>
          <CardDescription>
            Rename systems or remove the last system in the list. Deleting a system clears its songs from the Song DB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {systems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No systems available yet.</p>
          ) : (
            systems.map((system) => {
              const isEditing = editingId === system.id
              const canDelete = system.openKjSystemId === maxSystemId && systems.length > 1

              return (
                <div
                  key={system.id}
                  className="flex flex-col gap-4 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <Input
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          className="max-w-xs"
                          autoFocus
                        />
                      ) : (
                        <h3 className="text-lg font-semibold">{system.name}</h3>
                      )}
                      <Badge variant="outline">OpenKJ ID {system.openKjSystemId}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(system.createdAt).toLocaleDateString()} • Updated{' '}
                      {new Date(system.updatedAt).toLocaleDateString()}
                    </p>
                    {isEditing && editError && (
                      <p className="text-sm text-destructive">{editError}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isEditing ? (
                      <>
                        <Button size="sm" onClick={() => handleRename(system.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEditing}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEditing(system)}>
                        Rename
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!canDelete || deleteLoadingId === system.id}
                      onClick={() => {
                        if (!canDelete) return
                        if (
                          !window.confirm(
                            'Deleting this system will remove all associated songs. Continue?',
                          )
                        ) {
                          return
                        }
                        void handleDelete(system.id)
                      }}
                    >
                      {deleteLoadingId === system.id ? 'Deleting…' : 'Delete'}
                    </Button>
                  </div>
                </div>
              )
            })
          )}

          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
