export const colors = {
  // Aged ledger paper instead of a clean white -- this is a mob accountant's book, not a form app.
  bg: '#F4EEDD',
  surface: '#EDE3C8',
  tint: '#E3D3AE',
  border: '#C9B68A',
  text: '#211714',
  muted: '#6B5A45',
  // Blood red + brass gold instead of indigo -- the "Shakedown" palette.
  primary: '#8C1620',
  primaryDark: '#6B0F17',
  onPrimary: '#F4EEDD',
  accent: '#A9791C',
  accentDark: '#7C5A14',
  positive: '#2F6B3D',
  negative: '#B0202B',
  // Ambient red/gold glow for the decorative background.
  blobA: '#8C1620',
  blobB: '#A9791C',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

// Slightly sharper than a soft consumer app -- this outfit doesn't do rounded corners.
export const radii = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

/** Shared shadow presets -- iOS shadow props plus elevation for parity. */
export const shadows = {
  button: {
    shadowColor: '#8C1620',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  card: {
    shadowColor: '#1C120C',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
} as const;
