/**
 * Design Tokens for myID Auth Screens
 * Extracted from https://myid.africa/screens/
 * These tokens ensure pixel-perfect replication of the reference designs
 */

export const authTokens = {
  // Color palette from myID screens
  colors: {
    light: {
      bg: '#F2F2F7',
      surface: '#FFFFFF',
      text: '#000000',
      textSecondary: '#8E8E93',
      primary: '#007AFF',
      border: '#C6C6C8',
      error: '#FF3B30',
      success: '#22C55E',
      warning: '#F59E0B',
      info: '#0EA5E9',
    },
    dark: {
      bg: '#000000',
      surface: '#1C1C1E',
      text: '#FFFFFF',
      textSecondary: '#8E8E93',
      primary: '#0A84FF',
      border: '#38383A',
      error: '#FF453A',
      success: '#16A34A',
      warning: '#D97706',
      info: '#0EA5E9',
    },
  },

  // Semantic colors
  semantic: {
    success: {
      light: '#22C55E',
      dark: '#16A34A',
    },
    warning: {
      light: '#F59E0B',
      dark: '#D97706',
    },
    error: {
      light: '#EF4444',
      dark: '#DC2626',
    },
    info: {
      light: '#0EA5E9',
      dark: '#0284C7',
    },
  },

  // Typography - exact sizes from screens
  typography: {
    fontFamily: {
      primary: "'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      mono: "'Ubuntu Mono', 'OCR-B', 'Courier New', monospace",
    },
    fontSize: {
      h1: '32px',
      h2: '28px',
      h3: '24px',
      h4: '16px',
      body: '16px',
      small: '14px',
      caption: '13px',
      tiny: '12px',
      label: '10px',
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  // Exact spacing from screens page
  spacing: {
    statusBarHeight: '44px',
    containerPaddingX: '20px',
    containerPaddingCompact: '16px',
    containerPaddingTight: '12px',
    containerPaddingMinimal: '8px',
    formGroupMargin: '20px',
    labelMargin: '8px',
    inputPadding: '16px',
    iconRight: '16px',
    keyIconRight: '45px',
    headerMarginTop: '30px',
    headerMarginBottom: '25px',
    logoMarginBottom: '24px',
    checkboxGap: '12px',
    gap: {
      xs: '4px',
      sm: '8px',
      md: '12px',
      lg: '16px',
    },
  },

  // Border radius from screens
  borderRadius: {
    none: '0',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '32px',
    '3xl': '40px',
    full: '50%',
    input: '12px',
    button: '12px',
    card: '16px',
    phone: '40px',
  },

  // Container dimensions - iPhone screen size
  container: {
    width: '393px',
    minHeight: '852px',
  },

  // Shadows
  shadows: {
    subtle: '0 1px 3px rgba(0, 0, 0, 0.08)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
    prominent: '0 25px 50px rgba(0, 0, 0, 0.3)',
    card: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },

  // Transitions
  transitions: {
    fast: '150ms ease',
    base: '200ms ease',
    slow: '300ms ease',
    opacity: '200ms ease',
  },

  // Navigation
  navigation: {
    bottomPadding: '34px',
  },

  // Toggle/Switch
  toggle: {
    width: '44px',
    height: '24px',
    knobTranslation: '20px',
  },
} as const;

export type AuthTokens = typeof authTokens;

// Legacy design tokens for backward compatibility
export const designTokens = {
  colors: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    secondary: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
    },
    success: {
      50: '#f0fdf4',
      500: '#22c55e',
      700: '#15803d',
    },
    danger: {
      50: '#fef2f2',
      500: '#ef4444',
      700: '#b91c1c',
    },
    neutral: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  typography: {
    fontFamily: {
      sans: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export type DesignTokens = typeof designTokens;
