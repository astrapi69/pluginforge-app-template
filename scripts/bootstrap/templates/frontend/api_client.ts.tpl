/**
 * ${pascal_name} API client.
 *
 * Wraps the FastAPI ``/api`` surface. The backend uses snake_case in
 * JSON; this module normalises to camelCase at the client boundary so
 * the rest of the frontend stays idiomatic TS.
 *
 * No external HTTP library: pure ``fetch``. ``ApiError`` lives here
 * too because it is the discriminated error type the rest of the UI
 * (notify.ts, toasts) checks via ``instanceof``.
 */

import type {
${type_import_list}
} from "../types/${name}";

const BASE = "/api";

export class ApiError extends Error {
    status: number;
    detail: string;
    endpoint: string;
    method: string;
    stacktrace: string;
    timestamp: string;
    detailBody?: Record<string, unknown>;

    constructor(
        status: number,
        detail: string,
        endpoint: string,
        method: string,
        stacktrace = "",
        detailBody?: Record<string, unknown>,
    ) {
        super(detail);
        this.name = "ApiError";
        this.status = status;
        this.detail = detail;
        this.endpoint = endpoint;
        this.method = method;
        this.stacktrace = stacktrace;
        this.timestamp = new Date().toISOString();
        this.detailBody = detailBody;
    }

    get isNotFound(): boolean {
        return this.status === 404;
    }

    get isValidation(): boolean {
        return this.status === 400 || this.status === 422;
    }

    get isServerError(): boolean {
        return this.status >= 500;
    }
}

// --- snake_case <-> camelCase ---

function snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(s: string): string {
    return s.replace(/[A-Z]/g, (c) => `_$${c.toLowerCase()}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function camelizeKeys<T>(input: unknown): T {
    if (Array.isArray(input)) {
        return input.map((v) => camelizeKeys(v)) as unknown as T;
    }
    if (!isPlainObject(input)) {
        return input as unknown as T;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
        out[snakeToCamel(k)] = camelizeKeys(v);
    }
    return out as T;
}

function snakeizeKeys(input: unknown): unknown {
    if (Array.isArray(input)) {
        return input.map((v) => snakeizeKeys(v));
    }
    if (!isPlainObject(input)) {
        return input;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
        out[camelToSnake(k)] = snakeizeKeys(v);
    }
    return out;
}

// --- request helpers ---

interface RequestOptions {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined | null>;
    rawBody?: BodyInit;
    headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method || "GET";
    let url = `$${BASE}$${path}`;
    if (options.query) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(options.query)) {
            if (v === undefined || v === null) continue;
            params.append(camelToSnake(k), String(v));
        }
        const qs = params.toString();
        if (qs) url = `$${url}?$${qs}`;
    }
    const endpoint = url.split("?")[0];

    const init: RequestInit = {method};
    if (options.rawBody !== undefined) {
        init.body = options.rawBody;
    } else if (options.body !== undefined) {
        init.body = JSON.stringify(snakeizeKeys(options.body));
        init.headers = {"Content-Type": "application/json", ...(options.headers || {})};
    } else if (options.headers) {
        init.headers = options.headers;
    }

    const res = await fetch(url, init);
    if (!res.ok) {
        const err = await res.json().catch(() => ({detail: res.statusText}));
        const isDictDetail = err.detail && typeof err.detail === "object";
        const detailString = isDictDetail
            ? (err.detail.message || err.detail.error || "Request failed")
            : (err.detail || "Request failed");
        throw new ApiError(
            res.status,
            detailString,
            endpoint,
            method,
            err.stacktrace || "",
            isDictDetail ? (err.detail as Record<string, unknown>) : undefined,
        );
    }
    if (res.status === 204) return undefined as T;
    const body = await res.json();
    return camelizeKeys<T>(body);
}

// --- typed payloads ---

${payload_interfaces}

// --- api namespace ---

export const api = {
${api_namespace_entries}
    health: () =>
        request<{status: string; version: string; debug: boolean}>("/health"),
    i18n: {
        get: (lang: string) => request<Record<string, unknown>>(`/i18n/$${lang}`),
    },
    // Universal app-level namespaces. These are NOT generated from the
    // manifest entities; they map to the kept ``app/routers/settings.py``
    // and ``app/routers/plugin_install.py`` routers and are consumed by
    // universal hooks (``useI18n``, future settings UI).
    settings: {
        getApp: () => request<Record<string, unknown>>("/settings/app"),
        updateApp: (data: Record<string, unknown>) =>
            request<Record<string, unknown>>("/settings/app", {method: "PATCH", body: data}),
        listPlugins: () => request<Record<string, unknown>>("/settings/plugins"),
        listDiscoveredPlugins: () =>
            request<{name: string; has_config: boolean; enabled: boolean; loaded: boolean}[]>(
                "/settings/plugins/discovered",
            ),
        getPlugin: (name: string) =>
            request<Record<string, unknown>>(`/settings/plugins/$${name}`),
        deletePlugin: (name: string) =>
            request<{plugin: string; status: string}>(
                `/settings/plugins/$${name}`,
                {method: "DELETE"},
            ),
    },
};

// Expose helpers for tests that exercise the conversion logic directly.
export const _internal = {camelizeKeys, snakeizeKeys, snakeToCamel, camelToSnake};
