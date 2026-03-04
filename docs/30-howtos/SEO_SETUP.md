# SEO Setup Guide

## 📋 Overview

This document explains the SEO setup for Upsight, with a single dynamic source of truth for `sitemap.xml` and `robots.txt`.

---

## 🗺️ Sitemap Source of Truth

### Dynamic Sitemap: `app/routes/sitemap[.]xml.tsx`

**What it is:**
- A React Router route that generates sitemap.xml dynamically
- Runs server-side code to build the XML
- Can pull URLs from database, environment variables, or other sources

**When to use:**
- You need environment-specific URLs (dev vs. prod)
- You want to generate URLs from database content
- You need automatic lastmod date updates
- You have dynamic content (blog posts, products, etc.)

**How it works:**
```typescript
// The [.] in the filename creates a route at /sitemap.xml
// It returns XML instead of HTML
export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = new URL(request.url).origin // Auto-detects domain
  // ... generates XML dynamically
}
```

**Benefits:**
- ✅ Auto-updates `lastmod` dates
- ✅ Environment-aware (uses actual domain)
- ✅ Can pull URLs from database
- ✅ Easy to maintain (just edit the pages array)

---

## 🎯 Current SEO Strategy

### Priority Levels

**1.0 - Homepage**
- Main landing page
- Highest priority for search engines

**0.9 - Marketing Pages**
- `/customer-interviews` - Main SEO landing page
- High-value content targeting key search terms
- Weekly updates for freshness

**0.8 - Conversion Pages**
- `/sign-up` - Primary conversion goal
- Monthly updates

**0.7 - Auth Pages**
- `/login`, `/sign-up`
- Lower priority (not main traffic drivers)

### Change Frequency

- **Weekly**: Homepage, marketing pages (signals fresh content)
- **Monthly**: Auth pages, static pages

---

## 📄 Marketing Page: `/customer-interviews`

### SEO Optimization

**Target Keywords:**
- customer interview software
- user research software
- interview analysis
- AI transcription
- customer insights
- user feedback analysis
- product research
- UX research tools

**Meta Tags:**
```html
<title>Customer Interview Software | AI-Powered User Research Platform - Upsight</title>
<meta name="description" content="Transform customer interviews into actionable insights with AI..." />
<meta name="keywords" content="customer interviews, user research software..." />
```

**Content Structure:**
1. **Hero Section** - Clear value proposition with CTAs
2. **Problem Section** - Addresses pain points (3 key problems)
3. **Solution Section** - How it works (4-step process) + Features
4. **Benefits Section** - Quantified outcomes (10x faster, 95% accuracy)
5. **Use Cases** - Different scenarios (Product Discovery, UX Research, etc.)
6. **CTA Section** - Final conversion push

**SEO Best Practices Applied:**
- ✅ H1 tag with primary keyword
- ✅ Semantic HTML structure (h1, h2, h3)
- ✅ Rich, descriptive content (2000+ words)
- ✅ Internal links to conversion pages
- ✅ Clear value propositions
- ✅ Quantified benefits (builds trust)
- ✅ Multiple CTAs throughout page
- ✅ Mobile-responsive design

---

## 🏗️ Marketing Content & CMS Architecture

### Domain Strategy: Two Recommended Approaches

#### **Option 1: Unified Domain (RECOMMENDED) ⭐**

**Structure:**
```
getupsight.com/                    → Marketing homepage
getupsight.com/customer-interviews → Marketing pages
getupsight.com/blog/*              → Blog from Payload CMS
getupsight.com/case-studies/*      → Case studies from CMS
getupsight.com/login               → Auth pages
getupsight.com/a/:accountId/*      → Authenticated app
```

**Implementation:**
- Main app serves all routes
- Marketing pages are React Router routes
- CMS content loaded via loaders from Payload API
- Users stay on same domain throughout journey

**Pros:**
- ✅ **Best for SEO**: Single domain authority, no redirect friction
- ✅ **Seamless UX**: No domain switch, consistent branding
- ✅ **Simpler auth**: No cross-domain cookie issues
- ✅ **Better analytics**: Single tracking domain
- ✅ **Lower cost**: One hosting setup, one SSL cert
- ✅ **Easier sharing**: All content under one domain

**Cons:**
- ⚠️ Marketing and app share same bundle (can be code-split)
- ⚠️ Need to handle CMS API calls in app loaders

