import {basename, extname} from 'path';
import {readFileSync} from 'fs';
import {gunzipSync} from 'zlib';
import virtual from '@rollup/plugin-virtual';
import {mergeConfig, defineConfig} from 'vitest/config';
import baseConfig, {chromiumBrowser} from './vitest.config.base';

// Minimal tar reader (ustar): yields regular file entries from an already-gunzipped buffer.
function *readTar(buffer: Buffer): Generator<{name: string, content: Buffer}> {
    for (let offset = 0; offset + 512 <= buffer.length;) {
        const block = buffer.subarray(offset, offset + 512);
        // Two consecutive zero-filled blocks mark the end of the archive.
        if (block.every(byte => byte === 0)) break;

        const readString = (start: number, length: number) => {
            const raw = block.subarray(start, start + length);
            const end = raw.indexOf(0);
            return raw.toString('utf8', 0, end === -1 ? length : end);
        };

        const name = readString(0, 100);
        const size = parseInt(readString(124, 12).trim() || '0', 8);
        const typeFlag = readString(156, 1);
        const prefix = readString(345, 155);
        const fullName = prefix ? `${prefix}/${name}` : name;

        offset += 512;
        if (typeFlag === '0' || typeFlag === '') {
            yield {name: fullName, content: buffer.subarray(offset, offset + size)};
        }
        offset += Math.ceil(size / 512) * 512;
    }
}

// Extract PNG fixtures (base64) and iconset protobufs (base64) from the test-suite tarballs,
// so tests can read them without unpacking the archives to disk.
const fixtures: Record<string, string> = {};
const iconsets: Record<string, string> = {};

for (const tarPath of ['./test/usvg/test-suite.tar.gz', './test/usvg/mapbox_usvg_pb_test_suite.tar.gz']) {
    const suite = basename(tarPath, '.tar.gz');
    for (const {name, content} of readTar(gunzipSync(readFileSync(tarPath)))) {
        if (basename(name).startsWith('._')) continue; // skip macOS AppleDouble metadata files
        const ext = extname(name);
        if (ext === '.png') {
            fixtures[basename(name, '.png')] = content.toString('base64');
        } else if (ext === '.iconset') {
            iconsets[suite] = content.toString('base64');
        }
    }
}

export default mergeConfig(baseConfig, defineConfig({
    test: {
        browser: chromiumBrowser(),
        retry: 0,
        include: ['./test/usvg/*.test.ts'],
        setupFiles: ['./test/usvg/setup.ts'],
    },
    plugins: [
        virtual({
            'virtual:usvg-fixtures': `export const fixtures = ${JSON.stringify(fixtures)};\nexport const iconsets = ${JSON.stringify(iconsets)};`
        })
    ]
}));
