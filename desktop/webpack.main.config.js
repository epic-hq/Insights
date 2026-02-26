const webpack = require("webpack");
const dotenv = require("dotenv");
const path = require("path");

function loadDesktopEnv() {
  const desktopEnvPath = path.resolve(__dirname, ".env");
  const rootEnvPath = path.resolve(__dirname, "..", ".env");
  const desktopResult = dotenv.config({ path: desktopEnvPath });
  if (!desktopResult.error) return desktopEnvPath;

  const rootResult = dotenv.config({ path: rootEnvPath });
  if (!rootResult.error) return rootEnvPath;

  return null;
}

function requireEnv(name, sourcePath) {
  const value = process.env[name];
  if (value && String(value).trim()) return value;
  throw new Error(
    `[desktop config] Missing required ${name}. Add it to desktop/.env or ${sourcePath || "project .env"}.`,
  );
}

const loadedEnvPath = loadDesktopEnv();
const supabaseUrl = requireEnv("SUPABASE_URL", loadedEnvPath);
const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY", loadedEnvPath);
const upsightApiUrl =
  process.env.UPSIGHT_API_URL || "https://app.getupsight.com";
const recallApiUrl =
  process.env.RECALLAI_API_URL || "https://us-west-2.recall.ai";

module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: "./src/main.js",
  // Put your normal webpack config below here
  module: {
    rules: require("./webpack.rules"),
  },
  plugins: [
    // Inject environment variables at build time
    new webpack.DefinePlugin({
      "process.env.SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
      "process.env.UPSIGHT_API_URL": JSON.stringify(upsightApiUrl),
      // Recall.ai SDK API URL - required for meeting detection
      "process.env.RECALLAI_API_URL": JSON.stringify(recallApiUrl),
    }),
  ],
  externals: {
    "@recallai/desktop-sdk": "commonjs @recallai/desktop-sdk",
    keytar: "commonjs keytar",
  },
};
