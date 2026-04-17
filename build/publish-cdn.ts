#!/usr/bin/env node
import fs from 'fs';
import {execCommand, parseArgs} from './publish-utils.ts';

function showHelp(): void {
    console.log(`
CDN Upload Script

Uploads built files to S3 for CDN distribution.

Usage:
  tsx build/publish-cdn.ts <tag> [--dry-run]

Arguments:
  <tag>       Version tag in format vX.X.X or vX.X.X-prerelease
  --dry-run   Print commands without executing

Example:
  ./build/publish-cdn.ts v3.20.0
  ./build/publish-cdn.ts v3.21.0-alpha.abc1234 --dry-run

Required files (build with npm run prepublishOnly):
${CDN_FILES.map(f => `  - dist/${f}`).join('\n')}
  - dist/esm-cdn/*
`);
}

/** Files to upload to S3 with their MIME types */
const CDN_FILES = [
    'mapbox-gl.js',
    'mapbox-gl.js.map',
    'mapbox-gl-dev.js',
    'mapbox-gl.css',
    'mapbox-gl-csp.js',
    'mapbox-gl-csp.js.map',
    'mapbox-gl-csp-worker.js',
    'mapbox-gl-csp-worker.js.map',
];

/** Discovers all ESM CDN files from dist/esm-cdn/ directory */
function getEsmCdnFiles(): string[] {
    const esmCdnDir = './dist/esm-cdn';
    if (!fs.existsSync(esmCdnDir)) return [];
    return fs.readdirSync(esmCdnDir)
        .filter(f => f.endsWith('.js') || f.endsWith('.js.map'))
        .map(f => `esm-cdn/${f}`);
}

/**
 * Determines the MIME type for a file.
 */
function getMimeType(file: string): string {
    if (file.endsWith('.js.map')) {
        return 'application/octet-stream';
    }
    if (file.endsWith('.js')) {
        return 'application/javascript';
    }
    if (file.endsWith('.css')) {
        return 'text/css';
    }
    return 'application/octet-stream';
}

/**
 * Validates that the tag format is correct.
 */
function validateTag(tag: string): void {
    // Tag should be vX.X.X or vX.X.X-prerelease
    if (!/^v\d+\.\d+\.\d+(-[\w.]+)?$/.test(tag)) {
        console.error(`Error: Invalid tag format "${tag}". Expected format: vX.X.X or vX.X.X-prerelease`);
        process.exit(1);
    }
}

function validateDistFiles(dryRun: boolean): void {
    if (!fs.existsSync('./dist')) {
        if (dryRun) {
            console.warn('Warning: dist folder does not exist (dry-run mode, continuing)');
            return;
        }
        console.error('Error: dist folder does not exist. Make sure you build the bundle before running this script.');
        console.error('Run: npm run build-prod && npm run build-esm-prod && npm run build-csp && npm run build-dev && npm run build-css');
        process.exit(1);
    }

    if (!dryRun) {
        const missingFiles: string[] = [];
        for (const file of CDN_FILES) {
            if (!fs.existsSync(`./dist/${file}`)) {
                missingFiles.push(file);
            }
        }
        if (!fs.existsSync('./dist/esm-cdn')) {
            missingFiles.push('esm-cdn/');
        }
        if (missingFiles.length > 0) {
            console.error(`Error: Missing files in dist folder: ${missingFiles.join(', ')}`);
            console.error('Make sure you build the bundle before running this script.');
            console.error('Run: npm run build-prod && npm run build-esm-prod && npm run build-csp && npm run build-dev && npm run build-css');
            process.exit(1);
        }
    }
}

export function publishCdn(tag: string, dryRun: boolean): void {
    validateTag(tag);
    validateDistFiles(dryRun);

    const esmCdnFiles = getEsmCdnFiles();
    if (esmCdnFiles.length === 0) {
        if (dryRun) {
            console.warn('Warning: dist/esm-cdn/ does not exist or is empty (dry-run mode, continuing)');
        } else {
            console.error('Error: dist/esm-cdn/ does not exist or contains no files.');
            process.exit(1);
        }
    }
    const allFiles = [...CDN_FILES, ...esmCdnFiles];

    console.log(`\nUploading to CDN: ${tag}`);

    for (const file of allFiles) {
        const mimeType = getMimeType(file);
        const cdnPath = file.startsWith('esm-cdn/') ? file.replace('esm-cdn/', 'esm/') : file;
        const cmd = `aws s3 cp --acl public-read --content-type ${mimeType} ./dist/${file} s3://mapbox-gl-js/${tag}/${cdnPath}`;

        if (dryRun) {
            console.log(cmd);
        } else {
            execCommand(cmd, false);
            console.log(`Uploaded: ${file}`);
        }
    }

    console.log(`\nCDN upload complete: https://api.mapbox.com/mapbox-gl-js/${tag}/mapbox-gl.js`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        showHelp();
        process.exit(0);
    }

    if (args.positional.length === 0) {
        console.error('Error: No tag provided. Please provide a tag in the form of vX.X.X.');
        console.error('Example: tsx build/publish-cdn.ts v3.20.0');
        process.exit(1);
    }

    const tag = args.positional[0];
    publishCdn(tag, args.dryRun);
}
