/**
 * QR Code Service
 *
 * Generates QR codes for LAN URLs so mobile users can quickly connect.
 * Runs server-side to avoid exposing arbitrary URL generation to clients.
 */

import QRCode from 'qrcode';

/**
 * Generate a QR code PNG as a base64 data URL for the given URL.
 * @param url - The URL to encode (must be the server's own LAN URL)
 * @returns base64 PNG data URL string
 */
export async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 220,
    color: {
      dark: '#152132',
      light: '#ffffff',
    },
  });
}
