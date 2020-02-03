/* eslint-disable import/no-commonjs */
const path = require('path');
const fs = require('fs');
const glob = require('glob');
const localizeURLs = require('./localize-urls');

const OUTPUT_FILE = 'fixtures.json';

exports.generateFixtureJson = generateFixtureJson;
exports.getAllFixtureGlobs = getAllFixtureGlobs;

/**
 * Analyzes the contents of the specified `path.join(rootDirectory, suiteDirectory)`, and inlines
 * the contents into a single json file which can then be imported and built into a bundle
 * to be shipped to the browser.
 *
 * @param {string} rootDirectory
 * @param {string} suiteDirectory
 * @param {boolean} includeImages
 */
function generateFixtureJson(rootDirectory, suiteDirectory, outputDirectory = 'test/integration/dist', includeImages = false) {
    const globs = getAllFixtureGlobs(rootDirectory, suiteDirectory);
    const jsonPaths = globs[0];
    const imagePaths = globs[1];
    //Extract the filedata into a flat dictionary
    const allFiles = {};
    let allPaths = glob.sync(jsonPaths);
    if (includeImages) {
        allPaths = allPaths.concat(glob.sync(imagePaths));
    }

    //A Set that stores test names that are malformed so they can be removed later
    const malformedTests = {};

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
                allFiles[fixturePath] = pngToBase64Str(fixturePath);
            } else {
                throw new Error(`${extension} is incompatible , file path ${fixturePath}`);
            }
        } catch (e) {
            console.log(`Error parsing file: ${fixturePath}`);
            malformedTests[testName] = true;
        }
    }

    // Re-nest by directory path, each directory path defines a testcase.
    const result = {};
    for (const fullPath in allFiles) {
        const testName = path.dirname(fullPath).replace(rootDirectory, '');
        //Skip if test is malformed
        if (malformedTests[testName]) { continue; }

        //Lazily initaialize an object to store each file wihin a particular testName
        if (result[testName] == null) {
            result[testName] = {};
        }
        //Trim extension from filename
        const fileName = path.basename(fullPath, path.extname(fullPath));
        result[testName][fileName] = allFiles[fullPath];
    }

    const outputStr = JSON.stringify(result, null, 4);
    const outputPath = path.join(outputDirectory, OUTPUT_FILE);

    return new Promise((resolve, reject) => {
        fs.writeFile(outputPath, outputStr, {encoding: 'utf8'}, (err) => {
            if (err) { reject(err); }

            resolve();
        });
    });
}

function getAllFixtureGlobs(rootDirectory, suiteDirectory) {
    const basePath = path.join(rootDirectory, suiteDirectory);
    const jsonPaths = path.join(basePath, '/**/*.json');
    const imagePaths = path.join(basePath, '/**/*.png');

    return [jsonPaths, imagePaths];
}

function parseJsonFromFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, {encoding: 'utf8'}));
}

function pngToBase64Str(filePath) {
    return fs.readFileSync(filePath).toString('base64');
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
