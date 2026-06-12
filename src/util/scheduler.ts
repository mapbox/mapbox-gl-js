import ThrottledInvoker from './throttled_invoker';
import {bindAll, isWorker} from './util';
import {PerformanceUtils} from './performance';
import {RenderSourceType} from '../source/render_source_type';

import type {Cancelable} from '../types/cancelable';

export type TaskMetadata = {
    type: 'message' | 'maybePrepare' | 'parseTile';
    renderSourceType?: RenderSourceType | null;
    zoom?: number;
};

type TaskFunction = () => void;

type Task = {
    fn: TaskFunction;
    metadata: TaskMetadata;
    priority: number;
    id: number;
};

class Scheduler {

    tasks: Map<number, Task>;
    invoker: ThrottledInvoker;
    nextId: number;

    constructor() {
        this.tasks = new Map();
        bindAll(['process'], this);
        this.invoker = new ThrottledInvoker(this.process);
        this.nextId = 0;
    }

    add(fn: TaskFunction, metadata: TaskMetadata): Cancelable | null {
        const id = this.nextId++;
        const priority = getPriority(metadata);

        if (priority === 0) {
            // Process tasks with priority 0 immediately. Do not yield to the event loop.
            const m = isWorker(self) ? PerformanceUtils.beginMeasure('workerTask') : undefined;
            try {
                fn();
            } finally {
                if (m) PerformanceUtils.endMeasure(m);
            }
            // Don't return an empty cancel because we can't actually be cancelled
            return null;
        }

        this.tasks.set(id, {fn, metadata, priority, id});
        this.invoker.trigger();
        return {
            cancel: () => {
                this.tasks.delete(id);
            }
        };
    }

    process() {
        const m = isWorker(self) ? PerformanceUtils.beginMeasure('workerTask') : undefined;
        try {
            const task = this.pick();
            if (!task) return;

            this.tasks.delete(task.id);
            // Schedule another process call if we know there's more to process _before_ invoking the
            // current task. This is necessary so that processing continues even if the current task
            // doesn't execute successfully.
            if (this.tasks.size > 0) {
                this.invoker.trigger();
            }

            task.fn();
        } finally {
            if (m) PerformanceUtils.endMeasure(m);
        }
    }

    pick(): Task | null {
        let result: Task | null = null;
        let minPriority = Infinity;
        for (const task of this.tasks.values()) {
            if (task.priority < minPriority) {
                minPriority = task.priority;
                result = task;
            }
        }
        return result;
    }

    remove() {
        this.tasks.clear();
        this.invoker.remove();
    }
}

function getPriority({type, renderSourceType, zoom}: TaskMetadata): number {
    zoom = zoom || 0;
    const isSymbol = renderSourceType === RenderSourceType.Symbol;
    if (type === 'message') return 0;
    if (type === 'maybePrepare' && !isSymbol) return 100 - zoom;
    if (type === 'parseTile' && !isSymbol) return 200 - zoom;
    if (type === 'parseTile' && isSymbol) return 300 - zoom;
    if (type === 'maybePrepare' && isSymbol) return 400 - zoom;
    return 500;
}

export default Scheduler;
