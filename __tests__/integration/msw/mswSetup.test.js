/**
 * MSW Setup Test
 * Tests that MSW is properly configured and can be imported
 */

describe('MSW Setup', () => {
  it('should be able to import MSW modules', () => {
    // Test direct import of MSW
    const msw = require('msw')
    expect(msw).toBeDefined()
    expect(msw.http).toBeDefined()
    expect(msw.HttpResponse).toBeDefined()
  })
  
  it('should be able to import MSW node server', () => {
    // Test importing setupServer from msw/node
    let setupServer
    try {
      const mswNode = require('msw/node')
      setupServer = mswNode.setupServer
    } catch (error) {
      console.error('Failed to import msw/node:', error.message)
      // Try alternative import path
      const path = require('path')
      const mswNodePath = path.join(__dirname, '../../../node_modules/msw/lib/node/index.js')
      const mswNode = require(mswNodePath)
      setupServer = mswNode.setupServer
    }
    
    expect(setupServer).toBeDefined()
    expect(typeof setupServer).toBe('function')
  })
  
  it('should be able to access our MSW server setup', () => {
    const { server, resetHandlers } = require('./server')
    expect(server).toBeDefined()
    expect(resetHandlers).toBeDefined()
    expect(typeof resetHandlers).toBe('function')
  })
  
  it('should be able to access our MSW handlers', () => {
    const { handlers, errorHandlers } = require('./handlers')
    expect(handlers).toBeDefined()
    expect(Array.isArray(handlers)).toBe(true)
    expect(handlers.length).toBeGreaterThan(0)
    expect(errorHandlers).toBeDefined()
  })
})