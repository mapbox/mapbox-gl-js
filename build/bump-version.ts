#!/usr/bin/env node

import {execSync} from 'child_process';
import {
    readPackageVersion,
    prompt,
    execSilent,
} from './publish-utils.ts';

type IncrementType = 'major' | 'minor' | 'patch';

function showHelp(): void {
    console.log(`
Version Bumping Script

Bumps the version of the main package and the style-spec sub-package.

Usage:
  ./build/bump-version.ts <major|minor|patch> [pre-release-id]

Arguments:
  <major|minor|patch>   Required. The type of version bump.
  [pre-release-id]      Optional. Identifier for a pre-release version (e.g., 'beta', 'rc').

Examples:
  # Stable release: 3.13.0 -> 3.14.0
  ./build/bump-version.ts minor

  # Start a new pre-release: 3.13.0 -> 3.14.0-beta.1
  ./build/bump-version.ts minor beta

  # Increment an existing pre-release: 3.14.0-beta.1 -> 3.14.0-beta.2
  ./build/bump-version.ts minor beta

  # Change pre-release type: 3.14.0-beta.2 -> 3.14.0-rc.1
  ./build/bump-version.ts minor rc

  # Graduate from pre-release to stable: 3.14.0-rc.1 -> 3.14.0
  ./build/bump-version.ts minor
`);
}

function getPrereleaseId(version: string): string | null {
    const match = version.match(/-([a-zA-Z]+)\.\d+$/);
    return match ? match[1] : null;
}

function calculateNextVersion(
    currentVersion: string,
    incrementType: IncrementType,
    preid: string | null,
): string {
    const currentPreid = getPrereleaseId(currentVersion);

    if (preid) {
        if (currentPreid && currentPreid !== preid) {
            // SPECIAL CASE: Switching pre-release identifiers (e.g., beta -> rc).
            // We stay on the same base version.
            // First, get the stable version of the current release (e.g., 3.16.0-beta.1 -> 3.16.0)
            const stableVersion = execSilent(`npx semver "${currentVersion}" -i patch`);
            // Then, start the new pre-release series from that stable base.
            let nextVersion = execSilent(`npx semver "${stableVersion}" -i prepatch --preid ${preid}`);
            // Finally, bump the new series from .0 to .1
            nextVersion = execSilent(`npx semver "${nextVersion}" -i prerelease`);
            return nextVersion;
        } else {
            let semverIncrement: string;
            if (currentPreid === preid) {
                // Incrementing an existing prerelease (e.g., beta.1 -> beta.2)
                semverIncrement = 'prerelease';
            } else {
                // Starting a new prerelease from a stable version (e.g., 3.15.2 -> 3.16.0-beta.1)
                semverIncrement = `pre${incrementType}`;
            }

            // Calculate the next version
            let nextVersion = execSilent(`npx semver "${currentVersion}" -i ${semverIncrement} --preid ${preid}`);

            // If we just started a new pre-release series (which starts at .0), bump it to .1
            if (semverIncrement !== 'prerelease') {
                nextVersion = execSilent(`npx semver "${nextVersion}" -i prerelease`);
            }
            return nextVersion;
        }
    } else {
        return execSilent(`npx semver "${currentVersion}" -i ${incrementType}`);
    }
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    const incrementType = args[0] as IncrementType;
    if (!['major', 'minor', 'patch'].includes(incrementType)) {
        console.error(`Error: Invalid increment type '${incrementType}'. Must be one of 'major', 'minor', or 'patch'.`);
        showHelp();
        process.exit(1);
    }

    const preid = args[1] || null;

    const version = readPackageVersion('./package.json');
    const styleSpecVersion = readPackageVersion('./src/style-spec/package.json');

    const nextVersion = calculateNextVersion(version, incrementType, preid);
    const styleSpecNextVersion = calculateNextVersion(styleSpecVersion, incrementType, preid);

    console.log(`Current versions: gl-js ${version}, style-spec ${styleSpecVersion}`);
    console.log(`New versions:     gl-js ${nextVersion}, style-spec ${styleSpecNextVersion}`);
    console.log();

    const confirmed = await prompt('Proceed and commit the changes? (y/n) ');
    if (!confirmed) {
        console.log('Operation cancelled.');
        process.exit(0);
    }

    console.log('Bumping versions in package.json files...');

    execSync(`npm version "${nextVersion}" --no-git-tag-version`, {stdio: 'pipe'});
    execSync(`npm version "${styleSpecNextVersion}" --no-git-tag-version --workspace src/style-spec`, {stdio: 'pipe'});

    console.log('Committing changes...');
    execSync('git add package.json package-lock.json src/style-spec/package.json', {stdio: 'inherit'});
    execSync(`git commit -m "v${nextVersion}. Bump versions"`, {stdio: 'inherit'});

    console.log(`Done. New version is ${nextVersion}.`);
}

main().catch((error) => {
    console.error('Error:', (error as Error).message);
    process.exit(1);
});
