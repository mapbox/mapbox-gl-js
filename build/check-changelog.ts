import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

function entries(markdown: string): string[] {
    const unreleased = markdown.split(/^## Unreleased$/m)[1]?.split(/^## /m)[0];
    return unreleased?.match(/^- \S.*$/gm) || [];
}

const baseRef = process.argv[2];
if (!baseRef) throw new Error('Missing base Git revision.');

const prefix = execFileSync('git', ['rev-parse', '--show-prefix'], {encoding: 'utf8'}).trim();
const base = execFileSync('git', ['show', `${baseRef}:${prefix}CHANGELOG.md`], {encoding: 'utf8'});
const current = readFileSync('CHANGELOG.md', 'utf8');

if (entries(current).length <= entries(base).length) {
    console.error('CHANGELOG.md must add an entry to the Unreleased section.');
    process.exitCode = 1;
}
