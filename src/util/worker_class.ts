import type {Class} from '../types/class';

export default {
    workerUrl: '',
    workerClass: null,
    workerParams: undefined,
} as {
    workerUrl: string;
    workerClass: Class<Worker>;
    workerParams: WorkerOptions;
};
