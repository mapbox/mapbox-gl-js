#!/usr/bin/env node

/* eslint-disable */
const { Octokit } = require("@octokit/rest");
const { createAppAuth } = require("@octokit/auth-app");
const fs = require('fs');
const {execSync} = require('child_process');
const zlib = require('zlib');

process.on('unhandledRejection', error => {
    // don't log `error` directly, because errors from child_process.execSync
    // contain an (undocumented) `envPairs` with environment variable values
    // //
    console.log(error.message || 'Error');
    process.exit(1)
});

const SIZE_CHECK_APP_ID = 14028;
const SIZE_CHECK_APP_INSTALLATION_ID = 229425;

const PK = process.env['SIZE_CHECK_APP_PRIVATE_KEY'];
if (!PK) {
    console.log('Fork PR; not computing size.');
    process.exit(0);
}
const owner = 'mapbox';
const repo = 'mapbox-gl-js';

(async () => {

    const message = execSync(`git log --pretty="%B" -1`).toString()
    const matches = message.match(/\[benchmap-js(.*?)\]/);
    const runBenchmarks = matches && matches[0];
    if (!runBenchmarks) return;

    // Initialize github client
    const github = new Octokit({
        authStrategy: createAppAuth,
        auth: {
            id: SIZE_CHECK_APP_ID,
            privateKey: Buffer.from(PK, 'base64').toString('binary'),
            installationId: SIZE_CHECK_APP_INSTALLATION_ID
        }
    });

    async function getMergeBase() {
        const head = process.env['CIRCLE_SHA1'];
        const pr = process.env['CIRCLE_PULL_REQUEST'];
        if (pr) {
            const number = +pr.match(/\/(\d+)\/?$/)[1];
            return github.pulls.get({
                owner,
                repo,
                pull_number: number
            }).then(({data}) => {
                const base = data.base.ref;
                return execSync(`git merge-base origin/${base} ${head}`).toString().trim();
            });
        } else {
            // Walk backward through the history (maximum of 10 commits) until
            // finding a commit on either master or release-*; assume that's the
            // base branch.
            for (const sha of execSync(`git rev-list --max-count=10 ${head}`).toString().trim().split('\n')) {
                const base = execSync(`git branch -r --contains ${sha} origin/main origin/release-*`).toString().split('\n')[0].trim();
                if (base) {
                    return Promise.resolve(execSync(`git merge-base ${base} ${head}`).toString().trim());
                }
            }
        }

        return Promise.resolve(null);
    }

    const mergeBase = await getMergeBase();

    console.log(mergeBase);
    if (!mergeBase) return;

    const params = JSON.stringify({
        parameters: {
            "args": matches[1] || "",
            "gl-js-old": mergeBase,
            "gl-js-new": process.env['CIRCLE_SHA1'],
            "github_check_branch": process.env['CIRCLE_BRANCH'],
            "github_check_sha1": process.env['CIRCLE_SHA1']
        },
        branch: "status"
    });
    console.log(params);

    const post = execSync(`curl -X POST --header "Content-Type: application/json" -H "Circle-Token: ${process.env['WEB_METRICS_TOKEN']}" -d '${params}' https://circleci.com/api/v2/project/github/mapbox/benchmap-js/pipeline`).toString();
    console.log(post);
})();
