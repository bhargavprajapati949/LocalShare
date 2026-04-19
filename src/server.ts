/**
 * Server Entry Point
 * 
 * Loads configuration, wires up dependencies, and starts HTTP server.
 * This is the composition root where all layers are connected.
 */

import Bonjour from 'bonjour-service';
import { loadConfig, getLanIPv4Candidates } from './infrastructure/config';
import { FileSystemAdapter } from './infrastructure/fileSystemAdapter';
import { HostSessionState } from './domain/models/hostSession';
import { ListFilesUseCase } from './application/useCases/listFiles';
import { DownloadFileUseCase } from './application/useCases/downloadFile';
import { DownloadDirectoryUseCase } from './application/useCases/downloadDirectory';
import { createApp } from './application/appFactory';

/**
 * Start the server
 */
function main(): void {
  // Load and validate configuration
  const config = loadConfig();

  // Create domain model (session state)
  const sessionState = new HostSessionState();

  // Create infrastructure adapters
  const fileSystem = new FileSystemAdapter(config.roots);

  // Create application use cases (injected with ports)
  const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
  const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);
  const downloadDirectoryUseCase = new DownloadDirectoryUseCase(fileSystem, sessionState);

  // Create Express app (injected with all dependencies)
  const { app } = createApp(config, sessionState, listFilesUseCase, downloadFileUseCase, downloadDirectoryUseCase);

  // Start server
  const server = app.listen(config.port, config.host, () => {
    const addresses = getLanIPv4Candidates()
      .map((ip) => `http://${ip}:${config.port}`)
      .join('\n');

    console.log('LAN File Host started');
    console.log(`Local URL: http://localhost:${config.port}`);
    if (addresses) {
      console.log(`LAN URLs:\n${addresses}`);
    }
    console.log(`Shared roots: ${config.roots.map((r) => r.absPath).join(', ')}`);
    if (config.sessionPin) {
      console.log('PIN protection enabled');
    } else {
      console.log('No PIN configured (open on local network)');
    }

    const snapshot = sessionState.getSnapshot();
    console.log(`Sharing active: ${snapshot.sharingActive}`);
    console.log('Host control API endpoints are localhost-only: POST /api/host/start and POST /api/host/stop');

    // Advertise via mDNS/Bonjour so devices discover automatically
    if (config.mdnsEnabled) {
      const bonjour = new Bonjour();
      const bonjourService = bonjour.publish({
        name: 'LAN File Host',
        type: 'http',
        port: config.port,
      });

      const shutdown = (): void => {
        bonjour.unpublishAll(() => {
          bonjour.destroy();
          server.close(() => process.exit(0));
        });
      };

      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);

      console.log('mDNS: advertising LAN File Host on local network');
    }
  });
}

main();
