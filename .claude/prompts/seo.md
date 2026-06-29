# myapp — add SEO

Drop-in prompt. Replace `myapp` + the example URLs with yours, then paste
into a fresh Claude Code session at the repo root.

---

Add SEO to this app. Goal: every route has a correct title, description,
social-share preview, and canonical URL; search engines can crawl and
index the public surface; the home page exposes structured data.

GitHub issue FIRST ("Add SEO: meta/OG/sitemap/robots"), `Closes #NN` in
the commit. Follow `.claude/rules/tdd.md` for the component work.

## Scope

1. **Per-route head tags.** Use the dependency-free `<Seo>` component at
   `frontend/src/components/Seo.tsx` (already shipped). Mount it near the
   top of each page with that page's title/description/canonical/image:

   ```tsx
   import {Seo} from "../components/Seo";

   export default function Dashboard() {
     return (
       <>
         <Seo
           title="Dashboard - myapp"
           description="Your projects at a glance."
           canonical="https://myapp.example/dashboard"
           image="https://myapp.example/og/dashboard.png"
         />
         {/* ...page... */}
       </>
     );
   }
   ```

   If you prefer a library, `react-helmet-async` is the usual choice — but
   it is a new dependency; ask before adding it (see
   `coding-standards.md`). The shipped `<Seo>` needs none.

2. **Static defaults in `index.html`.** Set a sensible default `<title>`,
   `<meta name="description">`, `og:*`, `twitter:*`, and `theme-color` so a
   no-JS crawl and the very first paint are not empty. The per-route
   `<Seo>` overrides these at runtime.

3. **`robots.txt`** in `frontend/public/`: allow crawling, point at the
   sitemap. Disallow any private/admin routes.

   ```
   User-agent: *
   Allow: /
   Sitemap: https://myapp.example/sitemap.xml
   ```

4. **`sitemap.xml`.** For a small static route set, a hand-written
   `frontend/public/sitemap.xml` is fine. For a generated set, add a small
   build script (`scripts/generate_sitemap.*`) that enumerates public
   routes and writes the file; wire it into the frontend `build` script.
   Keep it deterministic (no timestamps that churn the diff).

5. **JSON-LD** on the home page via `<Seo jsonLd={...}>` — typically a
   `WebSite` or `Organization` object. Validate against schema.org.

## Constraints

- No hardcoded user-facing strings if the app is i18n'd — pull titles from
  the catalogs (see `docs/patterns/05-i18n-sync.md`).
- Absolute URLs for canonical/og:image (relative ones break previews).
- Do not index private/authenticated routes — pass `noindex` to `<Seo>`
  there and disallow them in `robots.txt`.
- Add a Vitest for any new title/meta logic; `Seo.tsx` already has one.

## Done when

- Each route renders a unique title + description + canonical.
- `robots.txt` + `sitemap.xml` are reachable in the built output.
- A social-share debugger (or a manual `view-source`) shows correct OG +
  Twitter tags on the home and one inner route.
- `make test` stays green.
