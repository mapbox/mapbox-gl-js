#!/usr/bin/env node

import {execSync} from 'child_process';
import {
    readPackageVersion,
    getCurrentBranch,
    getShortSha,
    getLastCommitMessage,
    prompt,
    execSilent,
} from './publish-utils.ts';
import {publishCdn} from './publish-cdn.ts';

interface Args {
    help: boolean;
    publishToCdn: boolean;
    dryRun: boolean;
}

function showHelp(): void {
    console.log(`
Alpha Tagging Script

Tags the current commit with alpha version in format gl-js/v<semver>-alpha.<sha>.
Also tags style-spec with gl-js/style-spec@<semver>-alpha.<sha>.

Usage:
  tsx build/publish-alpha.ts [--publish-to-cdn] [--dry-run] [--help]

Options:
  --publish-to-cdn   Also upload built files to CDN (requires dist folder)
  --dry-run          Print commands without executing (only with --publish-to-cdn)
  --help             Show this help message

Requirements:
  - Must be on the 'main' branch

Example output tags:
  gl-js/v3.21.0-alpha.abc1234
  gl-js/style-spec@14.21.0-alpha.abc1234
`);
}

function parseAlphaArgs(args: string[]): Args {
    const result: Args = {
        help: false,
        publishToCdn: false,
        dryRun: false,
    };

    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            result.help = true;
        } else if (arg === '--publish-to-cdn') {
            result.publishToCdn = true;
        } else if (arg === '--dry-run') {
            result.dryRun = true;
        }
    }

    return result;
}

async function main(): Promise<void> {
    const args = parseAlphaArgs(process.argv.slice(2));

    if (args.help) {
        showHelp();
        process.exit(0);
    }

    if (args.dryRun) {
        const sha = getShortSha();
        const version = readPackageVersion('./package.json');
        const nextVersion = execSilent(`npx semver ${version} -i minor`);
        const alphaVersion = `v${nextVersion}-alpha.${sha}`;

        console.log(`Publishing ${alphaVersion} to CDN (dry-run)`);
        publishCdn(alphaVersion, true);
        return;
    }

    const branch = getCurrentBranch();

    if (branch !== 'main') {
        console.error('Error: Alpha tagging is only possible from main!');
        console.error(`Current branch: ${branch}`);
        process.exit(1);
    }

    const version = readPackageVersion('./package.json');
    const styleSpecVersion = readPackageVersion('./src/style-spec/package.json');

    const nextVersion = execSilent(`npx semver ${version} -i minor`);
    const styleSpecNextVersion = execSilent(`npx semver ${styleSpecVersion} -i minor`);

    const sha = getShortSha();

    const tag = `gl-js/v${nextVersion}-alpha.${sha}`;
    const styleSpecTag = `gl-js/style-spec@${styleSpecNextVersion}-alpha.${sha}`;
    const alphaVersion = `v${nextVersion}-alpha.${sha}`;

    const commitMessage = getLastCommitMessage();

    console.log(`Tags ${tag} and ${styleSpecTag} will be published.`);
    if (args.publishToCdn) {
        console.log(`CDN upload: ${alphaVersion}`);
    }
    console.log(`\nCommit message:\n${commitMessage}`);
    console.log();

    const confirmed = await prompt('Proceed? (y/n) ');
    if (!confirmed) {
        console.log('Cancelled.');
        process.exit(0);
    }

    console.log(`\ngit tag ${tag}`);
    execSync(`git tag ${tag}`, {stdio: 'inherit'});

    console.log(`git tag ${styleSpecTag}`);
    execSync(`git tag ${styleSpecTag}`, {stdio: 'inherit'});

    console.log(`git push --atomic origin ${tag} ${styleSpecTag}`);
    execSync(`git push --atomic origin ${tag} ${styleSpecTag}`, {stdio: 'inherit'});

    console.log('\nDone! CI will now publish the alpha versions.');

    if (args.publishToCdn) {
        console.log('\nUploading to CDN...');
        publishCdn(alphaVersion, args.dryRun);
    }
}

main().catch((error) => {
    console.error('Error:', (error as Error).message);
    process.exit(1);
});
