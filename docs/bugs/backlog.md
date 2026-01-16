## Deferred: Goals UI

**What:** Break research goal into trackable tasks with subtasks
- Goals section showing research goal from /setup
- Ability to decompose into child tasks
- Progress tracking

**Why deferred:** Focus on smart suggestions first. Goals = Tasks pattern is useful but scope creep.

**When:** After smart suggestions is solid

---

## Deferred: Voice Response Recording Option

**What:** Allow survey respondents to record audio-only responses
- Add "Voice" option alongside current video recording
- Audio-only uploads (smaller files, easier for respondents)
- Transcription for searchability

**Why deferred:** Video recording works, voice is enhancement

**When:** When video adoption shows need for lighter-weight option

---

## Blocked: Mastra Upgrade to beta.23+

**What:** Upgrade @mastra/core and @mastra/ai-sdk beyond beta.17/beta.10

**Current versions (working):**
- @mastra/core: 1.0.0-beta.17
- @mastra/ai-sdk: 1.0.0-beta.10

**Issues found in beta.23:**
1. **requestContext not forwarded to tools** - Tools receive context but `context.requestContext.get()` returns undefined/empty for values set in the route. Agent instructions receive context fine, but tools don't.
   - Symptom: `created_by` null errors, "Missing userId in runtime context" errors
   - Workaround attempted: Pass userId/projectId through agent instructions as tool input params

2. **Stricter input validation** - Tools fail when LLM passes `null` for optional fields
   - Symptom: `themeSearch: Expected string, received null`
   - Fix needed: Change `.optional()` to `.nullish()` in all tool input schemas

**Before upgrading again, test:**
- [ ] createTask tool - verify created_by is populated
- [ ] fetchThemes tool - verify null inputs don't cause validation errors
- [ ] semanticSearchEvidence tool - verify project context works
- [ ] searchSurveyResponses tool - verify results return properly

**Monitor:** Check Mastra changelog for "requestContext forwarding" fixes before attempting upgrade

**When:** When Mastra v1 stabilizes or changelog indicates context forwarding is fixed

