import {describe, it} from 'mocha'
import sinon from 'sinon'

import {camelCaseToTitleCase, createStreamTable, printObjectAsKeyValueTable} from '../../src/ux/table.js'
import {expect, sandbox} from '../setup.js'

describe('Table Utilities', () => {
  describe('camelCaseToTitleCase', () => {
    it('should convert camelCase to Title Case', () => {
      expect(camelCaseToTitleCase('helloWorld')).to.equal('Hello World')
      expect(camelCaseToTitleCase('userName')).to.equal('User Name')
      expect(camelCaseToTitleCase('apiKey')).to.equal('Api Key')
    })

    it('should handle already capitalized text', () => {
      expect(camelCaseToTitleCase('HelloWorld')).to.equal('Hello World')
    })

    it('should handle single word', () => {
      expect(camelCaseToTitleCase('hello')).to.equal('Hello')
    })

    it('should trim extra spaces', () => {
      expect(camelCaseToTitleCase('hello  world')).to.equal('Hello World')
    })
  })

  describe('printObjectAsKeyValueTable', () => {
    it('should format object as key-value table', () => {
      const data = {
        age: 25,
        city: 'New York',
        name: 'Test',
      }

      const result = printObjectAsKeyValueTable(data)

      expect(result).to.be.a('string')
      expect(result).to.include('Key')
      expect(result).to.include('Value')
      expect(result).to.include('Name')
      expect(result).to.include('Test')
      expect(result).to.include('Age')
      expect(result).to.include('25')
      expect(result).to.include('City')
      expect(result).to.include('New York')
    })

    it('should handle empty object', () => {
      const data = {}
      const result = printObjectAsKeyValueTable(data)

      expect(result).to.be.a('string')
      expect(result).to.include('Key')
      expect(result).to.include('Value')
    })
  })

  describe('createStreamTable', () => {
    let stdoutWriteStub: sinon.SinonStub

    beforeEach(() => {
      stdoutWriteStub = sandbox.stub(process.stdout, 'write')
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('should create a stream table with specified column count', () => {
      const stream = createStreamTable(3)

      expect(stream).to.have.property('write')
      expect(stream.write).to.be.a('function')
    })

    it('should create a stream table with column configuration', () => {
      const columnConfig = {
        0: {width: 30, wrapWord: true},
        1: {width: 50, wrapWord: true},
      }

      const stream = createStreamTable(2, columnConfig)

      expect(stream).to.have.property('write')
      expect(stream.write).to.be.a('function')
    })

    it('should write rows to the stream', () => {
      const stream = createStreamTable(2)

      stream.write(['Name', 'Value'])
      stream.write(['Test', '123'])

      expect(stdoutWriteStub.called).to.be.true
      const output = stdoutWriteStub.getCalls().map(call => call.args[0]).join('')
      expect(output).to.include('Name')
      expect(output).to.include('Value')
      expect(output).to.include('Test')
      expect(output).to.include('123')
    })

    it('should handle multiple rows', () => {
      const stream = createStreamTable(3)

      stream.write(['Col1', 'Col2', 'Col3'])
      stream.write(['A', 'B', 'C'])
      stream.write(['D', 'E', 'F'])
      stream.write(['G', 'H', 'I'])

      expect(stdoutWriteStub.called).to.be.true
      const output = stdoutWriteStub.getCalls().map(call => call.args[0]).join('')

      // Check all values are in output
      expect(output).to.include('Col1')
      expect(output).to.include('Col2')
      expect(output).to.include('Col3')
      expect(output).to.include('A')
      expect(output).to.include('F')
      expect(output).to.include('I')
    })

    it('should apply custom column width configuration', () => {
      const columnConfig = {
        0: {width: 10},
        1: {width: 40},
      }

      const stream = createStreamTable(2, columnConfig)
      stream.write(['Short', 'This is a much longer value that should be within the configured width'])

      expect(stdoutWriteStub.called).to.be.true
    })

    it('should handle word wrapping when configured', () => {
      const columnConfig = {
        0: {width: 15, wrapWord: true},
      }

      const stream = createStreamTable(1, columnConfig)
      stream.write(['This is a very long text that should wrap'])

      expect(stdoutWriteStub.called).to.be.true
      const output = stdoutWriteStub.getCalls().map(call => call.args[0]).join('')
      // Check that the text is present (may be wrapped or truncated)
      expect(output).to.include('This is a very')
    })
  })
})
