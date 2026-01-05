# Storybook Documentation

## 📚 Documentation Files

### 1. [storybook-workflow.md](./storybook-workflow.md) - **START HERE**

**For Designers & Developers working together**

Complete workflow guide covering:

- 🎨 **Designer Workflow**: How to create components visually in Storybook
- 👨‍💻 **Developer Workflow**: How to implement Storybook components in the app
- 🔄 **Collaboration Patterns**: Best practices for design-to-development handoff
- 📋 **Quick Reference**: Common patterns and examples

**When to use**: First time using Storybook, or need to understand the full workflow.

### 2. [storybook-guide.md](./storybook-guide.md) - **TECHNICAL REFERENCE**

**For Developers needing detailed API docs**

Technical reference covering:

- 📖 Manual story creation patterns
- 🤖 Programmatic story generation
- 🎛️ Args, controls, and decorators
- 🔧 Configuration details
- 🐛 Troubleshooting

**When to use**: Need specific technical details or API reference.

---

## 🚀 Quick Start

### Run Storybook

```bash
pnpm storybook
```

Access at: <http://localhost:6006>

### Generate a Story

```bash
# Basic component
npx tsx scripts/generate-story.ts ./app/components/ui/Button.tsx

# Component with React Router
npx tsx scripts/generate-story.ts ./app/features/interviews/pages/detail.tsx --router
```

---

## 🎯 Common Tasks

### I want to...

**...create a new component visually**

→ See [Designer Workflow](./storybook-workflow.md#-for-designers-creating-components-in-storybook)

**...implement a Storybook component in my app**

→ See [Developer Workflow](./storybook-workflow.md#-for-developers-implementing-storybook-components)

**...understand story file structure**

→ See [Creating Stories Manually](./storybook-guide.md#creating-stories-manually)

**...batch generate multiple stories**

→ Use `scripts/generate-stories.ts` (see [Programmatic Generation](./storybook-guide.md#programmatic-story-generation))

**...add interactive controls**

→ See [Args and Controls](./storybook-guide.md#4-args-and-controls)

**...work with React Router components**

→ See [Component with React Router](./storybook-guide.md#2-component-with-react-router-pagefea ture))

---

## 🛠️ Generator Scripts

### Single Component

```bash
npx tsx scripts/generate-story.ts <component-path> [options]
```

**Options:**

- `--title <string>` - Custom story title
- `--router` - Component uses React Router
- `--layout <type>` - Layout: centered, padded, fullscreen
- `--force` - Overwrite existing story

**Examples:**

```bash
# Basic component
npx tsx scripts/generate-story.ts ./app/components/ui/Button.tsx

# With custom title
npx tsx scripts/generate-story.ts ./app/components/ui/Button.tsx --title "Components/UI/Button"

# React Router component
npx tsx scripts/generate-story.ts ./app/features/interviews/pages/detail.tsx --router

# Full options
npx tsx scripts/generate-story.ts ./app/components/Card.tsx \
  --title "Components/Card" \
  --layout padded \
  --force
```

### Batch Generation

Edit `scripts/generate-stories.ts` to add components, then run:

```bash
npx tsx scripts/generate-stories.ts
```

---

## 📖 Tech Stack

- **Storybook**: 9.1.12
- **React**: 19.2.0
- **React Router**: v7
- **Tailwind CSS**: v4 (via CDN in Storybook)
- **Addon**: `storybook-addon-remix-react-router`

---

## 🔗 External Resources

- [Storybook Docs](https://storybook.js.org/docs)
- [React Router Addon](https://storybook.js.org/addons/storybook-addon-remix-react-router)
- [CSF 3.0 Format](https://storybook.js.org/docs/api/csf)

---

## 💡 Tips

- ✅ Start with the [workflow guide](./storybook-workflow.md) if you're new
- ✅ Use generator scripts to save time
- ✅ Create multiple story variants (Default, Loading, Error, Empty)
- ✅ Add interactive controls for key props
- ✅ Document usage in story descriptions
- ✅ Keep stories in sync with production components
