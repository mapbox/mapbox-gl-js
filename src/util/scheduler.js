// @flow

import ThrottledInvoker from './throttled_invoker.js';
import {bindAll, isWorker} from './util.js';
import {PerformanceUtils} from './performance.js';

import type {Cancelable} from '../types/cancelable.js';

type TaskMetadata = {
    type: 'message' | 'maybePrepare' | 'parseTile',
    isSymbolTile: ?boolean,
    zoom?: number
};

type TaskFunction = () => void;

type Task = {
    fn: TaskFunction,
    metadata: TaskMetadata,
    priority: number,
    id: number
};

class Scheduler {

    tasks: { [number]: Task };
    taskQueue: Array<number>;
    invoker: ThrottledInvoker;
    nextId: number;

    constructor() {
        this.tasks = {};
        this.taskQueue = [];
        bindAll(['process'], this);
        // $FlowFixMe[method-unbinding]
        this.invoker = new ThrottledInvoker(this.process);

        this.nextId = 0;
    }

    add(fn: TaskFunction, metadata: TaskMetadata): Cancelable | null {
        const id = this.nextId++;
        const priority = getPriority(metadata);

        if (priority === 0) {
            // Process tasks with priority 0 immediately. Do not yield to the event loop.
            const m = isWorker() ? PerformanceUtils.beginMeasure('workerTask') : undefined;
            try {
                fn();
            } finally {
                if (m) PerformanceUtils.endMeasure(m);
            }
            // Don't return an empty cancel because we can't actually be cancelled
            return null;
        }

        this.tasks[id] = {fn, metadata, priority, id};
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

    pick(): null | number {
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

function getPriority({type, isSymbolTile, zoom}: TaskMetadata): number {
    zoom = zoom || 0;
    if (type === 'message') return 0;
    if (type === 'maybePrepare' && !isSymbolTile) return 100 - zoom;
    if (type === 'parseTile' && !isSymbolTile) return 200 - zoom;
    if (type === 'parseTile' && isSymbolTile) return 300 - zoom;
    if (type === 'maybePrepare' && isSymbolTile) return 400 - zoom;
    return 500;
}

export default Scheduler;
