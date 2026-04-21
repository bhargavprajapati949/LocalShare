/**
 * Server Entry Point
 * 
 * Loads configuration, wires up dependencies, and starts HTTP server.
 * This is the composition root where all layers are connected.
 */

import Bonjour from 'bonjour-service';
import { loadConfig, getDefaultMdnsDomainName, getLanIPv4Candidates } from './infrastructure/config';
import { FileSystemAdapter } from './infrastructure/fileSystemAdapter';
import { HostSessionState } from './domain/models/hostSession';
import { ListFilesUseCase } from './application/useCases/listFiles';
import { DownloadFileUseCase } from './application/useCases/downloadFile';
import { DownloadDirectoryUseCase } from './application/useCases/downloadDirectory';
import { UploadFileUseCase } from './application/useCases/uploadFile';
import { CreateDirectoryUseCase } from './application/useCases/createDirectory';
import { DeleteEntryUseCase } from './application/useCases/deleteEntry';
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
  const uploadFileUseCase = new UploadFileUseCase(fileSystem, sessionState);
  const createDirectoryUseCase = new CreateDirectoryUseCase(fileSystem, sessionState);
  const deleteEntryUseCase = new DeleteEntryUseCase(fileSystem, sessionState);

  const bonjour = config.mdnsEnabled ? new Bonjour() : undefined;
  let activeService: { stop?: CallableFunction } | undefined;

  const republishMdns = (domainOverride?: string): void => {
    if (!bonjour) {
      return;
    }

    const domainName = (domainOverride || sessionState.getDomainName() || config.customDomainName || getDefaultMdnsDomainName()).toLowerCase();
    const lanAddresses = getLanIPv4Candidates();

    const previous = activeService;
    const serviceConfig = {
      name: 'LAN File Host',
      type: 'http',
      host: domainName,
      port: config.port,
      addresses: lanAddresses.length ? lanAddresses : undefined,
      txt: {
        path: '/',
        description: 'LAN File Host',
        domain: domainName,
      },
    } as unknown as Parameters<typeof bonjour.publish>[0];

    const svc = bonjour.publish(serviceConfig);
    // Suppress well-known bonjour conflicts (duplicate service name on LAN)
    (svc as unknown as { on?: (evt: string, cb: (err: Error) => void) => void }).on?.('error', (err: Error) => {
      console.warn(`mDNS: ${err.message}`);
    });
    activeService = svc;

    if (previous?.stop) {
      previous.stop(() => undefined);
    }

    console.log(`mDNS enabled - Access at: http://${domainName}:${config.port}`);
    console.log('mDNS: advertising LAN File Host on local network');
  };

  // Create Express app (injected with all dependencies)
  const { app } = createApp(
    config,
    sessionState,
    listFilesUseCase,
    downloadFileUseCase,
    downloadDirectoryUseCase,
    uploadFileUseCase,
    createDirectoryUseCase,
    deleteEntryUseCase,
    (domainName) => {
      republishMdns(domainName);
    },
  );

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
      republishMdns();
    }

    const shutdown = (): void => {
      if (bonjour) {
        bonjour.unpublishAll(() => {
          bonjour.destroy();
          server.close(() => process.exit(0));
        });
        return;
      }

      server.close(() => process.exit(0));
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}

main();
