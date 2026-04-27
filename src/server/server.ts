/**
 * File Server Class
 * 
 * Manages the lifecycle of the Express server and mDNS advertisements.
 * Exported to be controlled by the Electron Main Process.
 */

import { Server } from 'node:http';
import Bonjour from 'bonjour-service';
import { AppConfig, getDefaultMdnsDomainName, getLanIPv4Candidates } from './infrastructure/config';
import { FileSystemAdapter } from './infrastructure/fileSystemAdapter';
import { HostSessionState } from './domain/models/hostSession';
import { ListFilesUseCase } from './application/useCases/listFiles';
import { DownloadFileUseCase } from './application/useCases/downloadFile';
import { DownloadDirectoryUseCase } from './application/useCases/downloadDirectory';
import { UploadFileUseCase } from './application/useCases/uploadFile';
import { CreateDirectoryUseCase } from './application/useCases/createDirectory';
import { DeleteEntryUseCase } from './application/useCases/deleteEntry';
import { createApp } from './application/appFactory';

export class FileServer {
  private server?: Server;
  private bonjour?: Bonjour;
  private activeService?: { stop?: CallableFunction };
  private sessionState: HostSessionState;
  private fileSystem: FileSystemAdapter;

  constructor(private config: AppConfig) {
    this.sessionState = new HostSessionState();
    this.fileSystem = new FileSystemAdapter(config.roots);
  }

  /**
   * Start the HTTP and mDNS services
   */
  public async start(): Promise<{ port: number }> {
    const { config, sessionState, fileSystem } = this;

    const listFilesUseCase = new ListFilesUseCase(fileSystem, sessionState);
    const downloadFileUseCase = new DownloadFileUseCase(fileSystem, sessionState);
    const downloadDirectoryUseCase = new DownloadDirectoryUseCase(fileSystem, sessionState);
    const uploadFileUseCase = new UploadFileUseCase(fileSystem, sessionState);
    const createDirectoryUseCase = new CreateDirectoryUseCase(fileSystem, sessionState);
    const deleteEntryUseCase = new DeleteEntryUseCase(fileSystem, sessionState);

    this.bonjour = config.mdnsEnabled ? new Bonjour() : undefined;

    const { app } = createApp(
      config,
      sessionState,
      fileSystem,
      listFilesUseCase,
      downloadFileUseCase,
      downloadDirectoryUseCase,
      uploadFileUseCase,
      createDirectoryUseCase,
      deleteEntryUseCase,
      (domainName) => {
        this.republishMdns(domainName);
      },
    );

    return new Promise((resolve, reject) => {
      try {
        this.server = app.listen(config.port, config.host, () => {
          if (config.mdnsEnabled) {
            this.republishMdns();
          }
          resolve({ port: config.port });
        });

        this.server.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            // Logic for next available port could go here or in Main
            reject(err);
          } else {
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stop all services
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.activeService?.stop) {
        this.activeService.stop(() => undefined);
      }

      if (this.bonjour) {
        this.bonjour.unpublishAll(() => {
          this.bonjour?.destroy();
          this.bonjour = undefined;
          this.closeServer(resolve);
        });
      } else {
        this.closeServer(resolve);
      }
    });
  }

  private closeServer(callback: () => void): void {
    if (this.server) {
      this.server.close(() => {
        this.server = undefined;
        callback();
      });
    } else {
      callback();
    }
  }

  private republishMdns(domainOverride?: string, retryCount = 0): void {
    if (!this.bonjour) return;

    const baseDomainName = (domainOverride || this.sessionState.getDomainName() || this.config.customDomainName || getDefaultMdnsDomainName()).toLowerCase();
    const domainName = retryCount > 0 ? baseDomainName.replace(/\.local$/, `-${retryCount}.local`) : baseDomainName;
    const lanAddresses = getLanIPv4Candidates();

    const previous = this.activeService;
    const serviceConfig = {
      name: 'LocalShare',
      type: 'http',
      host: domainName,
      port: this.config.port,
      addresses: lanAddresses.length ? lanAddresses : undefined,
      txt: { path: '/', description: 'LocalShare', domain: domainName },
    } as any;

    try {
      const svc = this.bonjour.publish(serviceConfig);
      
      if (svc && typeof svc === 'object' && 'on' in svc) {
        (svc as any).on('error', (err: Error) => {
          if (err.message?.includes('already in use') && retryCount < 3) {
            if (this.activeService?.stop) this.activeService.stop(() => undefined);
            setTimeout(() => this.republishMdns(domainOverride, retryCount + 1), 1000);
          }
        });
      }

      this.activeService = svc;
      if (previous?.stop) previous.stop(() => undefined);
    } catch (error) {
      console.warn('mDNS error', error);
    }
  }

  public getSessionState() {
    return this.sessionState;
  }

  public getConfig() {
    return this.config;
  }

  public getDiscoveryHealth() {
    const lanAddresses = getLanIPv4Candidates();
    const configuredDomainName = (this.sessionState.getDomainName() || this.config.customDomainName || '').trim().toLowerCase();
    const domainName = configuredDomainName || getDefaultMdnsDomainName();
    const lanUrls = lanAddresses.map((ip) => `http://${ip}:${this.config.port}`);
    const domainUrl = domainName ? `http://${domainName}:${this.config.port}` : undefined;
    const warnings: string[] = [];

    if (!(this.config.host === '0.0.0.0' || this.config.host === '::')) {
      warnings.push(`Server bind host is ${this.config.host}. Use HOST=0.0.0.0 for LAN access.`);
    }
    if (!lanAddresses.length) {
      warnings.push('No LAN IPv4 interface detected. Connect to Wi-Fi/hotspot and retry.');
    }
    if (!this.sessionState.isSharingActive()) {
      warnings.push('Sharing is currently stopped. Start sharing before testing from other devices.');
    }
    if (!this.config.mdnsEnabled) {
      warnings.push('mDNS is disabled (MDNS_ENABLED=0). Domain-based access will not work.');
    }
    if (domainName && ['test.local', 'host.local', 'server.local', 'my-files.local'].includes(domainName)) {
      warnings.push('Domain name is generic and may collide on LAN. Use a unique name like yourname-files.local.');
    }

    warnings.push('Many mobile browsers, especially on Android, do not reliably resolve .local mDNS hostnames. Use the LAN IP URL or QR code on phones if the domain URL fails.');
    warnings.push('If IP URL works but domain URL does not, the network likely blocks multicast DNS or the client OS/browser does not support .local resolution.');
    warnings.push('If nothing works from other devices, check host OS firewall and hotspot/client-isolation settings.');

    return {
      host: this.config.host,
      port: this.config.port,
      sharingActive: this.sessionState.isSharingActive(),
      mdnsEnabled: this.config.mdnsEnabled,
      configuredDomainName: configuredDomainName || undefined,
      domainName,
      domainUrl,
      lanAddresses,
      lanUrls,
      recommendedClientUrls: domainUrl ? [...lanUrls, domainUrl] : lanUrls,
      warnings,
    };
  }
}
