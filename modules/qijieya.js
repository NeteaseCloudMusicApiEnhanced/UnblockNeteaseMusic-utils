const axios = require('axios');
const logger = require('../src/logger');
const { getUnblockModuleTimeoutMs } = require('../src/match');

/** * 通过qijieya音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @param {{signal?: AbortSignal}} [options] - abort signal from src/match.js
 * @returns {string|null} 音乐URL或null
 */

module.exports = {
    async qijieya(id, options = {}) {
        const { signal } = options;
        try {
            const response = await axios.get(`https://api.qijieya.cn/meting/?type=url&id=${id}`, {
                timeout: getUnblockModuleTimeoutMs(),
                signal,
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400
            });
            if (response.headers.location) {
                return response.headers.location;
            }
            if (response.data && typeof response.data === 'object' && response.data.url) {
                return response.data.url;
            }
            return null;
        } catch (error) {
            if (signal && signal.aborted) {
                return null;
            }
            try {
                const response = await axios.get(`https://api.qijieya.cn/meting/?type=url&id=${id}`, {
                    timeout: getUnblockModuleTimeoutMs(),
                    signal
                });
                if (typeof response.data === 'string' && response.data.startsWith('http')) {
                    return response.data;
                }
                return null;
            } catch (e) {
                if (!signal || !signal.aborted) {
                    logger.error(`qijieya error: ${e.message}`);
                }
                return null;
            }
        }
    }
}
