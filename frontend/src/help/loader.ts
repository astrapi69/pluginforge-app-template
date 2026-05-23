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

export async function loadNav(_locale: string): Promise<HelpNavItem[]> {
    return [];
}

export async function loadPage(_locale: string, _slug: string): Promise<HelpPage | null> {
    return null;
}

export async function searchPages(_locale: string, _query: string): Promise<HelpSearchResult[]> {
    return [];
}
