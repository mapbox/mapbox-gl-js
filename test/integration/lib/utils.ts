export function sendFragment(id: number, data: string | undefined) {
    if (!data) {
        return Promise.resolve();
    }

    return fetch('/report-html/send-fragment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id,
            data: btoa(data),
        })
    });
}
