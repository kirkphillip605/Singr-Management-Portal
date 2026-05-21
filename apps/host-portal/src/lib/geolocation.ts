interface GeolocationPosition {
  coords: {
    latitude: number
    longitude: number
    accuracy: number
  }
}

interface GeolocationError {
  code: number
  message: string
}

export interface LocationResult {
  lat: number
  lng: number
  accuracy?: number
}

export class GeolocationService {
  private static instance: GeolocationService
  
  public static getInstance(): GeolocationService {
    if (!GeolocationService.instance) {
      GeolocationService.instance = new GeolocationService()
    }
    return GeolocationService.instance
  }

  async getCurrentPosition(): Promise<LocationResult | null> {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser')
      return null
    }

    // Check permissions first
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' })
      
      if (permission.state === 'denied') {
        console.warn('Geolocation permission denied')
        return null
      }
    } catch (error) {
      console.warn('Could not check geolocation permissions:', error)
    }

    return new Promise((resolve) => {
      const options = {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }

      navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        },
        (error: GeolocationError) => {
          console.warn('Geolocation error:', error.message)
          resolve(null)
        },
        options
      )
    })
  }

  async requestPermission(): Promise<boolean> {
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' })
      return permission.state === 'granted'
    } catch (error) {
      console.warn('Could not check geolocation permissions:', error)
      return false
    }
  }
}

export const geolocationService = GeolocationService.getInstance()
