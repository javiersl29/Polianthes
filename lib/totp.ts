/**
 * TOTP (Time-based One-Time Password) para 2FA del panel admin.
 * Compatible con Google Authenticator, Authy, 1Password, Microsoft Authenticator.
 * Estándar RFC 6238.
 */
import { generateSecret, generateSync, verifySync } from "otplib";
import QRCode from "qrcode";

/**
 * Genera un secret base32 aleatorio para TOTP.
 */
export function generateTotpSecret(): string {
  return generateSecret();
}

/**
 * Genera un código TOTP de 6 dígitos a partir de un secret.
 */
export function generateTotpToken(secret: string): string {
  return generateSync({ secret });
}

/**
 * Verifica un código TOTP de 6 dígitos contra el secret guardado.
 * Acepta ±1 ventana (±30s) de tolerancia por defecto en otplib.
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    const result = verifySync({ token: token.trim(), secret });
    return Boolean(result.valid);
  } catch {
    return false;
  }
}

/**
 * Construye el otpauth:// URI para escanear con Google Authenticator.
 * Formato: otpauth://totp/ISSUER:ACCOUNT?secret=SECRET&issuer=ISSUER
 */
export function buildOtpAuthUri(
  secret: string,
  username: string,
  issuer = "Polianthes"
): string {
  const label = encodeURIComponent(`${issuer}:${username}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Genera un QR code en base64 (data URL) para el otpauth URI.
 * El admin lo escanea con Google Authenticator para registrar el secret.
 */
export async function generateQrCodeDataUrl(
  secret: string,
  username: string
): Promise<string> {
  const uri = buildOtpAuthUri(secret, username);
  return QRCode.toDataURL(uri, {
    width: 240,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" }
  });
}
