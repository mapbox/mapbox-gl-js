// Use linux 'path' syntax on all operating systems to preserve compatability with 'glob'
import fs from 'fs';
import {posix as path} from 'path';
import {globSync} from 'glob';
import localizeURLs from './localize-urls.js';

/**
 * Returns a list of all style fixture paths for the specified root and suite directories.
 *
 * @param {string} suiteDir - The specific suite directory.
 * @returns {string[]} An array of sorted style fixture paths.
 */
export function getAllStyleFixturePaths(suiteDir) {
    const ignoreStylePaths = [
        '**/actual.json',
        '**/expected*.json',
    ];

    const jsonGlob = path.join(suiteDir, '/**/*.json');
    const stylePaths = globSync(jsonGlob, {ignore: ignoreStylePaths, posix: true}).sort((a, b) => a.localeCompare(b, 'en'));
    if (!stylePaths.length) throw new Error(`No style fixture files found in ${jsonGlob}`);
    return stylePaths;
}

/**
 * @typedef {Object} TestFixture
 * @property {string} path - Absolute path to the test directory
 * @property {Object} [style] - The style.json content
 * @property {boolean} [PARSE_ERROR] - Indicates an error occurred while parsing
 * @property {string} [message] - Error message if PARSE_ERROR is true
 */

/**
 * Inlines the content of style fixture paths into a single json file which can then be imported into a bundle to be shipped to the browser.
 *
 * @param {string} suiteDir - The suite directory to strip from paths.
 * @param {string[]} stylePaths - An array of style fixture paths to process.
 * @param {boolean} includeImages - Whether to include image files in the output JSON.
 * @returns {Object<string, TestFixture>} An object mapping test names to their fixtures
 */
export function generateFixtureJson(suiteDir, stylePaths, includeImages = false) {
    if (!suiteDir || typeof suiteDir !== 'string') {
        throw new Error('Invalid suite directory provided to generateFixtureJson');
    }

    if (!stylePaths || !Array.isArray(stylePaths) || stylePaths.length === 0) {
        throw new Error('No style paths provided to generateFixtureJson');
    }

    /** @type {Object<string, TestFixture>} */
    const testCases = {};

    for (const stylePath of stylePaths) {
        const dirName = path.dirname(stylePath);

        const testName = path.relative(suiteDir, dirName);
        try {
            const json = parseJsonFromFile(stylePath);

            // Special case for style json which needs some preprocessing
            // 63315 is the default vitest port
            // https://vitest.dev/guide/browser/config.html#browser-api
            localizeURLs(json, 63315);

            const testObject = {
                path: dirName
            };

            const filenames = fs.readdirSync(dirName);
            for (const file of filenames) {
                // We don't use it and it is not a JSON
                if (file === 'actual.json') {
                    continue;
                }
                const [name, extension] = file.split(".");
                if (extension === 'json') {
                    const json = parseJsonFromFile(path.join(dirName, file));
                    //Special case for style json which needs some preprocessing
                    if (file === 'style.json') {
                        localizeURLs(json, 63315);
                    }
                    testObject[name] = json;
                } else if (extension === 'png') {
                    if (includeImages) {
                        testObject[name] = true;
                    }
                } else if (extension !== "DS_Store") {
                    throw new Error(`File name extension "${extension}" is incompatible , file path ${path.join(dirName, file)}`);
                }
            }
            testCases[testName] = testObject;
        } catch (e) {
            console.log(`Error reading directory: ${dirName}`);
            console.log(e.message);
            testCases[testName] = {PARSE_ERROR: true, message: e.message, path: dirName};
        }
    }

    return testCases;
}

function parseJsonFromFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, {encoding: 'utf8'}));
}
