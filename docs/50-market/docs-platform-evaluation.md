# Documentation Platform Evaluation for UpSight

**Date:** 2026-03-20
**Status:** Research / Recommendation
**Author:** Engineering

---

## Context

UpSight needs a developer documentation platform to support public-facing docs (API reference, integration guides, agent/MCP documentation) as it moves toward GA. The platform should align with UpSight's AI-native positioning and serve both human developers and AI agents consuming our APIs.

---

## Platform Comparison

| Criteria | **Mintlify** | **Docusaurus** | **GitBook** | **ReadMe** | **Fern** |
|---|---|---|---|---|---|
| **Monthly cost** | $300 (Pro) / $600+ (Enterprise) | Free (self-hosted) | $65+ | $99+ (Startup) | $400+ (Docs only) |
| **Setup effort** | Low (managed) | High (DIY) | Low (managed) | Low (managed) | Medium |
| **AI assistant built-in** | Yes (core feature) | No | Yes (Premium+) | Yes (Ask AI) | Yes |
| **MCP server auto-generation** | Yes (hosted at /mcp) | No | No | No | No |
| **Git-based workflow** | Yes (MDX in repo) | Yes (MDX in repo) | Yes (bi-directional sync) | Partial (Refactored product) | Yes (MDX) |
| **Custom domain** | Yes (all tiers) | Yes (self-managed) | Yes | Yes | Yes |
| **SSO / RBAC** | Enterprise only | DIY | Enterprise only | Business+ | Enterprise |
| **API playground** | Yes | No (plugin needed) | No | Yes | Yes |
| **OpenAPI spec support** | Yes | Plugin needed | Basic | Yes | Yes (core) |
| **Non-technical editor** | No (MDX only) | No | Yes (Notion-like) | Yes (WYSIWYG) | No |
| **Analytics** | Built-in | DIY (Plausible, etc.) | Built-in | Built-in (API usage too) | Built-in |
| **SOC 2 / compliance** | Yes (Enterprise) | N/A (self-hosted) | Enterprise | Enterprise | Enterprise |
| **Notable users** | Anthropic, Cursor, Perplexity, Coinbase, Vercel | Supabase, React Native, Figma | 150k+ orgs | Stripe (former), many APIs | Postman (acquirer), Square |

---

## MCP Support: The Differentiator

Mintlify is the only platform that **automatically generates and hosts an MCP server** from your documentation (available at `docs.yourdomain.com/mcp`). This means:

- AI coding assistants (Claude, Cursor, Windsurf, ChatGPT) can query UpSight docs in real time during code generation
- No separate MCP server build/deploy needed
- Authentication-aware: respects user permissions/groups
- Competitive advantage: if UpSight has an MCP-accessible docs site and competitors do not, our API surface is more discoverable inside every AI-powered IDE

Given that UpSight is building an AI-native platform with Mastra agents and BAML prompts, having docs that are themselves AI-queryable is strategically aligned.

---

## Recommendation: Mintlify Pro

### Why Mintlify

1. **AI-native by default.** MCP server generation, AI search, and the Autopilot agent that drafts doc updates when code changes ship. This matches UpSight's positioning as an AI-native platform.

2. **Peer credibility.** Anthropic, Cursor, Perplexity, and Vercel use Mintlify. Being on the same platform as our AI infrastructure peers signals seriousness to developer adopters.

3. **Low maintenance.** Managed hosting, automatic TLS, built-in analytics. The engineering team writes MDX in the repo and pushes; Mintlify handles the rest. No devops overhead vs. Docusaurus.

4. **API playground + OpenAPI.** UpSight's API surface (conversation ingestion, evidence retrieval, agent endpoints) gets interactive documentation out of the box from our OpenAPI spec.

5. **Upgrade path.** Start on Pro ($300/mo), move to Enterprise ($600+/mo) when we need SSO, white-labeling, and SOC 2 compliance for enterprise customers.

### Why Not the Others

