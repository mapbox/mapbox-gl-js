import * as module from './standard_main_imports';

export const Standard: Partial<typeof module.Standard> = module.Standard;

export async function prepareStandard(): Promise<void> { return Promise.resolve(); }
