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
}
