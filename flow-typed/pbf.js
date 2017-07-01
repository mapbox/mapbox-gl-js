declare module "pbf" {
    declare class Pbf {
        constructor(ArrayBuffer | $ArrayBufferView): Pbf;
    }

    declare module.exports: typeof Pbf
}
