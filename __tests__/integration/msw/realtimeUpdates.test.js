/**
 * Real-time Updates Integration Tests
 * Tests WebSocket-like behavior, polling mechanisms, and state synchronization
 */

import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { server, resetHandlers } from './server'
import { http, HttpResponse } from 'msw'

// Mock EventSource for SSE testing
class MockEventSource {
  constructor(url) {
    this.url = url
    this.readyState = MockEventSource.CONNECTING
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    MockEventSource.instances.push(this)
    
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN
      if (this.onopen) this.onopen({ type: 'open' })
    }, 100)
  }

  close() {
    this.readyState = MockEventSource.CLOSED
    if (this.onclose) this.onclose({ type: 'close' })
  }

  sendMessage(data) {
    if (this.onmessage && this.readyState === MockEventSource.OPEN) {
      this.onmessage({ type: 'message', data })
    }
  }

  sendError(error) {
    if (this.onerror) {
      this.onerror({ type: 'error', error })
    }
  }

  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2
  static instances = []
  
  static reset() {
    MockEventSource.instances.forEach(instance => instance.close())
    MockEventSource.instances = []
  }
}

// Component with polling mechanism
const PollingComponent = ({ pollInterval = 1000 }) => {
  const [data, setData] = React.useState([])
  const [isPolling, setIsPolling] = React.useState(false)
  const pollTimeoutRef = React.useRef(null)

  const startPolling = React.useCallback(() => {
    setIsPolling(true)
    
    const poll = async () => {
      try {
        const response = await fetch('/api/funding-opportunities')
        const result = await response.json()
        setData(result.data || [])
        
        if (isPolling) {
          pollTimeoutRef.current = setTimeout(poll, pollInterval)
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }
    
    poll()
  }, [pollInterval, isPolling])

  const stopPolling = () => {
    setIsPolling(false)
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current)
    }
  }

  React.useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div>
      <button onClick={isPolling ? stopPolling : startPolling}>
        {isPolling ? 'Stop Polling' : 'Start Polling'}
      </button>
      <div>Items: {data.length}</div>
      <ul>
        {data.map(item => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
    </div>
  )
}

// Component with SSE (Server-Sent Events)
const SSEComponent = () => {
  const [messages, setMessages] = React.useState([])
  const [connected, setConnected] = React.useState(false)
  const eventSourceRef = React.useRef(null)

  const connect = () => {
    const eventSource = new MockEventSource('/api/updates/stream')
    
    eventSource.onopen = () => {
      setConnected(true)
    }
    
    eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data)
      setMessages(prev => [...prev, message])
    }
    
    eventSource.onerror = () => {
      setConnected(false)
    }
    
    eventSourceRef.current = eventSource
  }

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setConnected(false)
    }
  }

  React.useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return (
    <div>
      <button onClick={connected ? disconnect : connect}>
        {connected ? 'Disconnect' : 'Connect'}
      </button>
      <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>
      <div>Messages: {messages.length}</div>
      <ul>
        {messages.map((msg, idx) => (
          <li key={idx}>{msg.type}: {msg.data}</li>
        ))}
      </ul>
    </div>
  )
}

