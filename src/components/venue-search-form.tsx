'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MapPin, Search, Plus, Loader2, Phone, Globe, Clock } from 'lucide-react'
import { z } from 'zod'

const searchSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
})

const manualVenueSchema = z.object({
  name: z.string().min(1, 'Venue name is required'),
  displayName: z.string().optional(),
  urlName: z.string().min(1, 'URL name is required').regex(/^[a-z0-9-]+$/, 'URL name can only contain lowercase letters, numbers, and hyphens'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('US'),
  phoneNumber: z.string().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  acceptingRequests: z.boolean().default(true),
})

interface HereSearchResult {
  id: string
  title: string
  address: {
    label: string
    countryCode: string
    countryName: string
    stateCode?: string
    state?: string
    city?: string
    street?: string
    postalCode?: string
    houseNumber?: string
  }
  position: {
    lat: number
    lng: number
  }
  contacts?: Array<{
    phone?: Array<{ value: string }>
    www?: Array<{ value: string }>
  }>
  categories?: Array<{
    name: string
    primary?: boolean
  }>
  openingHours?: Array<{
    text: string[]
    isOpen: boolean
  }>
}

interface UserLocation {
  lat: number
  lng: number
}

export function VenueSearchForm() {
  const [step, setStep] = useState<'search' | 'results' | 'manual'>('search')
  const [searchData, setSearchData] = useState({
    businessName: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
  })
  const [manualData, setManualData] = useState({
    name: '',
    displayName: '',
    urlName: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    phoneNumber: '',
    website: '',
    acceptingRequests: true,
  })
  const [isSearching, setIsSearching] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [searchResults, setSearchResults] = useState<HereSearchResult[]>([])
  const [selectedResult, setSelectedResult] = useState<HereSearchResult | null>(null)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationError, setLocationError] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  // Get user location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        (error) => {
          setLocationError('Unable to get your location. You can still search and add venues manually.')
          console.warn('Geolocation error:', error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      )
    } else {
      setLocationError('Geolocation is not supported by this browser.')
    }
  }, [])

  const generateUrlName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const handleNameChange = (name: string) => {
    setManualData(prev => ({
      ...prev,
      name,
      urlName: prev.urlName || generateUrlName(name)
    }))
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSearching(true)
    setError('')
    setSearchResults([])

    try {
      const validatedData = searchSchema.parse(searchData)
      
      // Build search query
      const queryParts = [validatedData.businessName]
      if (validatedData.address) queryParts.push(validatedData.address)
      if (validatedData.city) queryParts.push(validatedData.city)
      if (validatedData.state) queryParts.push(validatedData.state)
      if (validatedData.postalCode) queryParts.push(validatedData.postalCode)
      
      const query = queryParts.join(' ')

      const response = await fetch('/api/venues/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          userLocation,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Search failed')
      }

      setSearchResults(data.results || [])
      setStep('results')
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(error.errors[0].message)
      } else {
        setError(error instanceof Error ? error.message : 'Search failed')
      }
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectResult = (result: HereSearchResult) => {
    setSelectedResult(result)
    
    // Pre-populate manual form with selected result
    const address = result.address.houseNumber && result.address.street 
      ? `${result.address.houseNumber} ${result.address.street}`
      : result.address.street || ''
    
    setManualData({
      name: result.title,
      displayName: '',
      urlName: generateUrlName(result.title),
      address,
      city: result.address.city || '',
      state: result.address.state || '',
      postalCode: result.address.postalCode || '',
      country: result.address.countryName || 'US',
      phoneNumber: result.contacts?.[0]?.phone?.[0]?.value || '',
      website: result.contacts?.[0]?.www?.[0]?.value || '',
      acceptingRequests: true,
    })
    
    setStep('manual')
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError('')

    try {
      const validatedData = manualVenueSchema.parse(manualData)

      const response = await fetch('/api/venues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...validatedData,
          herePlaceId: selectedResult?.id || null,
          latitude: selectedResult?.position.lat || null,
          longitude: selectedResult?.position.lng || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create venue')
      }

      router.push('/dashboard/venues')
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(error.errors[0].message)
      } else {
        setError(error instanceof Error ? error.message : 'An error occurred')
      }
    } finally {
      setIsCreating(false)
    }
  }

  if (step === 'search') {
    return (
      <div className="space-y-6">
        {locationError && (
          <Alert>
            <MapPin className="h-4 w-4" />
            <AlertDescription>{locationError}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Search for Your Venue</CardTitle>
            <CardDescription>
              Search by business name and location to find your venue automatically
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  value={searchData.businessName}
                  onChange={(e) => setSearchData(prev => ({ ...prev, businessName: e.target.value }))}
                  placeholder="e.g., Thirsty's Bar"
                  required
                  disabled={isSearching}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={searchData.address}
                    onChange={(e) => setSearchData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="1500 N Duff St"
                    disabled={isSearching}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={searchData.city}
                    onChange={(e) => setSearchData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Mitchell"
                    disabled={isSearching}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={searchData.state}
                    onChange={(e) => setSearchData(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="SD"
                    disabled={isSearching}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postalCode">ZIP Code</Label>
                  <Input
                    id="postalCode"
                    value={searchData.postalCode}
                    onChange={(e) => setSearchData(prev => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="57301"
                    disabled={isSearching}
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-4">
                <Button type="submit" disabled={isSearching} className="flex-1">
                  {isSearching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search Venues
                    </>
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep('manual')}
                  disabled={isSearching}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Manually
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'results') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Search Results</h2>
            <p className="text-muted-foreground">
              Found {searchResults.length} venue{searchResults.length !== 1 ? 's' : ''} matching your search
            </p>
          </div>
          <Button variant="outline" onClick={() => setStep('search')}>
            Back to Search
          </Button>
        </div>

        {searchResults.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No venues found</h3>
              <p className="text-muted-foreground mb-4">
                We couldn't find any venues matching your search criteria.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setStep('search')}>
                  Try Different Search
                </Button>
                <Button variant="outline" onClick={() => setStep('manual')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Manually
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {searchResults.map((result) => (
              <Card key={result.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{result.title}</h3>
                        {result.categories?.[0] && (
                          <Badge variant="secondary" className="text-xs">
                            {result.categories[0].name}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{result.address.label}</span>
                        </div>
                        
                        {result.contacts?.[0]?.phone?.[0] && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{result.contacts[0].phone[0].value}</span>
                          </div>
                        )}
                        
                        {result.contacts?.[0]?.www?.[0] && (
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            <span className="truncate">{result.contacts[0].www[0].value}</span>
                          </div>
                        )}
                      </div>
                      
                      {result.openingHours?.[0] && (
                        <div className="mt-3 p-2 bg-muted/50 rounded-md">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4" />
                            <span className={result.openingHours[0].isOpen ? 'text-green-600' : 'text-red-600'}>
                              {result.openingHours[0].isOpen ? 'Open' : 'Closed'}
                            </span>
                          </div>
                          {result.openingHours[0].text.slice(0, 2).map((hours, idx) => (
                            <p key={idx} className="text-xs text-muted-foreground mt-1">
                              {hours}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <Button onClick={() => handleSelectResult(result)}>
                      Select This Venue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            <Separator />
            
            <Card>
              <CardContent className="text-center py-6">
                <p className="text-muted-foreground mb-4">
                  Can't find your venue in the results above?
                </p>
                <Button variant="outline" onClick={() => setStep('manual')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Venue Manually
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    )
  }

  // Manual entry step
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {selectedResult ? 'Confirm Venue Details' : 'Add Venue Manually'}
          </h2>
          <p className="text-muted-foreground">
            {selectedResult ? 'Review and adjust the venue information' : 'Enter your venue information manually'}
          </p>
        </div>
        <Button variant="outline" onClick={() => setStep(selectedResult ? 'results' : 'search')}>
          Back
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleManualSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Venue Name *</Label>
                <Input
                  id="name"
                  value={manualData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., The Singing Spot"
                  required
                  disabled={isCreating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={manualData.displayName}
                  onChange={(e) => setManualData(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="e.g., Main Location (optional)"
                  disabled={isCreating}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="urlName">URL Name *</Label>
              <Input
                id="urlName"
                value={manualData.urlName}
                onChange={(e) => setManualData(prev => ({ ...prev, urlName: e.target.value }))}
                placeholder="e.g., singing-spot"
                required
                disabled={isCreating}
              />
              <p className="text-sm text-muted-foreground">
                This will be used in the request URL: /venue/{manualData.urlName || 'your-url-name'}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Address Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={manualData.address}
                  onChange={(e) => setManualData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main Street"
                  disabled={isCreating}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={manualData.city}
                    onChange={(e) => setManualData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Anytown"
                    disabled={isCreating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State/Province</Label>
                  <Input
                    id="state"
                    value={manualData.state}
                    onChange={(e) => setManualData(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="CA"
                    disabled={isCreating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postalCode">ZIP/Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={manualData.postalCode}
                    onChange={(e) => setManualData(prev => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="90210"
                    disabled={isCreating}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Contact Information (Optional)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    value={manualData.phoneNumber}
                    onChange={(e) => setManualData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                    disabled={isCreating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={manualData.website}
                    onChange={(e) => setManualData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://example.com"
                    disabled={isCreating}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="acceptingRequests"
                checked={manualData.acceptingRequests}
                onCheckedChange={(checked) => setManualData(prev => ({ ...prev, acceptingRequests: checked }))}
                disabled={isCreating}
              />
              <Label htmlFor="acceptingRequests">Accept song requests immediately</Label>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isCreating} className="flex-1">
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Venue'
                )}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.push('/dashboard/venues')}
                disabled={isCreating}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}