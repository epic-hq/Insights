const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
  packagerConfig: {
    name: "UpSight",
    appBundleId: "com.getupsight.desktop",
    asar: {
      unpackDir: "{node_modules/@recallai,node_modules/keytar}",
    },
    osxSign: {
      identity: "Developer ID Application: Richard MOY (MF6J364BXK)",
      optionsForFile: (_) => {
        return {
          entitlements: "./Entitlements.plist",
          "entitlements-inherit": "./Entitlements.plist",
        };
      },
    },
    ...(process.env.APPLE_ID && process.env.APPLE_ID_PASSWORD
      ? {
          osxNotarize: {
            appleId: process.env.APPLE_ID,
            appleIdPassword: process.env.APPLE_ID_PASSWORD,
            teamId: "MF6J364BXK",
          },
        }
      : {}),
    icon: "./upsight.icns",
    extendInfo: {
      NSUserNotificationAlertStyle: "alert",
      NSMicrophoneUsageDescription:
        "UpSight needs microphone access to record meeting audio.",
      NSCameraUsageDescription:
        "UpSight needs camera access to record video meetings.",
      NSScreenCaptureUsageDescription:
        "UpSight needs to record your screen during meetings.",
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-dmg",
    },
    // {
    //   name: '@electron-forge/maker-squirrel',
    //   config: {},
    // },
    // {
    //   name: '@electron-forge/maker-zip',
    //   platforms: ['darwin'],
    // },
    // {
    //   name: '@electron-forge/maker-deb',
    //   config: {},
    // },
    // {
    //   name: '@electron-forge/maker-rpm',
    //   config: {},
    // },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    {
      name: "@electron-forge/plugin-webpack",
      config: {
        devContentSecurityPolicy:
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob: filesystem: mediastream: file:;",
        mainConfig: "./webpack.main.config.js",
        renderer: {
          config: "./webpack.renderer.config.js",
          entryPoints: [
            {
              html: "./src/index.html",
              js: "./src/renderer.js",
              name: "main_window",
              preload: {
                js: "./src/preload.js",
              },
            },
            {
              html: "./src/pages/login/index.html",
              js: "./src/pages/login/renderer.js",
              name: "login",
              preload: {
                js: "./src/preload.js",
              },
            },
            {
              html: "./src/floating-panel.html",
              js: "./src/floating-panel-renderer.js",
              name: "floating_panel",
              preload: {
                js: "./src/preload.js",
              },
            },
          ],
        },
      },
    },
    {
      name: "@timfish/forge-externals-plugin",
      config: {
        externals: ["@recallai/desktop-sdk", "keytar"],
        includeDeps: true,
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
