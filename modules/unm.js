const match = require('@unblockneteasemusic/server');
const logger = require('../src/logger');
const { getUnblockModuleTimeoutMs } = require('../src/match');

// NOTE: this module is backed by @unblockneteasemusic/server, which performs its
// own network requests, exposes no AbortSignal and has no configurable timeout.
// It therefore gets its own hard deadline (the same UNBLOCK_MODULE_TIMEOUT_MS as
// the other modules, unref'd so it never keeps the process alive). The SDK call
// itself cannot be cancelled; if the deadline wins, its promise is left to settle
// in the background and any late rejection is swallowed below.

/** * 通过unm音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @param {{signal?: AbortSignal}} [options] - abort signal from src/match.js
 * @returns {string|null} 音乐URL或null
 */

module.exports = {
    async unm(id, options = {}) {
        const { signal } = options;
        const timeoutMs = getUnblockModuleTimeoutMs();
        let timer = null;
        const deadline = new Promise((resolve) => {
            timer = setTimeout(() => resolve(null), timeoutMs);
            if (typeof timer.unref === 'function') {
                timer.unref();
            }
        });

        const sdkPromise = Promise.resolve()
            .then(() => match(id, ['pyncmd', 'bodian', 'qq']))
            .catch((error) => {
                if (!signal || !signal.aborted) {
                    logger.error(`unm error: ${(error && error.message) || error}`);
                }
                return null;
            });

        try {
            const response = await Promise.race([sdkPromise, deadline]);
            if (response && response.url) {
                return response.url;
            }
            return null;
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }
}
