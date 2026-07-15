import WorkerClass from './worker_class';

export function createWorker(name?: string): Worker {
    // eslint-disable-next-line new-cap
    if (WorkerClass.workerClass != null) return new WorkerClass.workerClass();
    // The worker bundle is valid as classic or module, but only the
    // module form permits `import.meta`. Downstream bundlers (Vite, Rolldown,
    // webpack5+) instrument every dynamic import() they see by injecting
    // `import.meta.url`.
    // In a classic worker that throws "Cannot use 'import.meta' outside a module"
    // the instant it parses, killing the worker silently while the main thread keeps
    // running normally.
    return new self.Worker(WorkerClass.workerUrl, ({name, type: 'module', ...WorkerClass.workerParams}));
}
