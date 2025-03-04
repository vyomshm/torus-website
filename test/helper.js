/* eslint-disable no-console */
const nock = require('nock')
const log = require('loglevel')
const Ganache = require('ganache-core')

const register = require('@babel/register').default

register({
  extensions: ['.js'],
  rootMode: 'upward',
  ignore: [/(node_module)/],
  presets: [['@vue/cli-plugin-babel/preset', { useBuiltIns: 'entry' }]],
  plugins: ['@babel/plugin-proposal-class-properties'],
})

nock.disableNetConnect()
nock.enableNetConnect((host) => host.includes('localhost') || host.includes('mainnet.infura.io:443'))

// catch rejections that are still unhandled when tests exit
const unhandledRejections = new Map()
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled rejection:', reason)
  unhandledRejections.set(promise, reason)
})
process.on('rejectionHandled', (promise) => {
  console.log(`handled: ${unhandledRejections.get(promise)}`)
  unhandledRejections.delete(promise)
})

process.on('exit', () => {
  if (unhandledRejections.size > 0) {
    console.error(`Found ${unhandledRejections.size} unhandled rejections:`)
    for (const reason of unhandledRejections.values()) {
      console.error('Unhandled rejection:', reason)
    }
    process.exit(1)
  }
})

// ganache server
const server = Ganache.server()
server.listen(8545, () => {})

log.setDefaultLevel(5)
global.log = log

//
// polyfills
//

// fetch
const fetch = require('node-fetch')

global.fetch = fetch
global.Response = fetch.Response
global.Headers = fetch.Headers
global.Request = fetch.Request

// dom
require('jsdom-global')()

global.matchMedia = global.matchMedia || (() => ({ matches: false, addListener: () => {}, removeListener: () => {} }))
