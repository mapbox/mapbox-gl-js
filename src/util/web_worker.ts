import WorkerClass from './worker_class';

export function createWorker(): Worker {
    // eslint-disable-next-line new-cap
    return WorkerClass.workerClass != null ? new WorkerClass.workerClass() : new self.Worker(WorkerClass.workerUrl, WorkerClass.workerParams);
}
