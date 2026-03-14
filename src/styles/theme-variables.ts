// ── Theme CSS Custom Properties ──

import type { ThemeName, ThemeOverrides } from '../types';

export const LIGHT_THEME: Record<string, string> = {
  '--gc-primary': '#6366f1',
  '--gc-primary-hover': '#4f46e5',
  '--gc-primary-text': '#ffffff',
  '--gc-bg': '#ffffff',
  '--gc-bg-secondary': '#f9fafb',
  '--gc-text': '#111827',
  '--gc-text-secondary': '#6b7280',
  '--gc-border': '#e5e7eb',
  '--gc-user-bubble': '#6366f1',
  '--gc-user-text': '#ffffff',
  '--gc-agent-bubble': '#f3f4f6',
  '--gc-agent-text': '#111827',
  '--gc-input-bg': '#ffffff',
  '--gc-input-border': '#d1d5db',
  '--gc-input-focus': '#6366f1',
  '--gc-shadow': '0 8px 32px rgba(0, 0, 0, 0.12)',
  '--gc-radius': '16px',
  '--gc-radius-msg': '18px',
  '--gc-font': "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  '--gc-font-size': '14px',
  '--gc-header-height': '64px',
  '--gc-width': '400px',
  '--gc-height': '600px',
  '--gc-launcher-size': '60px',
  '--gc-z-index': '999999',
};

export const DARK_THEME: Record<string, string> = {
  ...LIGHT_THEME,
  '--gc-primary': '#818cf8',
  '--gc-primary-hover': '#6366f1',
  '--gc-bg': '#1f2937',
  '--gc-bg-secondary': '#111827',
  '--gc-text': '#f9fafb',
  '--gc-text-secondary': '#9ca3af',
  '--gc-border': '#374151',
  '--gc-user-bubble': '#818cf8',
  '--gc-user-text': '#ffffff',
  '--gc-agent-bubble': '#374151',
  '--gc-agent-text': '#f9fafb',
  '--gc-input-bg': '#374151',
  '--gc-input-border': '#4b5563',
  '--gc-input-focus': '#818cf8',
  '--gc-shadow': '0 8px 32px rgba(0, 0, 0, 0.4)',
};

/** Get base theme variables by name */
export function getThemeVars(theme: ThemeName): Record<string, string> {
  if (theme === 'dark') return DARK_THEME;
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? DARK_THEME : LIGHT_THEME;
  }
  return LIGHT_THEME;
}

/** Map ThemeOverrides to CSS variable overrides */
const OVERRIDE_MAP: Record<keyof ThemeOverrides, string> = {
  base: '',
  primaryColor: '--gc-primary',
  primaryTextColor: '--gc-primary-text',
  backgroundColor: '--gc-bg',
  textColor: '--gc-text',
  userBubbleColor: '--gc-user-bubble',
  userTextColor: '--gc-user-text',
  agentBubbleColor: '--gc-agent-bubble',
  agentTextColor: '--gc-agent-text',
  inputBackgroundColor: '--gc-input-bg',
  borderRadius: '--gc-radius',
  fontFamily: '--gc-font',
  fontSize: '--gc-font-size',
  headerHeight: '--gc-header-height',
  width: '--gc-width',
  height: '--gc-height',
  launcherSize: '--gc-launcher-size',
};

/** Resolve theme config into CSS custom properties */
export function resolveTheme(
  theme: ThemeName | ThemeOverrides | undefined
): Record<string, string> {
  // Default to light
  if (!theme) return LIGHT_THEME;

  // String theme name
  if (typeof theme === 'string') return getThemeVars(theme);

  // Theme overrides object
  const base = getThemeVars(theme.base ?? 'light');
  const vars = { ...base };

  for (const [key, cssVar] of Object.entries(OVERRIDE_MAP)) {
    if (!cssVar) continue;
    const value = theme[key as keyof ThemeOverrides];
    if (value) vars[cssVar] = value;
  }

  return vars;
}
