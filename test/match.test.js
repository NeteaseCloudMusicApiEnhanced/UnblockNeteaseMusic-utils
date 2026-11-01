// Hermetic unit tests for src/match.js
//
// Run with: npm run test:unit
//
// Everything is stubbed through Module._load (axios, @unblockneteasemusic/server,
// src/logger), so the tests never touch the network and do not need node_modules.

const { test, beforeEach } = require('node:test')
const assert = require('node:assert')
const Module = require('node:module')

const TIMEOUT_MS = 150
process.env.UNBLOCK_MODULE_TIMEOUT_MS = String(TIMEOUT_MS)

// ---------------------------------------------------------------------------
// stubs
// ---------------------------------------------------------------------------
let httpHandler = async () => {
  throw new Error('unexpected http request')
}
let unmHandler = async () => null

// every axios.get call is recorded so tests can assert the timeout / signal
const records = []

const fakeAxios = {
  get: (url, config = {}) => {
    records.push({ url, config })
    return httpHandler(url, config)
  },
}

// modules/unm.js calls the package as a function: match(id, sources)
const fakeUnmServer = (id, sources) => unmHandler(id, sources)

// silence expected module error logs (broken sources are the point of these tests)
const silentLogger = {
  log() {},
  info() {},
  warn() {},
  error() {},
  debug() {},
  success() {},
  critical() {},
}

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'axios') return fakeAxios
  if (request === '@unblockneteasemusic/server') return fakeUnmServer
  if (request === './logger' || request === '../src/logger') return silentLogger
  return originalLoad.call(this, request, parent, isMain)
}

const {
  matchID,
  getUnblockModuleTimeoutMs,
  getAvailableModules,
  DEFAULT_MODULE_TIMEOUT_MS,
} = require('../src/match')

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const hang = () => new Promise(() => {})
const fail = () => Promise.reject(new Error('source unavailable'))

// A response object that every axios-based module accepts.
const successResponse = (url) => ({
  headers: { location: url },
  data: { url, data: [{ url }] },
})

// URL fragment used by each axios module (unm is not axios based).
const URL_HINTS = {
  byfuns: 'byfuns.top',
  ddyr: 'zddyr.top',
  gdmusic: 'gdstudio',
  msls: 'msls1441',
  oi: 'oiapi.net',
  qijieya: 'qijieya.cn',
}

function reset(handler = hang, unm = async () => null) {
  httpHandler = handler
  unmHandler = unm
  records.length = 0
}

const hasHint = (url, moduleName) =>
  typeof URL_HINTS[moduleName] === 'string' && url.includes(URL_HINTS[moduleName])

beforeEach(() => {
  process.env.UNBLOCK_MODULE_TIMEOUT_MS = String(TIMEOUT_MS)
  reset()
})

// ---------------------------------------------------------------------------
// timeout configuration
// ---------------------------------------------------------------------------

test('the timeout is read lazily and clamped to [100, 30000] ms', () => {
  const previous = process.env.UNBLOCK_MODULE_TIMEOUT_MS
  try {
    process.env.UNBLOCK_MODULE_TIMEOUT_MS = '1234'
    assert.strictEqual(getUnblockModuleTimeoutMs(), 1234)

    process.env.UNBLOCK_MODULE_TIMEOUT_MS = '50'
    assert.strictEqual(getUnblockModuleTimeoutMs(), 100)

    process.env.UNBLOCK_MODULE_TIMEOUT_MS = '999999'
    assert.strictEqual(getUnblockModuleTimeoutMs(), 30000)

    process.env.UNBLOCK_MODULE_TIMEOUT_MS = 'not-a-number'
    assert.strictEqual(getUnblockModuleTimeoutMs(), DEFAULT_MODULE_TIMEOUT_MS)

    delete process.env.UNBLOCK_MODULE_TIMEOUT_MS
    assert.strictEqual(getUnblockModuleTimeoutMs(), DEFAULT_MODULE_TIMEOUT_MS)
  } finally {
    process.env.UNBLOCK_MODULE_TIMEOUT_MS = previous
  }
})

test('every axios request receives the configured timeout', { timeout: 5000 }, async () => {
  process.env.UNBLOCK_MODULE_TIMEOUT_MS = '321'
  reset(() => Promise.resolve(successResponse('https://stub.example/song.mp3')))

  for (const source of ['byfuns', 'ddyr', 'gdmusic', 'msls', 'oi', 'qijieya']) {
    records.length = 0
    const result = await matchID('1', source)
    assert.strictEqual(result.code, 200, `${source} should succeed`)
    const requests = records.filter((record) => hasHint(record.url, source))
    assert.ok(requests.length >= 1, `${source} should issue a request`)
    for (const request of requests) {
      assert.strictEqual(
        request.config.timeout,
        321,
        `${source} axios timeout should be the configured value`,
      )
      assert.ok(request.config.signal, `${source} should receive an AbortSignal`)
    }
  }
})

test(
  'msls/qijieya fallback requests also receive the configured timeout',
  { timeout: 5000 },
  async () => {
    process.env.UNBLOCK_MODULE_TIMEOUT_MS = '321'
    const calls = new Map()
    reset((url) => {
      const count = (calls.get(url) || 0) + 1
      calls.set(url, count)
      if (count === 1) return fail() // primary request fails -> fallback is used
      // the msls/qijieya fallback expects a plain-text URL body
      return Promise.resolve({ headers: {}, data: 'https://stub.example/fallback.mp3' })
    })

    for (const source of ['msls', 'qijieya']) {
      calls.clear()
      records.length = 0
      const result = await matchID('1', source)
      assert.strictEqual(result.code, 200, `${source} fallback should succeed`)
      const requests = records.filter((record) => hasHint(record.url, source))
      assert.strictEqual(requests.length, 2, `${source} should retry exactly once`)
      for (const request of requests) {
        assert.strictEqual(request.config.timeout, 321)
      }
    }
  },
)

