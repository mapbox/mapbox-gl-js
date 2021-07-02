import address from 'address';
import qrcode from 'qrcode-terminal'

const url = `http://${address.ip()}:9966/test/release/index.html`;
console.warn(`Scan this QR code or enter ${url}`);
qrcode.generate(url);
