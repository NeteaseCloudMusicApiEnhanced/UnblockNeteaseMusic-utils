const axios = require('axios');
const logger = require('../src/logger');

/** * 通过baka音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @returns {string|null} 音乐URL或null
 */

module.exports = {
    async baka(id) {
        try {
            const response = await axios.get(`https://api.baka.plus/meting/?type=url&id=${id}`, {
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
            try {
                const response = await axios.get(`https://api.baka.plus/meting/?type=url&id=${id}`);
                if (typeof response.data === 'string' && response.data.startsWith('http')) {
                    return response.data;
                }
                return null;
            } catch (e) {
                logger.error(`baka error: ${e.message}`);
                return null;
            }
        }
    }
}