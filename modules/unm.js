const match = require('@unblockneteasemusic/server');
const logger = require('../src/logger');

/** * 通过unm音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @returns {string|null} 音乐URL或null
 */

module.exports = {
    async unm(id) {
        try {
            const sources = ['pyncmd', 'bodian', 'qq'];
            const response = await match(id, sources);
            if (response && response.url) {
                return response.url;
            }
            return null;
        } catch (error) {
            logger.error(`unm error: ${error.message}`);
            return null;
        }
    }
}