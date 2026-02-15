const axios = require('axios');
const logger = require('../src/logger');

/** * 通过bikonoo音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @returns {string|null} 音乐URL或null
 */

module.exports = {
    async bikonoo(id) {
        try {
            const response = await axios.get(`https://ncm.bikonoo.com/api/163_music.php?ids=${id}&level=lossless&type=json`);
            if (response.data && typeof response.data === 'object' && response.data.url) {
                return response.data.url;

            }
            return null;
        } catch (error) {
            logger.error(`bikonoo error: ${error.message}`);
            return null;
        }
    }
}
