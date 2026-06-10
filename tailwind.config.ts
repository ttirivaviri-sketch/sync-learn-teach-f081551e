import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: { '2xl': '1400px' }
		},
		extend: {
			fontFamily: {
				sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
				display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input:  'hsl(var(--input))',
				ring:   'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT:    'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					glow:       'hsl(var(--primary-glow))',
					light:      'hsl(var(--primary-light))',
					dark:       'hsl(var(--primary-dark))',
				},
				secondary: {
					DEFAULT:    'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
					light:      'hsl(var(--secondary-light))',
				},
				destructive: {
					DEFAULT:    'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				muted: {
					DEFAULT:    'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				accent: {
					DEFAULT:    'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				// ── STUDYMODE extra colour tokens ──────────────────────────────────
				warning: {
					DEFAULT: 'hsl(38 92% 50%)',
					foreground: 'hsl(0 0% 98%)',
				},
				gold: {
					DEFAULT: 'hsl(45 93% 47%)',
					foreground: 'hsl(0 0% 98%)',
				},
				success: {
					DEFAULT: 'hsl(var(--success, 142.1 76.2% 36.3%))',
					foreground: 'hsl(0 0% 98%)',
				},
				// ──────────────────────────────────────────────────────────────────
				popover: {
					DEFAULT:    'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				card: {
					DEFAULT:    'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
				sidebar: {
					DEFAULT:             'hsl(var(--sidebar-background))',
					foreground:          'hsl(var(--sidebar-foreground))',
					primary:             'hsl(var(--sidebar-primary))',
					'primary-foreground':'hsl(var(--sidebar-primary-foreground))',
					accent:              'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border:              'hsl(var(--sidebar-border))',
					ring:                'hsl(var(--sidebar-ring))',
				},
			},
			borderRadius: {
				'2xl': '1rem',
				xl:    'calc(var(--radius) + 2px)',
				lg:    'var(--radius)',
				md:    'calc(var(--radius) - 2px)',
				sm:    'calc(var(--radius) - 4px)',
			},
			boxShadow: {
				xs:       'var(--shadow-xs)',
				sm:       'var(--shadow-sm)',
				md:       'var(--shadow-md)',
				lg:       'var(--shadow-lg)',
				xl:       'var(--shadow-xl)',
				elegant:  'var(--shadow-elegant)',
				card:     'var(--shadow-card)',
				glow:     'var(--shadow-glow)',
				'glow-sm':'var(--shadow-glow-sm)',
			},
			backgroundImage: {
				'gradient-hero':      'var(--gradient-hero)',
				'gradient-hero-dark': 'var(--gradient-hero-dark)',
				'gradient-header':    'var(--gradient-header)',
				'gradient-tutor':     'var(--gradient-tutor)',
				'gradient-card':      'var(--gradient-card)',
				'gradient-mesh':      'var(--gradient-mesh)',
				// STUDYMODE gradient utilities
				'gradient-primary':   'linear-gradient(135deg, hsl(228 89% 60%), hsl(248 88% 64%))',
				'gradient-accent':    'linear-gradient(135deg, hsl(24.6 95% 53.1%), hsl(38 95% 60%))',
				'gradient-secondary': 'linear-gradient(135deg, hsl(248 88% 64%), hsl(262 83% 60%))',
			},
			fontSize: {
				xs:   ['0.78rem',  { lineHeight: '1.1rem' }],
				sm:   ['0.9rem',   { lineHeight: '1.3rem' }],
				base: ['1rem',     { lineHeight: '1.55rem' }],
				lg:   ['1.15rem',  { lineHeight: '1.7rem' }],
				xl:   ['1.3rem',   { lineHeight: '1.85rem' }],
				'2xl':['1.6rem',   { lineHeight: '2.05rem' }],
				'3xl':['2rem',     { lineHeight: '2.4rem' }],
				'4xl':['2.5rem',   { lineHeight: '2.85rem' }],
				'5xl':['3.15rem',  { lineHeight: '1.05' }],
				'6xl':['3.85rem',  { lineHeight: '1.05' }],
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to:   { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to:   { height: '0' },
				},
				float: {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%':      { transform: 'translateY(-12px)' },
				},
				fadeUp: {
					from: { opacity: '0', transform: 'translateY(24px)' },
					to:   { opacity: '1', transform: 'translateY(0)' },
				},
				scaleIn: {
					from: { opacity: '0', transform: 'scale(0.92)' },
					to:   { opacity: '1', transform: 'scale(1)' },
				},
				shimmer: {
					'0%':   { backgroundPosition: '-200% 0' },
					'100%': { backgroundPosition: '200% 0' },
				},
				pulseRing: {
					'0%':   { boxShadow: '0 0 0 0 hsl(var(--primary) / 0.45)' },
					'70%':  { boxShadow: '0 0 0 12px hsl(var(--primary) / 0)' },
					'100%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0)' },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up':   'accordion-up 0.2s ease-out',
				float:            'float 6s ease-in-out infinite',
				'float-slow':     'float 9s ease-in-out infinite',
				'fade-up':        'fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
				'scale-in':       'scaleIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
				shimmer:          'shimmer 2.5s infinite',
				'pulse-ring':     'pulseRing 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite',
			},
			transitionTimingFunction: {
				spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
				bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
