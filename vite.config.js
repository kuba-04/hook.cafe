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
		  VitePWA({
			registerType: "autoUpdate",
			injectRegister: "auto",
			workbox: {
			  maximumFileSizeToCacheInBytes: 5 * 1024 ** 2,
			},
			manifest: {
			  name: process.env.VITE_APP_NAME,
			  short_name: process.env.VITE_APP_NAME,
			  description: process.env.VITE_APP_DESCRIPTION,
			  protocol_handlers: [{protocol: "web+nostr", url: "/%s"}],
			  permissions: ["clipboardRead", "clipboardWrite", "unlimitedStorage"],
			  icons: [
				{src: "static/pwa-64x64.png", sizes: "64x64", type: "image/png"},
				{src: "static/pwa-192x192.png", sizes: "192x192", type: "image/png"},
				{src: "static/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any"},
				{
				  src: "static/maskable-icon-512x512.png",
				  sizes: "512x512",
				  type: "image/png",
				  purpose: "maskable",
				},
			  ],
			},
		  }),
		htmlPlugin({
		// Add necessary meta tags and icons here
		}),  
		
	]
});
