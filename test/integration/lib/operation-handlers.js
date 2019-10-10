function handleOperation(map, operations, opIndex, doneCb) {
    const operation = operations[opIndex];
    const opName = operation[0];
    //Delegate to special handler if one is available
    if (opName in operationHandlers) {
        operationHandlers[opName](map, operation.slice(1), () => {
            doneCb(opIndex);
        });
    } else {
        map[opName](...operation.slice(1));
        doneCb(opIndex);
    }
}

export const operationHandlers = {
    wait(map, params, doneCb) {
        const wait = function() {
            if (map.loaded()) {
                doneCb();
            } else {
                map.once('render', wait);
            }
        };
        wait();
    }
};

export function applyOperations(map, operations, doneCb) {
    // No operations specified, end immediately adn invoke doneCb.
    if (!operations || operations.length === 0) {
        doneCb();
        return;
    }

    // Start recursive chain
    const scheduleNextOperation = (lastOpIndex) => {
        if (lastOpIndex === operations.length - 1) {
            // Stop recusive chain when at the end of the operations
            doneCb();
            return;
        }

        handleOperation(map, operations, ++lastOpIndex, scheduleNextOperation);
    };
    scheduleNextOperation(-1);
}
