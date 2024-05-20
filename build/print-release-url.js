/* eslint-disable flowtype/require-valid-file-annotation */

import {ip} from 'address';
import qrcode from 'qrcode-terminal';

let url = `http://${ip()}:9966/test/release/index.html`;
console.warn(`Scan this QR code or enter ${url}`);

const accessToken = process.env['MAPBOX_ACCESS_TOKEN'];
if (accessToken) url += `#page=&access_token=${accessToken}`;

qrcode.generate(url);
