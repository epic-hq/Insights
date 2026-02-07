const webpack = require("webpack");
const dotenv = require("dotenv");
const path = require("path");

// Load .env file for build-time variable injection
dotenv.config({ path: path.resolve(__dirname, ".env") });

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
      "process.env.SUPABASE_URL": JSON.stringify(
        process.env.SUPABASE_URL || "https://ywkqpsvfhjjxswjzqnnq.supabase.co",
      ),
      "process.env.SUPABASE_ANON_KEY": JSON.stringify(
        process.env.SUPABASE_ANON_KEY ||
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3a3Fwc3ZmaGpqeHN3anpxbm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjA0MDAzNzEsImV4cCI6MjAzNTk3NjM3MX0.vvAlwDCfKQo1gUEcYxJwLMZFubvYiwQb95c56rQ-i5g",
      ),
      "process.env.UPSIGHT_API_URL": JSON.stringify(
        process.env.UPSIGHT_API_URL || "https://app.getupsight.com",
      ),
      // Recall.ai SDK API URL - required for meeting detection
      "process.env.RECALLAI_API_URL": JSON.stringify(
        process.env.RECALLAI_API_URL || "https://us-west-2.recall.ai",
      ),
    }),
  ],
  externals: {
    "@recallai/desktop-sdk": "commonjs @recallai/desktop-sdk",
    keytar: "commonjs keytar",
  },
};
