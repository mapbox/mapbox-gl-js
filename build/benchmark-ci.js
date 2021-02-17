#!/usr/bin/env node

import {execSync} from 'child_process';

import {createOctokit, getMergeBase} from './github_utils.js';

process.on('unhandledRejection', error => {
    // don't log `error` directly, because errors from child_process.execSync
    // contain an (undocumented) `envPairs` with environment variable values
    // //
    console.log(error.message || 'Error');
    process.exit(1);
});

(async () => {

    const message = execSync(`git log --pretty="%B" -1`).toString();
    const matches = message.match(/\[benchmap-js(.*?)\]/);
    const runBenchmarks = matches && matches[0];
    if (!runBenchmarks) return;

    const github = createOctokit();
    if (!github) {
        console.log('Fork PR; not computing size.');
        process.exit(0);
    }
    const mergeBase = await getMergeBase(github);

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
        branch: "main"
    });

    const post = execSync(`curl -X POST --header "Content-Type: application/json" -H "Circle-Token: ${process.env['WEB_METRICS_TOKEN']}" -d '${params}' https://circleci.com/api/v2/project/github/mapbox/benchmap-js/pipeline`).toString();
    console.log(post);
})();
