# Follow-up Questions Fix

## Problem Summary
Follow-up questions were being added to the database but not showing in the UI, and users couldn't assign a category when adding them.

## Root Causes

### 1. Status Mismatch
- **Issue**: Follow-up questions were created with `status: "proposed"` 
- **Impact**: The UI filters questions by `status === "proposed"` in `questionPack`, which only shows AI-generated questions
- **Fix**: Changed to `status: "selected"` to match user-selected questions that should appear in the main list

### 2. No Category Selection
- **Issue**: Category was hardcoded to use parent question's category
- **Impact**: Users couldn't organize follow-ups into appropriate categories
- **Fix**: Added category selector dropdown with state management

### 3. No Database Reload
- **Issue**: After saving, UI didn't reload from database
- **Impact**: UI state could diverge from actual database state
- **Fix**: Added `await loadQuestions()` after database save

## Changes Implemented

### 1. Added Category State (Line 271)
```typescript
const [followupCategory, setFollowupCategory] = useState("context")
```

### 2. Changed Status to "selected" (Line 2453)
```typescript
status: "selected",  // Was: "proposed"
```

### 3. Use followupCategory Instead of Parent's Category (Lines 2450, 2458)
```typescript
categoryId: followupCategory,  // Was: question.categoryId
{ categoryId: followupCategory } as Question,  // Was: question.categoryId
```

### 4. Added Category Selector UI (Lines 2424-2435)
```typescript
<Select value={followupCategory} onValueChange={setFollowupCategory}>
  <SelectTrigger className="w-full">
    <SelectValue placeholder="Select category" />
  </SelectTrigger>
  <SelectContent>
    {questionCategories.map((cat) => (
      <SelectItem key={cat.id} value={cat.id}>
        {cat.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 5. Added Database Reload (Line 2498)
```typescript
await loadQuestions()  // Reload from DB to ensure UI reflects actual state
```

### 6. Initialize Category on Open (Line 2319)
```typescript
setFollowupCategory(question.categoryId)  // Initialize with parent's category
```

### 7. Reset Category on Close (Line 2408)
```typescript
setFollowupCategory(question.categoryId)  // Reset to parent's category
```

## Testing Checklist

- [ ] Follow-up questions appear in UI immediately after adding
- [ ] Category selector shows all available categories
- [ ] Selected category is saved to database correctly
- [ ] Questions maintain correct order after insertion
- [ ] Database reload doesn't cause UI flashing
- [ ] Category resets to parent's category when reopening form
- [ ] Delete functionality still works correctly (migration applied)

## Related Files
- `/app/components/questions/InterviewQuestionsManager.tsx` - Main component with fixes
- `/supabase/migrations/20251004152800_add_deleted_status_to_interview_prompts.sql` - Database constraint fix

## Architecture Notes

### Question Status Flow
- `"proposed"` - AI-generated questions in the suggestion pool
- `"selected"` - User-selected questions that appear in the main interview plan
- `"rejected"` - Questions user explicitly rejected
- `"deleted"` - Soft-deleted questions (kept for training data)
- `"backup"` - Reserve questions
- `"asked"` - Questions used in an interview
- `"answered"` - Questions with responses
- `"skipped"` - Questions not asked during interview

### Data Flow
1. User clicks "Add Followup" on a question
2. Form opens with textarea and category selector
3. User enters text and selects category
4. On submit:
   - Create Question object with `status: "selected"`
   - Insert into local state
   - Save to `interview_prompts` table
   - Reload from database to ensure consistency
   - Show success toast
5. Question appears in main list immediately

## Future Improvements
- Consider adding "parent question" relationship in database
- Add visual indicator for follow-up questions (e.g., indentation)
- Allow bulk category changes for multiple questions
- Add keyboard shortcuts (Enter to submit, Esc to cancel)
