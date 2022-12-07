// Use linux 'path' syntax on all operating systems to preserve compatability with 'glob'
import {posix as path} from "path";
import fs from 'fs';
import glob from 'glob';
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
    if (!stylePaths.length){
        const pathGlob = getAllFixtureGlobs(rootDirectory, suiteDirectory)[0];
        stylePaths = glob.sync(pathGlob);
        if (!stylePaths.length) {
            console.error(`Found no tests matching the pattern ${pathGlob}`);
        }
    }

    const allFiles = {};

    for (const stylePath of stylePaths) {
        const fileName = path.basename(stylePath);
        const extension = path.extname(stylePath);
        try {
            const json = parseJsonFromFile(stylePath);

            // Special case for style json which needs some preprocessing
            // 7357 is testem's default port
            localizeURLs(json, 7357);

            const actualPath = stylePath.replace("style.json", "actual.png")
            const expectedPath = stylePath.replace("style.json", "expected.png")
            const diffPath = stylePath.replace("style.json", "diff.png")

            if (includeImages) {
                allFiles[stylePath] = json;
                allFiles[actualPath] = true;
                allFiles[expectedPath] = true;
                allFiles[diffPath] = true;    
            }
        } catch (e) {
            console.log(`Error parsing file: ${stylePath}`);
            console.log(e.message);
            allFiles[stylePath] = {PARSE_ERROR: true, message: e.message};
        }
    }

    // Re-nest by directory path, each directory path defines a testcase.
    const result = {};
    for (const fullPath in allFiles) {
        const testName = path.dirname(fullPath).replace(rootDirectory, '');
        //Lazily initialize an object to store each file wihin a particular testName
        if (result[testName] == null) {
            result[testName] = {};
        }
        //Trim extension from filename
        const fileName = path.basename(fullPath, path.extname(fullPath));
        result[testName][fileName] = allFiles[fullPath];
    }

    const outputStr = JSON.stringify(result, null, 4);
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
    const jsonPaths = path.join(basePath, '/**/[!actual]*.json');
    const imagePaths = path.join(basePath, '/**/*.png');

    return [jsonPaths, imagePaths];
}

function parseJsonFromFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, {encoding: 'utf8'}));
}
