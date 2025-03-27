import express from 'express';
import localizeURLs from './localize-urls.js';
import {injectMiddlewares} from './middlewares.js';

export default function () {
    let server;
    const port = 3000;
    const app = express();
    injectMiddlewares(app);

    return {
        listen(callback) {
            server = app.listen(port, callback);
        },

        close(callback) {
            if (!server) return;
            server.close(callback);
        },

        localizeURLs(style) {
            return localizeURLs(style, port);
        }
    };
}
