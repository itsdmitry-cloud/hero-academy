import QRCode from 'qrcode';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const url = process.argv[2];
const outPath = process.argv[3] ?? '../presentation-assets/qr-consent.png';

if (!url) {
  console.error('Usage: tsx scripts/generate-qr.ts <url> [out-path]');
  process.exit(1);
}

const absOut = resolve(process.cwd(), outPath);
mkdirSync(dirname(absOut), { recursive: true });

QRCode.toFile(absOut, url, {
  width: 800,
  margin: 2,
  color: { dark: '#1a1a2e', light: '#ffffff' },
})
  .then(() => {
    console.log(`QR code written to: ${absOut}`);
  })
  .catch((err) => {
    console.error('Failed to generate QR code:', err);
    process.exit(1);
  });
