import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const isWatch = process.argv.includes("--watch") || process.argv.includes("-w");

const DEST_DIR = "./g3000-acars/PackageSources/Copys/garmin-3000-acars/plugin/garmin-3000-acars";
const PLUGINS_DIR = "./g3000-acars/PackageSources/Copys/garmin-3000-acars/plugin/Plugins";

// Copy assets and CSS to destination
function copyStaticFiles() {
  // Ensure destination directories exist
  if (!existsSync(DEST_DIR)) mkdirSync(DEST_DIR, { recursive: true });
  if (!existsSync(PLUGINS_DIR)) mkdirSync(PLUGINS_DIR, { recursive: true });

  // Copy CSS
  copyFileSync("src/acars-style.css", join(DEST_DIR, "plugin.css"));

  // Copy assets
  const assetsDir = join(DEST_DIR, "assets");
  if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });

  for (const file of readdirSync("src/assets")) {
    copyFileSync(join("src/assets", file), join(assetsDir, file));
  }

  // Copy plugin.xml
  copyFileSync("src/plugin.xml", join(PLUGINS_DIR, "g3000-acars.xml"));

  console.log("Static files copied!");
}

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
  outfile: join(DEST_DIR, "plugin.js"),
  external: [
    "@microsoft/msfs-sdk",
    "@microsoft/msfs-garminsdk",
    "@microsoft/msfs-wtg3000-common",
    "@microsoft/msfs-wtg3000-gtc",
  ],
});

if (isWatch) {
  console.log("Watching for changes...");
  copyStaticFiles();
  await ctx.watch();
} else {
  await ctx.rebuild();
  copyStaticFiles();
  await ctx.dispose();
  console.log("Build completed!");
}
