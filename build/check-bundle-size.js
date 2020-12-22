#!/usr/bin/env node

/* eslint-disable */
const { Octokit } = require("@octokit/rest");
const { createAppAuth } = require("@octokit/auth-app");
const prettyBytes = require('pretty-bytes');
const fs = require('fs');
const {execSync} = require('child_process');
const zlib = require('zlib');

process.on('unhandledRejection', error => {
    // don't log `error` directly, because errors from child_process.execSync
    // contain an (undocumented) `envPairs` with environment variable values
    console.log(error.message || 'Error');
    process.exit(1)
});

const SIZE_CHECK_APP_ID = 14028;
const SIZE_CHECK_APP_INSTALLATION_ID = 229425;

const FILES = [
    ['JS', "dist/mapbox-gl.js"],
    ['CSS', "dist/mapbox-gl.css"]
];
const PK = Buffer.from(process.env['SIZE_CHECK_APP_PRIVATE_KEY'], 'base64').toString('binary');
if (!PK) {
    console.log('Fork PR; not computing size.');
    process.exit(0);
}
const owner = 'mapbox';
const repo = 'mapbox-gl-js';

(async () => {
    // Initialize github client
    const github = new Octokit({
        authStrategy: createAppAuth,
        auth: {
            id: SIZE_CHECK_APP_ID,
            privateKey: PK,
            installationId: SIZE_CHECK_APP_INSTALLATION_ID
        }
    });

    //get current sizes
    const currentSizes = FILES.map(([label, filePath]) => [label, getSize(filePath)]);
    console.log(currentSizes);
    // Why we need to add GitHub's public key to known_hosts:
    // https://circleci.com/docs/2.0/gh-bb-integration/#establishing-the-authenticity-of-an-ssh-host
    execSync(`mkdir -p ~/.ssh`);
    execSync(`echo 'github.com ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAq2A7hRGmdnm9tUDbO9IDSwBK6TbQa+PXYPCPy6rbTrTtw7PHkccKrpp0yVhp5HdEIcKr6pLlVDBfOLX9QUsyCOV0wzfjIJNlGEYsdlLJizHhbn2mUjvSAHQqZETYP81eFzLQNnPHt4EVVUh7VfDESU84KezmD5QlWpXLmvU31/yMf+Se8xhHTvKSCZIFImWwoG6mbUoWf9nzpIoaSjB+weqqUUmpaaasXVal72J+UX2B+2RPW3RcT0eOzQgqlJL3RKrTJvdsjE3JEAvGq3lGHSZXy28G3skua2SmVi/w4yCE6gbODqnTWlg7+wC604ydGXA8VJiS5ap43JXiUFFAaQ==
    bitbucket.org ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAubiN81eDcafrgMeLzaFPsw2kNvEcqTKl/VqLat/MaB33pZy0y3rJZtnqwR2qOOvbwKZYKiEO1O6VqNEBxKvJJelCq0dTXWT5pbO2gDXC6h6QDXCaHo6pOHGPUy+YBaGQRGuSusMEASYiWunYN0vCAI8QaXnWMXNMdFP3jHAJH0eDsoiGnLPBlBp4TNm6rYI74nMzgz3B9IikW4WVK+dc8KZJZWYjAuORU3jc1c/NPskD2ASinf8v3xnfXeukU0sJ5N6m5E8VLjObPEO+mN2t/FZTMZLiFqPWc/ALSqnMnnhwrNi2rbfg/rd/IpL8Le3pSBne8+seeFVBoGqzHM9yXw==
    ' >> ~/.ssh/known_hosts`);
    execSync(`git reset --hard && git checkout origin/main`);
    execSync('yarn install');
    execSync('yarn run build-prod-min');
    execSync('yarn run build-css');
    const priorSizes = FILES.map(([label, filePath]) => [label, getSize(filePath)]);
    console.log(priorSizes);

    // Generate a github check for each filetype
    for(let check_idx=0; check_idx<FILES.length; check_idx++){
        const [label, file] = FILES[check_idx];
        const name = `Size - ${label}`;
        const size = currentSizes[check_idx][1];
        const priorSize = priorSizes[check_idx][1];

        const title = `${formatSize(size.size, priorSize.size)}, gzipped ${formatSize(size.gzipSize, priorSize.gzipSize)}`;

        const megabit = Math.pow(2, 12);
        const downloadTime3G = (size.gzipSize / (3 * megabit)).toFixed(0);
        const downloadTime4G = (size.gzipSize / (10 * megabit)).toFixed(0);
        const summary = `\`${file}\` is ${size.size} bytes (${prettyBytes(size.size)}) uncompressed, ${size.gzipSize} bytes (${prettyBytes(size.gzipSize)}) gzipped.
        That's **${downloadTime3G} seconds** over slow 3G (3 Mbps), **${downloadTime4G} seconds** over fast 4G (10 Mbps).`;
        console.log('Posting check to GitHub');
        console.log(`Title: ${title}`);
        console.log(`Summary: ${summary}`);

        await github.checks.create({
            owner,
            repo,
            name,
            head_branch: process.env['CIRCLE_BRANCH'],
            head_sha: process.env['CIRCLE_SHA1'],
            status: 'completed',
            conclusion: 'success',
            completed_at: new Date().toISOString(),
            output: { title, summary }
        });
    }
})();

function getSize(filePath) {
    const {size} = fs.statSync(filePath);
    const gzipSize = zlib.gzipSync(fs.readFileSync(filePath)).length;
    return {size, gzipSize};
}

function formatSize(size, priorSize) {
    if (priorSize) {
        const change = size - priorSize;
        const percent = (change / priorSize) * 100;
        return `${change >= 0 ? '+' : ''}${prettyBytes(change)} ${percent.toFixed(3)}% (${prettyBytes(size)})`;
    } else {
        return prettyBytes(size);
    }
}
