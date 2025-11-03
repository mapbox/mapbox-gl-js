import WorkerClass from './worker_class';

export function createWorker(name?: string): Worker {
    // eslint-disable-next-line new-cap
    return WorkerClass.workerClass != null ? new WorkerClass.workerClass() : new self.Worker(WorkerClass.workerUrl, Object.assign({name}, WorkerClass.workerParams));
}
