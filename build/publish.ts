#!/usr/bin/env node
/*
 * Main CI Publish Script
 *
 * Publishes mapbox-gl and style-spec packages based on git tags at HEAD.
 * Run as part of CI on AWS CodeBuild.
 *
 * Usage:
 *   ./build/publish.ts [--dry-run]
 *
 * Tags handled:
 *   gl-js/vX.X.X              → Publishes mapbox-gl + CDN upload
 *   gl-js/vX.X.X-alpha.xxx    → Publishes mapbox-gl with 'dev' tag + CDN upload
 *   gl-js/vX.X.X-beta.x       → Publishes mapbox-gl with 'next' tag + CDN upload
 *   gl-js/style-spec@X.X.X    → Publishes @mapbox/mapbox-gl-style-spec
 */

import {
    fetchLatestPublishedVersion,
    determineDistTag,
    readPackageVersion,
    execCommand,
    getTagsAtHead,
    isAlreadyPublished,
    parseArgs,
} from './publish-utils.ts';
import {publishCdn} from './publish-cdn.ts';

/*
 * In CI, the workflow splits gl-js/v* and gl-js/style-spec@* into separate jobs,
 * each triggered by (and scoped to) its own tag via GITHUB_REF_NAME. Publishing
 * only that tag's package - rather than every tag sitting on HEAD - is what keeps
 * a paired-tag release from making both jobs race to publish the same package.
 * Outside CI (local/dry-run use), fall back to every tag at HEAD.
 */
function getTargetTags(): string[] {
    const refTag = process.env.GITHUB_REF_NAME;
    if (process.env.GITHUB_ACTIONS === 'true' && refTag) {
        return [refTag];
    }

    return getTagsAtHead();
}

/*
 * Publishes the style-spec package.
 */
function publishStyleSpec(version: string, currentLatest: string | null, dryRun: boolean): Promise<void> {
    console.log(`\nPublishing style-spec: ${version}`);

    const currentVersion = readPackageVersion('./src/style-spec/package.json');

    if (version !== currentVersion) {
        execCommand(`npm version ${version} --no-git-tag-version -w src/style-spec`, dryRun);
    } else {
        console.log(`Version already set to ${version}, skipping version update`);
    }

    if (isAlreadyPublished('@mapbox/mapbox-gl-style-spec', version)) {
        console.log('Already published.');
        return;
    }

    const distTag = determineDistTag(version, currentLatest);
    console.log(`Using dist tag: ${distTag}`);

    execCommand(`npm publish --tag ${distTag} -w src/style-spec`, dryRun);
}

/*
 * Publishes the main mapbox-gl package.
 */
function publishMapboxGl(version: string, currentLatest: string | null, dryRun: boolean): Promise<void> {
    console.log(`\nPublishing mapbox-gl: ${version}`);

    const currentVersion = readPackageVersion('./package.json');

    if (version !== currentVersion) {
        execCommand(`npm version ${version} --no-git-tag-version`, dryRun);
    } else {
        console.log(`Version already set to ${version}, skipping version update`);
    }

    if (isAlreadyPublished('mapbox-gl', version)) {
        console.log('Already published.');
        return;
    }

    const distTag = determineDistTag(version, currentLatest);
    console.log(`Using dist tag: ${distTag}`);

    execCommand(`npm publish --tag ${distTag}`, dryRun);

    console.log('\nPublishing to CDN');
    publishCdn(`v${version}`, dryRun);
}

function showHelp(): void {
    console.log(`
Main CI Publish Script

Publishes mapbox-gl and style-spec packages based on git tags at HEAD.

Usage:
  ./build/publish.ts [--dry-run]

Options:
  --dry-run   Print commands without executing

Tags handled:
  gl-js/vX.X.X              → Publishes mapbox-gl + CDN upload
  gl-js/vX.X.X-alpha.xxx    → Publishes mapbox-gl with 'dev' tag + CDN upload
  gl-js/vX.X.X-beta.x       → Publishes mapbox-gl with 'next' tag + CDN upload
  gl-js/style-spec@X.X.X    → Publishes @mapbox/mapbox-gl-style-spec

Dist tag logic:
  - alpha.* prerelease      → 'dev'
  - other prerelease        → 'next'
  - stable & newer          → 'latest'
  - stable & older/equal    → 'vX.Y' (e.g., 'v3.19')
`);
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        showHelp();
        process.exit(0);
    }

    const dryRun = args.dryRun;
    if (dryRun) {
        console.log('Dry run mode enabled - commands will be printed but not executed\n');
    }

    console.log('Fetching current latest version from versions.json...');
    const currentLatest = await fetchLatestPublishedVersion();
    if (currentLatest) {
        console.log(`Current latest: ${currentLatest}`);
    } else {
        console.log('Could not determine current latest version');
    }

    const tags = getTargetTags();
    if (tags.length === 0) {
        console.log('No tags to publish.');
        return;
    }

    console.log(`Publishing for tags: ${tags.join(', ')}`);

    for (const fullTag of tags) {
        const tag = fullTag.replace(/^gl-js\//, '');

        if (tag.startsWith('style-spec@')) {
            // Style-spec tag: gl-js/style-spec@X.X.X
            const version = tag.replace('style-spec@', '');
            publishStyleSpec(version, currentLatest, dryRun);
        } else if (/^v\d/.test(tag)) {
            // Main package tag: gl-js/vX.X.X or gl-js/vX.X.X-prerelease
            const version = tag.replace(/^v/, '');
            publishMapboxGl(version, currentLatest, dryRun);
        } else {
            console.log(`\nUnrecognized tag: ${fullTag}`);
        }
    }

    console.log('\nPublish complete.');
}

main().catch((error) => {
    console.error('Publish failed:', (error as Error).message);
    process.exit(1);
});
