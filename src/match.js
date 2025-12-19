const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('./logger');

// 获取modules目录下的所有模块
const modulesDir = path.join(__dirname, '../modules');
let availableModules = [];

// 动态加载modules目录下的所有js模块
if (fs.existsSync(modulesDir)) {
  const files = fs.readdirSync(modulesDir);
  availableModules = files
    .filter(file => file.endsWith('.js'))
    .map(file => file.replace('.js', ''));
}

/**
 * 匹配歌曲ID并返回可用的音乐URL
 * @param {string} id - 网易云音乐歌曲ID
 * @param {string} source - 指定的音源模块名称（可选）
 * @returns {Object} 包含code、message和data的对象
 */
async function matchID(id, source = null) {
  if (!id) {
    return {
      code: 400,
      message: 'Missing id parameter',
      data: null
    };
  }

  // 如果指定了特定音源
  if (source) {
    const modulePath = path.join(__dirname, `../modules/${source}.js`);
    if (!fs.existsSync(modulePath)) {
      return {
        code: 404,
        message: `Module ${source} not found`,
        data: null
      };
    }

    try {
      const module = require(modulePath);
      const url = await module(id);
      
      if (url) {
        return {
          code: 200,
          message: 'success',
          data: {
            url: url,
            source: source
          }
        };
      } else {
        return {
          code: 500,
          message: `No available source found from ${source}`,
          data: null
        };
      }
    } catch (error) {
      return {
        code: 500,
        message: `Error from ${source}: ${error.message}`,
        data: null
      };
    }
  }

  // 如果没有指定音源，遍历所有可用模块
  for (const moduleName of availableModules) {
    try {
      const modulePath = path.join(__dirname, `../modules/${moduleName}.js`);
      const module = require(modulePath);
      const url = await module(id);
      
      if (url && url !== null) {
        return {
          code: 200,
          message: 'success',
          data: {
            url: url,
            source: moduleName
          }
        };
      }
    } catch (error) {
      logger.error(`Error from ${moduleName}: ${error.message}`);
      // 继续尝试下一个模块
      continue;
    }
  }

  // 所有模块都失败
  return {
    code: 500,
    message: 'No available source found',
    data: null
  };
}

module.exports = { matchID };