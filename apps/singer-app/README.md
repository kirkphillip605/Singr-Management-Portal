# Singr Singer App

> **Status**: Planned — not yet implemented.

This workspace will house the singer-facing mobile/web experience for Singr Karaoke Connect, built with **Capacitor** + React.

## Planned Features

- Browse nearby venues accepting song requests
- Submit song requests to a venue's queue
- View queue position and estimated wait time
- Singer profile and favourites

## Architecture

- **Frontend**: React (shared `@singr/ui` components)
- **Native wrapper**: Capacitor (iOS + Android)
- **Auth**: `@singr/auth` via Bearer token (no cookie — native shell)
- **API**: Communicates with `@singr/api` (OpenKJ endpoints)

## Getting Started

This app will be scaffolded when development begins. For now, it's a placeholder in the monorepo workspace.