- **Docusaurus**: Free but requires ongoing engineering maintenance for hosting, search, AI features, and MCP. The hidden cost in eng time exceeds Mintlify's price within the first month.
- **GitBook**: Better for mixed technical/non-technical teams and internal docs. Weaker AI-agent story, no MCP generation. Good for internal knowledge base but not for developer-facing API docs.
- **ReadMe**: Strong API hub features but no MCP support, more expensive at scale ($399/mo Business tier), and less aligned with the AI-native ecosystem.
- **Fern**: Excellent if we needed multi-language SDK generation. At $400/mo for docs alone (without SDKs), it is more expensive than Mintlify with fewer AI features. Now owned by Postman, which introduces platform risk.

---

## Estimated Cost

| Phase | Plan | Monthly | Annual |
|---|---|---|---|
| **Now (pre-GA)** | Pro (5 editors) | $300 | $3,600 |
| **Post-GA (10 editors)** | Pro + 5 extra seats | $400 | $4,800 |
| **Enterprise (SSO, white-label)** | Custom | ~$600-800 | ~$7,200-9,600 |
| **AI credit overages** | Variable | ~$30-100 | ~$360-1,200 |

**Year 1 estimate: $4,000-6,000.** Significantly less than one month of an engineer maintaining a Docusaurus site.

---

## Proposed Docs Structure at docs.getupsight.com

```
/                           # Landing / overview
/quickstart                 # 5-min getting started
/concepts
  /evidence                 # Receipts / evidence model
  /lenses                   # Conversation lenses
  /themes                   # Themes & insights
  /people                   # People & personas
/guides
  /ingestion                # Uploading conversations
  /zoom-integration         # Zoom connector
  /api-keys                 # Authentication
  /webhooks                 # Event subscriptions
/api-reference              # Auto-generated from OpenAPI spec
  /conversations
  /evidence
  /people
  /lenses
  /themes
/agents
  /mcp-server               # How to connect UpSight's MCP server
  /mastra-integration       # Using UpSight with Mastra agents
  /baml-examples            # BAML prompt patterns
/sdks
  /typescript               # TypeScript SDK reference
  /python                   # Python SDK (future)
/changelog                  # Release notes
```

---

## The "Mintlify for Customer Intelligence" Analogy

UpSight's positioning as "the AI-native CRM / customer intelligence platform" mirrors Mintlify's own positioning as "the AI-native documentation platform." Both companies:

- Transform unstructured content (conversations / codebases) into structured, searchable knowledge
- Use AI agents to keep that knowledge current automatically
- Make their output queryable by both humans and AI systems
- Target technical teams who expect modern, developer-grade tooling

Using Mintlify for UpSight's own docs reinforces this parallel: our documentation experience should feel as AI-native as our product. When a developer asks Claude "how do I extract evidence from an UpSight conversation?", the answer should come directly from our MCP-enabled docs, not from a stale training set.

---

## Next Steps

1. Sign up for Mintlify Pro trial
2. Scaffold initial docs structure in a `docs/` directory at repo root (or separate repo)
3. Connect custom domain `docs.getupsight.com`
4. Import existing OpenAPI spec for API reference generation
5. Verify MCP server works with Claude and Cursor

---

## Sources

- [Mintlify Pricing](https://www.mintlify.com/pricing)
- [Mintlify MCP Server Generation](https://www.mintlify.com/blog/generate-mcp-servers-for-your-docs)
- [Mintlify Model Context Protocol Docs](https://www.mintlify.com/docs/ai/model-context-protocol)
- [Mintlify Custom Domain Setup](https://www.mintlify.com/docs/customize/custom-domain)
- [Mintlify Enterprise Features](https://www.mintlify.com/blog/mintlify-for-enterprise)
- [Mintlify Customers](https://www.mintlify.com/customers)
- [Mintlify Pricing Analysis (Featurebase)](https://www.featurebase.app/blog/mintlify-pricing)
- [Mintlify Review 2026 (Ferndesk)](https://ferndesk.com/blog/mintlify-review)
- [Best Developer Documentation Tools 2025 (Infrasity)](https://www.infrasity.com/blog/best-documentation-tools-for-developers)
- [Best API Documentation Tools 2026 (Ferndesk)](https://ferndesk.com/blog/best-api-documentation-tools)
- [Docs Vendor Comparison (Speakeasy)](https://www.speakeasy.com/blog/choosing-a-docs-vendor)
- [Fern Pricing](https://buildwithfern.com/pricing)
- [Documentation as AI Interface (Mintlify)](https://www.mintlify.com/blog/docs-as-ai-interface)