**SEO Impact:**
- 🎯 All backlinks strengthen single domain
- 🎯 Blog content directly boosts app domain authority
- 🎯 No link equity loss from redirects
- 🎯 Simpler sitemap management

---

#### **Option 2: Subdomain Split**

**Structure:**
```
getupsight.com/           → Marketing site (Payload CMS frontend)
getupsight.com/blog/*     → Blog from CMS
app.getupsight.com/       → Application (React Router app)
```

**Implementation:**
- Marketing site is separate Payload CMS frontend
- App is completely separate deployment
- Redirect users to app.getupsight.com after signup

**Pros:**
- ✅ Complete separation of concerns
- ✅ Marketing team has full CMS control
- ✅ Independent deployments
- ✅ Easier to scale separately

**Cons:**
- ⚠️ **SEO dilution**: Split domain authority between root and subdomain
- ⚠️ **Redirect friction**: Users notice domain change
- ⚠️ **Cross-domain tracking**: More complex analytics setup
- ⚠️ **Cookie complexity**: Auth across subdomains needs careful handling
- ⚠️ **Higher cost**: Two hosting setups, two SSL certs
- ⚠️ **Link equity loss**: Backlinks to blog don't help app ranking

**SEO Impact:**
- ⚠️ Google treats subdomains as separate sites
- ⚠️ Blog backlinks don't directly boost app.getupsight.com
- ⚠️ Need separate sitemaps for each subdomain
- ⚠️ More complex canonical URL management

---

### Recommended Approach: **Option 1 (Unified Domain)**

**Why it's better for SaaS:**

1. **SEO Compounding Effect**
   - Every blog post, case study, and marketing page strengthens getupsight.com
   - All backlinks contribute to single domain authority
   - Better ranking for competitive keywords

2. **User Journey Optimization**
   - Visitor reads blog → clicks CTA → signs up (same domain)
   - No jarring redirect to app.getupsight.com
   - Lower bounce rate, higher conversion

3. **Technical Simplicity**
   - Single SSL certificate
   - One analytics property
   - Simpler cookie management
   - Easier social sharing

4. **Cost Efficiency**
   - One hosting/CDN setup
   - Single domain renewal
   - Unified monitoring

---

### Implementation: CMS Content via Loaders

**Architecture Pattern:**

```typescript
// app/routes/blog._index.tsx
export async function loader() {
  const posts = await fetch('https://cms.getupsight.com/api/posts')
    .then(res => res.json())
  
  return { posts }
}

// app/routes/blog.$slug.tsx
export async function loader({ params }: LoaderFunctionArgs) {
  const post = await fetch(`https://cms.getupsight.com/api/posts/${params.slug}`)
    .then(res => res.json())
  
  return { post }
}
```

**Payload CMS Setup:**
```
cms.getupsight.com → Payload CMS admin (headless)
getupsight.com/blog → React Router routes fetching from CMS API
```

**Benefits:**
- ✅ CMS is headless (admin-only interface)
- ✅ Frontend fully controlled by your app
- ✅ Can customize rendering with your components
- ✅ SEO-friendly server-side rendering
- ✅ Full control over meta tags, structured data

---

### Dynamic Sitemap for CMS Content

**Update `sitemap[.]xml.tsx` to include CMS content:**

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const baseUrl = new URL(request.url).origin

  // Static pages
  const staticPages = [
    { path: "/", priority: 1.0, changefreq: "weekly" },
    { path: "/customer-interviews", priority: 0.9, changefreq: "weekly" },
    { path: "/sign-up", priority: 0.8, changefreq: "monthly" },
  ]

  // Fetch blog posts from Payload CMS
  const blogPosts = await fetch('https://cms.getupsight.com/api/posts')
    .then(res => res.json())
    .then(data => data.docs.map(post => ({
      path: `/blog/${post.slug}`,
      priority: 0.7,
      changefreq: "monthly",
      lastmod: post.updatedAt
    })))

  // Fetch case studies
  const caseStudies = await fetch('https://cms.getupsight.com/api/case-studies')
    .then(res => res.json())
    .then(data => data.docs.map(study => ({
      path: `/case-studies/${study.slug}`,
      priority: 0.8,
      changefreq: "monthly",
      lastmod: study.updatedAt
    })))

  const allPages = [...staticPages, ...blogPosts, ...caseStudies]

  // Generate XML...
}
```

**Benefits:**
- ✅ Sitemap auto-updates when CMS content changes
- ✅ Proper lastmod dates from CMS
- ✅ Search engines discover new content immediately
- ✅ No manual sitemap maintenance

