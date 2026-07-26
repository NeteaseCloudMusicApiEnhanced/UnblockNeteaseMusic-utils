const axios = require('axios');
const logger = require('../src/logger');
const br = process.env.DISABLE_FLAC === 'true' ? 'exhigh' : 'hi-res';

/** * 通过gdmusic音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @returns {string|null} 音乐URL或null
 */

module.exports = {
    async gdmusic(id) {
        try {
            const response = await axios.get(`https://163api.qijieya.cn/song/url/v1?id=${id}&level=${br}`);
            logger.info(`qijieyaPlus response: ${JSON.stringify(response.data)}`);
            const data = response.data.data[0];
            if (data.url) {
                return data.url;
            }
            return null;
        } catch (error) {
            logger.error(`qijieyaPlus error: ${error.message}`);
            return null;
        }
    }
}