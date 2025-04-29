// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function (output: any, ...inputs: Array<any>): any {
    for (const input of inputs) {
        for (const k in input) {
            output[k] = input[k];
        }
    }
    return output;
}
