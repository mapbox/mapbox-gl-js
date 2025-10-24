#!/usr/bin/env node

import {execSync} from 'child_process';
import {createCheck, getCheckSummary} from './gh-check-utils';

type Size = {
    name: string;
    size: number;
    passed: boolean;
    formattedDiff?: string;
};

const CHECK_NAME = 'GL JS Size';

function getSizes(): Size[] {
    const raw = execSync('npm run size --silent -- --json').toString().trim();
    return JSON.parse(raw || '[]') as Size[];
}

function formatSize(size: number): string {
    return `${(size / 1000).toFixed(2)} kB gzipped`;
}

// COMMIT_SHA and PRIOR_COMMIT_SHA are being set in the GitHub Action Workflow
const currentSha = process.env.COMMIT_SHA || execSync('git rev-parse HEAD').toString().trim();
const priorCommit = process.env.PRIOR_COMMIT_SHA;

// Fetch prior sizes
const priorSizes: Record<string, Size> = {};
const priorSummary = await getCheckSummary(priorCommit, CHECK_NAME);
if (priorSummary) {
    const sizes = JSON.parse(priorSummary) as Size[];
    for (const size of sizes) {
        priorSizes[size.name] = size;
    }
}

let passed = true;
const newSizes = getSizes();
for (const size of newSizes) {
    passed = passed && size.passed;
    const priorSize = priorSizes[size.name]?.size;
    const diff = priorSize ? size.size - priorSize : 0;
    const formattedSize = formatSize(size.size);
    if (diff === 0) {
        size.formattedDiff = `No changes (${formattedSize})`;
    } else {
        const percent = (diff / priorSize) * 100;
        size.formattedDiff = `${diff >= 0 ? '+' : ''}${formatSize(diff)} ${percent.toFixed(3)}% (${formattedSize})`;
    }
}

const jsSize = newSizes.find(s => s.name === 'dist/mapbox-gl.js');
const message = jsSize?.formattedDiff || '';
console.log(message);

const title = newSizes.map(size => `${size.name}: ${size.formattedDiff}`).join('; ');
await createCheck(currentSha, CHECK_NAME, title, JSON.stringify(newSizes), passed ? 'success' : 'failure');

process.on('unhandledRejection', (error: unknown) => {
    console.error((error as Error)?.message || 'Error');
    process.exit(1);
});
