// @flow
/* global mapboxgl:readonly */
import suite from '../performance-metrics/suite.json';
import {applyOperations} from '../../test/integration/lib/operation-handlers';

//Used to warm-up the browser cache for consistent tile-load timings
const NUM_WARMUP_RUNS = 5;

const NUM_ACTUAL_RUNS = 5;

export function runMetrics() {
    const suiteList = [];
    for (const runName in suite) {
        suiteList.push(suite[runName]);
    }
    const totalRuns = NUM_WARMUP_RUNS + NUM_ACTUAL_RUNS;
    let currIndex = 0;

    const startRun = function() {
        executeRun(suiteList[0], (metrics) => {
            if (currIndex >= NUM_WARMUP_RUNS) {
                console.log(metrics);
            }

            currIndex++;
            if (currIndex < totalRuns) {
                startRun();
            }
        });
    };
    startRun();
}

function executeRun(options, finishCb) {

    //1. Create and position the container, floating at the top left
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '10px';
    container.style.top = '10px';
    container.style.width = `${options.width}px`;
    container.style.height = `${options.height}px`;
    document.body.appendChild(container);

    const mapOptions = parseOptions(container, options);
    let map = new mapboxgl.Map(mapOptions);
    map.repaint = true;
    applyOperations(map, options.operations, () => {
        const metrics = map.extractPerformanceMetrics();
        map.remove();
        map = null;
        document.body.removeChild(container);
        finishCb(metrics);
    });
}

function parseOptions(container, options) {
    const copy = JSON.parse(JSON.stringify(options));
    delete copy.width;
    delete copy.height;
    delete copy.operations;
    copy.container = container;
    return copy;
}

