export {ModelBucket, Tiled3dModelBucket} from './standard_worker_imports';

// Live in UMD builds: Standard is always loaded because all symbols are resolved
// synchronously at bundle load time. ESM exposes the same shape but lazily.
export const loaded = true;

export async function prepareStandard(): Promise<void> { return Promise.resolve(); }
