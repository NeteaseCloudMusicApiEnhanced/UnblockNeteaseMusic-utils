const { matchID } = require('./src/match');
    async function getMusicUrl(id) {
        const result = await matchID(id, 'bikonoo'); // 返回json文本
        console.log(result); // 输出url
    }
console.log(getMusicUrl('557583842'))