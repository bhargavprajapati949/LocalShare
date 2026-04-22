# Features

LocalShare is a local-network file sharing app designed for fast, no-account transfer between devices on the same LAN.

## Core Experience

- Host and client web UIs
- Real-time host status and LAN URL visibility
- Start/stop sharing controls from host machine
- QR code generation for fast phone access
- mDNS/local domain support for friendly hostnames

## File Browsing and Download

- Directory browsing with breadcrumb navigation
- Sort by name, size, and date
- File download via browser
- Directory download as ZIP archive
- Managed download mode with progress
- Pause, resume, and cancel controls
- Parallel chunk download for faster transfers
- Browser-managed download mode toggle

## Upload and File Operations

- File upload from browser
- Directory upload with nested structure preservation
- Resumable chunked upload sessions
- Upload pause/resume/cancel controls
- Create folder from UI
- Delete file/folder from UI

## Access and Security

- Optional session PIN protection
- PIN prompt flow in client UI
- Localhost-only host admin controls
- Read permission toggle (browse/download)
- Upload permission toggle
- Create permission toggle
- Delete permission toggle

## WebDAV Mode

- WebDAV endpoint for desktop/mobile clients
- Toggle enable/disable from admin UI
- PIN authentication support for WebDAV clients
- RFC 4918 method support:
  - OPTIONS
  - PROPFIND
  - GET / HEAD
  - PUT
  - MKCOL
  - DELETE
  - COPY / MOVE
  - LOCK / UNLOCK

## Host Configuration and Diagnostics

- Set shared root folder from admin UI
- Native folder picker support on macOS
- Configure custom local domain name
- Discovery health diagnostics endpoint and UI section
- Helpful LAN/mDNS troubleshooting hints

## Packaging and Distribution

- Build standalone binaries for:
  - macOS (Apple Silicon and Intel)
  - Linux x64
  - Windows x64
- Consumers can run the app without installing Node.js
