// @flow strict
import assert from 'assert';
import browser from './browser.js';

export type TaskID = number; // can't mark opaque due to https://github.com/flowtype/flow-remove-types/pull/61
type Task = {
    callback: (timeStamp: number) => void;
    id: TaskID;
    cancelled: boolean;
};

class TaskQueue {
    _queue: Array<Task>;
    _id: TaskID;
    _cleared: boolean;
    _currentlyRunning: Array<Task> | false;
    _cancelledTasks: Set<number>;

    constructor()  {
        this._queue = [];
        this._id = 0;
        this._cleared = false;
        this._cancelledTasks = new Set();
        this._currentlyRunning = false;
    }

    add(callback: (timeStamp: number) => void): TaskID {
        const id = ++this._id;
        const queue = this._queue;
        queue.push({callback, id, cancelled: false});
        return id;
    }

    remove(id: TaskID) {
        this._cancelledTasks.add(id);
    }

    run(timeStamp: number = 0) {
        assert(!this._currentlyRunning);
        const queue = this._currentlyRunning = this._queue;

        // Tasks queued by callbacks in the current queue should be executed
        // on the next run, not the current run.
        this._queue = [];

        for (const task of queue) {
            if (this._cancelledTasks.delete(task.id)) continue;
            task.callback(timeStamp);
            if (this._cleared) break;
        }

        this._cleared = false;
        this._currentlyRunning = false;
    }

    clear() {
        if (this._currentlyRunning) {
            this._cleared = true;
        }
        this._queue = [];
        this._cancelledTasks.clear();
    }
}


export class TimeBudgetedTaskQueue extends TaskQueue {
    _timeBudget: number; //in ms

    constructor(timeBudget: number) {
        super();
        this._timeBudget = timeBudget;
    }

    run(timeStamp: number = 0) {
        assert(!this._currentlyRunning);
        const queue = this._currentlyRunning = this._queue;

        // Tasks queued by callbacks in the current queue should be executed
        // on the next run, not the current run.
        this._queue = [];

        let totalTime = 0;
        let taskCt = 0;
        for (const task of queue) {
            taskCt++;

            if (this._cancelledTasks.delete(task.id)) continue;
            const start = browser.now();
            task.callback(timeStamp);
            totalTime = totalTime + (browser.now() - start);
            // stop running tasks once we've hit the time budget
            if (totalTime > this._timeBudget) break;
            if (this._cleared) break;
        }
        // Add in any leftover tasks to the task queue
        const leftoverTasks = this._currentlyRunning.slice(taskCt);
        this._queue = leftoverTasks.concat(this._queue);
        this._cleared = false;
        this._currentlyRunning = false;
    }

    tasksPending(): boolean {
        return this._queue.length > 0;
    }

}

export default TaskQueue;
