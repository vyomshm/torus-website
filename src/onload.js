import NodeDetailManager from '@toruslabs/fetch-node-details'
import log from 'loglevel'
import LocalMessageDuplexStream from 'post-message-stream'
import Web3 from 'web3'

import TorusController from './controllers/TorusController'
import setupMultiplex from './controllers/utils/setupMultiplex'
import { MAINNET, MAINNET_CODE, MAINNET_DISPLAY_NAME } from './utils/enums'
import { getIFrameOrigin, isMain, isPwa, storageAvailable } from './utils/utils'
// import store from './store'
let storeReference
let deferredDispatch = []
function getStore() {
  return (
    storeReference || {
      dispatch(...arguments_) {
        deferredDispatch.push(() => {
          storeReference.dispatch(...arguments_)
        })
      },
    }
  )
}

export function injectStore(s) {
  storeReference = s
  deferredDispatch.forEach((fn) => fn())
  deferredDispatch = []
}

function triggerUi(type, payload, request) {
  log.info(`TRIGGERUI:${type}`, payload, request)
  getStore().dispatch('showPopup', { payload, request })
}

function triggerThresholdUi(type, payload) {
  log.info(`TRIGGER THRESHOLD UI:${type}`, payload)
  getStore().dispatch('showThresholdKeyUi', { type, data: payload })
}

function onloadTorus(torus) {
  let sessionData

  if (storageAvailable(!isPwa ? 'sessionStorage' : 'localStorage')) {
    const storage = isPwa ? localStorage : sessionStorage
    sessionData = storage.getItem('torus-app')
  }

  const sessionCachedNetwork = (sessionData && JSON.parse(sessionData).networkType) || {
    host: MAINNET,
    chainId: MAINNET_CODE,
    networkName: MAINNET_DISPLAY_NAME,
  }

  const torusController = new TorusController({
    sessionCachedNetwork,
    showUnconfirmedMessage: triggerUi.bind(window, 'showUnconfirmedMessage'),
    unlockAccountMessage: triggerUi.bind(window, 'unlockAccountMessage'),
    showUnapprovedTx: triggerUi.bind(window, 'showUnapprovedTx'),
    openPopup: triggerUi.bind(window, 'bindopenPopup'),
    requestTkeyInput: triggerThresholdUi.bind(window, 'requestTkeyInput'),
    storeProps: () => {
      const { state } = getStore()
      const { selectedAddress, wallet } = state || {}
      return { selectedAddress, wallet }
    },
    rehydrate() {
      getStore().dispatch('rehydrate')
    },
  })

  torus.torusController = torusController

  torusController.provider.setMaxListeners(100)
  torus.web3 = new Web3(torusController.provider)

  // update node details
  torus.nodeDetailManager = new NodeDetailManager({ network: process.env.VUE_APP_PROXY_NETWORK, proxyAddress: process.env.VUE_APP_PROXY_ADDRESS })
  torus.nodeDetailManager
    .getNodeDetails()
    .then((nodeDetails) => log.info(nodeDetails))
    .catch((error) => log.error(error))
  // torus.nodeDetailManager._currentEpoch = 1
  // torus.nodeDetailManager._torusNodeEndpoints = [
  //   'https://node-1.webauthn.dev.tor.us/jrpc',
  //   'https://node-2.webauthn.dev.tor.us/jrpc',
  //   'https://node-3.webauthn.dev.tor.us/jrpc',
  //   'https://node-4.webauthn.dev.tor.us/jrpc',
  //   'https://node-5.webauthn.dev.tor.us/jrpc',
  // ]
  // torus.nodeDetailManager.torusNodePub = [
  //   {
  //     X: 'f5f7604bdb3f5b81e6c7e597110816caa85647c3ade384278a430cbb77b18842',
  //     Y: '2d71aaf7ec0543edb60408f8a66a6671b526a26c80520027f59238dcadcaec1c',
  //   },
  //   {
  //     X: '84534127a341b95c1cc6a0fc90b88fcbe7bfb3f8601cafb7ca73a5db02afb30c',
  //     Y: '85fa2bd61619d995b9cb8bab7cfc052059fdffb2055b6d57ea529e5f20096a02',
  //   },
  //   {
  //     X: 'b63a0ed8a0a89e787d286eb6e3a81324fdbee63a62d0df56ad239d7e94c04aa3',
  //     Y: 'db4739572583ddc788e5304697b15fbe0993f474944638c08c4b531a3bcbbc07',
  //   },
  //   {
  //     X: '9dd1f6aad5632111a4b6d592acf140e81c58daee0715ee036a205c97f189f659',
  //     Y: '8d7c0b2694218af3d07f7e38fe0cdd4add243f39ed566ae60d60cc9504a0a55f',
  //   },
  //   {
  //     X: '62a59f2922f4ead0babf5897e2b0054cc42c84d8943dae68203906e3a78f4376',
  //     Y: 'aa7d3176c41bdaa5ac189ae590f3ef7fcaf121827a510c2d4f6218242131209b',
  //   },
  // ]
  // torus.nodeDetailManager.torusIndexes = [1, 2, 3, 4, 5]
  // we use this to start accounttracker balances
  torusController.setupControllerConnection()

  if (isMain) return torus

  const metamaskStream = new LocalMessageDuplexStream({
    name: 'iframe_metamask',
    target: 'embed_metamask',
    targetWindow: window.parent,
  })

  const communicationStream = new LocalMessageDuplexStream({
    name: 'iframe_comm',
    target: 'embed_comm',
    targetWindow: window.parent,
  })

  torus.metamaskMux = setupMultiplex(metamaskStream)
  torus.communicationMux = setupMultiplex(communicationStream)
  torus.communicationMux.setMaxListeners(50)

  const providerOutStream = torus.metamaskMux.getStream('provider')

  torusController.setupUntrustedCommunication(providerOutStream, getIFrameOrigin())

  return torus
}

export default onloadTorus
