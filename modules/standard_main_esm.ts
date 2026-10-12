import {warnOnce} from '../src/util/util';
import {Standard} from './standard_registry_esm';

export {Standard};

let pending: Promise<void> | null = null;

export function prepareStandard(): Promise<void> {
    if (pending !== null) return pending;
    pending = import('./standard_main_imports').then(({Standard: standardModule}) => {
        Object.assign(Standard, standardModule);
    }).catch(() => {
        pending = null;
        warnOnce('Could not load Standard module.');
    });
    return pending;
}
