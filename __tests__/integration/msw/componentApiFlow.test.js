/**
 * Component-API Flow Integration Tests
 * Tests complete data flow from user interaction through API calls to component updates
 */

const React = require('react')
const { render, screen, waitFor, fireEvent } = require('@testing-library/react')
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query')
const { server, resetHandlers } = require('./server')
const { http, HttpResponse } = require('msw')

// Mock component that interacts with API
const FundingOpportunityList = () => {
  const [opportunities, setOpportunities] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  const fetchOpportunities = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/funding-opportunities')
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setOpportunities(data.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    fetchOpportunities()
  }, [])

  if (loading) return <div>Loading opportunities...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <button onClick={fetchOpportunities}>Refresh</button>
      <ul>
        {opportunities.map(opp => (
          <li key={opp.id}>{opp.title}</li>
        ))}
      </ul>
    </div>
  )
}

// Mock component for creating opportunities
const CreateOpportunityForm = () => {
  const [title, setTitle] = React.useState('')
  const [status, setStatus] = React.useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    
    try {
      const response = await fetch('/api/funding-opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      
      if (!response.ok) throw new Error('Failed to create')
      const data = await response.json()
      setStatus(`Created: ${data.id}`)
      setTitle('')
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Opportunity title"
      />
      <button type="submit">Create</button>
      {status && <div>{status}</div>}
    </form>
  )
}

// Server lifecycle is handled by jest.setup.js
// Just reset handlers between tests for this specific test file if needed
afterEach(() => {
  resetHandlers()
})

describe('Component-API Flow Integration', () => {
  describe('Data Fetching Flow', () => {
    it('should fetch and display funding opportunities', async () => {
      render(<FundingOpportunityList />)

      // Initially shows loading
      expect(screen.getByText('Loading opportunities...')).toBeInTheDocument()

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText('Loading opportunities...')).not.toBeInTheDocument()
      })

      // Check if opportunities are displayed
      const items = await screen.findAllByRole('listitem')
      expect(items).toHaveLength(10) // Default limit from mock handler
      expect(items[0]).toHaveTextContent('Clean Energy Innovation Grant')
    })

    it('should handle refresh action', async () => {
      render(<FundingOpportunityList />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText('Loading opportunities...')).not.toBeInTheDocument()
      })

      // Modify server response for refresh
      server.use(
        http.get('/api/funding-opportunities', () => {
          return HttpResponse.json({
            data: [
              {
                id: 'refreshed-1',
                title: 'Refreshed Grant Opportunity',
              },
            ],
          })
        })
      )

      // Click refresh button
      const refreshButton = screen.getByText('Refresh')
      fireEvent.click(refreshButton)

      // Wait for new data
      await waitFor(() => {
        expect(screen.getByText('Refreshed Grant Opportunity')).toBeInTheDocument()
      })
    })
  })

  describe('Data Creation Flow', () => {
    it('should create new opportunity and receive response', async () => {
      render(<CreateOpportunityForm />)

      const input = screen.getByPlaceholderText('Opportunity title')
      const submitButton = screen.getByText('Create')

      // Fill form and submit
      fireEvent.change(input, { target: { value: 'New Research Grant' } })
      fireEvent.click(submitButton)

      // Wait for submission to complete
      await waitFor(() => {
        expect(screen.getByText(/Created:/)).toBeInTheDocument()
      })

      // Verify input was cleared
      expect(input.value).toBe('')
    })

    it('should handle creation errors gracefully', async () => {
      server.use(
        http.post('/api/funding-opportunities', () => {
          return HttpResponse.json(
            { error: 'Validation failed' },
            { status: 400 }
          )
        })
      )

      render(<CreateOpportunityForm />)

      const input = screen.getByPlaceholderText('Opportunity title')
      const submitButton = screen.getByText('Create')

      fireEvent.change(input, { target: { value: 'Invalid Grant' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument()
      })
    })
  })

  describe('Complex User Workflow', () => {
    it('should handle complete CRUD workflow', async () => {
      const CompleteWorkflow = () => {
        const [opportunities, setOpportunities] = React.useState([])
        const [selectedId, setSelectedId] = React.useState(null)
        const [selectedOpp, setSelectedOpp] = React.useState(null)

        const fetchAll = async () => {
          const res = await fetch('/api/funding-opportunities')
          const data = await res.json()
          setOpportunities(data.data || [])
        }

        const fetchOne = async (id) => {
          const res = await fetch(`/api/funding-opportunities/${id}`)
          const data = await res.json()
          setSelectedOpp(data)
        }

        const updateOne = async (id, updates) => {
          const res = await fetch(`/api/funding-opportunities/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })
          const data = await res.json()
          setSelectedOpp(data)
          await fetchAll()
        }

        const deleteOne = async (id) => {
          await fetch(`/api/funding-opportunities/${id}`, {
            method: 'DELETE',
          })
          setSelectedOpp(null)
          await fetchAll()
        }

        React.useEffect(() => {
          fetchAll()
        }, [])

        return (
          <div>
            <div>
              <h2>List</h2>
              {opportunities.map(opp => (
                <div key={opp.id}>
                  <span>{opp.title}</span>
                  <button onClick={() => { setSelectedId(opp.id); fetchOne(opp.id) }}>
                    Select
                  </button>
                </div>
              ))}
            </div>
            {selectedOpp && (
              <div>
                <h2>Selected: {selectedOpp.title}</h2>
                <button onClick={() => updateOne(selectedOpp.id, { title: 'Updated Title' })}>
                  Update
                </button>
                <button onClick={() => deleteOne(selectedOpp.id)}>
                  Delete
                </button>
              </div>
            )}
          </div>
        )
      }

      render(<CompleteWorkflow />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Clean Energy Innovation Grant')).toBeInTheDocument()
      })

      // Select an opportunity
      const selectButtons = screen.getAllByText('Select')
      fireEvent.click(selectButtons[0])

      // Wait for selection
      await waitFor(() => {
        expect(screen.getByText(/Selected:/)).toBeInTheDocument()
      })

      // Update the opportunity
      const updateButton = screen.getByText('Update')
      fireEvent.click(updateButton)

      await waitFor(() => {
        expect(screen.getByText('Updated Title')).toBeInTheDocument()
      })

      // Delete the opportunity
      const deleteButton = screen.getByText('Delete')
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument()
      })
    })
  })

  describe('Pagination and Filtering', () => {
    it('should handle paginated data fetching', async () => {
      const PaginatedList = () => {
        const [page, setPage] = React.useState(1)
        const [data, setData] = React.useState({ data: [], totalPages: 0 })

        const fetchPage = async (pageNum) => {
          const res = await fetch(`/api/funding-opportunities?page=${pageNum}&limit=5`)
          const result = await res.json()
          setData(result)
        }

        React.useEffect(() => {
          fetchPage(page)
        }, [page])

        return (
          <div>
            {data.data.map(item => (
              <div key={item.id}>{item.title}</div>
            ))}
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>Page {page} of {data.totalPages}</span>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={page >= data.totalPages}
            >
              Next
            </button>
          </div>
        )
      }

      render(<PaginatedList />)

      // Wait for first page
      await waitFor(() => {
        expect(screen.getByText(/Page 1 of/)).toBeInTheDocument()
      })

      // Go to next page
      const nextButton = screen.getByText('Next')
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText(/Page 2 of/)).toBeInTheDocument()
      })

      // Verify different data on page 2
      expect(screen.getByText(/Clean Energy Innovation Grant 2-/)).toBeInTheDocument()
    })
  })

  describe('Authentication Flow', () => {
    it('should handle login and authenticated requests', async () => {
      const AuthenticatedApp = () => {
        const [user, setUser] = React.useState(null)
        const [error, setError] = React.useState(null)

        const login = async (email, password) => {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          
          if (res.ok) {
            const data = await res.json()
            setUser(data.user)
            localStorage.setItem('token', data.token)
          } else {
            setError('Login failed')
          }
        }

        const fetchProfile = async () => {
          const token = localStorage.getItem('token')
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` },
          })
          
          if (res.ok) {
            const data = await res.json()
            setUser(data.user)
          }
        }

        const logout = async () => {
          await fetch('/api/auth/logout', { method: 'POST' })
          localStorage.removeItem('token')
          setUser(null)
        }

        return (
          <div>
            {!user ? (
              <div>
                <button onClick={() => login('test@example.com', 'password123')}>
                  Login
                </button>
                {error && <div>{error}</div>}
              </div>
            ) : (
              <div>
                <div>Welcome {user.email}</div>
                <button onClick={fetchProfile}>Refresh Profile</button>
                <button onClick={logout}>Logout</button>
              </div>
            )}
          </div>
        )
      }

      render(<AuthenticatedApp />)

      // Click login
      const loginButton = screen.getByText('Login')
      fireEvent.click(loginButton)

      // Wait for login to complete
      await waitFor(() => {
        expect(screen.getByText('Welcome test@example.com')).toBeInTheDocument()
      })

      // Refresh profile
      const refreshButton = screen.getByText('Refresh Profile')
      fireEvent.click(refreshButton)

      // Logout
      const logoutButton = screen.getByText('Logout')
      fireEvent.click(logoutButton)

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument()
      })
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle multiple simultaneous API calls', async () => {
      const ConcurrentRequests = () => {
        const [loading, setLoading] = React.useState(true)
        const [data, setData] = React.useState({})

        React.useEffect(() => {
          const fetchAll = async () => {
            const [opps, sources, metrics] = await Promise.all([
              fetch('/api/funding-opportunities').then(r => r.json()),
              fetch('/api/funding-sources').then(r => r.json()),
              fetch('/api/metrics').then(r => r.json()),
            ])
            
            setData({ opps, sources, metrics })
            setLoading(false)
          }
          
          fetchAll()
        }, [])

        if (loading) return <div>Loading all data...</div>

        return (
          <div>
            <div>Opportunities: {data.opps.data?.length || 0}</div>
            <div>Sources: {data.sources.data?.length || 0}</div>
            <div>Total Funding: ${data.metrics.totalFunding || 0}</div>
          </div>
        )
      }

      render(<ConcurrentRequests />)

      expect(screen.getByText('Loading all data...')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText(/Opportunities:/)).toBeInTheDocument()
        expect(screen.getByText(/Sources:/)).toBeInTheDocument()
        expect(screen.getByText(/Total Funding:/)).toBeInTheDocument()
      })
    })
  })
})