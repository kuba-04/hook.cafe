import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';

export default defineConfig({
	plugins: [sveltekit(), babel()	],
	optimizeDeps: {
		include: ['bigint-polyfill'], 
	},	
});
