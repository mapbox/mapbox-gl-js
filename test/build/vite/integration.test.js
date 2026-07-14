import path from 'node:path';
import {fileURLToPath} from 'node:url';
import harness from '../browser-check.cjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
harness.testPages({label: 'vite', root: path.join(dir, 'dist'), files: ['esm.html', 'umd.html']});
