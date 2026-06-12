import WorkerClass from '../../src/util/worker_class';

if (!WorkerClass.workerUrl) {
    // Internal, test-only: load the untranspiled worker source as an ES module.
    WorkerClass.workerParams = {type: 'module'};
    WorkerClass.workerUrl = '/src/source/worker.ts';
}
