import path from 'path';
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
export function generateFixtureJson(rootDirectory, suiteDirectory, outputDirectory = 'test/integration/dist', includeImages = false) {
    const globs = getAllFixtureGlobs(rootDirectory, suiteDirectory);
    const jsonPaths = globs[0];
    const imagePaths = globs[1];
    //Extract the filedata into a flat dictionary
    const allFiles = {};
    let allPaths = glob.sync(jsonPaths);
    if (includeImages) {
        allPaths = allPaths.concat(glob.sync(imagePaths));
    }

    for (const fixturePath of allPaths) {
        const testName = path.dirname(fixturePath);
        const fileName = path.basename(fixturePath);
        const extension = path.extname(fixturePath);
        try {
            if (extension === '.json') {
                let json = parseJsonFromFile(fixturePath);

                //Special case for style json which needs some preprocessing
                if (fileName === 'style.json') {
                    json = processStyle(testName, json);
                }

                allFiles[fixturePath] = json;
            } else if (extension === '.png') {
                allFiles[fixturePath] = true;
            } else {
                throw new Error(`${extension} is incompatible , file path ${fixturePath}`);
            }
        } catch (e) {
            console.log(`Error parsing file: ${fixturePath}`);
            allFiles[fixturePath] = {PARSE_ERROR: true, message: e.message};
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

function processStyle(testName, style) {
    const clone = JSON.parse(JSON.stringify(style));
    // 7357 is testem's default port
    localizeURLs(clone, 7357);

    clone.metadata = clone.metadata || {};
    clone.metadata.test = Object.assign({
        testName,
        width: 512,
        height: 512,
        pixelRatio: 1,
        recycleMap: false,
        allowed: 0.00015
    }, clone.metadata.test);

    return clone;
}
