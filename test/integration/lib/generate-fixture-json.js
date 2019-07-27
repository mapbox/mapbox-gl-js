import path from 'path';
import fs from 'fs';
import glob from 'glob';
import {shuffle} from 'shuffle-seed';

const OUTPUT_FILE = 'fixtures.json';

/**
 * Analyzes the contents of the specified `directory` ,and inlines
 * the contents into a single json file which can then we imported and built into a bundle
 * to be shipped to the browser.
 *
 * @param {string} directory
 * @param {Object} options
 */
export default function ( directory, options ) {
    const tests = options.tests || [];
    const ignores = options.ignores || {};

    const basePath = path.join(process.cwd(), directory);
    const jsonPaths = path.join(basePath, '/**/*.json');
    const imagePaths = path.join(basePath, '/**/*.png');
    //Extract the filedata into a flat dictionary
    let allFiles = {};
    glob.sync(jsonPaths).concat(glob.sync(imagePaths)).forEach(fixturePath => {
        try {
            const fileName = path.basename(fixturePath);
            const extension = path.extname(fixturePath)

            if( extension === '.json' ){
                let json = parseJsonFromFile(fixturePath);

                //Special case for style json which needs some preprocessing
                if( fileName === 'style.json' ) {

                }

                allFiles[fixturePath] = json;
            } else if ( extension === '.png' ) {
                allFiles[fixturePath] = pngToBase64Str(fixturePath);
            } else {
                throw new Error(`${extension} is incompatible , file path ${fixturePath}`);
            }
        } catch (e) {
            console.log(`Error parsing file: ${fixturePath}`);
        }
    });

    // Re-nest by directory name, each directory name defines a testcase.
    let result = {};
    for ( let fullPath in allFiles ) {
        const dirName = path.dirname(fullPath);
        if( result[dirName] == null ){
            result[dirName] = {};
        }
        const fileName = path.basename(fullPath, path.extname(fullPath));
        result[dirName][fileName] = allFiles[fullPath];
    }

    const outputStr = JSON.stringify(result, null, 4);
    const outputPath = path.join(basePath, OUTPUT_FILE);

    fs.writeFileSync(outputPath, outputStr, { encoding: 'utf8'});
}


function parseJsonFromFile( filePath ) {
    return JSON.parse(fs.readFileSync( filePath, { encoding: 'utf8' }));
}

function pngToBase64Str( filePath ) {
    return fs.readFileSync(filePath).toString('base64');
}