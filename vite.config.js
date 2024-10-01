import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		nodePolyfills({
			protocolImports: true,
		  }),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			injectRegister: false,
		
			pwaAssets: {
				disabled: false,
				config: true
			},
		
			manifest: {
				name: 'Hook Cafe',
				short_name: 'Hook Cafe',
				description: 'Connecting people for daily get together',
				theme_color: '#ffffff'
			},

			workbox: {
				maximumFileSizeToCacheInBytes: 10 * 1024 ** 2,
				globPatterns: [
				'client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'
				],
		
				cleanupOutdatedCaches: true,
				clientsClaim: true
			},
		
			devOptions: {
				enabled: true,
				suppressWarnings: true,
				navigateFallback: '/',
				navigateFallbackAllowlist: [/^\/$/],
				type: 'module'
			}
		})
	]
});
