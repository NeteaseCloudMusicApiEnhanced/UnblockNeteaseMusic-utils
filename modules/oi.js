const axios = require('axios');
const logger = require('../src/logger');

/** * 通过oi音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @returns {string|null} 音乐URL或null
 */

module.exports = {
    async oi(id) {
        try {
            const response = await axios.get(`https://oiapi.net/api/Music_163?id=${id}`);
            if (response.data) {
                return response.data.data[0].url;
            }
            return null;
        } catch (error) {
            logger.error(`oi error: ${error.message}`);
            return null;
        }
    }
}