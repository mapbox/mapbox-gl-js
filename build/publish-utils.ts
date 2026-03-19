import fs from 'fs';
import {execSync} from 'child_process';
import readline from 'readline';

export interface ParsedSemver {
    major: number;
    minor: number;
    patch: number;
    prerelease: string | null;
}

export function parseSemver(version: string): ParsedSemver {
    const v = version.startsWith('v') ? version.slice(1) : version;

    const match = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match) {
        throw new Error(`Invalid semver: ${version}`);
    }

    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        prerelease: match[4] || null,
    };
}

export function compareSemver(a: ParsedSemver, b: ParsedSemver): number {
    // Compare major.minor.patch
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;

    // Same major.minor.patch - handle prereleases
    // A stable release (no prerelease) is greater than a prerelease
    if (a.prerelease === null && b.prerelease !== null) return 1;
    if (a.prerelease !== null && b.prerelease === null) return -1;
    if (a.prerelease === null && b.prerelease === null) return 0;

    // Both are prereleases - compare lexicographically
    // This handles alpha < beta < rc ordering naturally
    return a.prerelease.localeCompare(b.prerelease);
}

export function isNewerThan(a: string, b: string): boolean {
    return compareSemver(parseSemver(a), parseSemver(b)) > 0;
}

export async function fetchLatestPublishedVersion(): Promise<string | null> {
    const response = await fetch('https://api.mapbox.com/mapbox-gl-js/versions.json');

    if (!response.ok) {
        throw new Error(`Failed to fetch versions.json: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {latest?: string};

    if (data.latest) {
        return data.latest.startsWith('v') ? data.latest.slice(1) : data.latest;
    }

    return null;
}

/*
 * Logic:
 * - alpha.* prerelease → 'dev'
 * - other prerelease → 'next'
 * - stable & newer than currentLatest → 'latest'
 * - stable & older/equal to currentLatest → 'vX.Y' (e.g., 'v3.19')
 */
export function determineDistTag(version: string, currentLatest: string | null): string {
    const parsed = parseSemver(version);

    if (parsed.prerelease) {
        if (parsed.prerelease.startsWith('alpha.')) {
            return 'dev';
        }

        return 'next';
    }

    if (currentLatest === null) {
        throw new Error('Current latest version is unknown. Cannot determine dist tag for stable release.');
    }

    if (isNewerThan(version, currentLatest)) {
        return 'latest';
    }

    return `v${parsed.major}.${parsed.minor}`;
}

export function readPackageVersion(packageJsonPath: string): string {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content) as {version: string};
    return pkg.version;
}

export function execCommand(cmd: string, dryRun: boolean, options?: {silent?: boolean}): string {
    if (!options?.silent) {
        console.log(`$ ${cmd}`);
    }
    if (dryRun) {
        return '';
    }

    return execSync(cmd, {encoding: 'utf-8', stdio: options?.silent ? 'pipe' : 'inherit'}) || '';
}

export function execSilent(cmd: string): string {
    return execSync(cmd, {encoding: 'utf-8'}).trim();
}

export function prompt(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}

export function getTagsAtHead(): string[] {
    try {
        const output = execSilent('git tag --points-at HEAD');
        if (!output) return [];
        return output.split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

export function getCurrentBranch(): string {
    return execSilent('git branch --show-current');
}

export function getShortSha(): string {
    return execSilent('git rev-parse --short HEAD');
}

export function getLastCommitMessage(): string {
    return execSilent('git log -1 --pretty=%B');
}

export function isAlreadyPublished(packageName: string, version: string): boolean {
    try {
        const result = execSync(`npm view ${packageName}@${version} version`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.trim() === version;
    } catch {
        // npm view exits with error if version doesn't exist
        return false;
    }
}

export function parseArgs(args: string[]): {dryRun: boolean; help: boolean; positional: string[]} {
    const result = {
        dryRun: false,
        help: false,
        positional: [] as string[],
    };

    for (const arg of args) {
        if (arg === '--dry-run') {
            result.dryRun = true;
        } else if (arg === '--help' || arg === '-h') {
            result.help = true;
        } else if (!arg.startsWith('-')) {
            result.positional.push(arg);
        }
    }

    return result;
}
