# Roadmap

Status values:
- todo: Not started
- inprogress: Being implemented
- done: Implemented and usable

## Features

### Hosting and Session - done
- Start/stop host server - done
- Select shared root folders - done
- Host status and open-mode warning - done
- Separate host admin UI and client access UI - done
- Host admin controls for session, access, and transfer management - done

### Downloading
- File download - done
- Directory download (ZIP archive) - done
- Add pause/start/cancel controls for downloads - todo
- Allow directory download even when host free disk is low by streaming archive generation - done
- Parallel chunk downloading for faster transfers - todo

### Uploading
- Upload files to host - done
- Upload directories to host - todo

### File Browsing - done
- Browser directory listing - done
- Add sortable file list headers (name/size/date asc/desc) - done
- Create directory from UI - done
- Delete file or directory from UI - done
- Admin permission toggle for modify access - done
- Admin permission toggle for delete access - done

### Discovery and Connectivity - done
- QR share - done
- mDNS discovery - done
- Host-configured custom local domain name for LAN access - done
- Local domain resolution so clients can use hostname instead of raw IP - done

### Security and Access
- Session PIN support - todo
- Session PIN behavior documentation (how current implementation works) - todo
- Remove client UI controls that should be host-only (shared roots, PIN settings) - todo
- Read/write policies - todo
- Trusted devices - todo
- Logs and session control - todo

### Power User and Extensibility
- CLI mode - todo
- WebDAV mode - todo
- Extensibility and automation - todo

## Bugs
- Android mDNS (.local) resolution unreliable on same LAN/hotspot - todo
