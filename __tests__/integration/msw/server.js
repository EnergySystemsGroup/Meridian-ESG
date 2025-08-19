// MSW Server Setup for Integration Tests
const { setupServer } = require('msw/node')
const { http, HttpResponse } = require('msw')

const { handlers } = require('./handlers')

// Create the MSW server with all handlers
const server = setupServer(...handlers)

// Helper to reset handlers to defaults
const resetHandlers = () => {
  server.resetHandlers()
}

// Helper to add runtime request handlers
const addHandler = (handler) => {
  server.use(handler)
}

// Helper to replace all handlers
const replaceHandlers = (...newHandlers) => {
  server.resetHandlers(...newHandlers)
}

// Helper to simulate network errors
const simulateNetworkError = () => {
  server.use(
    http.all('*', () => {
      return HttpResponse.error()
    })
  )
}

// Helper to simulate server errors
const simulateServerError = (statusCode = 500, message = 'Internal Server Error') => {
  server.use(
    http.all('*', () => {
      return HttpResponse.json(
        { error: message },
        { status: statusCode }
      )
    })
  )
}

// Server lifecycle management for tests
const startServer = () => {
  server.listen({
    onUnhandledRequest: 'warn', // Warn about unhandled requests in tests
  })
}

const stopServer = () => {
  server.close()
}

// Export everything using CommonJS
module.exports = {
  server,
  resetHandlers,
  addHandler,
  replaceHandlers,
  simulateNetworkError,
  simulateServerError,
  startServer,
  stopServer
}