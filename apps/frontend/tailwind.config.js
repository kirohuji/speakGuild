/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', 'class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			// ManYu 品牌语义色
  			brand: {
  				navy:    'hsl(var(--brand-navy))',
  				'navy-deep': 'hsl(var(--brand-navy-deep))',
  				'navy-dark': 'hsl(var(--brand-navy-dark))',
  				coral:   'hsl(var(--brand-coral))',
  				'coral-light': 'hsl(var(--brand-coral-light))',
  				'coral-pressed': 'hsl(var(--brand-coral-pressed))',
  				link:    'hsl(var(--brand-link))',
  				text:    'hsl(var(--brand-text))',
  				'text-secondary': 'hsl(var(--brand-text-secondary))',
  				divider: 'hsl(var(--brand-divider))',
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Noto Sans SC',
  				'sans-serif'
  			],
  			display: [
  				'Plus Jakarta Sans',
  				'Inter',
  				'-apple-system',
  				'sans-serif'
  			],
  			mono: [
  				'JetBrains Mono',
  				'ui-monospace',
  				'SFMono-Regular',
  				'monospace'
  			]
  		}
  	}
  },
  plugins: [],
}
