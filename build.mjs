import * as esbuild from "esbuild";

const ctx = await esbuild.context({
  entryPoints: ["src/app.mjs"],
  bundle: true,
  minify: false,
  sourcemap: false,
  target: ["es2020"],
  format: "iife",
  banner: {
    js: `
       function require(m) {
         const MODS = {
          "@microsoft/msfs-sdk": window.msfssdk,
          "@microsoft/msfs-garminsdk": window.garminsdk,
          "@microsoft/msfs-wtg3000-common": window.wtg3000common,
          "@microsoft/msfs-wtg3000-gtc": window.wtg3000gtc,
         }
        if(MODS[m])
          return MODS[m];
         throw new Error(\`Unknown module \${m}\`);
       }
    `,
  },

  jsx: "transform",
  jsxFactory: "msfssdk.FSComponent.buildComponent",
  jsxFragment: "msfssdk.FSComponent.Fragment",
  outfile:
    "./g3000-acars/PackageSources/Copys/garmin-3000-acars/plugin/garmin-3000-acars/plugin.js",
  external: [
    "@microsoft/msfs-sdk",
    "@microsoft/msfs-garminsdk",
    "@microsoft/msfs-wtg3000-common",
    "@microsoft/msfs-wtg3000-gtc",
  ],
});

await ctx.watch();
