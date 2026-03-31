/**
 * Browser cookie extraction for Twitter authentication.
 * Delegates to @steipete/sweet-cookie for Safari/Chrome/Firefox reads.
 */
import { getCookies } from '@steipete/sweet-cookie';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const TWITTER_COOKIE_NAMES = ['auth_token', 'ct0'];
const TWITTER_URL = 'https://x.com/';
const TWITTER_ORIGINS = ['https://x.com/', 'https://twitter.com/'];
const DEFAULT_COOKIE_TIMEOUT_MS = 30_000;
const BIRD_CONFIG_PATH = path.join(os.homedir(), '.config', 'bird', 'config.json5');
function normalizeValue(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function cookieHeader(authToken, ct0) {
    return `auth_token=${authToken}; ct0=${ct0}`;
}
function buildEmpty() {
    return { authToken: null, ct0: null, cookieHeader: null, source: null };
}
function readEnvCookie(cookies, keys, field) {
    if (cookies[field]) {
        return;
    }
    for (const key of keys) {
        const value = normalizeValue(process.env[key]);
        if (!value) {
            continue;
        }
        cookies[field] = value;
        if (!cookies.source) {
            cookies.source = `env ${key}`;
        }
        break;
    }
}
function resolveSources(cookieSource) {
    if (Array.isArray(cookieSource)) {
        return cookieSource;
    }
    if (cookieSource) {
        return [cookieSource];
    }
    return ['safari', 'chrome', 'firefox'];
}
function stripJson5Comments(raw) {
    return raw
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
}
function stripTrailingCommas(raw) {
    return raw.replace(/,\s*([}\]])/g, '$1');
}
function quoteUnquotedKeys(raw) {
    return raw.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/g, '$1"$2"$3');
}
function readBirdConfig() {
    try {
        if (!fs.existsSync(BIRD_CONFIG_PATH)) {
            return {};
        }
        const raw = fs.readFileSync(BIRD_CONFIG_PATH, 'utf8');
        const normalized = quoteUnquotedKeys(stripTrailingCommas(stripJson5Comments(raw)));
        const parsed = JSON.parse(normalized);
        return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch {
        return {};
    }
}
function labelForSource(source, profile) {
    if (source === 'safari') {
        return 'Safari';
    }
    if (source === 'chrome') {
        return profile ? `Chrome profile "${profile}"` : 'Chrome default profile';
    }
    return profile ? `Firefox profile "${profile}"` : 'Firefox default profile';
}
function pickCookieValue(cookies, name) {
    const matches = cookies.filter((c) => c?.name === name && typeof c.value === 'string');
    if (matches.length === 0) {
        return null;
    }
    const preferred = matches.find((c) => (c.domain ?? '').endsWith('x.com'));
    if (preferred?.value) {
        return preferred.value;
    }
    const twitter = matches.find((c) => (c.domain ?? '').endsWith('twitter.com'));
    if (twitter?.value) {
        return twitter.value;
    }
    return matches[0]?.value ?? null;
}
async function readTwitterCookiesFromBrowser(options) {
    const warnings = [];
    const out = buildEmpty();
    const { cookies, warnings: providerWarnings } = await getCookies({
        url: TWITTER_URL,
        origins: TWITTER_ORIGINS,
        names: [...TWITTER_COOKIE_NAMES],
        browsers: [options.source],
        mode: 'merge',
        chromeProfile: options.chromeProfile,
        firefoxProfile: options.firefoxProfile,
        timeoutMs: options.cookieTimeoutMs,
    });
    warnings.push(...providerWarnings);
    const authToken = pickCookieValue(cookies, 'auth_token');
    const ct0 = pickCookieValue(cookies, 'ct0');
    if (authToken) {
        out.authToken = authToken;
    }
    if (ct0) {
        out.ct0 = ct0;
    }
    if (out.authToken && out.ct0) {
        out.cookieHeader = cookieHeader(out.authToken, out.ct0);
        out.source = labelForSource(options.source, options.source === 'chrome' ? options.chromeProfile : options.firefoxProfile);
        return { cookies: out, warnings };
    }
    if (options.source === 'safari') {
        warnings.push('No Twitter cookies found in Safari. Make sure you are logged into x.com in Safari.');
    }
    else if (options.source === 'chrome') {
        warnings.push('No Twitter cookies found in Chrome. Make sure you are logged into x.com in Chrome.');
    }
    else {
        warnings.push('No Twitter cookies found in Firefox. Make sure you are logged into x.com in Firefox and the profile exists.');
    }
    return { cookies: out, warnings };
}
export async function extractCookiesFromSafari() {
    return readTwitterCookiesFromBrowser({ source: 'safari' });
}
export async function extractCookiesFromChrome(profile) {
    return readTwitterCookiesFromBrowser({ source: 'chrome', chromeProfile: profile });
}
export async function extractCookiesFromFirefox(profile) {
    return readTwitterCookiesFromBrowser({ source: 'firefox', firefoxProfile: profile });
}
/**
 * Resolve Twitter credentials from multiple sources.
 * Priority: CLI args > environment variables > browsers (ordered).
 */
export async function resolveCredentials(options) {
    const warnings = [];
    const cookies = buildEmpty();
    const birdConfig = readBirdConfig();
    const cookieTimeoutMs = typeof options.cookieTimeoutMs === 'number' &&
        Number.isFinite(options.cookieTimeoutMs) &&
        options.cookieTimeoutMs > 0
        ? options.cookieTimeoutMs
        : process.platform === 'darwin'
            ? DEFAULT_COOKIE_TIMEOUT_MS
            : undefined;
    const chromeProfile = options.chromeProfile ?? birdConfig.chromeProfile;
    const firefoxProfile = options.firefoxProfile ?? birdConfig.firefoxProfile;
    const cookieSource = options.cookieSource ?? birdConfig.cookieSource;
    if (options.authToken) {
        cookies.authToken = options.authToken;
        cookies.source = 'CLI argument';
    }
    if (options.ct0) {
        cookies.ct0 = options.ct0;
        if (!cookies.source) {
            cookies.source = 'CLI argument';
        }
    }
    readEnvCookie(cookies, ['AUTH_TOKEN', 'TWITTER_AUTH_TOKEN'], 'authToken');
    readEnvCookie(cookies, ['CT0', 'TWITTER_CT0'], 'ct0');
    if (cookies.authToken && cookies.ct0) {
        cookies.cookieHeader = cookieHeader(cookies.authToken, cookies.ct0);
        return { cookies, warnings };
    }
    const sourcesToTry = resolveSources(cookieSource);
    for (const source of sourcesToTry) {
        const res = await readTwitterCookiesFromBrowser({
            source,
            chromeProfile,
            firefoxProfile,
            cookieTimeoutMs,
        });
        warnings.push(...res.warnings);
        if (res.cookies.authToken && res.cookies.ct0) {
            return { cookies: res.cookies, warnings };
        }
    }
    if (!cookies.authToken) {
        warnings.push('Missing auth_token - provide via --auth-token, AUTH_TOKEN env var, or login to x.com in Safari/Chrome/Firefox');
    }
    if (!cookies.ct0) {
        warnings.push('Missing ct0 - provide via --ct0, CT0 env var, or login to x.com in Safari/Chrome/Firefox');
    }
    if (cookies.authToken && cookies.ct0) {
        cookies.cookieHeader = cookieHeader(cookies.authToken, cookies.ct0);
    }
    return { cookies, warnings };
}
//# sourceMappingURL=cookies.js.map
