// @flow

import ThrottledInvoker from './throttled_invoker';
import {bindAll, isWorker} from './util';
import {PerformanceUtils} from './performance';

class Scheduler {

    tasks: { [number]: any };
    taskQueue: Array<number>;
    invoker: ThrottledInvoker;
    nextId: number;

    constructor() {
        this.tasks = {};
        this.taskQueue = [];
        bindAll(['process'], this);
        this.invoker = new ThrottledInvoker(this.process);

        this.nextId = 0;
    }

    add(fn: () => void, metadata: Object) {
        const id = this.nextId++;
        this.tasks[id] = {fn, metadata, priority: getPriority(metadata), id};
        this.taskQueue.push(id);
        this.invoker.trigger();
        return {
            cancel: () => {
                delete this.tasks[id];
            }
        };
    }

    process() {
        const m = isWorker() ? PerformanceUtils.beginMeasure('workerTask') : undefined;
        try {
            this.taskQueue = this.taskQueue.filter(id => !!this.tasks[id]);

            if (!this.taskQueue.length) {
                return;
            }
            const id = this.pick();
            if (id === null) return;

            const task = this.tasks[id];
            delete this.tasks[id];
            // Schedule another process call if we know there's more to process _before_ invoking the
            // current task. This is necessary so that processing continues even if the current task
            // doesn't execute successfully.
            if (this.taskQueue.length) {
                this.invoker.trigger();
            }
            if (!task) {
                // If the task ID doesn't have associated task data anymore, it was canceled.
                return;
            }

            task.fn();
        } finally {
            if (m) PerformanceUtils.endMeasure(m);
        }
    }

    pick() {
        let minIndex = null;
        let minPriority = Infinity;
        for (let i = 0; i < this.taskQueue.length; i++) {
            const id = this.taskQueue[i];
            const task = this.tasks[id];
            if (task.priority < minPriority) {
                minPriority = task.priority;
                minIndex = i;
            }
        }
        if (minIndex === null) return null;
        const id = this.taskQueue[minIndex];
        this.taskQueue.splice(minIndex, 1);
        return id;
    }

    remove() {
        this.invoker.remove();
    }
}

function getPriority({type, isSymbolTile, zoom}: Object) {
    zoom = zoom || 0;
    if (type === 'message') return 0;
    if (type === 'maybePrepare' && !isSymbolTile) return 100 - zoom;
    if (type === 'parseTile' && !isSymbolTile) return 200 - zoom;
    if (type === 'parseTile' && isSymbolTile) return 300 - zoom;
    if (type === 'maybePrepare' && isSymbolTile) return 400 - zoom;
    return 500;
}

export default Scheduler;
