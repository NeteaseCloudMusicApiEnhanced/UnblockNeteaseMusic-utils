const axios = require('axios');
const logger = require('../src/logger');
const br = process.env.DISABLE_FLAC === 'true' ? 'standard' : 'hires';

/** * 通过ddyr音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @returns {string|null} 音乐URL或null
 */

module.exports = {
    async bugpk(id) {
        try {
            const response = await axios.get(`https://api.bugpk.com/api/163_music?type=json&ids=${id}&quality=${br}`);
            if (response.data) {
                return response.data.url;
            }
            return null;
        } catch (error) {
            logger.error(`bugpk error: ${error.message}`);
            return null;
        }
    }
}