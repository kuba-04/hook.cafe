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
			  maximumFileSizeToCacheInBytes: 10 * 1024 ** 2,
			},
			manifest: {
			  name: "Hook Cafe",
			  short_name: "HookCafe",
			  description: "Simple App to connect people for daily meals",
			  theme_color: "accent:#FC560E,neutral-950:#FAFAFA,neutral-900:#FAFAFA,neutral-800:#F5F5F5,neutral-700:#D4D4D4,neutral-600:#A3A3A3,neutral-500:#737373,neutral-400:#525252,neutral-300:#404040,neutral-200:#262626,neutral-100:#171717,neutral-50:#0A0A0A,success:#12D2B0,tinted-800:#FFFFFF,tinted-700:#FAFAFA,tinted-600:#F5F5F5,tinted-500:#D4D4D4,tinted-400:#A3A3A3,tinted-200:#737373,tinted-100:#525252,warning:#FCAB0E,danger:#dc0c0c",
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
