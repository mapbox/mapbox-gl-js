import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '../..');

describe('published .d.ts must be self-contained', () => {
    for (const file of ['dist/mapbox-gl.d.ts', 'dist/esm/mapbox-gl.d.ts']) {
        it(`${file} references no external modules`, () => {
            const src = fs.readFileSync(path.join(root, file), 'utf8');
            const {importedFiles, referencedFiles} = ts.preProcessFile(src, true, true);
            const external = [...importedFiles, ...referencedFiles]
                .map((f) => f.fileName)
                .filter((name) => !name.startsWith('.') && !name.startsWith('/'));
            assert.deepEqual(external, []);
        });
    }
});
