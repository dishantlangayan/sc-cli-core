import * as chai from 'chai'
import { createSandbox } from 'sinon'

// Export the chai expect function and sinon for use in tests
export const {expect} = chai
export { createSandbox, mock, spy, stub } from 'sinon'
export const sandbox = createSandbox()

// Setup hook to restore sinon stubs/mocks after each test
export const mochaHooks = {
  afterEach() {
    sandbox.restore()
  },
}
