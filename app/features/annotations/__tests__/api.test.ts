import { createRemixStub } from '@remix-run/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { action as annotationsAction, loader as annotationsLoader } from '../api/annotations'
import { action as entityFlagsAction, loader as entityFlagsLoader } from '../api/entity-flags'
import { action as votesAction, loader as votesLoader } from '../api/votes'

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  })),
  rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
}

// Mock user context
const mockUserContext = {
  supabase: mockSupabase,
  account_id: '00000000-0000-0000-0000-000000000001',
  claims: { sub: '00000000-0000-0000-0000-000000000003' },
}

const mockContext = {
  get: vi.fn(() => mockUserContext),
}

describe('Annotations API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('/api/annotations', () => {
    it('should handle GET request for annotations', async () => {
      const request = new Request('http://localhost/api/annotations?entity_type=insight&entity_id=test-id')
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({
                  data: [
                    {
                      id: '1',
                      content: 'Test comment',
                      annotation_type: 'comment',
                      created_at: new Date().toISOString(),
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        })),
      })

      const response = await annotationsLoader({ request, context: mockContext, params: {} })
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.annotations).toBeDefined()
      expect(Array.isArray(data.annotations)).toBe(true)
    })

    it('should handle POST request to create annotation', async () => {
      const formData = new FormData()
      formData.append('entity_type', 'insight')
      formData.append('entity_id', 'test-id')
      formData.append('annotation_type', 'comment')
      formData.append('content', 'New comment')
      formData.append('project_id', 'project-id')

      const request = new Request('http://localhost/api/annotations', {
        method: 'POST',
        body: formData,
      })

      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: '1',
                content: 'New comment',
                annotation_type: 'comment',
                created_at: new Date().toISOString(),
              },
              error: null,
            })),
          })),
        })),
      })

      const response = await annotationsAction({ request, context: mockContext, params: {} })
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.annotation).toBeDefined()
      expect(data.annotation.content).toBe('New comment')
    })

    it('should handle validation errors', async () => {
      const formData = new FormData()
      // Missing required fields
      formData.append('entity_type', 'insight')

      const request = new Request('http://localhost/api/annotations', {
        method: 'POST',
        body: formData,
      })

      const response = await annotationsAction({ request, context: mockContext, params: {} })
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('/api/votes', () => {
    it('should handle GET request for vote counts', async () => {
      const request = new Request('http://localhost/api/votes?entity_type=insight&entity_id=test-id')
      
      mockSupabase.rpc.mockResolvedValue({
        data: { upvotes: 5, downvotes: 2 },
        error: null,
      })

      const response = await votesLoader({ request, context: mockContext, params: {} })
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.voteCounts).toBeDefined()
      expect(data.voteCounts.upvotes).toBe(5)
      expect(data.voteCounts.downvotes).toBe(2)
    })

    it('should handle POST request to upsert vote', async () => {
      const formData = new FormData()
      formData.append('entity_type', 'insight')
      formData.append('entity_id', 'test-id')
      formData.append('vote_value', '1')
      formData.append('project_id', 'project-id')

      const request = new Request('http://localhost/api/votes', {
        method: 'POST',
        body: formData,
      })

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: '1',
                vote_value: 1,
                created_at: new Date().toISOString(),
              },
              error: null,
            })),
          })),
        })),
      })

      const response = await votesAction({ request, context: mockContext, params: {} })
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.vote).toBeDefined()
      expect(data.vote.vote_value).toBe(1)
    })

    it('should handle vote removal', async () => {
      const formData = new FormData()
      formData.append('entity_type', 'insight')
      formData.append('entity_id', 'test-id')
      formData.append('_action', 'remove')

      const request = new Request('http://localhost/api/votes', {
        method: 'POST',
        body: formData,
      })

      mockSupabase.from.mockReturnValue({
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null })),
              })),
            })),
          })),
        })),
      })

      const response = await votesAction({ request, context: mockContext, params: {} })
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })

  describe('/api/entity-flags', () => {
    it('should handle GET request for user flags', async () => {
      const request = new Request('http://localhost/api/entity-flags?entity_type=insight&entity_id=test-id')
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({
                  data: [
                    {
                      id: '1',
                      flag_type: 'starred',
                      flag_value: true,
                      created_at: new Date().toISOString(),
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        })),
      })

      const response = await entityFlagsLoader({ request, context: mockContext, params: {} })
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.flags).toBeDefined()
      expect(Array.isArray(data.flags)).toBe(true)
    })

    it('should handle POST request to set flag', async () => {
      const formData = new FormData()
      formData.append('entity_type', 'insight')
      formData.append('entity_id', 'test-id')
      formData.append('flag_type', 'archived')
      formData.append('flag_value', 'true')
      formData.append('project_id', 'project-id')

      const request = new Request('http://localhost/api/entity-flags', {
        method: 'POST',
        body: formData,
      })

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: {
                id: '1',
                flag_type: 'archived',
                flag_value: true,
                created_at: new Date().toISOString(),
              },
              error: null,
            })),
          })),
        })),
      })

      const response = await entityFlagsAction({ request, context: mockContext, params: {} })
      
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.flag).toBeDefined()
      expect(data.flag.flag_type).toBe('archived')
      expect(data.flag.flag_value).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const request = new Request('http://localhost/api/annotations?entity_type=insight&entity_id=test-id')
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({
                  data: null,
                  error: { message: 'Database error' },
                })),
              })),
            })),
          })),
        })),
      })

      const response = await annotationsLoader({ request, context: mockContext, params: {} })
      
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should handle missing authentication', async () => {
      const request = new Request('http://localhost/api/annotations?entity_type=insight&entity_id=test-id')
      
      const mockContextNoAuth = {
        get: vi.fn(() => ({ supabase: mockSupabase, account_id: null, claims: null })),
      }

      const response = await annotationsLoader({ request, context: mockContextNoAuth, params: {} })
      
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })
})
