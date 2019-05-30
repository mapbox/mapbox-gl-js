// @flow strict

import type Window from '../src/types/window';

declare module "jsdom" {
    declare class JSDOM {
        constructor(content: string, options: Object): JSDOM;
        window: Window;
    }
    declare class VirtualConsole {
        constructor(): VirtualConsole;
        sendTo(console: typeof console): VirtualConsole;
    }
    declare module.exports: {
        JSDOM: typeof JSDOM,
        VirtualConsole: typeof VirtualConsole
    };
}
