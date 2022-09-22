// @flow strict

declare module "jsdom" {
    declare class JSDOM {
        constructor(content: string, options: Object): JSDOM;
        window: WindowProxy;
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