---

### Content Strategy with Payload CMS

**Recommended Content Types:**

1. **Blog Posts** (`/blog/*`)
   - Priority: 0.7
   - Target long-tail keywords
   - Educational content
   - Link to product features

2. **Case Studies** (`/case-studies/*`)
   - Priority: 0.8
   - High conversion intent
   - Social proof
   - Target "[competitor] alternative" keywords

3. **Help Center** (`/help/*`)
   - Priority: 0.6
   - Support content
   - Reduces support tickets
   - Good for long-tail SEO

4. **Product Updates** (`/changelog/*`)
   - Priority: 0.5
   - Shows active development
   - Keeps users engaged
   - Good for brand searches

5. **Guides & Resources** (`/guides/*`)
   - Priority: 0.7
   - Comprehensive tutorials
   - High-value backlink targets
   - Establish thought leadership

---

### SEO Best Practices for CMS Content

**1. Server-Side Rendering (SSR)**
```typescript
// Ensure meta tags are rendered server-side
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: data.post.seo_title || data.post.title },
    { name: "description", content: data.post.seo_description },
    { property: "og:title", content: data.post.title },
    { property: "og:image", content: data.post.featured_image },
  ]
}
```

**2. Structured Data (JSON-LD)**
```typescript
// Add schema.org markup for blog posts
export default function BlogPost({ post }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "image": post.featured_image,
    "datePublished": post.publishedAt,
    "dateModified": post.updatedAt,
    "author": {
      "@type": "Person",
      "name": post.author.name
    }
  }

  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
      {/* Post content */}
    </>
  )
}
```

**3. Internal Linking**
- Link blog posts to relevant product pages
- Link case studies to signup page
- Create topic clusters (pillar + supporting posts)
- Use descriptive anchor text

**4. Image Optimization**
- Store images in Payload CMS
- Serve via CDN (Cloudflare, Cloudinary)
- Use responsive images with srcset
- Add descriptive alt text

**5. Performance**
- Cache CMS API responses (Redis, in-memory)
- Use stale-while-revalidate pattern
- Implement incremental static regeneration
- Lazy load images below fold

---

### Migration Path

**Phase 1: Setup (Week 1)**
- ✅ Deploy Payload CMS to cms.getupsight.com
- ✅ Create content models (posts, case studies, etc.)
- ✅ Set up API endpoints

**Phase 2: Integration (Week 2)**
- ✅ Create blog routes in React Router
- ✅ Implement loaders fetching from CMS
- ✅ Add meta tags and structured data
- ✅ Update sitemap to include CMS content

**Phase 3: Content Migration (Week 3)**
- ✅ Import existing content to Payload
- ✅ Set up redirects for old URLs
- ✅ Test all routes and SEO tags
- ✅ Submit updated sitemap to Google

**Phase 4: Optimization (Week 4)**
- ✅ Implement caching strategy
- ✅ Add internal linking
- ✅ Optimize images
- ✅ Monitor Core Web Vitals

---

### Example Routes Structure

```
app/routes/
├── _marketing.tsx              # Marketing layout (no auth)
│   ├── _index.tsx             # Homepage
│   ├── customer-interviews.tsx
│   ├── blog._index.tsx        # Blog listing
│   ├── blog.$slug.tsx         # Blog post detail
│   ├── case-studies._index.tsx
│   ├── case-studies.$slug.tsx
│   ├── guides._index.tsx
│   └── guides.$slug.tsx
├── _auth.tsx                   # Auth layout
│   ├── login.tsx
│   └── sign-up.tsx
└── _app.tsx                    # Protected app layout
    └── a.$accountId.$projectId.*
```

---

### Monitoring & Analytics

**Track These Metrics:**
- Organic traffic to blog vs. product pages
- Conversion rate: blog reader → signup
- Time on site for CMS content
- Internal link click-through rates
- Page speed for CMS-powered routes

**Tools:**
- Google Analytics 4 (single property)
- Google Search Console (one domain)
- Plausible/Fathom for privacy-friendly analytics
- Sentry for error tracking

---

## 🤖 Robots.txt

### Source of Truth: `app/routes/robots[.]txt.ts`

```txt
User-agent: *
Allow: /

# Disallow private/authenticated routes
Disallow: /a/
Disallow: /api/
Disallow: /auth/

# Allow public pages
Allow: /auth/login
Allow: /auth/register
Allow: /sign-up

# Sitemap location
Sitemap: https://getupsight.com/sitemap.xml
```

