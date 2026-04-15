#!/usr/bin/env node

import {execSync} from 'child_process';
import {readFileSync} from 'fs';
import {createCheck, getCheckSummary} from './gh-check-utils';

type Size = {
    name: string;
    size: number;
    passed: boolean;
    formattedDiff?: string;
};

const CHECK_NAME = 'GL JS Size';
const DATA_SEPARATOR = '\n\n<!-- size-data\n';
const DATA_SEPARATOR_END = '\n-->';

type SizeLimitEntry = {
    name?: string;
    path: string;
};

// Build a map from size-limit `name` (which equals `path` when no explicit name is set)
// to a human-friendly display name sourced from package.json.
// Entries with an explicit `name` use it as-is; path-only entries strip the `dist/` prefix.
function buildDisplayNames(): Record<string, string> {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const map: Record<string, string> = {};
    for (const entry of pkg['size-limit'] as SizeLimitEntry[]) {
        // size-limit uses the explicit `name` field as the key in JSON output,
        // falling back to `path` when no name is defined
        const key = entry.name ?? entry.path;
        map[key] = entry.name ?? entry.path.replace(/^dist\//, '');
    }
    return map;
}

const displayNames = buildDisplayNames();

function getSizes(): Size[] {
    let raw: string;
    try {
        raw = execSync('npm run size --silent -- --json').toString().trim();
    } catch (err: unknown) {
        // npm run size exits with non-zero when a chunk exceeds its limit,
        // but the JSON output is still written to stdout
        const stdout = (err as {stdout?: Buffer | string}).stdout;
        if (!stdout) throw err;
        raw = stdout.toString().trim();
        console.error(`npm run size failed:\n${raw}`);
    }
    return JSON.parse(raw || '[]') as Size[];
}

function formatSize(size: number): string {
    return `${(size / 1000).toFixed(2)} kB gzipped`;
}

function formatTable(sizes: Size[]): string {
    const rows = sizes.map(size => {
        const displayName = displayNames[size.name] ?? size.name;
        const absoluteSize = formatSize(size.size);
        return `| ${displayName} | ${absoluteSize} | ${size.formattedDiff} |`;
    });
    return [
        '| Chunk | Size | Change |',
        '|---|---|---|',
        ...rows,
    ].join('\n');
}

// COMMIT_SHA and PRIOR_COMMIT_SHA are being set in the GitHub Action Workflow
const currentSha = process.env.COMMIT_SHA || execSync('git rev-parse HEAD').toString().trim();
const priorCommit = process.env.PRIOR_COMMIT_SHA;

// Fetch prior sizes
const priorSizes: Record<string, Size> = {};
if (priorCommit) {
    const priorSummary = await getCheckSummary(priorCommit, CHECK_NAME);
    if (!priorSummary) {
        console.warn(`No prior size data found for check "${CHECK_NAME}" at ${priorCommit}, proceeding without comparison`);
    } else {
        // Extract JSON from after the separator, or fall back to parsing the whole summary
        // (for backwards compatibility with checks that stored raw JSON directly)
        const separatorIndex = priorSummary.indexOf(DATA_SEPARATOR);
        const json = separatorIndex !== -1
            ? priorSummary.slice(separatorIndex + DATA_SEPARATOR.length, priorSummary.lastIndexOf(DATA_SEPARATOR_END))
            : priorSummary;
        try {
            const sizes = JSON.parse(json) as Size[];
            for (const size of sizes) {
                priorSizes[size.name] = size;
            }
        } catch (_) {
            // Ignore parse errors from unrecognised legacy formats
        }
    }
}

let passed = true;
const newSizes = getSizes();
for (const size of newSizes) {
    passed = passed && size.passed;
    const priorSize = priorSizes[size.name]?.size;
    if (!priorSize) {
        size.formattedDiff = 'No prior data';
    } else if (size.size === priorSize) {
        size.formattedDiff = 'No change';
    } else {
        const diff = size.size - priorSize;
        const percent = (diff / priorSize) * 100;
        size.formattedDiff = `${diff >= 0 ? '+' : ''}${formatSize(diff)} (${percent >= 0 ? '+' : ''}${percent.toFixed(3)}%)`;
    }
}

const table = formatTable(newSizes);
console.log(table);

const failingCount = newSizes.filter(s => !s.passed).length;
const title = passed ? 'All bundles within size limits' : `${failingCount} bundle${failingCount === 1 ? '' : 's'} too large`;
const summary = `${table}${DATA_SEPARATOR}${JSON.stringify(newSizes)}${DATA_SEPARATOR_END}`;
await createCheck(currentSha, CHECK_NAME, title, summary, passed ? 'success' : 'failure');

if (!passed) {
    const failed = newSizes.filter(s => !s.passed).map(s => `  ${s.name}: ${formatSize(s.size)} (limit exceeded)`).join('\n');
    console.error(`Size limit exceeded:\n${failed}`);
    process.exit(1);
}

process.on('unhandledRejection', (error: unknown) => {
    console.error((error as Error)?.message || 'Error');
    process.exit(1);
});
