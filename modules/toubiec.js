// toubiec.js - 音源模块
const axios = require('axios');
const logger = require('../src/logger');
const https = require('https');

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
        }, {
            headers: {
                'accept': '*/*',
                'accept-language': 'zh-CN,zh;q=0.9',
                'content-type': 'application/json',
                'origin': 'https://wyapi.toubiec.cn',
                'priority': 'u=1, i',
                'referer': 'https://wyapi.toubiec.cn/',
                'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            timeout: 10000
        });

        if (response.data && typeof response.data === 'object' && response.data.data[0].url) {
            return response.data.data[0].url;
        }

        return null;
    } catch (error) {
        logger.error(`toubiec error: ${error.message}`);
        return null;
    }
}

module.exports = toubiec;