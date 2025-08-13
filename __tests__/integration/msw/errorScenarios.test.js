/**
 * Error Scenario Integration Tests
 * Tests how components handle various error conditions from API
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { server, resetHandlers } from './server'
import { errorHandlers } from './handlers'
import { http, HttpResponse, delay } from 'msw'

// Component with retry logic
const ResilientDataFetcher = ({ endpoint, retryCount = 3, retryDelay = 1000 }) => {
  const [data, setData] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [attempts, setAttempts] = React.useState(0)

  const fetchWithRetry = async (retriesLeft = retryCount) => {
    setLoading(true)
    setError(null)
    setAttempts(retryCount - retriesLeft + 1)

    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })
      
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          throw new Error(`Rate limited. Retry after ${retryAfter}s`)
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      if (retriesLeft > 0 && !err.message.includes('Rate limited')) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return fetchWithRetry(retriesLeft - 1)
      }
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button onClick={() => fetchWithRetry()}>Fetch Data</button>
      {loading && <div>Loading... (Attempt {attempts})</div>}
      {error && <div role="alert">Error: {error}</div>}
      {data && <div>Data loaded: {JSON.stringify(data)}</div>}
    </div>
  )
}

// Component with error boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert">
          <h2>Something went wrong</h2>
          <details>
            <summary>Error details</summary>
            {this.state.error?.toString()}
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Reset
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Setup and teardown
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  resetHandlers()
})

afterAll(() => {
  server.close()
})

describe('Error Scenario Handling', () => {
  describe('Network Errors', () => {
    it('should handle network failures gracefully', async () => {
      server.use(errorHandlers.networkError)

      render(<ResilientDataFetcher endpoint="/api/funding-opportunities" />)
      
      const fetchButton = screen.getByText('Fetch Data')
      fireEvent.click(fetchButton)

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Error:/)
      }, { timeout: 10000 })
    })

    it('should retry on network failures', async () => {
      let callCount = 0
      server.use(
        http.get('/api/test', () => {
          callCount++
          if (callCount < 3) {
            return HttpResponse.error()
          }
          return HttpResponse.json({ success: true })
        })
      )

      render(<ResilientDataFetcher endpoint="/api/test" retryDelay={100} />)
      
      const fetchButton = screen.getByText('Fetch Data')
      fireEvent.click(fetchButton)

      // Should show multiple attempts
      await waitFor(() => {
        expect(screen.getByText(/Attempt 2/)).toBeInTheDocument()
      })

      // Eventually succeeds
      await waitFor(() => {
        expect(screen.getByText(/Data loaded/)).toBeInTheDocument()
      })

      expect(callCount).toBe(3)
    })
  })

  describe('Server Errors', () => {
    it('should handle 500 Internal Server Error', async () => {
      server.use(errorHandlers.serverError)

      render(<ResilientDataFetcher endpoint="/api/funding-opportunities" />)
      
      const fetchButton = screen.getByText('Fetch Data')
      fireEvent.click(fetchButton)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent('Error: HTTP 500')
      }, { timeout: 10000 })
    })

    it('should handle 503 Service Unavailable', async () => {
      server.use(errorHandlers.serviceUnavailable)

      render(<ResilientDataFetcher endpoint="/api/funding-opportunities" />)
      
      const fetchButton = screen.getByText('Fetch Data')
      fireEvent.click(fetchButton)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent('Error: HTTP 503')
      }, { timeout: 10000 })
    })
  })

  describe('Authentication Errors', () => {
    it('should handle 401 Unauthorized', async () => {
      server.use(errorHandlers.unauthorized)

      const AuthComponent = () => {
        const [user, setUser] = React.useState(null)
        const [error, setError] = React.useState(null)

        const fetchProfile = async () => {
          try {
            const res = await fetch('/api/auth/me')
            if (res.status === 401) {
              throw new Error('Please log in')
            }
            const data = await res.json()
            setUser(data)
          } catch (err) {
            setError(err.message)
          }
        }

        return (
          <div>
            <button onClick={fetchProfile}>Get Profile</button>
            {error && <div role="alert">{error}</div>}
            {user && <div>User: {user.email}</div>}
          </div>
        )
      }

      render(<AuthComponent />)
      
      fireEvent.click(screen.getByText('Get Profile'))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Please log in')
      })
    })

    it('should handle 403 Forbidden', async () => {
      server.use(errorHandlers.forbidden)

      const AdminComponent = () => {
        const [error, setError] = React.useState(null)

        const performAdminAction = async () => {
          try {
            const res = await fetch('/api/admin/config', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key: 'value' }),
            })
            if (res.status === 403) {
              throw new Error('Access denied. Admin privileges required.')
            }
          } catch (err) {
            setError(err.message)
          }
        }

        return (
          <div>
            <button onClick={performAdminAction}>Admin Action</button>
            {error && <div role="alert">{error}</div>}
          </div>
        )
      }

      render(<AdminComponent />)
      
      fireEvent.click(screen.getByText('Admin Action'))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Access denied')
      })
    })
  })

  describe('Rate Limiting', () => {
    it('should handle 429 Too Many Requests', async () => {
      server.use(errorHandlers.rateLimited)

      render(<ResilientDataFetcher endpoint="/api/funding-opportunities" />)
      
      const fetchButton = screen.getByText('Fetch Data')
      fireEvent.click(fetchButton)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent('Rate limited')
        expect(alert).toHaveTextContent('Retry after 60s')
      })
    })

    it('should implement exponential backoff for rate limits', async () => {
      const BackoffComponent = () => {
        const [retryIn, setRetryIn] = React.useState(0)
        const [error, setError] = React.useState(null)

        const fetchWithBackoff = async (backoffMs = 1000) => {
          try {
            const res = await fetch('/api/test')
            if (res.status === 429) {
              const retryAfter = parseInt(res.headers.get('Retry-After') || '60')
              setRetryIn(retryAfter)
              setError(`Rate limited. Retrying in ${retryAfter}s`)
              
              // Schedule automatic retry
              setTimeout(() => {
                fetchWithBackoff(backoffMs * 2) // Exponential backoff
              }, retryAfter * 1000)
              
              return
            }
            setError(null)
            setRetryIn(0)
          } catch (err) {
            setError(err.message)
          }
        }

        return (
          <div>
            <button onClick={() => fetchWithBackoff()}>Fetch</button>
            {error && <div role="alert">{error}</div>}
            {retryIn > 0 && <div>Retry countdown: {retryIn}s</div>}
          </div>
        )
      }

      server.use(errorHandlers.rateLimited)

      render(<BackoffComponent />)
      
      fireEvent.click(screen.getByText('Fetch'))

      await waitFor(() => {
        expect(screen.getByText(/Retry countdown: 60s/)).toBeInTheDocument()
      })
    })
  })

  describe('Timeout Handling', () => {
    it('should handle request timeouts', async () => {
      server.use(
        http.get('/api/slow', async () => {
          await delay(10000) // 10 second delay
          return HttpResponse.json({ data: 'slow response' })
        })
      )

      const TimeoutComponent = () => {
        const [error, setError] = React.useState(null)
        const [loading, setLoading] = React.useState(false)

        const fetchWithTimeout = async () => {
          setLoading(true)
          setError(null)
          
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 2000) // 2 second timeout

          try {
            const res = await fetch('/api/slow', {
              signal: controller.signal,
            })
            const data = await res.json()
            clearTimeout(timeoutId)
          } catch (err) {
            if (err.name === 'AbortError') {
              setError('Request timeout after 2 seconds')
            } else {
              setError(err.message)
            }
          } finally {
            setLoading(false)
          }
        }

        return (
          <div>
            <button onClick={fetchWithTimeout}>Fetch Slow Data</button>
            {loading && <div>Loading...</div>}
            {error && <div role="alert">{error}</div>}
          </div>
        )
      }

      render(<TimeoutComponent />)
      
      fireEvent.click(screen.getByText('Fetch Slow Data'))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Request timeout after 2 seconds')
      }, { timeout: 3000 })
    })
  })

  describe('Error Recovery', () => {
    it('should recover from errors with user action', async () => {
      let shouldFail = true
      
      server.use(
        http.get('/api/recoverable', () => {
          if (shouldFail) {
            shouldFail = false
            return HttpResponse.json(
              { error: 'Temporary error' },
              { status: 500 }
            )
          }
          return HttpResponse.json({ data: 'Success!' })
        })
      )

      const RecoverableComponent = () => {
        const [data, setData] = React.useState(null)
        const [error, setError] = React.useState(null)

        const fetchData = async () => {
          setError(null)
          try {
            const res = await fetch('/api/recoverable')
            if (!res.ok) throw new Error('Failed to fetch')
            const result = await res.json()
            setData(result.data)
          } catch (err) {
            setError(err.message)
          }
        }

        return (
          <div>
            <button onClick={fetchData}>Fetch</button>
            {error && (
              <div>
                <div role="alert">{error}</div>
                <button onClick={fetchData}>Retry</button>
              </div>
            )}
            {data && <div>Success: {data}</div>}
          </div>
        )
      }

      render(<RecoverableComponent />)
      
      // First attempt fails
      fireEvent.click(screen.getByText('Fetch'))
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch')
      })

      // Retry succeeds
      fireEvent.click(screen.getByText('Retry'))
      
      await waitFor(() => {
        expect(screen.getByText('Success: Success!')).toBeInTheDocument()
      })
    })
  })

  describe('Error Boundaries', () => {
    it('should catch and display component errors', async () => {
      const BuggyComponent = () => {
        const [shouldCrash, setShouldCrash] = React.useState(false)

        if (shouldCrash) {
          throw new Error('Component crashed!')
        }

        return (
          <div>
            <button onClick={() => setShouldCrash(true)}>Trigger Error</button>
            <div>Component is working</div>
          </div>
        )
      }

      render(
        <ErrorBoundary>
          <BuggyComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Component is working')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Trigger Error'))

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      })

      // Can recover from error
      fireEvent.click(screen.getByText('Reset'))

      await waitFor(() => {
        expect(screen.getByText('Component is working')).toBeInTheDocument()
      })
    })
  })

  describe('Validation Errors', () => {
    it('should handle 400 Bad Request with validation errors', async () => {
      server.use(
        http.post('/api/funding-opportunities', () => {
          return HttpResponse.json(
            {
              error: 'Validation failed',
              details: {
                title: 'Title is required',
                amount: 'Amount must be positive',
              },
            },
            { status: 400 }
          )
        })
      )

      const FormComponent = () => {
        const [errors, setErrors] = React.useState({})

        const handleSubmit = async () => {
          try {
            const res = await fetch('/api/funding-opportunities', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            })
            
            if (!res.ok) {
              const data = await res.json()
              setErrors(data.details || { general: data.error })
            }
          } catch (err) {
            setErrors({ general: err.message })
          }
        }

        return (
          <div>
            <button onClick={handleSubmit}>Submit</button>
            {errors.title && <div role="alert">{errors.title}</div>}
            {errors.amount && <div role="alert">{errors.amount}</div>}
            {errors.general && <div role="alert">{errors.general}</div>}
          </div>
        )
      }

      render(<FormComponent />)
      
      fireEvent.click(screen.getByText('Submit'))

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument()
        expect(screen.getByText('Amount must be positive')).toBeInTheDocument()
      })
    })
  })
})