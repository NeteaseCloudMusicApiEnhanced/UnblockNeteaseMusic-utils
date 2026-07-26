const axios = require('axios');
const logger = require('../src/logger');
const br = process.env.DISABLE_FLAC === 'true' ? 320 : 999;

/** * 通过gdmusic音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @returns {string|null} 音乐URL或null
 */

module.exports = {
    async gdmusic(id) {
        try {
            const response = await axios.get(`https://music-api.gdstudio.xyz/api.php?types=url&source=netease&id=${id}&br=${br}`);
            if (response.data && typeof response.data === 'object' && response.data.url) {
                return response.data.url;
            }
            return null;
        } catch (error) {
            logger.error(`gdmusic error: ${error.message}`);
            return null;
        }
    }
}