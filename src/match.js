const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('./logger');

const DEFAULT_MODULE_TIMEOUT_MS = 5000;
const MIN_MODULE_TIMEOUT_MS = 100;
const MAX_MODULE_TIMEOUT_MS = 30000;

/**
 * Resolve the per-module timeout (in milliseconds).
 *
 * axios defaults to `timeout: 0` (wait forever) and a single dead or slow
 * third-party source used to block the whole lookup chain for minutes: we
 * observed one source hanging for 61s before ECONNRESET, which made the API
 * caller (20s budget) give up and fall back to the official 45s preview.
 *
 * This is read lazily on every call so a value loaded later (for example by
 * `dotenv.config()` after this module was required) still takes effect.
 * It is also the per-request axios timeout used by the modules AND the hard
 * wall-clock timeout in callModuleWithTimeout() (which also covers modules
 * without axios, e.g. unm, backed by @unblockneteasemusic/server).
 *
 * Read from the UNBLOCK_MODULE_TIMEOUT_MS environment variable, clamped to
 * [100, 30000] ms; invalid/empty values fall back to the default.
 *
 * @returns {number} timeout in milliseconds
 */
function getUnblockModuleTimeoutMs() {
  const raw = Number(process.env.UNBLOCK_MODULE_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_MODULE_TIMEOUT_MS;
  }
  return Math.min(Math.max(raw, MIN_MODULE_TIMEOUT_MS), MAX_MODULE_TIMEOUT_MS);
}

/**
 * Backwards-compatible snapshot of the timeout (read once at require time).
 * Prefer getUnblockModuleTimeoutMs() when the value may come from .env.
 */
const UNBLOCK_MODULE_TIMEOUT_MS = getUnblockModuleTimeoutMs();

// 获取modules目录下的所有模块
const modulesDir = path.join(__dirname, '../modules');
let availableModules = [];

// 缓存已加载的模块
const moduleCache = {};

// 动态加载modules目录下的所有js模块
if (fs.existsSync(modulesDir)) {
  const files = fs.readdirSync(modulesDir);
  availableModules = files
    .filter(file => file.endsWith('.js'))
    .map(file => file.replace('.js', ''));
}

/**
 * 返回可加载的模块名（按目录/优先级顺序，副本）
 * @returns {string[]}
 */
function getAvailableModules() {
  return [...availableModules];
}

/**
 * 加载模块（带缓存）
 * @param {string} moduleName - 模块名称
 * @returns {Function|null} 模块函数或null
 */
function loadModule(moduleName) {
  // 如果已经缓存，直接返回
  if (moduleCache[moduleName]) {
    return moduleCache[moduleName];
  }

  const modulePath = path.join(__dirname, `../modules/${moduleName}.js`);
  if (!fs.existsSync(modulePath)) {
    return null;
  }

  try {
    const module = require(modulePath);
    // 支持两种导出方式：
    // 1. 直接导出函数: module.exports = function
    // 2. 对象导出: module.exports = { funcName: function }
    let moduleFunc = null;

    if (typeof module === 'function') {
      // 直接导出函数
      moduleFunc = module;
    } else if (typeof module === 'object' && module !== null) {
      // 对象导出，尝试提取函数
      // 优先查找与模块名同名的函数
      if (typeof module[moduleName] === 'function') {
        moduleFunc = module[moduleName];
      } else {
        // 如果没有同名函数，查找第一个函数
        for (const key of Object.keys(module)) {
          if (typeof module[key] === 'function') {
            moduleFunc = module[key];
            break;
          }
        }
      }
    }
    // 缓存提取的函数
    if (moduleFunc) {
      moduleCache[moduleName] = moduleFunc;
      return moduleFunc;
    }
    logger.error(`Module ${moduleName} does not export a valid function`);
    return null;
  } catch (error) {
    logger.error(`Failed to load module ${moduleName}: ${(error && error.message) || error}`);
    return null;
  }
}

