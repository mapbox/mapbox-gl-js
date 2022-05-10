// @flow

import window from '../util/window.js';

import Dispatcher from './dispatcher.js';
import getWorkerPool from './global_worker_pool.js';
import {PerformanceUtils} from './performance.js';

const performance = window.performance;

// separate from PerformanceUtils to avoid circular dependency

export const WorkerPerformanceUtils = {

    getPerformanceMetricsAsync(callback: (error: ?Error, result: ?Object) => void) {
        const metrics = PerformanceUtils.getPerformanceMetrics();
        const dispatcher = new Dispatcher(getWorkerPool(), this);

        const createTime = performance.getEntriesByName('create', 'mark')[0].startTime;

        dispatcher.broadcast('getWorkerPerformanceMetrics', {}, (err, results) => {
            dispatcher.remove();
            if (err) return callback(err);

            const sums = {};

            for (const result of results) {
                for (const measure of result.entries) {
                    if (measure.entryType !== 'measure') continue;
                    sums[measure.name] = (sums[measure.name] || 0) + measure.duration;
                }

                sums.workerInitialization = result.timeOrigin - performance.timeOrigin - createTime;
            }

            for (const name in sums) {
                metrics[name] = sums[name] / results.length;
            }

            metrics.workerIdle = metrics.loadTime - metrics.workerInitialization - metrics.workerEvaluateScript - metrics.workerTask;
            metrics.workerIdlePercent = metrics.workerIdle / metrics.loadTime;

            metrics.parseTile = metrics.parseTile1 + metrics.parseTile2;

            metrics.timelines = [PerformanceUtils.getWorkerPerformanceMetrics(), ...results];

            return callback(undefined, metrics);
        });
    }
};
