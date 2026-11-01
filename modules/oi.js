const axios = require('axios');
const logger = require('../src/logger');
const { getUnblockModuleTimeoutMs } = require('../src/match');

/** * 通过oi音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @param {{signal?: AbortSignal}} [options] - abort signal from src/match.js
 * @returns {string|null} 音乐URL或null
 */

module.exports = {
    async oi(id, options = {}) {
        const { signal } = options;
        try {
            const response = await axios.get(`https://oiapi.net/api/Music_163?id=${id}`, {
                timeout: getUnblockModuleTimeoutMs(),
                signal
            });
            if (response.data) {
                return response.data.data[0].url;
            }
            return null;
        } catch (error) {
            if (!signal || !signal.aborted) {
                logger.error(`oi error: ${error.message}`);
            }
            return null;
        }
    }
}
