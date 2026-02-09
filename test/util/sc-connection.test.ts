import axios from 'axios'
import {afterEach, beforeEach, describe, it} from 'mocha'
import sinon, {match} from 'sinon'

import {DefaultBaseUrl, EnvironmentVariable, envVars} from '../../src/config/env-vars.js'
import {ScConnection} from '../../src/util/sc-connection.js'
import {expect, sandbox} from '../setup.js'

// Force ts-node recompile

// Define type for the axios instance stub
interface AxiosInstanceStub {
  delete: sinon.SinonStub;
  get: sinon.SinonStub;
  interceptors: {
    response: {
      use: sinon.SinonStub;
    };
  };
  patch: sinon.SinonStub;
  post: sinon.SinonStub;
  put: sinon.SinonStub;
}

describe('ScConnection', () => {
  // Stubs and mocks
  let axiosCreateStub!: sinon.SinonStub
  let axiosInstanceStub!: AxiosInstanceStub
  let envVarsGetStringStub!: sinon.SinonStub
  let consoleErrorStub!: sinon.SinonStub

  beforeEach(() => {
    // Create a stub for axios.create
    axiosInstanceStub = {
      delete: sandbox.stub(),
      get: sandbox.stub(),
      interceptors: {
        response: {
          use: sandbox.stub(),
        },
      },
      patch: sandbox.stub(),
      post: sandbox.stub(),
      put: sandbox.stub(),
    } as unknown as AxiosInstanceStub
    
    // Use type assertion to satisfy TypeScript when stubbing axios.create
    // Note: We use a specific cast here instead of 'any' to maintain type safety
    axiosCreateStub = sandbox.stub(axios, 'create').returns(axiosInstanceStub as unknown as ReturnType<typeof axios.create>)

    // Stub the getString method on the actual envVars instance
    envVarsGetStringStub = sandbox.stub(envVars, 'getString')

    // Stub console.error to prevent test output pollution
    consoleErrorStub = sandbox.stub(console, 'error')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('constructor', () => {
    it('should create an instance with default parameters', () => {
      // Arrange
      envVarsGetStringStub.withArgs(EnvironmentVariable.SC_BASE_URL, DefaultBaseUrl).returns(DefaultBaseUrl)
      envVarsGetStringStub.withArgs(EnvironmentVariable.SC_ACCESS_TOKEN, '').returns('')
      envVarsGetStringStub.withArgs(EnvironmentVariable.SC_API_VERSION, 'v2').returns('v2')

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const connection = new ScConnection()

      // Assert
      expect(axiosCreateStub.calledOnce).to.be.true
      expect(axiosCreateStub.firstCall.args[0]).to.deep.include({
        baseURL: `${DefaultBaseUrl}/api/v2`,
        headers: {
          Authorization: 'Bearer ',
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      })
    })

    it('should create an instance with custom parameters', () => {
      // Arrange
      const customBaseUrl = 'https://custom-api.example.com'
      const customToken = 'custom-token'
      const customTimeout = 5000
      envVarsGetStringStub.withArgs(EnvironmentVariable.SC_API_VERSION, 'v2').returns('v2')

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const connection = new ScConnection(customBaseUrl, customToken, customTimeout)

      // Assert
      expect(axiosCreateStub.calledOnce).to.be.true
      expect(axiosCreateStub.firstCall.args[0]).to.deep.include({
        baseURL: `${customBaseUrl}/api/v2`,
        headers: {
          Authorization: `Bearer ${customToken}`,
          'Content-Type': 'application/json',
        },
        timeout: customTimeout,
      })
    })

    it('should use custom API version if provided in environment variables', () => {
      // Arrange
      const customApiVersion = 'v3'
      envVarsGetStringStub.withArgs(EnvironmentVariable.SC_BASE_URL, DefaultBaseUrl).returns(DefaultBaseUrl)
      envVarsGetStringStub.withArgs(EnvironmentVariable.SC_ACCESS_TOKEN, '').returns('')
      envVarsGetStringStub.withArgs(EnvironmentVariable.SC_API_VERSION, 'v2').returns(customApiVersion)

      // Act
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const connection = new ScConnection()

      // Assert
      expect(axiosCreateStub.firstCall.args[0].baseURL).to.equal(`${DefaultBaseUrl}/api/${customApiVersion}`)
    })

    it('should correctly join paths with and without trailing/leading slashes', () => {
      // Arrange
      const baseUrls = ['https://api.example.com', 'https://api.example.com/']
      envVarsGetStringStub.withArgs(EnvironmentVariable.SC_ACCESS_TOKEN, '').returns('')
      envVarsGetStringStub.withArgs(EnvironmentVariable.SC_API_VERSION, 'v2').returns('v2')

      for (const baseUrl of baseUrls) {
        // Reset previous stubs
        envVarsGetStringStub.reset()
        envVarsGetStringStub.withArgs(EnvironmentVariable.SC_ACCESS_TOKEN, '').returns('')
        envVarsGetStringStub.withArgs(EnvironmentVariable.SC_API_VERSION, 'v2').returns('v2')

        // Act
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const connection = new ScConnection(baseUrl)

        // Assert
        expect(
          axiosCreateStub.calledWith(
            match({
              baseURL: 'https://api.example.com/api/v2',
            }),
          )
        ).to.be.true

        axiosCreateStub.resetHistory()
      }
    })
  })

  describe('HTTP methods', () => {
    let connection!: ScConnection
    const testUrl = '/test'
    const testData = {key: 'value'}
    const testConfig = {headers: {'X-Test': 'test'}}
    const responseData = {result: 'success'}

    beforeEach(() => {
      envVarsGetStringStub.withArgs(EnvironmentVariable.SC_BASE_URL, DefaultBaseUrl).returns(DefaultBaseUrl)
      envVarsGetStringStub.withArgs(EnvironmentVariable.SC_ACCESS_TOKEN, '').returns('')
      envVarsGetStringStub.withArgs(EnvironmentVariable.SC_API_VERSION, 'v2').returns('v2')

      connection = new ScConnection()
    })

    it('should make a GET request and return response data', async () => {
      // Arrange
      axiosInstanceStub.get.resolves({data: responseData})

      // Act
      const result = await connection.get(testUrl, testConfig)

      // Assert
      expect(axiosInstanceStub.get.calledOnceWith(testUrl, testConfig)).to.be.true
      expect(result).to.deep.equal(responseData)
    })

    it('should make a POST request and return response data', async () => {
      // Arrange
      axiosInstanceStub.post.resolves({data: responseData})

      // Act
      const result = await connection.post(testUrl, testData, testConfig)

      // Assert
      expect(axiosInstanceStub.post.calledOnceWith(testUrl, testData, testConfig)).to.be.true
      expect(result).to.deep.equal(responseData)
    })

    it('should make a PUT request and return response data', async () => {
      // Arrange
      axiosInstanceStub.put.resolves({data: responseData})

      // Act
      const result = await connection.put(testUrl, testData, testConfig)

      // Assert
      expect(axiosInstanceStub.put.calledOnceWith(testUrl, testData, testConfig)).to.be.true
      expect(result).to.deep.equal(responseData)
    })

    it('should make a PATCH request and return response data', async () => {
      // Arrange
      axiosInstanceStub.patch.resolves({data: responseData})

      // Act
      const result = await connection.patch(testUrl, testData, testConfig)

      // Assert
      expect(axiosInstanceStub.patch.calledOnceWith(testUrl, testData, testConfig)).to.be.true
      expect(result).to.deep.equal(responseData)
    })

    it('should make a DELETE request and return response data', async () => {
      // Arrange
      axiosInstanceStub.delete.resolves({data: responseData})

      // Act
      const result = await connection.delete(testUrl, testConfig)

      // Assert
      expect(axiosInstanceStub.delete.calledOnceWith(testUrl, testConfig)).to.be.true
      expect(result).to.deep.equal(responseData)
    })

    it('should handle errors in the response interceptor', async () => {
      // Find the error handler from the interceptor setup
      const interceptorUse = axiosInstanceStub.interceptors.response.use
      expect(interceptorUse.called).to.be.true

      // Get the success and error handlers
      const [, errorHandler] = interceptorUse.firstCall.args

      // Simulate an error
      const error = new Error('Test error')
      const errorWithResponse = {
        ...error,
        response: {data: 'Response error data'},
      }

      // Act
      try {
        await errorHandler(errorWithResponse)
        // Should not reach here
        expect.fail('Expected error to be thrown')
      } catch {
        // Assert
        expect(consoleErrorStub.calledOnce).to.be.true
        expect(consoleErrorStub.firstCall.args[0]).to.equal('API Error:')
        expect(consoleErrorStub.firstCall.args[1]).to.equal('Response error data')
      }

      // Test with error without response data
      try {
        await errorHandler(error)
        // Should not reach here
        expect.fail('Expected error to be thrown')
      } catch {
        // Assert
        expect(consoleErrorStub.calledTwice).to.be.true
        expect(consoleErrorStub.secondCall.args[0]).to.equal('API Error:')
        expect(consoleErrorStub.secondCall.args[1]).to.equal('Test error')
      }
    })
  })
})
