// toubiec.js - 音源模块
const axios = require('axios');
const logger = require('../src/logger');

/**
 * 通过toubiec音源获取音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @returns {string|null} 音乐URL或null
 */
async function toubiec(id) {
    try {
        const response = await axios.post(`https://wyapi-1.toubiec.cn/api/music/url`, {
            id: id,
            level: 'lossless',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // toubiec返回JSON格式，需要提取url字段
        if (response.data && typeof response.data === 'object' && response.data.url) {
            return response.data.url;
        }

        return null;

    } catch (error) {
        logger.error(`toubiec error: ${error.message}`);
        return null;
    }
}

module.exports = toubiec;