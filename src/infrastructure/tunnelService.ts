/**
 * Internet Tunnel Service
 * 
 * Manages ngrok tunnel connections for exposing local server to the internet.
 * Provides simple start/stop interface for tunnel management.
 */

// Dynamic ngrok module loading - handled at runtime to avoid build-time dependency issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ngrokModule: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadNgrok(): Promise<any> {
  if (!ngrokModule) {
    try {
      // Dynamic require to handle optional ngrok dependency
      ngrokModule = require('ngrok');
    } catch (error) {
      console.warn('ngrok package not installed. Internet tunnel feature unavailable.');
    }
  }
  return ngrokModule;
}

export interface TunnelConfig {
  readonly type: 'ngrok' | 'localtunnel';
  readonly port: number;
  readonly onUrlChange?: (url: string | undefined) => void;
}

export class TunnelService {
  private currentUrl: string | undefined;
  private authToken?: string;
  private onUrlChange?: (url: string | undefined) => void;

  constructor(config: TunnelConfig) {
    this.onUrlChange = config.onUrlChange;
  }

  /**
   * Start tunnel with given configuration
   * @param type - Tunnel type (ngrok or localtunnel)
   * @param port - Port to expose
   * @param authToken - Optional auth token for ngrok
   * @returns Public URL or undefined if failed
   */
  public async startTunnel(type: 'ngrok' | 'localtunnel', port: number, authToken?: string): Promise<string | undefined> {
    try {
      if (type === 'ngrok') {
        return await this.startNgrokTunnel(port, authToken);
      } else {
        // localtunnel requires separate package; for now, return undefined
        console.warn('Localtunnel support not yet implemented. Using ngrok instead.');
        return await this.startNgrokTunnel(port, authToken);
      }
    } catch (error) {
      console.error('Failed to start tunnel:', error);
      return undefined;
    }
  }

  /**
   * Start ngrok tunnel
   */
  private async startNgrokTunnel(port: number, authToken?: string): Promise<string | undefined> {
    try {
      const client = await loadNgrok();
      if (!client) {
        console.error('ngrok not available');
        return undefined;
      }

      if (authToken) {
        await client.authtoken(authToken);
      }

      const url = await client.connect({
        proto: 'http',
        addr: port,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onLogEvent: (data: any) => {
          if (String(data).includes('client session closed')) {
            this.currentUrl = undefined;
            this.onUrlChange?.(undefined);
          }
        },
      });

      this.currentUrl = String(url);
      this.onUrlChange?.(this.currentUrl);
      return this.currentUrl;
    } catch (error) {
      console.error('Ngrok tunnel error:', error);
      this.currentUrl = undefined;
      this.onUrlChange?.(undefined);
      return undefined;
    }
  }

  /**
   * Stop tunnel
   */
  public async stopTunnel(): Promise<void> {
    try {
      const client = await loadNgrok();
      if (client) {
        await client.disconnect();
      }
      this.currentUrl = undefined;
      this.onUrlChange?.(undefined);
    } catch (error) {
      console.error('Error stopping tunnel:', error);
    }
  }

  /**
   * Get current tunnel URL
   */
  public getCurrentUrl(): string | undefined {
    return this.currentUrl;
  }

  /**
   * Set auth token for ngrok
   */
  public setAuthToken(token: string | undefined): void {
    this.authToken = token;
  }
}
