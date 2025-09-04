#!/usr/bin/env node

import {execSync} from 'child_process';
import {createCheck, getCheckSummary} from './gh-check-utils';

type Size = {
    name: string;
    size: number;
    passed: boolean;
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

// Calculate new sizes
let passed = true;
const titles = [];
const newSizes = getSizes();
for (const size of newSizes) {
    passed = passed && size.passed;

    const priorSize = priorSizes[size.name]?.size;
    if (!priorSize) {
        titles.push(`${size.name} ${formatSize(size.size)}`);
        continue;
    }

    const diff = size.size - priorSize;
    if (diff === 0) {
        titles.push(`${size.name} ${formatSize(size.size)}`);
        continue;
    }

    const percent = (diff / priorSize) * 100;
    titles.push(`${size.name} ${diff >= 0 ? '+' : ''}${formatSize(diff)} ${percent.toFixed(3)}% (${formatSize(size.size)})`);
}

const title = titles.join('; ');
const summary = JSON.stringify(newSizes);
console.log(title);

await createCheck(currentSha, CHECK_NAME, title, summary, passed ? 'success' : 'failure');

process.on('unhandledRejection', (error: unknown) => {
    console.error((error as Error)?.message || 'Error');
    process.exit(1);
});
