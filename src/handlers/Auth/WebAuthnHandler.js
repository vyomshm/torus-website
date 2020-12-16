import log from 'loglevel'

import AbstractLoginHandler from './AbstractLoginHandler'

export default class WebAuthnHandler extends AbstractLoginHandler {
  constructor({ clientId, verifier, redirect_uri, typeOfLogin, preopenInstanceId, redirectToOpener = false }) {
    super({ clientId, verifier, redirect_uri, typeOfLogin, preopenInstanceId, redirectToOpener })
    this.setFinalUrl()
  }

  setFinalUrl() {
    const finalUrl = new URL('https://afternoon-caverns-12426.herokuapp.com')
    finalUrl.searchParams.append('redirect_uri', this.redirect_uri)
    finalUrl.searchParams.append('state', this.state)
    this.finalURL = finalUrl
  }

  async getUserInfo(parameters) {
    log.debug(parameters)
    const { idToken, extraParams, extraParamsPassed } = parameters
    if (!idToken) {
      throw new Error('no idtoken/signature found for WebAuthn getUserInfo')
    }
    let verifierId
    let signature
    let clientDataJSON
    let authenticatorData
    let publicKey
    let challenge
    let rpOrigin

    if (extraParamsPassed === 'true') {
      log.debug('extraParamsPassed is true, using extraParams passed through hashParams')
      ;({ verifier_id: verifierId, signature, clientDataJSON, authenticatorData, publicKey, challenge, rpOrigin } = JSON.parse(atob(extraParams)))
    } else {
      log.debug('extraParamsPassed is false, using extraParams passed through bridge server')
      ;({ verifier_id: verifierId, signature, clientDataJSON, authenticatorData, publicKey, challenge, rpOrigin } = JSON.parse(
        await fetch(`https://webauthn.lookup.dev.tor.us/fetch/${idToken}`).then((a) => a.text())
      ))
    }

    if (signature !== idToken) {
      throw new Error('idtoken should be equal to signature')
    }

    return {
      name: 'WebAuthn User',
      verifier: this.verifier,
      verifierId,
      typeOfLogin: this.typeOfLogin,
      extraParams: {
        signature,
        clientDataJSON,
        authenticatorData,
        publicKey,
        challenge,
        rpOrigin,
      },
    }
  }
}