// ---------------------------------------------------------------------------
// timeout / failure behaviour
// ---------------------------------------------------------------------------

test('a hanging module is cut off by the timeout', { timeout: 5000 }, async () => {
  reset(hang)
  const startedAt = Date.now()
  const result = await matchID('1', 'byfuns')
  const elapsed = Date.now() - startedAt

  assert.strictEqual(result.code, 500)
  assert.strictEqual(result.data, null)
  assert.ok(
    elapsed >= TIMEOUT_MS - 25 && elapsed < TIMEOUT_MS * 3,
    `expected ~${TIMEOUT_MS}ms, got ${elapsed}ms`,
  )
})

test(
  'a hanging specified source returns code 500 instead of throwing',
  { timeout: 5000 },
  async () => {
    reset(hang)
    const result = await matchID('1', 'byfuns')
    assert.deepStrictEqual(result, {
      code: 500,
      message: 'No available source found from byfuns',
      data: null,
    })
  },
)

test('starts all modules concurrently (total ~ one timeout, not N)', { timeout: 5000 }, async () => {
  reset(hang, hang)
  const startedAt = Date.now()
  const result = await matchID('1')
  const elapsed = Date.now() - startedAt

  assert.strictEqual(result.code, 500)
  assert.strictEqual(result.data, null)
  assert.ok(elapsed < TIMEOUT_MS * 3, `all sources should fail in parallel, took ${elapsed}ms`)
})

test('returns code 500 with data null when every source fails', { timeout: 5000 }, async () => {
  reset(fail, fail)
  const result = await matchID('1')
  assert.deepStrictEqual(result, {
    code: 500,
    message: 'No available source found',
    data: null,
  })
})

test(
  'unm has its own unref-ed deadline (non-axios module is bounded too)',
  { timeout: 5000 },
  async () => {
    reset(hang, hang)
    const startedAt = Date.now()
    const result = await matchID('1', 'unm')
    const elapsed = Date.now() - startedAt

    assert.strictEqual(result.code, 500)
    assert.ok(
      elapsed >= TIMEOUT_MS - 25 && elapsed < TIMEOUT_MS * 3,
      `unm deadline should fire at ~${TIMEOUT_MS}ms, got ${elapsed}ms`,
    )
  },
)

// ---------------------------------------------------------------------------
// priority
// ---------------------------------------------------------------------------

test(
  'returns the first successful module in directory (priority) order',
  { timeout: 5000 },
  async () => {
    // every module succeeds instantly: the directory-order first one must win
    reset(
      () => Promise.resolve(successResponse('https://stub.example/song.mp3')),
      async () => ({ url: 'https://unm.example/song.mp3' }),
    )
    const modules = getAvailableModules()
    const result = await matchID('1')

    assert.strictEqual(result.code, 200)
    assert.strictEqual(result.data.source, modules[0])
    assert.strictEqual(modules.indexOf(result.data.source), 0)
  },
)

test(
  'prefers a slower high-priority source over a fast lower-priority one',
  { timeout: 5000 },
  async () => {
    const modules = getAvailableModules()
    const winner = modules[0]
    const runnerUp = modules[1]

    reset((url) => {
      if (hasHint(url, winner)) {
        return delay(60).then(() => successResponse('https://winner.example/song.mp3'))
      }
      return Promise.resolve(successResponse('https://runner-up.example/song.mp3'))
    })

    const startedAt = Date.now()
    const result = await matchID('1')
    const elapsed = Date.now() - startedAt

    assert.strictEqual(result.code, 200)
    assert.strictEqual(result.data.source, winner)
    assert.notStrictEqual(result.data.source, runnerUp)
    assert.ok(elapsed >= 50, `should wait for the higher-priority source, took ${elapsed}ms`)
  },
)

test('aborts the in-flight losers once a source wins', { timeout: 5000 }, async () => {
  const winner = getAvailableModules()[0]
  reset((url) => {
    if (hasHint(url, winner)) {
      return Promise.resolve(successResponse('https://winner.example/song.mp3'))
    }
    return hang()
  })

  const result = await matchID('1')
  assert.strictEqual(result.data.source, winner)

  const losers = records.filter((record) => !hasHint(record.url, winner))
  assert.ok(losers.length > 0, 'there should be in-flight loser requests')
  for (const loser of losers) {
    assert.strictEqual(
      loser.config.signal.aborted,
      true,
      `loser request should be aborted: ${loser.url}`,
    )
  }
})

// ---------------------------------------------------------------------------
// public contract
// ---------------------------------------------------------------------------

test('keeps the public matchID contract', { timeout: 5000 }, async () => {
  reset(() => Promise.resolve(successResponse('https://stub.example/song.mp3')))

  const success = await matchID('1')
  assert.deepStrictEqual(success, {
    code: 200,
    message: 'success',
    data: {
      url: 'https://stub.example/song.mp3',
      source: getAvailableModules()[0],
    },
  })

  assert.deepStrictEqual(await matchID(null), {
    code: 400,
    message: 'Missing id parameter',
    data: null,
  })

  assert.deepStrictEqual(await matchID('1', 'does-not-exist'), {
    code: 404,
    message: 'Module does-not-exist not found',
    data: null,
  })

  // path traversal is rejected before any require()
  assert.deepStrictEqual(await matchID('1', '../index'), {
    code: 404,
    message: 'Module ../index not found',
    data: null,
  })
})
