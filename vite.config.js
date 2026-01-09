import path from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		tsConfigPaths(),
		tanstackRouter({ target: 'react', autoCodeSplitting: true }),
		viteReact({
			babel: {
				plugins: ['babel-plugin-react-compiler'],
			},
		}),
		tailwindcss(),
		cloudflare(),
	],
	server: {
		allowedHosts: ['cgarza-mbp-m2.discus-jazz.ts.net'],
		watch: {
			ignored: ['**/.wrangler/state/**'],
		},
	},
	resolve: {
		alias: {
			'@/': path.resolve(__dirname, './src'),
			'@/worker': path.resolve(__dirname, './worker'),
		},
	},
});
