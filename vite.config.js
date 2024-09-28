import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';
import htmlPlugin from "vite-plugin-html-config"

export default defineConfig({
	plugins: [
		sveltekit(),
		nodePolyfills({
			protocolImports: true,
		  }),
		  htmlPlugin({
			title: process.env.VITE_APP_NAME,
			metas: [
			  {name: "description", content: "Connecting people for daily meals"},
			  {name: "theme-color", content: "#ffffff"},
			  {name: "og:title", content: "Hook Cafe"},
			  {name: "og:type", content: "website"},
			  {name: "og:description", content: "Connecting people for daily meals"},
			  {name: "og:image", content: "logo-white.png"},
			  {name: "twitter:card", content: "summary_large_image"},
			  {name: "twitter:title", content: "Hook Cafe"},
			  {name: "twitter:description", content: "Hook Cafe"},
			  {name: "twitter:image", content: "logo-white.png"},
			  {property: "og:url", content: "hook.cafe"},
			  {name: "msapplication-TileColor", content: "#ffffff"},
			  {name: "msapplication-TileImage", content: "logo-white.png"},
			],
			links: [
			  {rel: "icon", href: "favicon.ico", sizes: "48x48"},
			  {rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon-180x180.png"},
			  {rel: "mask-icon", href: "logo.svg", color: "#FFFFFF"},
			  {rel: "apple-touch-icon", sizes: "180x180", href: "apple-touch-icon-180x180.png"},
			],
		}),
		VitePWA({
			registerType: "autoUpdate",
			// injectRegister: "auto",
			workbox: {
				maximumFileSizeToCacheInBytes: 10 * 1024 ** 2,
			},
			devOptions: {
				enabled: true
			},
			includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'maskable-icon-512x512.png'],
			manifest: {
				name: "Hook Cafe",
				short_name: "HookCafe",
				description: "Connecting people for daily meals",
				theme_color: "#ffffff",
				icons: [
					{src: "pwa-64x64.png", sizes: "64x64", type: "image/png"},
					{src: "pwa-192x192.png", sizes: "192x192", type: "image/png"},
					{src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any"},
					{
						src: "maskable-icon-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
		}),
	]
});
