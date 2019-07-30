import fixtures from '../query-tests/fixtures.json';
import ignores from '../../ignores.json';


tape.test('query', (t) => {
    // Dynamically generate a test for each fixture
    for(let testName in fixtures){
        const testFunc = (t) => {
            // This needs to be read from the `t` object because this function runs async in a closure.
            const currentTestName = t.name;
            const style = fixtures[currentTestName].style;
            const expected = fixtures[currentTestName].expected;
            const options = style.metadata.test;
            // TODO: handle pixel ratio
            window.devicePixelRatio = options.pixelRatio;

            //1. Create and position the container, floating at the bottom right
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.bottom = '10px';
            container.style.right = '10px';
            container.style.width = `${options.width}px`;
            container.style.height = `${options.height}px`;
            document.body.appendChild(container);


            //2. Initialize the Map
            const map = new mapboxgl.Map({
                container,
                style,
                classes: options.classes,
                interactive: false,
                attributionControl: false,
                preserveDrawingBuffer: true,
                axonometric: options.axonometric || false,
                skew: options.skew || [0, 0],
                fadeDuration: options.fadeDuration || 0,
                localIdeographFontFamily: options.localIdeographFontFamily || false,
                crossSourceCollisions: typeof options.crossSourceCollisions === "undefined" ? true : options.crossSourceCollisions
            });
            map.repaint = true;
            map.once('load', () => {
                //3. Run the operations on the map
                applyOperations(map, options.operations, () => {

                    //4. Perform query operation and compare results from expected values
                    const results = options.queryGeometry ?
                        map.queryRenderedFeatures(options.queryGeometry, options.queryOptions || {}) :
                        [];

                    //Cleanup WebGL context
                    map.remove();
                    delete map.painter.context.gl;
                    document.body.removeChild(container);

                    const actual = results.map((feature) => {
                        let featureJson = JSON.parse(JSON.stringify(feature.toJSON()));
                        delete featureJson.layer;
                        return featureJson;
                    });

                    t.deepEqual(actual, expected);
                    t.end();
                });
            });
        };

        if(testName in ignores){
            t.skip(testName, testFunc);
        }else{
            t.test(testName, testFunc);
        }
    }
});


function applyOperations(map, operations, doneCb) {
    // No operations specified, end immediately adn invoke doneCb.
    if(!operations || operations.length === 0){
        doneCb();
        return;
    }

    // Start recursive chain
    const scheduleNextOperation = (lastOpIndex) => {
        if(lastOpIndex === operations.length - 1){
            // Stop recusive chain when at the end of the operations
            doneCb();
            return;
        }

        handleOperation(map, operations, ++lastOpIndex, scheduleNextOperation);
    };
    scheduleNextOperation(-1);
}


function handleOperation(map, operations, opIndex, doneCb) {
    const operation = operations[opIndex];
    const opName = operation[0];
    //Delegate to special handler if one is available
    if(opName in operationHandlers){
        operationHandlers[opName](map, operation.slice(1), () => {
            doneCb(opIndex);
        });
    }else{
        map[opName](...operation.slice(1));
        doneCb(opIndex);
    }
}


// TODO: support other actions, refer suite_implementation.js
const operationHandlers = {
    wait: function(map, params, doneCb) {
        const wait = function() {
            if (map.loaded()) {
                doneCb();
            } else {
                map.once('render', wait);
            }
        };
        wait();
    }
}