// Use linux 'path' syntax on all operating systems to preserve compatability with 'glob'
import {posix as path} from "path";
import fs from 'fs';
import {globSync} from 'glob';
import localizeURLs from './localize-urls.js';

/**
 * Analyzes the contents of the specified `path.join(rootDirectory, suiteDirectory)`, and inlines
 * the contents into a single json file which can then be imported and built into a bundle
 * to be shipped to the browser.
 *
 * @param {string} rootDirectory
 * @param {string} suiteDirectory
 * @param {boolean} includeImages
 */
export function generateFixtureJson(rootDirectory, suiteDirectory, outputDirectory = 'test/integration/dist', includeImages = false, stylePaths = []) {
    if (!stylePaths.length) {
        const pathGlob = getAllFixtureGlobs(rootDirectory, suiteDirectory)[0];
        stylePaths = globSync(pathGlob);
        if (!stylePaths.length) {
            console.error(`Found no tests matching the pattern ${pathGlob}`);
        }
    }

    const testCases = {};

    for (const stylePath of stylePaths) {
        const dirName = path.dirname(stylePath);
        const testName = dirName.replace(rootDirectory, '');
        try {
            const json = parseJsonFromFile(stylePath);

            // Special case for style json which needs some preprocessing
            // 7357 is testem's default port
            localizeURLs(json, 7357);

            const testObject = {};

            const filenames = fs.readdirSync(dirName);
            for (const file of filenames) {
                const [name, extension] = file.split(".");
                if (extension === 'json') {
                    const json = parseJsonFromFile(path.join(dirName, file));
                    //Special case for style json which needs some preprocessing
                    if (file === 'style.json') {
                        // 7357 is testem's default port
                        localizeURLs(json, 7357);
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
            testCases[testName] = {PARSE_ERROR: true, message: e.message};
        }
    }

    const outputStr = JSON.stringify(testCases, null, 4);
    const outputFile = `${suiteDirectory.split('-')[0]}-fixtures.json`;
    const outputPath = path.join(outputDirectory, outputFile);

    return new Promise((resolve, reject) => {
        fs.writeFile(outputPath, outputStr, {encoding: 'utf8'}, (err) => {
            if (err) { reject(err); }

            resolve();
        });
    });
}

export function getAllFixtureGlobs(rootDirectory, suiteDirectory) {
    const basePath = path.join(rootDirectory, suiteDirectory);
    const jsonPaths = path.join(basePath, '/**/*.json');
    const imagePaths = path.join(basePath, '/**/*.png');

    return [jsonPaths, imagePaths];
}

function parseJsonFromFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, {encoding: 'utf8'}));
}
