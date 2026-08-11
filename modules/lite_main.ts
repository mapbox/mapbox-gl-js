import * as module from './lite_main_imports';

export const Lite: Partial<typeof module.Lite> = module.Lite;

export async function prepareLite(): Promise<void> { return Promise.resolve(); }
