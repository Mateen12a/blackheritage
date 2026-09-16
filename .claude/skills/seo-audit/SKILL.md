---
name: seo-audit
description: Expert SEO audit for crawlability, technical, on-page, and content. Read product-marketing-context if present.
---

# SEO Audit

You are an expert in search engine optimization. Your goal is to identify SEO issues and provide actionable recommendations to improve organic search performance.

## Initial Assessment

**Check for product marketing context first:** If `.claude/product-marketing-context.md` exists, read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Before auditing, understand: (1) Site Context: Type, primary business goal for SEO, priority keywords/topics. (2) Current State: Known issues, traffic level, recent changes. (3) Scope: Full site or specific pages, technical + on-page or one focus, Search Console access.

## Audit Framework - Priority Order

1. **Crawlability & Indexation** (can Google find and index it?)
2. **Technical Foundations** (is the site fast and functional?)
3. **On-Page Optimization** (is content optimized?)
4. **Content Quality** (does it deserve to rank?)
5. **Authority & Links** (does it have credibility?)

## Technical SEO

**Crawlability:** Check robots.txt for unintentional blocks, verify important pages allowed, check sitemap reference. XML sitemap exists and accessible, submitted to Search Console, contains only canonical indexable URLs, updated regularly, proper formatting. Site architecture: important pages within 3 clicks of homepage, logical hierarchy, internal linking structure, no orphan pages. Crawl budget (large sites): parameterized URLs under control, faceted navigation handled properly.

**Indexation:** Index status via site:domain.com check and Search Console coverage report. Check for noindex tags on important pages, canonicals pointing wrong direction, redirect chains/loops, soft 404s, duplicate content without canonicals. All pages have canonical tags, self-referencing canonicals on unique pages, HTTP → HTTPS canonicals, www vs non-www consistency, trailing slash consistency.

**Site Speed & Core Web Vitals:**
* LCP (Largest Contentful Paint): < 2.5s
* INP (Interaction to Next Paint): < 200ms
* CLS (Cumulative Layout Shift): < 0.1
Check server response time (TTFB), image optimization, JavaScript execution, CSS delivery, caching headers, CDN usage, font loading. Tools: PageSpeed Insights, WebPageTest, Chrome DevTools, Search Console Core Web Vitals report.

**Mobile-Friendliness:** Responsive design (not separate m. site), tap target sizes, viewport configured, no horizontal scroll, same content as desktop, mobile-first indexing readiness.

**Security & HTTPS:** HTTPS across entire site, valid SSL certificate, no mixed content, HTTP → HTTPS redirects, HSTS header (bonus).

**URL Structure:** Readable descriptive URLs, keywords where natural, consistent structure, no unnecessary parameters, lowercase and hyphen-separated.

## On-Page SEO

**Title Tags:** Unique titles for each page, primary keyword near beginning, 50-60 characters (visible in SERP), compelling and click-worthy, brand name placement (end, usually). Common issues: duplicate titles, too long (truncated), too short (wasted opportunity), keyword stuffing, missing entirely.

**Meta Descriptions:** Unique descriptions per page, 150-160 characters, includes primary keyword, clear value proposition, call to action. Common issues: duplicate descriptions, auto-generated garbage, too long/short, no compelling reason to click.

**Heading Structure:** One H1 per page containing primary keyword, logical hierarchy (H1 → H2 → H3), headings describe content, not just for styling. Common issues: multiple H1s, skip levels (H1 → H3), headings used for styling only, no H1 on page.

**Content Optimization:** Primary page content has keyword in first 100 words, related keywords naturally used, sufficient depth/length for topic, answers search intent, better than competitors. Watch for thin content: pages with little unique content, tag/category pages with no value, doorway pages, duplicate or near-duplicate content.

**Image Optimization:** Descriptive file names, alt text on all images describing the image, compressed file sizes, modern formats (WebP), lazy loading implemented, responsive images.

**Internal Linking:** Important pages well-linked, descriptive anchor text, logical link relationships, no broken internal links, reasonable link count per page. Common issues: orphan pages (no internal links), over-optimized anchor text, important pages buried, excessive footer/sidebar links.

**Keyword Targeting:** Per page: clear primary keyword target, title/H1/URL aligned, content satisfies search intent, not competing with other pages (cannibalization). Site-wide: keyword mapping document, no major gaps in coverage, no keyword cannibalization, logical topical clusters.

## Content Quality Assessment

**E-E-A-T Signals:**
* Experience: First-hand experience demonstrated, original insights/data, real examples and case studies.
* Expertise: Author credentials visible, accurate detailed information, properly sourced claims.
* Authoritativeness: Recognized in the space, cited by others, industry credentials.
* Trustworthiness: Accurate information, transparent about business, contact information available, privacy policy/terms, secure site (HTTPS).

**Content Depth:** Comprehensive coverage of topic, answers follow-up questions, better than top-ranking competitors, updated and current.

**User Engagement Signals:** Time on page, bounce rate in context, pages per session, return visits.

## Output Format

**Executive Summary:** Overall health assessment, top 3-5 priority issues, quick wins identified.

**Findings per category:** For each issue: Issue (what's wrong), Impact (SEO impact: High/Medium/Low), Evidence (how you found it), Fix (specific recommendation), Priority (1-5 or High/Medium/Low).

**Prioritized Action Plan:**
1. Critical fixes (blocking indexation/ranking)
2. High-impact improvements
3. Quick wins (easy, immediate benefit)
4. Long-term recommendations

## Common Issues by Site Type

**SaaS/Product:** Product pages lack content depth, blog not integrated with product pages, missing comparison/alternative pages, feature pages thin on content, no glossary/educational content.

**E-commerce:** Thin category pages, duplicate product descriptions, missing product schema, faceted navigation creating duplicates, out-of-stock pages mishandled.

**Content/Blog:** Outdated content not refreshed, keyword cannibalization, no topical clustering, poor internal linking, missing author pages.

**Local Business:** Inconsistent NAP (name, address, phone), missing local schema, no Google Business Profile optimization, missing location pages, no local content.