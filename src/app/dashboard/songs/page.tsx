import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Upload, Search, Music, Download, Trash2 } from 'lucide-react'

export default async function SongsPage() {
  const session = await getAuthSession()

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const songs = await prisma.songDb.findMany({
    where: { userId: session.user.id },
    orderBy: [
      { artist: 'asc' },
      { title: 'asc' },
    ],
    take: 100, // Limit for performance
  })

  const totalSongs = await prisma.songDb.count({
    where: { userId: session.user.id },
  })

  const artistCounts = await prisma.songDb.groupBy({
    by: ['artist'],
    where: { userId: session.user.id },
    _count: { artist: true },
    orderBy: { _count: { artist: 'desc' } },
    take: 10,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Song Database</h1>
          <p className="text-muted-foreground">
            Manage your karaoke song collection
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Songs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSongs.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Artists</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{artistCounts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top Artist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold truncate">
              {artistCounts[0]?.artist || 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">
              {artistCounts[0]?._count.artist || 0} songs
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">∞</div>
            <div className="text-sm text-muted-foreground">Unlimited</div>
          </CardContent>
        </Card>
      </div>

      {totalSongs === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Music className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No songs in your database</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add songs manually or import a song list to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search and Filter */}
          <Card>
            <CardHeader>
              <CardTitle>Search Songs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by artist, title, or combined..."
                    className="w-full"
                  />
                </div>
                <Button>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Top Artists */}
          <Card>
            <CardHeader>
              <CardTitle>Top Artists</CardTitle>
              <CardDescription>Artists with the most songs in your database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {artistCounts.slice(0, 10).map((artist) => (
                  <Badge key={artist.artist} variant="secondary" className="text-sm">
                    {artist.artist} ({artist._count.artist})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Songs List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Songs</CardTitle>
              <CardDescription>
                Showing {Math.min(100, songs.length)} of {totalSongs} songs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {songs.map((song) => (
                  <div key={song.songId.toString()} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50">
                    <div className="flex items-center space-x-3">
                      <Music className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{song.artist} - {song.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Added {new Date(song.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {totalSongs > 100 && (
                <div className="text-center mt-4">
                  <Button variant="outline">
                    Load More Songs
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}