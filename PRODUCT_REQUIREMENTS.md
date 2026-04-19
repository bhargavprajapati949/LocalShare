# Product Requirements - LAN File Host

## 1. Product Goal
Build a cross-platform app that starts a local HTTP server on a host device and allows other devices on the same local network to browse and download shared files through a browser.

## 2. Vision Statement
"Make local file transfer between devices as simple as opening one link."

## 3. Target Platforms
- Mobile: Android, iOS
- Desktop: Windows, macOS, Linux
- Client access: Any modern browser on same LAN

## 4. Primary User
- Personal user with mixed devices (phone + laptop/desktop)
- Wants quick transfer without cloud uploads, accounts, or cables

## 5. Core Problem We Solve
- Current workflows (cloud, chats, USB cable) are slow or inconvenient for local transfers.
- Users need direct local transfer with minimal setup.

## 6. Product Scope (Current Direction)
- Local network only (v0/v1)
- No internet relay in early phases
- Free and open source
- Per-session configurable access model
- Start simple; harden security and advanced features in later phases

## 7. Must Functionalities (Non-Negotiable)
These must exist before we call the product usable for real users:

1. (v0) Host can start/stop file server from app UI.
2. (v0) Once started, server stays up until user explicitly stops it (no auto-close).
3. (v0) Host can choose what folders are shared for a session.
4. (v0) Other devices can access host over LAN using URL or QR.
5. (v0) Host device IP is clearly shown in UI/status so clients can connect.
6. (v0) Browser client can navigate directories and download files.
7. (v0) Path traversal protection (never allow access outside shared roots).
8. (v0) App clearly indicates when sharing is active.
9. (v0) Host can instantly stop sharing and cut all new access.
10. (v0) Works offline (no cloud dependency).
11. (v0) Works across mobile + desktop host platforms.
12. (v0) Clear user warning when server is open on local network.
13. (v1) Large files (10 to 15 GB) transfer reliably without restart from zero after interruption; resume from last transferred point.
14. (v1) Host can configure a local domain name/hostname alias so clients can use it instead of typing raw IP.

## 8. Full Feature Inventory (All Possible Features)

### 8.1 Core Hosting
- Start/stop server
- Auto start on app open (optional)
- Share one or multiple root folders
- Session-only sharing profile
- Persistent trusted sharing profiles
- Per-root toggles (enable/disable)
- Show active host URL(s)
- Show LAN IP and port

### 8.2 Client Access and UX
- Web file explorer
- Breadcrumb navigation
- Search/filter within current directory
- Sort by name/size/date
- File metadata (size, modified date, type)
- File thumbnails (images/video)
- Multi-select download
- Folder as ZIP download
- Resume interrupted downloads
- Transfer progress and speed indicators

### 8.3 Discovery and Connectivity
- QR code for quick open
- Local discovery via mDNS/Bonjour
- Hostname access fallback
- Custom local domain/hostname alias configured by host
- Manual IP entry fallback
- Connection diagnostics (firewall, AP isolation)
- One-tap copy link

### 8.4 Security and Access Control
- Open LAN mode (quick mode)
- Session PIN
- Password mode
- Device pairing / trusted devices
- Access expiry timer
- Read-only vs read-write modes
- Per-folder access policies
- Download rate limiting
- Blocklist / allowlist
- Audit log (who downloaded what)

### 8.5 File Operations (Advanced)
- Upload to host
- Create folder
- Rename/move/delete (with safeguards)
- Conflict handling for same filename
- Batch operations
- Optional recycle bin behavior

### 8.6 Reliability and Performance
- Large file streaming
- Resume support
- Reliable 10 to 15 GB transfer handling
- Parallel transfer handling
- Pause/resume transfer queue
- Background hosting support
- Auto-recovery after temporary network drop
- Bandwidth limit control

### 8.7 Platform Experience
- Native notifications for transfer completion
- Tray/menu bar status on desktop
- Foreground service behavior on Android
- Background mode policy handling on iOS
- Share sheet integration (send to host quickly)

### 8.8 Product and Operations
- In-app logs export
- Crash reporting (opt-in)
- Telemetry (optional/opt-in)
- Localization support
- Theme customization
- Accessibility improvements (screen readers, contrast)
- Update checker
- Backup/restore settings

### 8.9 Developer and Ecosystem
- CLI host mode
- REST API docs
- Plugin architecture
- WebDAV compatibility mode
- Docker self-host mode

## 9. Phased Roadmap

## v0 (Implementation Start Phase)
Goal: Prove core local-host and browser-download loop is stable and safe.

Must include:
1. Start/stop local HTTP host.
2. Server remains running until user explicitly stops it.
3. Configure shared root folder(s).
4. Browse folders in web UI.
5. Download files from browser.
6. Strict path traversal protection.
7. Basic status page (active host info + URLs + host IP).
8. Clear warning when open mode is enabled.

Exit criteria:
- One host and one client on same Wi-Fi can complete transfer reliably.
- No directory escape vulnerability.
- App can stop sharing immediately.
- Server does not auto-stop during normal idle time or long-running session.

## v1 (MVP Public Beta)
Goal: Make product friendly and robust for daily personal use.

Features:
1. QR code sharing + copy link UX.
2. mDNS discovery.
3. Folder ZIP download.
4. Transfer progress and improved web UI.
5. Reliable 10 to 15 GB transfer support with resume from same point after interruption.
6. Host-configurable local domain/hostname alias for LAN access.
7. Session PIN authentication.
8. Basic diagnostics panel.
9. Mobile/desktop packaging for all target platforms.

Exit criteria:
- Non-technical user can complete first transfer in under 60 seconds.
- Stable behavior on Android, iOS, Windows, macOS, Linux.
- 10 to 15 GB file transfer can resume from interruption point and complete reliably.

## v2 (Security + Productivity)
Goal: Add stronger trust and richer workflows.

Features:
1. Device pairing / trusted devices.
2. Read-only vs read-write session modes.
3. Upload support.
4. Optional file actions (rename/move/delete with permissions).
5. Access logs and session history.
6. Rate limiting and session expiry.

## v3 (Power User + Ecosystem)
Goal: Extend beyond basic transfer into advanced usage.

Features:
1. CLI mode.
2. WebDAV mode.
3. Plugin-friendly architecture.
4. Advanced automation hooks.
5. Optional relay architecture exploration (if needed later).

## 10. Non-Goals (Near Term)
- Cloud sync product
- User account system
- Full remote device control
- Heavy collaboration/chat product

## 11. Risks
- Mobile OS background restrictions
- LAN discovery failures on restrictive routers
- User confusion around local-open mode security
- Platform-specific filesystem permission complexity

## 12. Success Metrics
- Time to first successful download
- Session success rate
- Crash-free session rate
- Number of support incidents for setup/connectivity
- Transfer completion rate for large files

## 13. Immediate Implementation Focus
We will implement v0 first.

Current codebase already covers part of v0:
- Local HTTP host
- Directory listing + download APIs
- Path traversal protection
- Basic browser UI

Next v0 tasks to finish:
1. Add explicit start/stop state controls in app layer.
2. Improve host status visibility and warning UX.
3. Add basic tests for path safety and list/download routes.
4. Freeze v0 acceptance checklist and run validation.
