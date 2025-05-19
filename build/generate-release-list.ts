import fs from 'fs';
import {Octokit} from '@octokit/rest';
import crypto from 'crypto';

interface Release {
    tag_name: string;
    published_at: string;
    prerelease: boolean;
}

interface ReleaseInfo {
    released: string;
    prerelease: boolean;
    sri?: string;
}

interface ReleaseList {
    [key: string]: ReleaseInfo | string;
    latest?: string;
}

const list: ReleaseList = {};

const octokit = new Octokit();

/**
 * Calculate the SRI hash for a given content
 * @param {string} content
 * @returns {string}
 */
function calculateSRIHash(content: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    const base64Hash = hash.digest('base64');
    return `sha256-${base64Hash}`;
}

try {
    const releases = await octokit.paginate<Release>(
        octokit.repos.listReleases.endpoint({
            owner: 'mapbox',
            repo: 'mapbox-gl-js',
        }),
    );

    releases.forEach((release) => {
        list[release.tag_name] = {
            released: release.published_at,
            prerelease: release.prerelease,
        };
    });

    // Find the latest non-prerelease version using semver comparison
    const latestVersion = releases
        .filter((release) => !release.prerelease && release.tag_name.match(/^v\d+\.\d+\.\d+$/))
        .map((release) => release.tag_name)
        .sort((a, b) => {
            const aParts = a.substring(1).split('.').map(Number);
            const bParts = b.substring(1).split('.').map(Number);

            // Compare major version
            if (aParts[0] !== bParts[0]) return bParts[0] - aParts[0];
            // Compare minor version
            if (aParts[1] !== bParts[1]) return bParts[1] - aParts[1];
            // Compare patch version
            return bParts[2] - aParts[2];
        })[0];

    if (latestVersion) {
        list.latest = latestVersion;

        // Fetch the mapbox-gl.js file and calculate SRI hash
        const url = `https://api.mapbox.com/mapbox-gl-js/${latestVersion}/mapbox-gl.js`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }

        const content = await response.text();
        const sriHash = calculateSRIHash(content);

        // Add SRI hash to the latest version entry
        const versionEntry = list[latestVersion];
        if (typeof versionEntry === 'object' && 'released' in versionEntry) {
            versionEntry.sri = sriHash;
        }
    }

    fs.writeFileSync('dist/versions.json', `${JSON.stringify(list, null, 4)}\n`);
    fs.writeFileSync('dist/versions.jsonp', `const mapboxglVersions = ${JSON.stringify(list, null, 4)};\n`);

    console.log('Done:');
    console.log('  - dist/versions.json');
    console.log('  - dist/versions.jsonp');
} catch (error) {
    console.error('Unexpected error:', (error as Error).message);
    process.exit(1);
}
