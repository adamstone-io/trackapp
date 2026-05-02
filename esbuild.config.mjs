import * as esbuild from "esbuild";
import path from "path";

const isWatch = process.argv.includes("--watch");
const apiOrigin = process.env.API_ORIGIN || "";

const jsEntries = [
  "priming-main.js",
  "habits-main.js",
  "timer-main.js",
  "workspace-main.js",
  "stats-main.js",
  "reviews-main.js",
  "settings-main.js",
  "login-main.js",
  "verify-email-main.js",
  "study-main.js",
].map((name) => path.join("frontend/js", name));

const shared = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch,
  logLevel: "info",
};

const jsBuild = {
  ...shared,
  entryPoints: jsEntries,
  outdir: "frontend/dist/js",
  format: "esm",
  splitting: true,
  entryNames: "[name].bundle",
  define: {
    "__API_ORIGIN__": JSON.stringify(apiOrigin),
  },
};

const cssBuild = {
  ...shared,
  entryPoints: ["frontend/css/main.css"],
  outdir: "frontend/dist/css",
  entryNames: "[name].bundle",
};

if (isWatch) {
  const [jsCtx, cssCtx] = await Promise.all([
    esbuild.context(jsBuild),
    esbuild.context(cssBuild),
  ]);
  await Promise.all([jsCtx.watch(), cssCtx.watch()]);
  console.log("Watching for changes...");
} else {
  await Promise.all([esbuild.build(jsBuild), esbuild.build(cssBuild)]);
}
