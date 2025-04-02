import Dispatcher from './dispatcher';
import {getGlobalWorkerPool as getWorkerPool} from './worker_pool_factory';
import {PerformanceUtils} from './performance';

import type {Callback} from '../types/callback';
import type {PerformanceMetrics, WorkerPerformanceMetrics} from './performance';

// separate from PerformanceUtils to avoid circular dependency

export const WorkerPerformanceUtils = {

    getPerformanceMetricsAsync(callback: Callback<PerformanceMetrics>) {
        const metrics = PerformanceUtils.getPerformanceMetrics();
        const dispatcher = new Dispatcher(getWorkerPool(), WorkerPerformanceUtils);

        const createTime = performance.getEntriesByName('create', 'mark')[0].startTime;

        dispatcher.broadcast('getWorkerPerformanceMetrics', undefined, (err, results: WorkerPerformanceMetrics[]) => {
            dispatcher.remove();
            if (err) return callback(err);

            const sums: Record<string, number> = {};

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
} as const;
