# Desktop App Build & Deploy Guide

Guide for building, code signing, and notarizing the UpSight Electron desktop app using Electron Forge.

## Prerequisites

- macOS (for macOS builds with code signing)
- Apple Developer account with valid Developer ID Application certificate
- Apple ID and app-specific password for notarization
- Node.js and npm installed

## Build Tool: Electron Forge

The desktop app uses [Electron Forge](https://www.electronforge.io/) for packaging, code signing, and distribution. Configuration is in `desktop/forge.config.js`.

### Package Scripts

From the `desktop/` directory:

```bash
# Development
npm start                    # Start app in dev mode

# Production builds
npm run package             # Package without creating installer
npm run make                # Create DMG installer (includes packaging)
```

## Code Signing & Notarization

### Configuration

Code signing and notarization are configured in `desktop/forge.config.js`:

**Code Signing** (always enabled):
```javascript
osxSign: {
  identity: "Developer ID Application: Richard MOY (MF6J364BXK)",
  optionsForFile: (_) => {
    return {
      entitlements: "./Entitlements.plist",
      "entitlements-inherit": "./Entitlements.plist",
    };
  },
}
```

**Notarization** (conditional - requires environment variables):
```javascript
...(process.env.APPLE_ID && process.env.APPLE_ID_PASSWORD
  ? {
      osxNotarize: {
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_ID_PASSWORD,
        teamId: "MF6J364BXK",
      },
    }
  : {})
```

### Building with Notarization

To build a notarized DMG:

```bash
cd desktop
APPLE_ID="your@email.com" \
APPLE_ID_PASSWORD="your-app-specific-password" \
npm run make
```

Recommended (fails fast if notarization is skipped and validates Gatekeeper/stapling):

```bash
cd desktop
APPLE_ID="your@email.com" \
APPLE_ID_PASSWORD="your-app-specific-password" \
npm run make:release
```

**Notes**:
- Notarization only happens when both `APPLE_ID` and `APPLE_ID_PASSWORD` env vars are set
- Use an [app-specific password](https://support.apple.com/en-us/HT204397) generated from appleid.apple.com, not your Apple ID password
- Code signing happens automatically using the certificate in your Keychain
- The notarization process can take 5-15 minutes

### Building Without Notarization

For local testing or builds that don't need to be distributed:

```bash
cd desktop
npm run package  # Creates app bundle without DMG
# or
npm run make     # Creates DMG without notarization
```

## Entitlements

The app requires specific macOS entitlements for meeting recording functionality. These are defined in `desktop/Entitlements.plist`:

- `com.apple.security.device.microphone` - Microphone access for audio recording
- `com.apple.security.device.camera` - Camera access for video meetings
- `com.apple.security.screen-capture` - Screen recording during meetings

The app also declares usage descriptions in `forge.config.js` under `extendInfo`:
- `NSMicrophoneUsageDescription`
- `NSCameraUsageDescription`
- `NSScreenCaptureUsageDescription`

## Output Artifacts

Built artifacts are created in:
- `desktop/out/` - Packaged app bundles
- `desktop/out/make/` - DMG installers (when using `npm run make`)

## Dependencies & Special Handling

The app uses native modules that require special bundling configuration:

**Unpacked ASAR modules** (`forge.config.js`):
```javascript
asar: {
  unpackDir: "{node_modules/@recallai,node_modules/keytar}",
}
```

**External modules** (not bundled by webpack):
```javascript
{
  name: "@timfish/forge-externals-plugin",
  config: {
    externals: ["@recallai/desktop-sdk", "keytar"],
    includeDeps: true,
  },
}
```

These configurations ensure native dependencies like the Recall.ai SDK and keytar work correctly in the packaged app.

## Troubleshooting

**Code signing fails**:
- Verify your Developer ID Application certificate is installed in Keychain
- Check certificate isn't expired
- Ensure identity matches exactly what's in `forge.config.js`

**Notarization fails**:
- Verify Apple ID and app-specific password are correct
- Check [Apple's notarization history](https://developer.apple.com/account/resources/notarization-history) for error details
- Ensure all entitlements are properly declared
- Wait 5-15 minutes - notarization is not instant

**Apple says "could not verify free of malware"**:
- This means the app is signed but not notarized/stapled.
- Run:
  - `spctl -a -vv --type execute desktop/out/UpSight-darwin-arm64/UpSight.app`
  - `xcrun stapler validate desktop/out/UpSight-darwin-arm64/UpSight.app`
- Use `npm run make:release` from `desktop/` to force notarization credentials and fail the build if notarization is skipped.

**App won't launch after build**:
- Check that native modules are properly unpacked (see ASAR configuration)
- Verify entitlements allow necessary permissions
- Check Console.app for crash logs

## Related Documentation

- [Electron Forge Documentation](https://www.electronforge.io/)
- [Apple Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [Notarization Process](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
