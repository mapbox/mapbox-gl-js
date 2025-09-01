import {ip} from 'address';
import qrcode from 'qrcode-terminal';

let url = `http://${ip()}:9966/test/release/index.html`;
console.warn(`Scan this QR code or enter ${url}`);

const accessToken = process.env['MAPBOX_ACCESS_TOKEN'];
if (accessToken) url += `#page=&access_token=${accessToken}`;

// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
qrcode.generate(url);
