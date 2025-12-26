const { matchID } = require('./src/match');
    async function getMusicUrl(id) {
        const result = await matchID(id, 'toubiec'); // 返回json文本
        console.log(result); // 输出url
    }
console.log(getMusicUrl('1971144922'))