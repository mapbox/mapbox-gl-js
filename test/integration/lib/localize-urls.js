import path from 'path';
import fs from 'fs';
import {styleText} from 'node:util';
// eslint-disable-next-line import-x/order
import {fileURLToPath} from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

import {createRequire} from 'module';
const require = createRequire(import.meta.url);

export default function localizeURLs(style, port) {
    if (style.imports) {
        for (const importSpec of style.imports) {
            localizeURLs(importSpec.data, port);
        }
    }

    if (style.metadata && style.metadata.test && style.metadata.test.operations) {
        style.metadata.test.operations.forEach((op) => {
            if (op[0] === 'setStyle') {
                if (typeof op[1] === 'object') {
                    localizeURLs(op[1], port);
                    return;
                }
                if (op[1].startsWith('mapbox://')) return;

                let styleJSON;
                try {
                    const relativePath = op[1].replace(/^local:\/\//, '');
                    if (relativePath.startsWith('mapbox-gl-styles')) {
                        styleJSON = fs.readFileSync(path.join(path.dirname(require.resolve('mapbox-gl-styles')), '..', relativePath));
                    } else {
                        styleJSON = fs.readFileSync(path.join(__dirname, '..', relativePath));
                    }
                } catch (error) {
                    console.log(styleText('blue', `* ${error}`));
                    return;
                }

                try {
                    styleJSON = JSON.parse(styleJSON.toString());
                } catch (error) {
                    console.log(styleText('blue', `* Error while parsing ${op[1]}: ${error}`));
                    return;
                }

                op[1] = styleJSON;
                op[2] = {diff: false};
            }
        });
    }
}