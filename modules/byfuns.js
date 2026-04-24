const axios = require('axios');
const logger = require('../src/logger');

/**
 * 通过byfuns音源获取音乐URL (支持无损音质)
 * @param {string} id - 网易云音乐歌曲ID
 * @returns {string|null} 音乐URL或null
 */

module.exports = {
    async byfuns(id) {
        try {
            const response = await axios.get(`https://api.byfuns.top/1/?id=${id}&level=lossless`, {
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400
            });
            
            // byfuns API 有两种返回方式：
            // 1. 3xx 重定向，直接返回音乐URL
            // 2. 直接返回文本URL
            
            if (response.headers.location) {
                return response.headers.location;
            }
            
            // 直接返回文本内容（可能直接是URL）
            if (typeof response.data === 'string') {
                const url = response.data.trim();
                if (url.startsWith('http')) {
                    return url;
                }
            }
            
            return null;
        } catch (error) {
            logger.error(`byfuns error: ${error.message}`);
            return null;
        }
    }
}