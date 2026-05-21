import { NextResponse } from 'next/server'

export default function ApiHomePage() {
  return NextResponse.json({
    service: 'Singr Karaoke Connect API',
    version: '1.0.0',
    docs: 'https://singrkaraoke.com/docs/api',
  })
}
