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

const SIZE_CHECK_APP_ID = 33080;
const SIZE_CHECK_APP_INSTALLATION_ID = 1155310;

const FILES = [
    ['JS', "dist/mapbox-gl.js"],
    ['CSS', "dist/mapbox-gl.css"]
];
const PK = Buffer.from(process.env['SIZE_CHECK_APP_PRIVATE_KEY'], 'base64').toString('binary');
const owner = 'mapbox';
const repo = 'mapbox-gl-js-internal';

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

    // compute sizes for merge base
    const pr = process.env['CIRCLE_PULL_REQUEST'];
    const base = 'master';
    // If the commit is created before the PR is opened, CIRCLE_PULL_REQUEST will be null.
    // Since the job's don't re-run when the PR is opened, it would show a failed check if we didnt account for pr being null.
    if (pr) {
        const pull_number = +pr.match(/\/(\d+)\/?$/)[1];
        const pull = await github.pulls.get({owner, repo, pull_number});
        base = pull.data.base.sha;
    }
    console.log(`Using ${base} as prior comparison point.`)
    execSync(`git checkout ${base}`);
    execSync('yarn run build-prod-min');
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