const address = require('address');
const qrcode = require('qrcode-terminal');

const url = `http://${address.ip()}:9966/test/release/index.html`;
console.warn(`Scan this QR code or enter ${url}`);
qrcode.generate(url);
