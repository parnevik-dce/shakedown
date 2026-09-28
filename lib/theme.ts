export const colors = {
  // A soft indigo-tinted white instead of clinical pure white -- warmer, less "form app".
  bg: '#FBFAFF',
  surface: '#F1EFFC',
  tint: '#E7E3FB',
  border: '#E4E0F5',
  text: '#161221',
  muted: '#726C87',
  // Richer indigo/violet instead of a flat corporate blue.
  primary: '#5B3DF5',
  primaryDark: '#4527D6',
  onPrimary: '#FFFFFF',
  positive: '#1E9E64',
  negative: '#E5484D',
  // Soft accent for decorative background shapes.
  blobA: '#D9CFFF',
  blobB: '#FFD9EC',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

/** Shared shadow presets -- iOS shadow props plus elevation for parity. */
export const shadows = {
  button: {
    shadowColor: '#5B3DF5',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  card: {
    shadowColor: '#241A57',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;
