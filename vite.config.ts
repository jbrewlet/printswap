import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

/** Project-site prefix, e.g. `/printswap` on GitHub Pages. Empty for local dev. */
function pagesBase(): '' | `/${string}` {
	const raw = process.env.BASE_PATH?.trim() ?? '';
	if (raw === '' || raw === '/') return '';
	const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
	return withSlash.replace(/\/+$/, '') as `/${string}`;
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: 'index.html' }),
			paths: {
				base: pagesBase()
			}
		})
	],
	server: {
		port: 3100,
		strictPort: true
	},
	preview: {
		port: 3100,
		strictPort: true
	},
	test: {
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	resolve: {
		alias: {
			'#lib': new URL('./src/lib', import.meta.url).pathname
		}
	}
});
