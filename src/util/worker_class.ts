import type {Class} from '../types/class';

type WorkerClass = {
    workerUrl: string;
    workerClass: Class<Worker> | null;
    workerParams?: WorkerOptions;
};

const WorkerClass: WorkerClass = {
    workerUrl: '',
    workerClass: null,
    workerParams: undefined,
};

export default WorkerClass;
