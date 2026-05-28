import {networkInterfaces} from 'os';

function ip() {
    for (const iface of Object.values(networkInterfaces()).flat()) {
        if (iface && iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
    return '127.0.0.1';
}

let url = `http://${ip()}:9966/test/release/index.html`;

const accessToken = process.env['MAPBOX_ACCESS_TOKEN'];
if (accessToken) url += `#page=&access_token=${accessToken}`;

console.warn(`Release testing URL: ${url}`);