/**
 * Call one module and resolve to its URL, or to null on failure/timeout.
 *
 * Never rejects: a broken, throwing or hanging module must not take down the
 * whole lookup. Two independent guards keep the latency bounded:
 *  - a hard wall-clock timeout (also covers modules without axios);
 *  - an AbortSignal so the caller can cancel requests of modules it no longer
 *    needs (a winner was found, or the whole lookup is over).
 *
 * The timer is unref'd so an abandoned module never keeps the Node.js process
 * alive after the lookup has already returned.
 *
 * @param {string} moduleName - module name, only used for logging
 * @param {Function} moduleFunc - the module function
 * @param {string} id - NeteaseCloudMusic song id
 * @param {AbortSignal} [signal] - aborts the underlying request
 * @returns {Promise<string|null>} music URL or null
 */
function callModuleWithTimeout(moduleName, moduleFunc, id, signal) {
  const timeoutMs = getUnblockModuleTimeoutMs();
  let timer = null;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      logger.error(`Unblock module ${moduleName} timed out after ${timeoutMs}ms`);
      resolve(null);
    }, timeoutMs);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  });

  const callPromise = Promise.resolve()
    .then(() => moduleFunc(id, { signal }))
    .then((url) => (url && url !== null ? url : null))
    .catch((error) => {
      // Aborted requests are expected (another source won); do not log them.
      if (!signal || !signal.aborted) {
        logger.error(`Error from ${moduleName}: ${(error && error.message) || error}`);
      }
      return null;
    });

  return Promise.race([callPromise, timeoutPromise]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
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
    // Only allow names discovered in modules/ (also prevents path traversal
    // such as `source=../index`).
    if (!availableModules.includes(source)) {
      return {
        code: 404,
        message: `Module ${source} not found`,
        data: null
      };
    }

    const moduleFunc = loadModule(source);
    if (typeof moduleFunc !== 'function') {
      return {
        code: 404,
        message: `Module ${source} not found`,
        data: null
      };
    }

    const controller = new AbortController();
    try {
      const url = await callModuleWithTimeout(source, moduleFunc, id, controller.signal);

      if (url) {
        return {
          code: 200,
          message: 'success',
          data: {
            url: url,
            source: source
          }
        };
      }

      return {
        code: 500,
        message: `No available source found from ${source}`,
        data: null
      };
    } finally {
      controller.abort();
    }
  }

  // Start every module at the same time (at most one HTTP request per module),
  // then return the first successful URL in the original directory (priority)
  // order. A slow source still occupies the priority slot, but the total lookup
  // latency is bounded by the per-module timeout instead of the sum of all
  // module latencies. Losers are aborted as soon as a winner is chosen.
  const pending = availableModules.map((moduleName) => {
    const moduleFunc = loadModule(moduleName);
    if (typeof moduleFunc !== 'function') {
      return null;
    }
    const controller = new AbortController();
    return {
      moduleName,
      controller,
      promise: callModuleWithTimeout(moduleName, moduleFunc, id, controller.signal)
    };
  });

  try {
    for (const entry of pending) {
      if (!entry) {
        continue;
      }
      const url = await entry.promise;
      if (url) {
        return {
          code: 200,
          message: 'success',
          data: {
            url: url,
            source: entry.moduleName
          }
        };
      }
    }
  } finally {
    // The lookup is over (success or not): cancel whatever is still in flight.
    for (const entry of pending) {
      if (entry && !entry.controller.signal.aborted) {
        entry.controller.abort();
      }
    }
  }

  // 所有模块都失败
  return {
    code: 500,
    message: 'No available source found',
    data: null
  };
}

module.exports = {
  matchID,
  getUnblockModuleTimeoutMs,
  getAvailableModules,
  UNBLOCK_MODULE_TIMEOUT_MS,
  DEFAULT_MODULE_TIMEOUT_MS
};
