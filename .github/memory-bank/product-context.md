# Product Context

## Product Name
LocalShare

## Problem
Users need fast, frictionless file transfer between devices on the same network without cloud uploads, account login, or cable dependency.

## Solution
Start a local HTTP server on one device; browse and download files from any browser on the same LAN.

## Target User
Personal user with mixed-OS devices (phone + laptop/desktop) who frequently transfers files between them.

## Core Value Proposition
One-click file sharing with zero setup, no accounts, no outside dependency.

## Scope Boundaries (v0/v1)
- **In**: Local network only; browser-based access; single-session mode; basic auth (PIN optional).
- **Out**: Internet relay, upload, native apps, WebDAV, cloud sync.

## Must-Have (v0)
1. Start/stop sharing from host UI
2. Safe folder-bound file access (no path traversal)
3. Browser-based directory listing and download
4. Cross-platform host support (mobile + desktop)
5. Clear "sharing active" warning
6. Works offline (no cloud dependency)

## Product Constraints
- Privacy-first: No tracking, no cloud, local-only.
- Simplicity-first: Minimize UI, auth friction; earn complexity later.
- Security-progressive: Open mode now; PIN/password/pairing in later phases.

## Next Milestones (Roadmap)
See roadmap.md for v0 → v3 feature phases.
