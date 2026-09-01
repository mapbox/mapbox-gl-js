// Enforces the debug page conventions documented in CONTRIBUTING.md.

import fs from 'fs';
import path from 'path';
import {DEBUG_DIR, ROLES, listPages, readMeta} from './generate-debug-index';

import type {Role} from './generate-debug-index';

const RELEASE_TESTING_PATH = path.join('test', 'release', 'index.js');

const KNOWN_TAGS = ['mapbox:role', 'mapbox:in-release-testing', 'mapbox:issue'];

// Must stay a public link: this repository is mirrored publicly, so avoid any internal tracker URLs.
const ISSUE_URL = /^https:\/\/github\.com\/mapbox\/mapbox-gl-js\/(issues|pull)\/\d+$/;

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const errors: {file: string; message: string}[] = [];
const fail = (href: string, message: string) => errors.push({file: path.join(DEBUG_DIR, href), message});

// The `url` entries of the pages used for release testing; `test/release/index.js` is the authoritative list.
const releaseTestingPages = (): Set<string> => {
    const source = fs.readFileSync(RELEASE_TESTING_PATH, 'utf8');
    return new Set(Array.from(source.matchAll(/["']url["']\s*:\s*["']\.\/debug\/([^"']+)["']/g), ([, href]) => href));
};

const checkPage = (href: string) => {
    const html = fs.readFileSync(path.join(DEBUG_DIR, href), 'utf8');
    const page = readMeta(href);

    for (const segment of href.replace(/\.html$/, '').split(path.sep)) {
        if (!KEBAB.test(segment)) fail(href, `filename must be kebab-case, got "${segment}"`);
    }

    if (!page.description) {
        // readMeta only reads `name` before `content`, so a swapped tag looks absent.
        const swapped = /<meta\s+content="[^"]*"\s+name="description"/.test(html);
        fail(href, swapped ? 'description meta tag has content before name; put name first' : 'missing a description meta tag');
    }

    if (!page.role) {
        fail(href, 'missing a mapbox:role meta tag');
    } else if (!(page.role in ROLES)) {
        fail(href, `unknown mapbox:role "${page.role}", expected one of ${(Object.keys(ROLES) as Role[]).join(', ')}`);
    }

    if (page.issue && !ISSUE_URL.test(page.issue)) {
        fail(href, `mapbox:issue must be a public mapbox-gl-js issue or pull URL, got "${page.issue}"`);
    }

    for (const [, name] of html.matchAll(/<meta\s+name="(mapbox:[^"]+)"/g)) {
        if (!KNOWN_TAGS.includes(name)) fail(href, `unknown meta tag "${name}", expected one of ${KNOWN_TAGS.join(', ')}`);
    }
};

const checkReleaseTesting = (pages: string[]) => {
    const listed = releaseTestingPages();
    const tagged = new Set(pages.filter((href) => readMeta(href).inReleaseTesting));

    for (const href of tagged) {
        if (!listed.has(href)) fail(href, `tagged mapbox:in-release-testing but not listed in ${RELEASE_TESTING_PATH}`);
    }
    for (const href of listed) {
        if (!tagged.has(href)) fail(href, `listed in ${RELEASE_TESTING_PATH} but missing mapbox:in-release-testing`);
    }
};

const pages = listPages('.');
pages.forEach(checkPage);
checkReleaseTesting(pages);

// Better visibility from inline anotation in PRs
const annotate = ({file, message}: {file: string; message: string}) => {
    const root = process.env.GITHUB_WORKSPACE;
    const file_ = root ? path.relative(root, path.resolve(file)) : file;
    console.log(`::error file=${file_}::${message}`);
};

if (errors.length) {
    if (process.env.GITHUB_ACTIONS) errors.forEach(annotate);

    console.error(`${errors.length} problem(s) in ${DEBUG_DIR}/:\n`);
    for (const {file, message} of errors) console.error(`  ${file}: ${message}`);
    console.error(`
Every debug page needs two meta tags in its <head>:

  <meta name="description" content="What the page shows, and when you would reach for it.">
  <meta name="mapbox:role" content="tool | feature | env | perf | repro">

Add them, then re-run \`npm run check-debug-pages\` to verify. 
Check "Adding a Debug Page" section in CONTRIBUTING.md for more details.`);
    process.exit(1);
}

console.log(`${pages.length} debug pages OK`);
