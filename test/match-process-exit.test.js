// Regression test: abandoned module timeout timers must NOT keep the Node.js
// process alive.
//
// Before timer.unref(), a lookup that returned in ~15ms kept the process alive
// until every loser timeout fired (measured: 1518ms exit time with a 1500ms
// timeout), which is a real problem for CLI usage and for tests.
//
// This test spawns a child Node process so the actual event-loop lifetime can be
// measured.

const { test } = require('node:test')
const assert = require('node:assert')
const { spawnSync } = require('node:child_process')

const MATCH_PATH = require.resolve('../src/match.js')
const TIMEOUT_MS = 1500

const childScript = `
const Module = require('module')
process.env.UNBLOCK_MODULE_TIMEOUT_MS = '${TIMEOUT_MS}'

const originalLoad = Module._load
const axiosStub = {
  get(url) {
    if (url.includes('byfuns.top')) {
      return Promise.resolve({
        headers: { location: 'https://byfuns.example/song.mp3' },
        data: '',
      })
    }
    return new Promise(() => {})
  },
}
Module._load = function (request, parent, isMain) {
  if (request === 'axios') return axiosStub
  if (request === '@unblockneteasemusic/server') return () => new Promise(() => {})
  return originalLoad.call(this, request, parent, isMain)
}

const { matchID } = require(${JSON.stringify(MATCH_PATH)})
const startedAt = Date.now()
matchID('1').then((result) => {
  process.stdout.write(
    JSON.stringify({
      elapsed: Date.now() - startedAt,
      code: result.code,
      source: result.data && result.data.source,
    }),
  )
})
`

test('abandoned module timers do not keep the process alive', { timeout: 15000 }, () => {
  const startedAt = Date.now()
  const child = spawnSync(process.execPath, ['-e', childScript], {
    encoding: 'utf8',
    timeout: 10000,
  })
  const wallTime = Date.now() - startedAt

  assert.strictEqual(
    child.status,
    0,
    `child exited with status ${child.status}: ${child.stderr || child.error}`,
  )

  const output = JSON.parse(child.stdout)
  assert.strictEqual(output.code, 200)
  assert.strictEqual(output.source, 'byfuns')
  assert.ok(output.elapsed < 500, `match should return quickly, took ${output.elapsed}ms`)
  assert.ok(
    wallTime < TIMEOUT_MS,
    `process should exit before the loser timeout (${TIMEOUT_MS}ms), took ${wallTime}ms`,
  )
})
