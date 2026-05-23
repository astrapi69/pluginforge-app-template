export interface HelpNavItem {
    title: string;
    slug: string;
    icon?: string;
    children?: HelpNavItem[];
}

export interface HelpPage {
    slug: string;
    locale: string;
    content: string;
}

export interface HelpSearchResult {
    slug: string;
    title: string;
    snippet: string;
}

const markdownModules = import.meta.glob("./*/*.md", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

const metaModules = import.meta.glob("./*/_meta.ts", {
    eager: true,
}) as Record<string, {meta: HelpNavItem[]}>;

function markdownKey(locale: string, slug: string): string {
    return `./${locale}/${slug}.md`;
}

function metaKey(locale: string): string {
    return `./${locale}/_meta.ts`;
}

export async function loadNav(locale: string): Promise<HelpNavItem[]> {
    const mod = metaModules[metaKey(locale)];
    return mod?.meta ?? [];
}

export async function loadPage(locale: string, slug: string): Promise<HelpPage | null> {
    const content = markdownModules[markdownKey(locale, slug)];
    if (!content) return null;
    return {slug, locale, content};
}

export async function searchPages(locale: string, query: string): Promise<HelpSearchResult[]> {
    const lowerQuery = query.toLowerCase();
    const prefix = `./${locale}/`;
    const results: HelpSearchResult[] = [];
    for (const [path, content] of Object.entries(markdownModules)) {
        if (!path.startsWith(prefix)) continue;
        if (!content.toLowerCase().includes(lowerQuery)) continue;
        const slug = path.slice(prefix.length).replace(/\.md$/, "");
        const titleLine = content.split("\n").find((l) => l.startsWith("# "));
        const title = titleLine ? titleLine.replace(/^#\s*/, "").trim() : slug;
        const idx = content.toLowerCase().indexOf(lowerQuery);
        const start = Math.max(0, idx - 40);
        const end = Math.min(content.length, idx + 80);
        const snippet = content.slice(start, end).replace(/\s+/g, " ").trim();
        results.push({slug, title, snippet});
    }
    return results;
}
