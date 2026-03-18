import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "ASCII Reference App",
		identifier: "com.ascii-ref.app",
		version: "0.1.0",
	},
	runtime: {
		exitOnLastWindowClosed: true,
	},
	build: {
		useAsar: true,
		bun: {
			entrypoint: "src/bun/index.ts",
		},
		views: {
			mainview: {
				entrypoint: "src/mainview/index.ts",
			},
		},
		copy: {
			"src/mainview/index.html": "views/mainview/index.html",
			"src/mainview/index.css": "views/mainview/index.css",
			"src/ascii/": "ascii/",
		},
		mac: {
			bundleCEF: true,
			bundleWGPU: false,
		},
		linux: {
			bundleCEF: true,
			bundleWGPU: false,
		},
		win: {
			bundleCEF: true,
			bundleWGPU: false,
		},
	},
} satisfies ElectrobunConfig;
