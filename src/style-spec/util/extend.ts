export default function(output: any, ...inputs: Array<any>): any {
    for (const input of inputs) {
        for (const k in input) {
            output[k] = input[k];
        }
    }
    return output;
}