**Environment-aware:**
- **Development**: Blocks all crawlers (`Disallow: /`)
- **Production**: Allows crawlers with rules

**Benefits:**
- Prevents dev/staging sites from being indexed
- Auto-includes correct sitemap URL

---

## 🚀 Recommended Additional Marketing Pages

To drive more organic traffic, consider adding:

### High-Value SEO Pages

1. **`/user-research-tools`**
   - Target: "user research tools", "qualitative research software"
   - Priority: 0.9

2. **`/ai-interview-transcription`**
   - Target: "AI transcription", "interview transcription software"
   - Priority: 0.9

3. **`/product-discovery`**
   - Target: "product discovery", "customer discovery process"
   - Priority: 0.9

4. **`/ux-research-platform`**
   - Target: "UX research platform", "user experience research tools"
   - Priority: 0.9

5. **`/pricing`**
   - Essential for conversion
   - Priority: 0.8

6. **`/features`**
   - Detailed feature breakdown
   - Priority: 0.8

7. **`/blog`** (if you add content)
   - Regular content for SEO
   - Priority: 0.7

### Comparison Pages (High Intent)

8. **`/vs/dovetail`**
   - Target: "Dovetail alternative"
   - Priority: 0.8

9. **`/vs/userinterviews`**
   - Target: "User Interviews alternative"
   - Priority: 0.8

### Resource Pages

10. **`/guides/customer-interview-questions`**
    - Educational content
    - Priority: 0.7

11. **`/guides/user-research-best-practices`**
    - Thought leadership
    - Priority: 0.7

---

## 📊 SEO Checklist

### On-Page SEO
- ✅ Unique title tags for each page
- ✅ Meta descriptions (150-160 characters)
- ✅ H1 tags with primary keywords
- ✅ Semantic HTML structure (h2, h3, etc.)
- ✅ Internal linking strategy
- ✅ Image alt tags (when images added)
- ✅ Mobile-responsive design
- ✅ Fast page load times

### Technical SEO
- ✅ Sitemap.xml submitted to Google Search Console
- ✅ Robots.txt configured
- ✅ HTTPS enabled
- ✅ Canonical URLs
- ✅ Structured data (consider adding JSON-LD)
- ✅ XML sitemap auto-updates

### Content SEO
- ✅ 2000+ word content on key pages
- ✅ Keyword-rich headings
- ✅ Clear value propositions
- ✅ Quantified benefits
- ✅ Multiple CTAs
- ✅ Problem-solution-benefit structure

---

## 🔧 Maintenance

### Adding New Pages to Sitemap
1. Edit `app/lib/seo/public-sitemap.ts`.
2. Add a new static entry (or include it in CMS-driven routes).
3. Confirm the route is indexable (not in the intentional noindex list).
4. Sitemap auto-updates on the next request to `/sitemap.xml`.

### Submitting to Search Engines

**Google Search Console:**
1. Go to <https://search.google.com/search-console>
2. Add property: `https://getupsight.com`
3. Submit sitemap: `https://getupsight.com/sitemap.xml`

**Bing Webmaster Tools:**
1. Go to <https://www.bing.com/webmasters>
2. Add site
3. Submit sitemap

---

## 📈 Next Steps

1. **Add more marketing pages** (see recommendations above)
2. **Submit sitemap** to Google Search Console
3. **Set up analytics** (Google Analytics, Plausible, etc.)
4. **Monitor rankings** for target keywords
5. **Create blog content** for ongoing SEO
6. **Build backlinks** through partnerships, guest posts
7. **Add structured data** (JSON-LD for rich snippets)
8. **Optimize page speed** (already fast with React Router)

---

## 🎯 Target Keywords & Rankings

Track these keywords in Google Search Console:

**Primary Keywords:**
- customer interview software
- user research software
- AI interview transcription
- customer insights platform

**Secondary Keywords:**
- interview analysis tool
- UX research platform
- product discovery software
- qualitative research software

**Long-tail Keywords:**
- AI-powered customer interview analysis
- automated user research insights
- customer interview transcription software
- product team research tools

---

## 📚 Resources

- [Google Search Console](https://search.google.com/search-console)
- [Sitemap Protocol](https://www.sitemaps.org/protocol.html)
- [Robots.txt Specification](https://www.robotstxt.org/)
- [Google SEO Starter Guide](https://developers.google.com/search/docs/beginner/seo-starter-guide)
