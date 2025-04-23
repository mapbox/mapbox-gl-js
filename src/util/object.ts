export const keys = Object.keys as <T extends object>(obj: T) => Array<Exclude<keyof T, number>>;
