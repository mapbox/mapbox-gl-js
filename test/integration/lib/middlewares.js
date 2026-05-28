
import fs from 'fs';
import path from 'path';

export const defaultOptions = {
    index: false,
    fallthrough: false,
};

export async function writeFile(req, res) {
    let body = '';
    req.on('data', (data) => {
        body += data;
    });

    return req.on('end', () => {
        const {filePath, data} = JSON.parse(body);

        /** @type {'base64'} */
        let encoding;
        if (filePath.split('.')[1] !== 'json') {
            encoding = 'base64';
        }

        fs.writeFile(path.join(process.cwd(), filePath), data, encoding, () => {
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end('ok');
        });
    });
}

export const staticFolders = [
    'render-tests',
    'image',
    'geojson',
    'video',
    'tiles',
    'tilesets',
    'glyphs',
    'sprites',
    'data',
    'models'
];
