/* global mapboxgl:readonly */
/* eslint-disable import/no-unresolved */
// fixtures.json is automatically generated before this file gets built
import suite from '../dist/fixtures.json';
import {applyOperations} from '../../test/integration/lib/operation-handlers';

//Used to warm-up the browser cache for consistent tile-load timings
const NUM_WARMUP_RUNS = 5;

const NUM_ACTUAL_RUNS = 15;

// This namespace ised to store functions/data that can be accessed and invoked by pupeteer.
window.mbglMetrics = {};

export function runMetrics() {
    const suiteList = [];
    for (const runName in suite) {
        suiteList.push(suite[runName]);
    }
    const totalRuns = NUM_WARMUP_RUNS + NUM_ACTUAL_RUNS;

    let currSuiteIndex = 0;
    let runCtr = 0;
    const nextRun = window.mbglMetrics.nextRun = function() {
        executeRun(suiteList[currSuiteIndex], (metrics) => {
            if (runCtr >= NUM_WARMUP_RUNS) {
                // Send a command to puppeteer using the `[PUPPETEER|<command>]:<command-data>` console message
                console.log(`[PUPPETEER|RUN_FINISHED]:${JSON.stringify({
                    name: suiteList[currSuiteIndex].style.metadata.test.testName,
                    metrics
                })}`);
            } else {
                // Move to next run automatically if we're still warming upz
                nextRun();
            }

            runCtr++;
            //Done with runs on this suite so reset state and move to next suite
            if (runCtr === totalRuns) {
                currSuiteIndex++;
                runCtr = 0;

                //Last suite so exit out
                if (currSuiteIndex === suiteList.length) {
                    console.log('[PUPPETEER|SUITE_FINISHED]');
                }
            }
        });
    };
    nextRun();
}

function executeRun(fixture, finishCb) {
    //1. Create and position the container, floating at the top left
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '10px';
    container.style.top = '10px';
    container.style.width = `${fixture.style.metadata.test.width}px`;
    container.style.height = `${fixture.style.metadata.test.height}px`;
    document.body.appendChild(container);

    const {mapOptions, operations} = parseFixture(container, fixture);
    let map = new mapboxgl.Map(mapOptions);
    map.repaint = true;
    applyOperations(map, operations, () => {
        const metrics = map.extractPerformanceMetrics();
        map.remove();
        map = null;
        document.body.removeChild(container);
        finishCb(metrics);
    });
}

function parseFixture(container, fixture) {
    const isStyleURL = fixture.style['style-url'] != null;

    // Use the entire fixture as the style, if no explicit style-url is specified, else grab initial viewport state
    // conditions from the style and pass them to the map constructor.
    const style = isStyleURL ? fixture.style['style-url'] : fixture.style;

    const mapOptions = {style, container};
    const mapOptionsStyleOverlapParams = [ 'center', 'zoom', 'bearing', 'pitch'];
    if (isStyleURL) {
        for (const param of mapOptionsStyleOverlapParams) {
            if (fixture.style[param] != null) {
                mapOptions[param] = fixture.style[param];
            }
        }
    }
    const operations = fixture.style.metadata.test.operations;

    return {mapOptions, operations};
}