// Component with optimistic updates
const OptimisticUpdateComponent = () => {
  const [items, setItems] = React.useState([])
  const [pendingItems, setPendingItems] = React.useState([])

  const fetchItems = async () => {
    const response = await fetch('/api/funding-opportunities')
    const data = await response.json()
    setItems(data.data || [])
  }

  const addItemOptimistically = async (title) => {
    const tempId = `temp-${Date.now()}`
    const newItem = { id: tempId, title, pending: true }
    
    // Add optimistically
    setPendingItems(prev => [...prev, newItem])
    
    try {
      const response = await fetch('/api/funding-opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      
      if (!response.ok) throw new Error('Failed to create')
      
      const createdItem = await response.json()
      
      // Remove from pending and add to actual items
      setPendingItems(prev => prev.filter(item => item.id !== tempId))
      setItems(prev => [...prev, createdItem])
    } catch (error) {
      // Remove failed item from pending
      setPendingItems(prev => prev.filter(item => item.id !== tempId))
      throw error
    }
  }

  React.useEffect(() => {
    fetchItems()
  }, [])

  const allItems = [...items, ...pendingItems]

  return (
    <div>
      <button onClick={() => addItemOptimistically('New Item')}>
        Add Item
      </button>
      <div>Total: {allItems.length}</div>
      <ul>
        {allItems.map(item => (
          <li key={item.id} style={{ opacity: item.pending ? 0.5 : 1 }}>
            {item.title} {item.pending && '(pending)'}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Setup and teardown
beforeAll(() => {
  global.EventSource = MockEventSource
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  resetHandlers()
  MockEventSource.reset()
})

afterAll(() => {
  server.close()
  delete global.EventSource
})

describe('Real-time Updates Integration', () => {
  describe('Polling Mechanism', () => {
    it('should poll for updates at regular intervals', async () => {
      let callCount = 0
      server.use(
        http.get('/api/funding-opportunities', () => {
          callCount++
          return HttpResponse.json({
            data: Array.from({ length: callCount }, (_, i) => ({
              id: `item-${i}`,
              title: `Item ${i}`,
            })),
          })
        })
      )

      render(<PollingComponent pollInterval={500} />)

      // Start polling
      fireEvent.click(screen.getByText('Start Polling'))

      // Initial fetch
      await waitFor(() => {
        expect(screen.getByText('Items: 1')).toBeInTheDocument()
      })

      // Wait for second poll
      await waitFor(() => {
        expect(screen.getByText('Items: 2')).toBeInTheDocument()
      }, { timeout: 1500 })

      // Wait for third poll
      await waitFor(() => {
        expect(screen.getByText('Items: 3')).toBeInTheDocument()
      }, { timeout: 1500 })

      // Stop polling
      fireEvent.click(screen.getByText('Stop Polling'))

      const currentCount = callCount

      // Wait a bit and verify polling stopped
      await new Promise(resolve => setTimeout(resolve, 1000))
      expect(callCount).toBe(currentCount)
    })

    it('should handle polling errors gracefully', async () => {
      let shouldFail = true
      server.use(
        http.get('/api/funding-opportunities', () => {
          if (shouldFail) {
            shouldFail = false
            return HttpResponse.error()
          }
          return HttpResponse.json({
            data: [{ id: '1', title: 'Recovered' }],
          })
        })
      )

      render(<PollingComponent pollInterval={500} />)

      fireEvent.click(screen.getByText('Start Polling'))

      // First poll fails, second succeeds
      await waitFor(() => {
        expect(screen.getByText('Recovered')).toBeInTheDocument()
      }, { timeout: 1500 })
    })
  })

  describe('Server-Sent Events (SSE)', () => {
    it('should receive real-time updates via SSE', async () => {
      render(<SSEComponent />)

      // Connect to SSE
      fireEvent.click(screen.getByText('Connect'))

      await waitFor(() => {
        expect(screen.getByText('Status: Connected')).toBeInTheDocument()
      })

      // Simulate incoming messages
      const eventSource = MockEventSource.instances[0]
      
      act(() => {
        eventSource.sendMessage(JSON.stringify({
          type: 'opportunity_created',
          data: 'New opportunity available',
        }))
      })

      await waitFor(() => {
        expect(screen.getByText('opportunity_created: New opportunity available')).toBeInTheDocument()
      })

      act(() => {
        eventSource.sendMessage(JSON.stringify({
          type: 'opportunity_updated',
          data: 'Opportunity deadline extended',
        }))
      })

      await waitFor(() => {
        expect(screen.getByText('opportunity_updated: Opportunity deadline extended')).toBeInTheDocument()
      })

      expect(screen.getByText('Messages: 2')).toBeInTheDocument()

      // Disconnect
      fireEvent.click(screen.getByText('Disconnect'))

      await waitFor(() => {
        expect(screen.getByText('Status: Disconnected')).toBeInTheDocument()
      })
    })

    it('should handle SSE connection errors', async () => {
      render(<SSEComponent />)

      fireEvent.click(screen.getByText('Connect'))

      await waitFor(() => {
        expect(screen.getByText('Status: Connected')).toBeInTheDocument()
      })

      // Simulate connection error
      const eventSource = MockEventSource.instances[0]
      
      act(() => {
        eventSource.sendError(new Error('Connection lost'))
      })

      await waitFor(() => {
        expect(screen.getByText('Status: Disconnected')).toBeInTheDocument()
      })
    })
  })

  describe('Optimistic Updates', () => {
    it('should show optimistic updates immediately', async () => {
      server.use(
        http.get('/api/funding-opportunities', () => {
          return HttpResponse.json({ data: [] })
        }),
        http.post('/api/funding-opportunities', async ({ request }) => {
          const body = await request.json()
          await new Promise(resolve => setTimeout(resolve, 500)) // Simulate delay
          return HttpResponse.json({
            id: 'real-id',
            title: body.title,
          })
        })
      )

      render(<OptimisticUpdateComponent />)

      await waitFor(() => {
        expect(screen.getByText('Total: 0')).toBeInTheDocument()
      })

      // Add item optimistically
      fireEvent.click(screen.getByText('Add Item'))

      // Should show immediately with pending state
      expect(screen.getByText('Total: 1')).toBeInTheDocument()
      expect(screen.getByText('New Item (pending)')).toBeInTheDocument()

      // Wait for server confirmation
      await waitFor(() => {
        expect(screen.getByText('New Item')).toBeInTheDocument()
        expect(screen.queryByText('New Item (pending)')).not.toBeInTheDocument()
      })
    })

    it('should rollback optimistic updates on failure', async () => {
      server.use(
        http.get('/api/funding-opportunities', () => {
          return HttpResponse.json({ data: [] })
        }),
        http.post('/api/funding-opportunities', () => {
          return HttpResponse.json(
            { error: 'Creation failed' },
            { status: 400 }
          )
        })
      )

      render(<OptimisticUpdateComponent />)

      await waitFor(() => {
        expect(screen.getByText('Total: 0')).toBeInTheDocument()
      })

      // Try to add item
      fireEvent.click(screen.getByText('Add Item'))

      // Shows optimistically
      expect(screen.getByText('Total: 1')).toBeInTheDocument()

      // Should roll back after failure
      await waitFor(() => {
        expect(screen.getByText('Total: 0')).toBeInTheDocument()
      })
    })
  })

  describe('State Synchronization', () => {
    it('should sync state across multiple components', async () => {
      // Shared state store
      const StateContext = React.createContext()
      
      const StateProvider = ({ children }) => {
        const [state, setState] = React.useState({ opportunities: [] })
        
        const syncState = async () => {
          const response = await fetch('/api/funding-opportunities')
          const data = await response.json()
          setState({ opportunities: data.data || [] })
        }
        
        React.useEffect(() => {
          syncState()
          const interval = setInterval(syncState, 1000)
          return () => clearInterval(interval)
        }, [])
        
        return (
          <StateContext.Provider value={{ state, syncState }}>
            {children}
          </StateContext.Provider>
        )
      }
      
      const ComponentA = () => {
        const { state } = React.useContext(StateContext)
        return <div>Component A: {state.opportunities.length} items</div>
      }
      
      const ComponentB = () => {
        const { state, syncState } = React.useContext(StateContext)
        return (
          <div>
            <div>Component B: {state.opportunities.length} items</div>
            <button onClick={syncState}>Manual Sync</button>
          </div>
        )
      }

      let updateCount = 0
      server.use(
        http.get('/api/funding-opportunities', () => {
          updateCount++
          return HttpResponse.json({
            data: Array.from({ length: updateCount }, (_, i) => ({
              id: `item-${i}`,
              title: `Item ${i}`,
            })),
          })
        })
      )

      render(
        <StateProvider>
          <ComponentA />
          <ComponentB />
        </StateProvider>
      )

      // Initial state
      await waitFor(() => {
        expect(screen.getByText('Component A: 1 items')).toBeInTheDocument()
        expect(screen.getByText('Component B: 1 items')).toBeInTheDocument()
      })

      // Auto-sync after interval
      await waitFor(() => {
        expect(screen.getByText('Component A: 2 items')).toBeInTheDocument()
        expect(screen.getByText('Component B: 2 items')).toBeInTheDocument()
      }, { timeout: 2000 })

      // Manual sync
      fireEvent.click(screen.getByText('Manual Sync'))

      await waitFor(() => {
        expect(screen.getByText('Component A: 3 items')).toBeInTheDocument()
        expect(screen.getByText('Component B: 3 items')).toBeInTheDocument()
      })
    })
  })

  describe('WebSocket-like Updates', () => {
    it('should handle bidirectional communication', async () => {
      // Mock WebSocket
      class MockWebSocket {
        constructor(url) {
          this.url = url
          this.readyState = MockWebSocket.CONNECTING
          this.onopen = null
          this.onmessage = null
          this.onclose = null
          this.onerror = null
          
          setTimeout(() => {
            this.readyState = MockWebSocket.OPEN
            if (this.onopen) this.onopen()
          }, 100)
        }
        
        send(data) {
          // Echo back with modification
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage({
                data: JSON.stringify({
                  echo: JSON.parse(data),
                  timestamp: Date.now(),
                }),
              })
            }
          }, 50)
        }
        
        close() {
          this.readyState = MockWebSocket.CLOSED
          if (this.onclose) this.onclose()
        }
        
        static CONNECTING = 0
        static OPEN = 1
        static CLOSED = 2
      }
      
      global.WebSocket = MockWebSocket

      const WebSocketComponent = () => {
        const [messages, setMessages] = React.useState([])
        const [connected, setConnected] = React.useState(false)
        const wsRef = React.useRef(null)

        const connect = () => {
          const ws = new WebSocket('ws://localhost:3000/ws')
          
          ws.onopen = () => setConnected(true)
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data)
            setMessages(prev => [...prev, data])
          }
          ws.onclose = () => setConnected(false)
          
          wsRef.current = ws
        }

        const sendMessage = (text) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ message: text }))
          }
        }

        const disconnect = () => {
          wsRef.current?.close()
        }

        return (
          <div>
            {!connected ? (
              <button onClick={connect}>Connect WebSocket</button>
            ) : (
              <>
                <button onClick={() => sendMessage('Hello')}>Send Hello</button>
                <button onClick={disconnect}>Disconnect</button>
              </>
            )}
            <div>Messages: {messages.length}</div>
            {messages.map((msg, idx) => (
              <div key={idx}>
                Echo: {msg.echo?.message} at {msg.timestamp}
              </div>
            ))}
          </div>
        )
      }

      render(<WebSocketComponent />)

      fireEvent.click(screen.getByText('Connect WebSocket'))

      await waitFor(() => {
        expect(screen.getByText('Send Hello')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Send Hello'))

      await waitFor(() => {
        expect(screen.getByText(/Echo: Hello at/)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Disconnect'))

      await waitFor(() => {
        expect(screen.getByText('Connect WebSocket')).toBeInTheDocument()
      })

      delete global.WebSocket
    })
  })

  describe('Conflict Resolution', () => {
    it('should handle concurrent updates with conflict resolution', async () => {
      const ConflictResolutionComponent = () => {
        const [item, setItem] = React.useState(null)
        const [version, setVersion] = React.useState(0)
        const [conflict, setConflict] = React.useState(false)

        const fetchItem = async () => {
          const response = await fetch('/api/funding-opportunities/1')
          const data = await response.json()
          setItem(data)
          setVersion(data.version || 0)
        }

        const updateItem = async (updates) => {
          try {
            const response = await fetch('/api/funding-opportunities/1', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'If-Match': version.toString(),
              },
              body: JSON.stringify({ ...updates, version }),
            })

            if (response.status === 409) {
              setConflict(true)
              const serverData = await response.json()
              return { conflict: true, serverData }
            }

            const data = await response.json()
            setItem(data)
            setVersion(data.version || version + 1)
            setConflict(false)
            return { conflict: false, data }
          } catch (error) {
            console.error('Update failed:', error)
          }
        }

        const resolveConflict = async () => {
          await fetchItem()
          setConflict(false)
        }

        React.useEffect(() => {
          fetchItem()
        }, [])

        return (
          <div>
            {item && (
              <>
                <div>Title: {item.title}</div>
                <div>Version: {version}</div>
                <button onClick={() => updateItem({ title: 'Updated Title' })}>
                  Update
                </button>
              </>
            )}
            {conflict && (
              <div>
                <div role="alert">Conflict detected!</div>
                <button onClick={resolveConflict}>Resolve</button>
              </div>
            )}
          </div>
        )
      }

      let serverVersion = 1
      server.use(
        http.get('/api/funding-opportunities/1', () => {
          return HttpResponse.json({
            id: '1',
            title: 'Original Title',
            version: serverVersion,
          })
        }),
        http.put('/api/funding-opportunities/1', async ({ request }) => {
          const headers = request.headers
          const clientVersion = parseInt(headers.get('If-Match') || '0')
          
          if (clientVersion < serverVersion) {
            return HttpResponse.json(
              {
                error: 'Version conflict',
                currentVersion: serverVersion,
                title: 'Server Updated Title',
              },
              { status: 409 }
            )
          }
          
          serverVersion++
          const body = await request.json()
          return HttpResponse.json({
            ...body,
            version: serverVersion,
          })
        })
      )

      render(<ConflictResolutionComponent />)

      await waitFor(() => {
        expect(screen.getByText('Title: Original Title')).toBeInTheDocument()
      })

      // Simulate another client updating
      serverVersion = 2

      // Our update should conflict
      fireEvent.click(screen.getByText('Update'))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Conflict detected!')
      })

      // Resolve conflict
      fireEvent.click(screen.getByText('Resolve'))

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(screen.getByText('Version: 2')).toBeInTheDocument()
      })
    })
  })
})