export type ObjMap<
  O extends Record<string, any>,
  F extends (...args: any[]) => any
> = {[P in keyof O]: ReturnType<F>};
