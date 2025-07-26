import { describe, it, expect, beforeEach, vi } from 'vitest'
import { aggregateAutoInsightsData, formatDataForLLM } from './autoInsightsData.server'
import { getServerClient } from '~/lib/supabase/server'

// Mock Supabase client
vi.mock('~/lib/supabase/server')

const mockSupabase = {
  from: vi.fn(),
}

const mockGetServerClient = vi.mocked(getServerClient)

describe('Auto-Insights Data Aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerClient.mockReturnValue({ client: mockSupabase } as any)
  })

  describe('aggregateAutoInsightsData', () => {
    const mockRequest = new Request('http://localhost/test')
    const accountId = 'account-123'

    beforeEach(() => {
      // Setup default successful responses
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
      }

      mockSupabase.from.mockReturnValue(mockQuery)

      // Mock count queries
      mockQuery.select.mockImplementation((fields, options) => {
        if (options?.count === 'exact') {
          return Promise.resolve({ count: 54, error: null })
        }
        return mockQuery
      })

      // Mock data queries
      mockQuery.eq.mockResolvedValue({
        data: [],
        error: null,
      })
    })

    it('should aggregate comprehensive data for auto-insights', async () => {
      // Mock insights data
      const mockInsights = [
        {
          id: 'insight-1',
          name: 'Time Management Struggles',
          category: 'User Experience',
          pain: 'Users spend 2-3 hours daily on manual planning',
          desired_outcome: 'Automated planning that saves time',
          evidence: 'I waste so much time just figuring out what to do next',
          impact: 5,
          novelty: 3,
          jtbd: 'When I start my day, I want to know what to focus on',
          emotional_response: 'High',
          journey_stage: 'Planning',
          confidence: 'High',
        },
      ]

      const mockPersonas = [
        {
          id: 'persona-1',
          name: 'Busy Professional',
          description: 'Time-constrained professionals seeking efficiency',
          percentage: 60,
        },
      ]

      // Setup specific query responses
      mockSupabase.from.mockImplementation((table) => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
        }

        if (table === 'insights') {
          mockQuery.eq.mockResolvedValue({
            data: mockInsights,
            error: null,
          })
          mockQuery.select.mockImplementation((fields, options) => {
            if (options?.count === 'exact') {
              return Promise.resolve({ count: 54, error: null })
            }
            return mockQuery
          })
        } else if (table === 'personas') {
          mockQuery.eq.mockResolvedValue({
            data: mockPersonas,
            error: null,
          })
        } else {
          mockQuery.eq.mockResolvedValue({
            data: [],
            error: null,
          })
          mockQuery.select.mockImplementation((fields, options) => {
            if (options?.count === 'exact') {
              return Promise.resolve({ count: 0, error: null })
            }
            return mockQuery
          })
        }

        return mockQuery
      })

      const result = await aggregateAutoInsightsData(mockRequest, accountId)

      expect(result).toMatchObject({
        summary: {
          total_insights: 54,
          total_interviews: 0,
          total_people: 0,
          total_opportunities: 0,
          account_id: accountId,
        },
        insights: expect.arrayContaining([
          expect.objectContaining({
            id: 'insight-1',
            name: 'Time Management Struggles',
            category: 'User Experience',
            impact: 5,
            novelty: 3,
          }),
        ]),
        personas: expect.arrayContaining([
          expect.objectContaining({
            id: 'persona-1',
            name: 'Busy Professional',
            percentage: 60,
          }),
        ]),
      })
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' },
          }),
        }),
      })

      await expect(aggregateAutoInsightsData(mockRequest, accountId))
        .rejects.toThrow('Failed to fetch insights: Database connection failed')
    })

    it('should prioritize high-impact insights', async () => {
      const mockInsights = [
        { id: '1', name: 'Low Impact', impact: 2, novelty: 1 },
        { id: '2', name: 'High Impact', impact: 5, novelty: 4 },
        { id: '3', name: 'Medium Impact', impact: 3, novelty: 3 },
      ]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'insights') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: mockInsights,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      })

      const result = await aggregateAutoInsightsData(mockRequest, accountId)
      
      // Should include all insights but prioritize by impact/novelty
      expect(result.insights).toHaveLength(3)
      expect(result.insights[0].name).toBe('High Impact')
    })

    it('should limit results to fit LLM context window', async () => {
      // Create 100 mock insights
      const manyInsights = Array.from({ length: 100 }, (_, i) => ({
        id: `insight-${i}`,
        name: `Insight ${i}`,
        impact: Math.floor(Math.random() * 5) + 1,
        novelty: Math.floor(Math.random() * 5) + 1,
      }))

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'insights') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: manyInsights.slice(0, 50), // Should be limited to 50
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      })

      const result = await aggregateAutoInsightsData(mockRequest, accountId)
      
      // Should be limited to 50 insights for context window
      expect(result.insights.length).toBeLessThanOrEqual(50)
    })
  })

  describe('formatDataForLLM', () => {
    const mockData = {
      summary: {
        total_insights: 54,
        total_interviews: 15,
        total_people: 8,
        total_opportunities: 12,
        date_range: '2024-01-01 to 2024-03-31',
        account_id: 'account-123',
      },
      insights: [
        {
          id: 'insight-1',
          name: 'Time Management Struggles',
          category: 'User Experience',
          pain: 'Users spend 2-3 hours daily on manual planning',
          desired_outcome: 'Automated planning that saves time',
          evidence: 'I waste so much time just figuring out what to do next',
          impact: 5,
          novelty: 3,
          jtbd: 'When I start my day, I want to know what to focus on',
          emotional_response: 'High',
          journey_stage: 'Planning',
          confidence: 'High',
          tags: ['time_management', 'productivity'],
          personas: ['Busy Professional'],
        },
      ],
      personas: [
        {
          id: 'persona-1',
          name: 'Busy Professional',
          description: 'Time-constrained professionals seeking efficiency',
          percentage: 60,
          insight_count: 25,
          top_pain_points: ['Time management', 'Context switching', 'Overwhelm'],
          top_desired_outcomes: ['Efficiency', 'Focus', 'Work-life balance'],
        },
      ],
      opportunities: [
        {
          id: 'opp-1',
          title: 'AI Planning Assistant',
          kanban_status: 'Explore',
          insight_count: 5,
          supporting_insights: ['Time Management Struggles'],
        },
      ],
      tags: [
        {
          tag: 'time_management',
          insight_count: 15,
          interview_count: 8,
          categories: ['User Experience', 'Product'],
        },
      ],
      interviews: [
        {
          id: 'interview-1',
          title: 'User Research Session #1',
          segment: 'Professional',
          high_impact_themes: ['Time management', 'Productivity'],
          interview_date: '2024-01-15',
          insight_count: 8,
        },
      ],
    }

    it('should format data into structured LLM prompt', () => {
      const formatted = formatDataForLLM(mockData)

      expect(formatted).toContain('# User Research Data Summary')
      expect(formatted).toContain('**Total Insights**: 54')
      expect(formatted).toContain('**Total Interviews**: 15')
      expect(formatted).toContain('Time Management Struggles')
      expect(formatted).toContain('Busy Professional (60% of users)')
      expect(formatted).toContain('AI Planning Assistant')
      expect(formatted).toContain('time_management: 15 insights')
    })

    it('should handle empty data gracefully', () => {
      const emptyData = {
        summary: {
          total_insights: 0,
          total_interviews: 0,
          total_people: 0,
          total_opportunities: 0,
          date_range: 'N/A to N/A',
          account_id: 'account-123',
        },
        insights: [],
        personas: [],
        opportunities: [],
        tags: [],
        interviews: [],
      }

      const formatted = formatDataForLLM(emptyData)

      expect(formatted).toContain('**Total Insights**: 0')
      expect(formatted).toContain('**Total Interviews**: 0')
      expect(formatted).not.toContain('undefined')
      expect(formatted).not.toContain('null')
    })

    it('should limit insights to top 20 for context window', () => {
      const manyInsights = Array.from({ length: 50 }, (_, i) => ({
        id: `insight-${i}`,
        name: `Insight ${i}`,
        category: 'Test',
        pain: `Pain ${i}`,
        desired_outcome: `Outcome ${i}`,
        evidence: `Evidence ${i}`,
        impact: 5,
        novelty: 3,
        jtbd: `JTBD ${i}`,
        emotional_response: 'High',
        journey_stage: 'Planning',
        confidence: 'High',
        tags: [],
        personas: [],
      }))

      const dataWithManyInsights = {
        ...mockData,
        insights: manyInsights,
      }

      const formatted = formatDataForLLM(dataWithManyInsights)

      // Should only include top 20 insights
      const insightMatches = formatted.match(/### Insight \d+/g)
      expect(insightMatches?.length).toBeLessThanOrEqual(20)
    })

    it('should handle null/undefined values gracefully', () => {
      const dataWithNulls = {
        ...mockData,
        insights: [
          {
            id: 'insight-1',
            name: 'Test Insight',
            category: 'Test',
            pain: null,
            desired_outcome: undefined,
            evidence: null,
            impact: null,
            novelty: null,
            jtbd: null,
            emotional_response: null,
            journey_stage: null,
            confidence: null,
            tags: [],
            personas: [],
          },
        ],
      }

      const formatted = formatDataForLLM(dataWithNulls)

      expect(formatted).toContain('**Pain**: N/A')
      expect(formatted).toContain('**Desired Outcome**: N/A')
      expect(formatted).toContain('**Evidence**: N/A')
      expect(formatted).not.toContain('null')
      expect(formatted).not.toContain('undefined')
    })

    it('should provide executive-level summary format', () => {
      const formatted = formatDataForLLM(mockData)

      // Should include key sections for executive analysis
      expect(formatted).toContain('## Overview')
      expect(formatted).toContain('## Top Insights (by Impact & Novelty)')
      expect(formatted).toContain('## Personas & Segments')
      expect(formatted).toContain('## Current Opportunities Pipeline')
      expect(formatted).toContain('## Trending Tags & Themes')
      expect(formatted).toContain('## Recent Interview Themes')
    })

    it('should optimize for strategic decision making', () => {
      const formatted = formatDataForLLM(mockData)

      // Should emphasize business-relevant information
      expect(formatted).toContain('Impact**: 5/5')
      expect(formatted).toContain('Novelty**: 3/5')
      expect(formatted).toContain('60% of users')
      expect(formatted).toContain('Status: Explore')
      expect(formatted).toContain('Supporting Insights')
    })
  })

  describe('Data Quality Validation', () => {
    it('should validate minimum data requirements', async () => {
      const mockRequest = new Request('http://localhost/test')
      const accountId = 'account-123'

      // Mock insufficient data
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockImplementation((fields, options) => {
          if (options?.count === 'exact') {
            return Promise.resolve({ count: 2, error: null }) // Below minimum
          }
          return {
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }),
      })

      const result = await aggregateAutoInsightsData(mockRequest, accountId)
      
      expect(result.summary.total_insights).toBe(2)
      expect(result.summary.total_interviews).toBe(2)
      // Should still return data but with low counts
    })

    it('should ensure data consistency across entities', async () => {
      const mockRequest = new Request('http://localhost/test')
      const accountId = 'account-123'

      // Mock consistent data relationships
      const mockInsights = [
        { id: 'insight-1', name: 'Test', category: 'Test' },
      ]

      mockSupabase.from.mockImplementation((table) => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
        }

        if (table === 'insights') {
          mockQuery.eq.mockResolvedValue({
            data: mockInsights,
            error: null,
          })
        } else {
          mockQuery.eq.mockResolvedValue({
            data: [],
            error: null,
          })
        }

        mockQuery.select.mockImplementation((fields, options) => {
          if (options?.count === 'exact') {
            return Promise.resolve({ count: 1, error: null })
          }
          return mockQuery
        })

        return mockQuery
      })

      const result = await aggregateAutoInsightsData(mockRequest, accountId)
      
      expect(result.insights).toHaveLength(1)
      expect(result.insights[0].id).toBe('insight-1')
    })
  })
})
