const {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  Notification,
  shell,
  Menu,
} = require("electron");
const path = require("node:path");
const url = require("url");
const fs = require("fs");
// Enable verbose SDK logging (SDK binary output is suppressed without this)
process.env.RECALLAI_DESKTOP_SDK_DEV = "1";
const RecallAiSdk = require("@recallai/desktop-sdk");
const axios = require("axios");
const OpenAI = require("openai");
const sdkLogger = require("./sdk-logger");

// Global error handlers to prevent crashes
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error.message);
  console.error("Stack:", error.stack);
  // Don't crash for EPIPE errors (SDK process died)
  if (error.code === "EPIPE") {
    console.log(
      "EPIPE error - SDK process may have died, attempting recovery...",
    );
    return;
  }
});

process.on("unhandledRejection", (reason, promise) => {
  const msg =
    reason instanceof Error
      ? `${reason.message}\n${reason.stack}`
      : typeof reason === "string"
        ? reason
        : JSON.stringify(reason);
  console.error("Unhandled Rejection:", msg);
});

// Load .env from project root (process.cwd() works better with webpack)
const envPath = path.join(process.cwd(), ".env");
require("dotenv").config({ path: envPath });
console.log("Loading .env from:", envPath);
console.log(
  "UPSIGHT_API_URL:",
  process.env.UPSIGHT_API_URL || "(not set, using default)",
);

const auth = require("./auth");

// File-based logging for DMG debugging (console.log not visible in packaged app)
const LOG_FILE = path.join(app.getPath("userData"), "upsight-debug.log");
const _origLog = console.log;
const _origError = console.error;
const _origWarn = console.warn;
function fileLog(level, ...args) {
  const msg = args
    .map((a) =>
      typeof a === "object" ? JSON.stringify(a, null, 2) : String(a),
    )
    .join(" ");
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (_) {}
}
console.log = (...args) => {
  _origLog(...args);
  fileLog("LOG", ...args);
};
console.error = (...args) => {
  _origError(...args);
  fileLog("ERR", ...args);
};
console.warn = (...args) => {
  _origWarn(...args);
  fileLog("WARN", ...args);
};
// Truncate log file on startup
try {
  fs.writeFileSync(
    LOG_FILE,
    `--- UpSight started at ${new Date().toISOString()} ---\n`,
  );
} catch (_) {}
console.log("Log file:", LOG_FILE);

// Define available models with their capabilities
const MODELS = {
  // Primary models
  PRIMARY: "openai/gpt-4o-mini",
  FALLBACKS: [],
};

// Lazy-initialized OpenAI client for local AI features (optional)
let _openai = null;
function getOpenAIClient() {
  if (!_openai) {
    const apiKey = process.env.OPENROUTER_KEY;
    if (!apiKey) {
      console.warn("OPENROUTER_KEY not set - local AI features disabled");
      return null;
    }
    _openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://getupsight.com",
        "X-Title": "UpSight",
      },
    });
  }
  return _openai;
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

// Store detected meeting information
let detectedMeeting = null;
// Track window IDs that have already been recorded, to suppress re-detection
const recordedWindowIds = new Set();

let mainWindow;
let floatingPanelWindow = null;

/**
 * Create the floating panel window (separate always-on-top window)
 */
function createFloatingPanelWindow() {
  console.log("createFloatingPanelWindow called");
  if (floatingPanelWindow) {
    console.log("Reusing existing floating panel window");
    floatingPanelWindow.show();
    return floatingPanelWindow;
  }
  console.log("Creating new floating panel window");

  floatingPanelWindow = new BrowserWindow({
    width: 320,
    height: 400,
    x: 100,
    y: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the floating panel using webpack entry
  console.log(
    "FLOATING_PANEL_WEBPACK_ENTRY:",
    typeof FLOATING_PANEL_WEBPACK_ENTRY !== "undefined"
      ? FLOATING_PANEL_WEBPACK_ENTRY
      : "NOT DEFINED",
  );
  if (typeof FLOATING_PANEL_WEBPACK_ENTRY !== "undefined") {
    floatingPanelWindow.loadURL(FLOATING_PANEL_WEBPACK_ENTRY);
  } else {
    console.error(
      "FLOATING_PANEL_WEBPACK_ENTRY is not defined - check forge.config.js",
    );
    // Fallback to file path for development
    floatingPanelWindow.loadFile(
      require("path").join(__dirname, "../src/floating-panel.html"),
    );
  }

  floatingPanelWindow.on("closed", () => {
    floatingPanelWindow = null;
  });

  return floatingPanelWindow;
}

/**
 * Show the floating panel (for meetings)
 */
function showFloatingPanel() {
  console.log("showFloatingPanel called");
  try {
    const panel = createFloatingPanelWindow();
    panel.show();
    console.log("Floating panel shown successfully");
    // Optionally hide main window
    if (mainWindow) {
      mainWindow.hide();
      console.log("Main window hidden");
    }
  } catch (error) {
    console.error("Error showing floating panel:", error);
  }
}

/**
 * Hide the floating panel and close the session
 * The main window stays hidden - app runs in background
 */
function hideFloatingPanel() {
  if (floatingPanelWindow) {
    floatingPanelWindow.close();
    floatingPanelWindow = null;
  }
  // Don't show the main window - keep app running in background
  // User can access via menu bar or when a new meeting is detected
  console.log("Floating panel closed - app running in background");
}

/**
 * Show the meetings archive in the main window
 */
function showMeetingsArchive() {
  console.log("Showing meetings archive");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    // Navigate to meetings view
    mainWindow.webContents.send("navigate", "meetings");
  }
}

const createWindow = async () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false, // Start hidden - only show floating panel when meeting detected
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f9f9f9",
  });

  // Allow the debug panel header to act as a drag region
  mainWindow.on("ready-to-show", () => {
    try {
      // Set regions that can be used to drag the window
      if (process.platform === "darwin") {
        // Only needed on macOS
        mainWindow.setWindowButtonVisibility(true);
      }
    } catch (error) {
      console.error("Error setting drag regions:", error);
    }
  });

  // Check if user is authenticated
  const isLoggedIn = await auth.isAuthenticated();

  if (isLoggedIn) {
    // Load the main app
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  } else {
    // Load the login page
    mainWindow.loadURL(LOGIN_WEBPACK_ENTRY);
  }

  // Open the DevTools in development
  if (process.env.NODE_ENV === "development") {
    // mainWindow.webContents.openDevTools();
  }

  // Listen for navigation events
  ipcMain.on("navigate", (event, page) => {
    if (page === "note-editor") {
      mainWindow.loadURL(
        MAIN_WINDOW_WEBPACK_ENTRY + "/../note-editor/index.html",
      );
    } else if (page === "home") {
      mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
    }
  });
};

// Register custom protocol for OAuth callback
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("upsight", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("upsight");
}

// Handle protocol on macOS
app.on("open-url", async (event, url) => {
  event.preventDefault();
  await handleOAuthCallback(url);
});

// OAuth callback handler
async function handleOAuthCallback(callbackUrl) {
  console.log("OAuth callback received:", callbackUrl);

  try {
    const urlObj = new URL(callbackUrl);

    // Check for code in query params (PKCE flow)
    const code = urlObj.searchParams.get("code");

    // Check for tokens in hash fragment (implicit flow)
    // Hash fragment comes after # and needs to be parsed manually
    const hashParams = new URLSearchParams(urlObj.hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (code) {
      console.log("Exchanging code for session...");
      await auth.exchangeCodeForSession(code);
      // Navigate to main app
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
      }
    } else if (accessToken && refreshToken) {
      console.log("Setting session from tokens...");
      try {
        const result = await auth.setSessionFromTokens(
          accessToken,
          refreshToken,
        );
        console.log("Session set successfully for user:", result.user?.email);
        // Navigate to main app
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log("Navigating to main window...");
          mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
          mainWindow.focus();

          // Show notification that login was successful
          const userName =
            result.user?.user_metadata?.full_name ||
            result.user?.user_metadata?.name ||
            result.user?.email;
          new Notification({
            title: "Signed in successfully",
            body: `Welcome${userName ? `, ${userName}` : ""}! You can close the browser tab.`,
          }).show();
        } else {
          console.error("mainWindow not available for navigation");
        }
      } catch (sessionError) {
        console.error("Failed to set session from tokens:", sessionError);
      }
    } else {
      console.error("OAuth callback missing code or tokens:", callbackUrl);
    }
  } catch (error) {
    console.error("OAuth callback error:", error);
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set up application menu with Meetings archive
  const menuTemplate = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Meetings",
      submenu: [
        {
          label: "View Past Meetings",
          accelerator: "CmdOrCtrl+M",
          click: () => {
            showMeetingsArchive();
          },
        },
        { type: "separator" },
        {
          label: "Open Meetings Folder",
          click: () => {
            shell.openPath(path.join(app.getPath("userData"), "meetings.json"));
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        {
          label: "Show Main Window",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show();
              mainWindow.focus();
            }
          },
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  console.log("Registering IPC handlers...");
  // Log all registered IPC handlers
  console.log("IPC handlers:", Object.keys(ipcMain._invokeHandlers));

  // Set up SDK logger IPC handlers
  ipcMain.on("sdk-log", (event, logEntry) => {
    // Forward logs from renderer to any open windows
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("sdk-log", logEntry);
    }
  });

  // Set up logger event listener to send logs from main to renderer
  sdkLogger.onLog((logEntry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("sdk-log", logEntry);
    }
  });

  // Auth handlers
  ipcMain.handle("login", async (event, email, password) => {
    try {
      const result = await auth.login(email, password);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("loginWithGoogle", async () => {
    try {
      // Start OAuth flow with local callback server
      const { authUrl, callbackPromise } = await auth.performOAuthFlow();

      // Open browser with OAuth URL
      shell.openExternal(authUrl);

      // Wait for callback (this will resolve when user completes auth)
      const result = await callbackPromise;

      // Handle the result
      if (result.code) {
        // PKCE flow - exchange code for session
        console.log("Exchanging OAuth code for session...");
        const sessionResult = await auth.exchangeCodeForSession(result.code);
        console.log(
          "OAuth login successful for user:",
          sessionResult.user?.email,
        );

        // Navigate to main app
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
          mainWindow.focus();
        }

        return { success: true, user: sessionResult.user };
      } else if (result.accessToken) {
        // Implicit flow - set session from tokens
        console.log("Setting session from OAuth tokens...");
        const sessionResult = await auth.setSessionFromTokens(
          result.accessToken,
          result.refreshToken,
        );
        console.log(
          "OAuth login successful for user:",
          sessionResult.user?.email,
        );

        // Navigate to main app
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
          mainWindow.focus();
        }

        return { success: true, user: sessionResult.user };
      } else {
        throw new Error("No auth code or tokens received");
      }
    } catch (error) {
      console.error("Google OAuth error:", error);
      auth.stopCallbackServer(); // Clean up on error
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("getAuthStatus", async () => {
    const isLoggedIn = await auth.isAuthenticated();
    const user = await auth.getCurrentUser();
    return { isLoggedIn, user };
  });

  ipcMain.handle("logout", async () => {
    await auth.clearSession();
    // Clear cached user context
    userContext = null;
    // Reload to login page
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(LOGIN_WEBPACK_ENTRY);
    }
    return { success: true };
  });

  ipcMain.handle("getAccessToken", async () => {
    return await auth.getAccessToken();
  });

  ipcMain.handle("getUserContext", async () => {
    try {
      const context = await getUserContext();
      return { success: true, data: context };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("navigateToHome", async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
    }
    return { success: true };
  });

  // Create recordings directory if it doesn't exist
  try {
    if (!fs.existsSync(RECORDING_PATH)) {
      fs.mkdirSync(RECORDING_PATH, { recursive: true });
    }
  } catch (e) {
    console.error("Couldn't create the recording path:", e);
  }

  // Create meetings file if it doesn't exist
  try {
    if (!fs.existsSync(meetingsFilePath)) {
      const initialData = { upcomingMeetings: [], pastMeetings: [] };
      fs.writeFileSync(meetingsFilePath, JSON.stringify(initialData, null, 2));
    }
  } catch (e) {
    console.error("Couldn't create the meetings file:", e);
  }

  // Initialize the Recall.ai SDK
  initSDK();

  createWindow();

  // When the window is ready, send the initial meeting detection status
  mainWindow.webContents.on("did-finish-load", () => {
    // Send the initial meeting detection status
    mainWindow.webContents.send("meeting-detection-status", {
      detected: detectedMeeting !== null,
    });
  });

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// Path to meetings data file in the user's Application Support directory
const meetingsFilePath = path.join(app.getPath("userData"), "meetings.json");

// Path for RecallAI SDK recordings
const RECORDING_PATH = path.join(app.getPath("userData"), "recordings");

// Global state to track active recordings
const activeRecordings = {
  // Map of recordingId -> {noteId, platform, state}
  recordings: {},

  // Register a new recording
  addRecording: function (recordingId, noteId, platform = "unknown") {
    this.recordings[recordingId] = {
      noteId,
      platform,
      state: "recording",
      startTime: new Date(),
    };
    console.log(
      `Recording registered in global state: ${recordingId} for note ${noteId}`,
    );
  },

  // Update a recording's state
  updateState: function (recordingId, state) {
    if (this.recordings[recordingId]) {
      this.recordings[recordingId].state = state;
      console.log(`Recording ${recordingId} state updated to: ${state}`);
      return true;
    }
    return false;
  },

  // Remove a recording
  removeRecording: function (recordingId) {
    if (this.recordings[recordingId]) {
      delete this.recordings[recordingId];
      console.log(`Recording ${recordingId} removed from global state`);
      return true;
    }
    return false;
  },

  // Get active recording for a note
  getForNote: function (noteId) {
    for (const [recordingId, info] of Object.entries(this.recordings)) {
      if (info.noteId === noteId) {
        return { recordingId, ...info };
      }
    }
    return null;
  },

  // Get all active recordings
  getAll: function () {
    return { ...this.recordings };
  },
};

// File operation manager to prevent race conditions on both reads and writes
const fileOperationManager = {
  isProcessing: false,
  pendingOperations: [],
  cachedData: null,
  lastReadTime: 0,

  // Read the meetings data with caching to reduce file I/O
  readMeetingsData: async function () {
    // If we have cached data that's recent (less than 500ms old), use it
    const now = Date.now();
    if (this.cachedData && now - this.lastReadTime < 500) {
      return JSON.parse(JSON.stringify(this.cachedData)); // Deep clone
    }

    try {
      // Read from file
      const fileData = await fs.promises.readFile(meetingsFilePath, "utf8");
      const data = JSON.parse(fileData);

      // Update cache
      this.cachedData = data;
      this.lastReadTime = now;

      return data;
    } catch (error) {
      console.error("Error reading meetings data:", error);
      // If file doesn't exist or is invalid, return empty structure
      return { upcomingMeetings: [], pastMeetings: [] };
    }
  },

  // Schedule an operation that needs to update the meetings data
  scheduleOperation: async function (operationFn) {
    return new Promise((resolve, reject) => {
      // Add this operation to the queue
      this.pendingOperations.push({
        operationFn, // This function will receive the current data and return updated data
        resolve,
        reject,
      });

      // Process the queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  },

  // Process the operation queue sequentially
  processQueue: async function () {
    if (this.pendingOperations.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get the next operation
      const nextOp = this.pendingOperations.shift();

      // Read the latest data
      const currentData = await this.readMeetingsData();

      try {
        // Execute the operation function with the current data
        const updatedData = await nextOp.operationFn(currentData);

        // If the operation returned data, write it
        if (updatedData) {
          // Update cache immediately
          this.cachedData = updatedData;
          this.lastReadTime = Date.now();

          // Write to file
          await fs.promises.writeFile(
            meetingsFilePath,
            JSON.stringify(updatedData, null, 2),
          );
        }

        // Resolve the operation's promise
        nextOp.resolve({ success: true });
      } catch (opError) {
        console.error("Error in file operation:", opError);
        nextOp.reject(opError);
      }
    } catch (error) {
      console.error("Error in file operation manager:", error);

      // If there was an operation that failed, reject its promise
      if (this.pendingOperations.length > 0) {
        const failedOp = this.pendingOperations.shift();
        failedOp.reject(error);
      }
    } finally {
      this.isProcessing = false;

      // Check if more operations were added while we were processing
      if (this.pendingOperations.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  },

  // Helper to write data directly - internally uses scheduleOperation
  writeData: async function (data) {
    return this.scheduleOperation(() => data); // Simply return the data to write
  },
};

// UpSight API configuration
const UPSIGHT_API_URL = process.env.UPSIGHT_API_URL || "https://getupsight.com";

// Get or create user context (account/project selection)
let userContext = null;

async function getUserContext() {
  if (userContext) return userContext;

  try {
    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
      console.log("No access token available for user context");
      return null;
    }

    const response = await axios.get(`${UPSIGHT_API_URL}/api/desktop/context`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 10000,
    });

    userContext = response.data;
    console.log("User context loaded:", {
      defaultAccountId: userContext.default_account_id,
      defaultProjectId: userContext.default_project_id,
    });

    return userContext;
  } catch (error) {
    console.error("Error fetching user context:", error.message);
    return null;
  }
}

// Create a desktop SDK upload token via UpSight backend
async function createDesktopSdkUpload() {
  try {
    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
      console.log("No access token available, skipping upload token request");
      return null;
    }

    // Get user context for account/project IDs
    const context = await getUserContext();
    if (!context) {
      console.log("No user context available, skipping upload token request");
      return null;
    }

    // Request upload token from UpSight backend
    const response = await axios.post(
      `${UPSIGHT_API_URL}/api/desktop/recall-token`,
      {
        account_id: context.default_account_id,
        project_id: context.default_project_id,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    if (!response.data.upload_token) {
      console.error("Failed to create upload token: no token in response");
      return null;
    }

    console.log(
      "Upload token created successfully:",
      response.data.upload_token.substring(0, 8) + "...",
    );

    return {
      status: "success",
      upload_token: response.data.upload_token,
      metadata: response.data.metadata,
    };
  } catch (error) {
    console.error(
      "Error creating upload token:",
      error.response?.data?.error || error.message,
    );
    if (error.response) {
      console.error("Response status:", error.response.status);
    }
    return null;
  }
}

// Create an interview record in the UpSight backend
async function createInterviewRecord(
  meetingTitle,
  platformName,
  desktopMeetingId,
) {
  try {
    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
      console.log("No access token available, skipping interview creation");
      return null;
    }

    const context = await getUserContext();
    if (!context) {
      console.log("No user context available, skipping interview creation");
      return null;
    }

    console.log("Creating interview record for:", meetingTitle);

    const response = await axios.post(
      `${UPSIGHT_API_URL}/api/desktop/interviews`,
      {
        account_id: context.default_account_id,
        project_id: context.default_project_id,
        title: meetingTitle,
        platform: platformName,
        desktop_meeting_id: desktopMeetingId,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    if (response.data.success) {
      console.log(
        "Interview record created:",
        response.data.interview_id,
        response.data.action,
      );
      return response.data;
    } else {
      console.error("Failed to create interview:", response.data.error);
      return null;
    }
  } catch (error) {
    console.error(
      "Error creating interview:",
      error.response?.data?.error || error.message,
    );
    return null;
  }
}

// Initialize the Recall.ai SDK
function initSDK() {
  const { systemPreferences } = require("electron");

  // Check and request accessibility BEFORE SDK init
  // This registers UpSight.app (not the SDK binary) with macOS TCC
  const isTrusted = systemPreferences.isTrustedAccessibilityClient(true);
  console.log("Accessibility trusted:", isTrusted);
  if (!isTrusted) {
    console.warn(
      "Accessibility NOT granted - macOS should have shown a prompt. " +
        "Please grant Accessibility permission to UpSight in System Settings.",
    );
  }

  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("Initializing Recall.ai SDK");
  console.log(
    "  RECALLAI_API_URL:",
    process.env.RECALLAI_API_URL || "(not set)",
  );
  console.log("  RECORDING_PATH:", RECORDING_PATH);
  console.log("  NODE_ENV:", process.env.NODE_ENV);
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );

  // Log the SDK initialization
  sdkLogger.logApiCall("init", {
    dev: process.env.NODE_ENV === "development",
    api_url: process.env.RECALLAI_API_URL,
    config: {
      recording_path: RECORDING_PATH,
    },
  });

  RecallAiSdk.init({
    api_url: process.env.RECALLAI_API_URL,
    acquirePermissionsOnStartup: ["accessibility", "screen-capture"],
    config: {
      recording_path: RECORDING_PATH,
    },
  })
    .then(() => {
      console.log("SDK init() resolved successfully");
    })
    .catch((err) => {
      console.error(
        "SDK init() FAILED:",
        err instanceof Error ? err.message : JSON.stringify(err),
      );
      // Try requesting permissions manually as fallback
      console.log("Requesting permissions manually...");
      RecallAiSdk.requestPermission("accessibility").catch((e) =>
        console.error(
          "requestPermission(accessibility) failed:",
          e?.message || e,
        ),
      );
      RecallAiSdk.requestPermission("screen-capture").catch((e) =>
        console.error(
          "requestPermission(screen-capture) failed:",
          e?.message || e,
        ),
      );
    });

  console.log("SDK init() called - listening for meeting-detected events...");

  // Listen for meeting detected events
  RecallAiSdk.addEventListener("meeting-detected", (evt) => {
    console.log("Meeting detected:", evt);

    // Log the meeting detected event
    sdkLogger.logEvent("meeting-detected", {
      platform: evt.window.platform,
      windowId: evt.window.id,
    });

    detectedMeeting = evt;

    // Suppress notification for meetings we already recorded (user can still re-record)
    if (recordedWindowIds.has(evt.window.id)) {
      console.log(
        `Meeting re-detected after recording (suppressing notification): ${evt.window.id}`,
      );
      return;
    }

    // Map platform codes to readable names
    const platformNames = {
      zoom: "Zoom",
      "google-meet": "Google Meet",
      slack: "Slack",
      teams: "Microsoft Teams",
    };

    // Get a user-friendly platform name, or use the raw platform name if not in our map
    const platformName =
      platformNames[evt.window.platform] || evt.window.platform;

    // Send a notification
    let notification = new Notification({
      title: `${platformName} Meeting Detected`,
      body: platformName,
    });

    // Handle notification click
    notification.on("click", () => {
      console.log("Notification clicked for platform:", platformName);
      joinDetectedMeeting();
    });

    notification.show();

    // Show the floating panel when meeting is detected
    showFloatingPanel();

    // Send the meeting detected status to the renderer process
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("meeting-detection-status", {
        detected: true,
      });
    }
  });

  // Listen for meeting updated events (to capture title and URL)
  // NOTE: meeting-detected events do NOT guarantee title and URL will be populated.
  // The meeting title and URL are only reliably available in meeting-updated events,
  // which fire as the meeting metadata becomes available after initial detection.
  RecallAiSdk.addEventListener("meeting-updated", async (evt) => {
    console.log("Meeting updated:", evt);

    const { window } = evt;

    // Log the meeting updated event with the URL for tracking purposes
    sdkLogger.logEvent("meeting-updated", {
      platform: window.platform,
      windowId: window.id,
      title: window.title,
      url: window.url,
    });

    // Update the detectedMeeting object with the new information
    if (detectedMeeting && detectedMeeting.window.id === window.id) {
      detectedMeeting = {
        ...detectedMeeting,
        window: {
          ...detectedMeeting.window,
          title: window.title,
          url: window.url,
        },
      };

      console.log("Updated meeting title:", window.title);

      // If a note has already been created for this meeting, update its title retroactively
      if (
        window.title &&
        global.activeMeetingIds &&
        global.activeMeetingIds[window.id]
      ) {
        const noteId = global.activeMeetingIds[window.id].noteId;

        if (noteId) {
          console.log("Updating existing note title for:", noteId);

          try {
            // Read the current meetings data
            const meetingsData = await fileOperationManager.readMeetingsData();

            // Find the meeting in pastMeetings
            const meeting = meetingsData.pastMeetings.find(
              (m) => m.id === noteId,
            );

            if (meeting) {
              const oldTitle = meeting.title;

              // Update the title
              meeting.title = window.title;

              // Save the updated data
              await fileOperationManager.writeData(meetingsData);
              console.log(
                `Successfully updated meeting title from "${oldTitle}" to "${window.title}"`,
              );

              // Notify the renderer to update the UI
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("meeting-title-updated", {
                  meetingId: noteId,
                  newTitle: window.title,
                });
              }
            } else {
              console.error(
                "Meeting not found in pastMeetings with ID:",
                noteId,
              );
            }
          } catch (error) {
            console.error("Error updating meeting title:", error);
          }
        }
      }
    }
  });

  // Listen for meeting closed events
  RecallAiSdk.addEventListener("meeting-closed", (evt) => {
    console.log("Meeting closed:", evt);

    // Log the SDK meeting-closed event
    sdkLogger.logEvent("meeting-closed", {
      windowId: evt.window.id,
    });

    // Do NOT delete activeMeetingIds here — recording-ended fires AFTER meeting-closed
    // and needs the noteId, interviewId, and interviewPromise data.
    // Cleanup is done in recording-ended after finalize/upload complete.
    console.log(
      `[meeting-closed] Window ${evt.window.id} — preserving activeMeetingIds for recording-ended`,
    );

    detectedMeeting = null;
    // Clean up recorded window tracking so future meetings in this window can be detected
    recordedWindowIds.delete(evt.window.id);

    // Send the meeting closed status to the renderer process
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("meeting-detection-status", {
        detected: false,
      });
    }
  });

  // Listen for recording ended events
  RecallAiSdk.addEventListener("recording-ended", async (evt) => {
    console.log("Recording ended:", evt);

    // Do NOT null detectedMeeting — user may still be in the meeting and want to re-record.
    // detectedMeeting is only nulled in meeting-closed (when the meeting window actually closes).

    // Log the SDK recording-ended event
    sdkLogger.logEvent("recording-ended", {
      windowId: evt.window.id,
    });

    // Get noteId and interviewId before any cleanup
    let noteId = null;
    let interviewId = null;
    const windowId = evt.window?.id;

    console.log(`[recording-ended] Window ID: ${windowId}`);
    console.log(
      `[recording-ended] activeMeetingIds keys:`,
      global.activeMeetingIds ? Object.keys(global.activeMeetingIds) : "none",
    );

    const meetingInfo =
      windowId && global.activeMeetingIds?.[windowId]
        ? global.activeMeetingIds[windowId]
        : null;

    if (meetingInfo) {
      noteId = meetingInfo.noteId;
      interviewId = meetingInfo.interviewId;
      console.log(
        `[recording-ended] Found meetingInfo: noteId=${noteId}, interviewId=${interviewId}, hasPromise=${!!meetingInfo.interviewPromise}`,
      );

      // If interviewId not yet set, await the creation promise (race condition fix)
      if (!interviewId && meetingInfo.interviewPromise) {
        console.log(
          "[recording-ended] interviewId not set yet, awaiting creation promise...",
        );
        try {
          interviewId = await meetingInfo.interviewPromise;
          console.log(
            `[recording-ended] Got interviewId from promise: ${interviewId}`,
          );
        } catch (e) {
          console.error(
            "[recording-ended] Interview creation promise failed:",
            e,
          );
        }
      }
    } else {
      console.log(
        `[recording-ended] No meetingInfo found for window ${windowId}`,
      );
    }

    try {
      // Update the note with recording information
      await updateNoteWithRecordingInfo(evt.window.id);

      // Read meeting data once for both finalize and upload
      let meeting = null;
      if (noteId) {
        try {
          const fileData = await fs.promises.readFile(meetingsFilePath, "utf8");
          const meetingsData = JSON.parse(fileData);
          meeting = meetingsData.pastMeetings.find((m) => m.id === noteId);
        } catch (readErr) {
          console.error(
            "[recording-ended] Error reading meeting data:",
            readErr,
          );
        }
      }

      // Finalize the interview in the backend (create tasks, save transcript)
      if (noteId && interviewId && meeting && meeting.transcript) {
        const formattedTranscript = meeting.transcript.map((t) => ({
          speaker: t.speaker,
          text: t.text,
          timestamp_ms: t.timestamp
            ? new Date(t.timestamp).getTime()
            : undefined,
        }));

        let durationSeconds = null;
        if (meeting.date) {
          const startTime = new Date(meeting.date).getTime();
          durationSeconds = Math.round((Date.now() - startTime) / 1000);
        }

        finalizeInterview(
          noteId,
          interviewId,
          formattedTranscript,
          durationSeconds,
          meeting.platform || null,
        )
          .then((result) => {
            if (result) {
              console.log(
                `[recording-ended] Finalized interview: ${result.results?.tasks_created || 0} tasks created`,
              );
            }
          })
          .catch((err) =>
            console.error("[recording-ended] Finalization error:", err),
          );
      }

      // Upload recording file to our Cloudflare R2 storage
      if (interviewId) {
        // Recording file uses meeting.recordingId, NOT the window ID
        const recordingFileId =
          (meeting && meeting.recordingId) || evt.window.id;
        if (meeting && meeting.recordingId) {
          console.log(
            `[recording-ended] Using recordingId ${recordingFileId} for file lookup (window: ${evt.window.id})`,
          );
        }

        setTimeout(async () => {
          try {
            await uploadRecordingToR2(recordingFileId, interviewId);
          } catch (uploadError) {
            console.error("[recording-ended] R2 upload error:", uploadError);
          }
        }, 3000); // Wait 3 seconds for file system to settle
      } else {
        console.log("[recording-ended] No interviewId, skipping R2 upload");
      }
    } catch (error) {
      console.error("Error handling recording ended:", error);
    }

    // Clean up activeMeetingIds and evidence state now that recording-ended is done
    if (windowId && global.activeMeetingIds?.[windowId]) {
      const cleanupNoteId = global.activeMeetingIds[windowId].noteId;
      if (cleanupNoteId) {
        evidenceExtractionState.cleanup(cleanupNoteId);
      }
      delete global.activeMeetingIds[windowId];
      console.log(
        `[recording-ended] Cleaned up activeMeetingIds for window ${windowId}`,
      );
    }

    // Allow re-recording in this window — remove from recorded set
    // (meeting-closed already deleted it, but recording-ended re-added it at the top)
    if (windowId) {
      recordedWindowIds.delete(windowId);
    }
  });

  RecallAiSdk.addEventListener("permissions-granted", async (evt) => {
    console.log("PERMISSIONS GRANTED");
  });

  // Track upload progress
  RecallAiSdk.addEventListener("upload-progress", async (evt) => {
    const { progress, window } = evt;
    console.log(`Upload progress: ${progress}%`);

    // Log the SDK upload-progress event
    // sdkLogger.logEvent('upload-progress', {
    //   windowId: window.id,
    //   progress
    // });

    // Update the note with upload progress if needed
    if (progress === 100) {
      console.log(`Upload completed for recording: ${window.id}`);
      // Could update the note here with upload completion status
    }
  });

  // Track SDK state changes
  RecallAiSdk.addEventListener("sdk-state-change", async (evt) => {
    const {
      sdk: {
        state: { code },
      },
      window,
    } = evt;
    console.log("Recording state changed:", code, "for window:", window?.id);

    // Log the SDK sdk-state-change event
    sdkLogger.logEvent("sdk-state-change", {
      state: code,
      windowId: window?.id,
    });

    // Update recording state in our global tracker
    if (window && window.id) {
      // Get the meeting note ID associated with this window
      let noteId = null;
      if (global.activeMeetingIds && global.activeMeetingIds[window.id]) {
        noteId = global.activeMeetingIds[window.id].noteId;
      }

      // Update the recording state in our tracker
      if (code === "recording") {
        console.log("Recording in progress...");
        if (noteId) {
          // If recording started, add it to our active recordings
          activeRecordings.addRecording(
            window.id,
            noteId,
            window.platform || "unknown",
          );
        }
      } else if (code === "paused") {
        console.log("Recording paused");
        activeRecordings.updateState(window.id, "paused");
      } else if (code === "idle") {
        console.log("Recording stopped");
        activeRecordings.removeRecording(window.id);
      }

      // Notify renderer process about recording state change
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("recording-state-change", {
          recordingId: window.id,
          state: code,
          noteId,
        });
      }

      // Also notify floating panel
      const isRecording = code === "recording";
      sendRecordingStateToPanel(isRecording, isRecording ? Date.now() : null);
    }
  });

  // Listen for real-time transcript events
  RecallAiSdk.addEventListener("realtime-event", async (evt) => {
    // Only log non-video frame events to prevent flooding the logger
    if (evt.event !== "video_separate_png.data") {
      console.log("Received realtime event:", evt.event);

      // Log the SDK realtime-event event
      sdkLogger.logEvent("realtime-event", {
        eventType: evt.event,
        windowId: evt.window?.id,
      });
    }

    // Handle different event types
    if (evt.event === "transcript.data" && evt.data && evt.data.data) {
      await processTranscriptData(evt);
    } else if (
      evt.event === "transcript.provider_data" &&
      evt.data &&
      evt.data.data
    ) {
      await processTranscriptProviderData(evt);
    } else if (
      evt.event === "participant_events.join" &&
      evt.data &&
      evt.data.data
    ) {
      await processParticipantJoin(evt);
    } else if (
      evt.event === "video_separate_png.data" &&
      evt.data &&
      evt.data.data
    ) {
      await processVideoFrame(evt);
    }
  });

  // Handle errors
  RecallAiSdk.addEventListener("error", async (evt) => {
    console.error("RecallAI SDK Error:", evt);
    const { type, message } = evt;

    // Log the SDK error event
    sdkLogger.logEvent("error", {
      errorType: type,
      errorMessage: message,
    });

    // Only show notification for non-process errors
    if (type !== "process") {
      let notification = new Notification({
        title: "Recording Error",
        body: `Error: ${type} - ${message}`,
      });
      notification.show();
    }
  });

  // Handle SDK shutdown (process died)
  RecallAiSdk.addEventListener("shutdown", async (evt) => {
    console.log("RecallAI SDK shutdown event:", evt);
    if (evt.code !== 0) {
      console.error(
        `SDK process exited unexpectedly with code ${evt.code}, signal ${evt.signal}`,
      );
      // The SDK has restartOnError: true by default, so it should auto-restart
    }
  });

  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("SDK event listeners registered. Watching for meetings...");
  console.log("Supported platforms: Zoom, Google Meet, Slack, Microsoft Teams");
  console.log(
    "NOTE: Safari may NOT be supported - use Chrome for best results",
  );
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
}

// Handle saving meetings data
ipcMain.handle("saveMeetingsData", async (event, data) => {
  try {
    // Use the file operation manager to safely write the file
    await fileOperationManager.writeData(data);
    return { success: true };
  } catch (error) {
    console.error("Failed to save meetings data:", error);
    return { success: false, error: error.message };
  }
});

// Debug handler to check if IPC handlers are registered
ipcMain.handle("debugGetHandlers", async () => {
  console.log("Checking registered IPC handlers...");
  const handlers = Object.keys(ipcMain._invokeHandlers);
  console.log("Registered handlers:", handlers);
  return handlers;
});

// Debug handler to dump all visible applications (for troubleshooting meeting detection)
ipcMain.handle("debugDumpApplications", async () => {
  console.log("[DEBUG] Manual dump of visible applications requested...");
  try {
    const apps = await RecallAiSdk.dumpAllApplications();
    console.log("[DEBUG] Visible applications:", JSON.stringify(apps, null, 2));
    return { success: true, applications: apps };
  } catch (err) {
    console.error("[DEBUG] Failed to dump applications:", err.message);
    return { success: false, error: err.message };
  }
});

// Handler to get active recording ID for a note
ipcMain.handle("getActiveRecordingId", async (event, noteId) => {
  console.log(`getActiveRecordingId called for note: ${noteId}`);

  try {
    // If noteId is provided, get recording for that specific note
    if (noteId) {
      const recordingInfo = activeRecordings.getForNote(noteId);
      return {
        success: true,
        data: recordingInfo,
      };
    }

    // Otherwise return all active recordings
    return {
      success: true,
      data: activeRecordings.getAll(),
    };
  } catch (error) {
    console.error("Error getting active recording ID:", error);
    return { success: false, error: error.message };
  }
});

// Handle deleting a meeting
ipcMain.handle("deleteMeeting", async (event, meetingId) => {
  try {
    console.log(`Deleting meeting with ID: ${meetingId}`);

    // Read current data
    const fileData = await fs.promises.readFile(meetingsFilePath, "utf8");
    const meetingsData = JSON.parse(fileData);

    // Find the meeting
    const pastMeetingIndex = meetingsData.pastMeetings.findIndex(
      (meeting) => meeting.id === meetingId,
    );
    const upcomingMeetingIndex = meetingsData.upcomingMeetings.findIndex(
      (meeting) => meeting.id === meetingId,
    );

    let meetingDeleted = false;
    let recordingId = null;

    // Remove from past meetings if found
    if (pastMeetingIndex !== -1) {
      // Store the recording ID for later cleanup if needed
      recordingId = meetingsData.pastMeetings[pastMeetingIndex].recordingId;

      // Remove the meeting
      meetingsData.pastMeetings.splice(pastMeetingIndex, 1);
      meetingDeleted = true;
    }

    // Remove from upcoming meetings if found
    if (upcomingMeetingIndex !== -1) {
      // Store the recording ID for later cleanup if needed
      recordingId =
        meetingsData.upcomingMeetings[upcomingMeetingIndex].recordingId;

      // Remove the meeting
      meetingsData.upcomingMeetings.splice(upcomingMeetingIndex, 1);
      meetingDeleted = true;
    }

    if (!meetingDeleted) {
      return { success: false, error: "Meeting not found" };
    }

    // Save the updated data
    await fileOperationManager.writeData(meetingsData);

    // If the meeting had a recording, cleanup the reference in the global tracking
    if (
      recordingId &&
      global.activeMeetingIds &&
      global.activeMeetingIds[recordingId]
    ) {
      console.log(
        `Cleaning up tracking for deleted meeting with recording ID: ${recordingId}`,
      );
      delete global.activeMeetingIds[recordingId];
    }

    console.log(`Successfully deleted meeting: ${meetingId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting meeting:", error);
    return { success: false, error: error.message };
  }
});

// Handle generating AI summary for a meeting (non-streaming)
ipcMain.handle("generateMeetingSummary", async (event, meetingId) => {
  try {
    console.log(
      `Manual summary generation requested for meeting: ${meetingId}`,
    );

    // Read current data
    const fileData = await fs.promises.readFile(meetingsFilePath, "utf8");
    const meetingsData = JSON.parse(fileData);

    // Find the meeting
    const pastMeetingIndex = meetingsData.pastMeetings.findIndex(
      (meeting) => meeting.id === meetingId,
    );

    if (pastMeetingIndex === -1) {
      return { success: false, error: "Meeting not found" };
    }

    const meeting = meetingsData.pastMeetings[pastMeetingIndex];

    // Check if there's a transcript to summarize
    if (!meeting.transcript || meeting.transcript.length === 0) {
      return {
        success: false,
        error: "No transcript available for this meeting",
      };
    }

    // Log summary generation to console instead of showing a notification
    console.log("Generating AI summary for meeting: " + meetingId);

    // Generate the summary
    const summary = await generateMeetingSummary(meeting);

    // Get meeting title for use in the new content
    const meetingTitle = meeting.title || "Meeting Notes";

    // Get recording ID
    const recordingId = meeting.recordingId;

    // Check for different possible video file patterns
    const possibleFilePaths = recordingId
      ? [
          path.join(RECORDING_PATH, `${recordingId}.mp4`),
          path.join(RECORDING_PATH, `macos-desktop-${recordingId}.mp4`),
          path.join(RECORDING_PATH, `macos-desktop${recordingId}.mp4`),
          path.join(RECORDING_PATH, `desktop-${recordingId}.mp4`),
        ]
      : [];

    // Find the first video file that exists
    let videoExists = false;
    let videoFilePath = null;

    try {
      for (const filePath of possibleFilePaths) {
        if (fs.existsSync(filePath)) {
          videoExists = true;
          videoFilePath = filePath;
          console.log(`Found video file at: ${videoFilePath}`);
          break;
        }
      }
    } catch (err) {
      console.error("Error checking for video files:", err);
    }

    // Create content with the AI-generated summary
    meeting.content = `# ${meetingTitle}\n\n${summary}`;

    // If video exists, store the path separately but don't add it to the content
    if (videoExists) {
      meeting.videoPath = videoFilePath; // Store the path for future reference
      console.log(`Stored video path in meeting object: ${videoFilePath}`);
    } else {
      console.log("Video file not found or no recording ID");
    }

    meeting.hasSummary = true;

    // Save the updated data with summary
    await fileOperationManager.writeData(meetingsData);

    console.log("Updated meeting note with AI summary");

    // Notify the renderer to refresh the note if it's open
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("summary-generated", meetingId);
    }

    return {
      success: true,
      summary,
    };
  } catch (error) {
    console.error("Error generating meeting summary:", error);
    return { success: false, error: error.message };
  }
});

// Handle starting a manual desktop recording
ipcMain.handle("startManualRecording", async (event, meetingId) => {
  try {
    console.log(`Starting manual desktop recording for meeting: ${meetingId}`);

    // Read current data
    const fileData = await fs.promises.readFile(meetingsFilePath, "utf8");
    const meetingsData = JSON.parse(fileData);

    // Find the meeting
    const pastMeetingIndex = meetingsData.pastMeetings.findIndex(
      (meeting) => meeting.id === meetingId,
    );

    if (pastMeetingIndex === -1) {
      return { success: false, error: "Meeting not found" };
    }

    const meeting = meetingsData.pastMeetings[pastMeetingIndex];

    try {
      // Prepare desktop audio recording - this is the key difference from our previous implementation
      // It returns a key that we use as the window ID

      // Log the prepareDesktopAudioRecording API call
      sdkLogger.logApiCall("prepareDesktopAudioRecording");

      const key = await RecallAiSdk.prepareDesktopAudioRecording();
      console.log("Prepared desktop audio recording with key:", key);

      // Create a recording token
      const uploadData = await createDesktopSdkUpload();
      if (!uploadData || !uploadData.upload_token) {
        return { success: false, error: "Failed to create recording token" };
      }

      // Store the recording ID in the meeting
      meeting.recordingId = key;

      // Initialize transcript array if not present
      if (!meeting.transcript) {
        meeting.transcript = [];
      }

      // Store tracking info for the recording
      global.activeMeetingIds = global.activeMeetingIds || {};
      global.activeMeetingIds[key] = {
        platformName: "Desktop Recording",
        noteId: meetingId,
      };

      // Register the recording in our active recordings tracker
      activeRecordings.addRecording(key, meetingId, "Desktop Recording");

      // Save the updated data
      await fileOperationManager.writeData(meetingsData);

      // Start recording with the key from prepareDesktopAudioRecording
      console.log("Starting desktop recording with key:", key);

      // Log the startRecording API call
      sdkLogger.logApiCall("startRecording", {
        windowId: key,
        uploadToken: `${uploadData.upload_token.substring(0, 8)}...`, // Log truncated token for security
      });

      RecallAiSdk.startRecording({
        windowId: key,
        uploadToken: uploadData.upload_token,
      });

      return {
        success: true,
        recordingId: key,
      };
    } catch (sdkError) {
      console.error("RecallAI SDK error:", sdkError);
      return {
        success: false,
        error: "Failed to prepare desktop recording: " + sdkError.message,
      };
    }
  } catch (error) {
    console.error("Error starting manual recording:", error);
    return { success: false, error: error.message };
  }
});

// Handle stopping a manual desktop recording
ipcMain.handle("stopManualRecording", async (event, recordingId) => {
  try {
    console.log(`Stopping manual desktop recording: ${recordingId}`);

    // Stop the recording - using the windowId property as shown in the reference

    // Log the stopRecording API call
    sdkLogger.logApiCall("stopRecording", {
      windowId: recordingId,
    });

    // Update our active recordings tracker
    activeRecordings.updateState(recordingId, "stopping");

    RecallAiSdk.stopRecording({
      windowId: recordingId,
    });

    // The recording-ended event will be triggered automatically,
    // which will handle uploading and generating the summary

    return { success: true };
  } catch (error) {
    console.error("Error stopping manual recording:", error);
    return { success: false, error: error.message };
  }
});

// Handle generating AI summary with streaming
ipcMain.handle("generateMeetingSummaryStreaming", async (event, meetingId) => {
  try {
    console.log(
      `Streaming summary generation requested for meeting: ${meetingId}`,
    );

    // Read current data
    const fileData = await fs.promises.readFile(meetingsFilePath, "utf8");
    const meetingsData = JSON.parse(fileData);

    // Find the meeting
    const pastMeetingIndex = meetingsData.pastMeetings.findIndex(
      (meeting) => meeting.id === meetingId,
    );

    if (pastMeetingIndex === -1) {
      return { success: false, error: "Meeting not found" };
    }

    const meeting = meetingsData.pastMeetings[pastMeetingIndex];

    // Check if there's a transcript to summarize
    if (!meeting.transcript || meeting.transcript.length === 0) {
      return {
        success: false,
        error: "No transcript available for this meeting",
      };
    }

    // Log summary generation to console instead of showing a notification
    console.log("Generating streaming summary for meeting: " + meetingId);

    // Get meeting title for use in the new content
    const meetingTitle = meeting.title || "Meeting Notes";

    // Initial content with placeholders
    meeting.content = `# ${meetingTitle}\n\nGenerating summary...`;

    // Update the note on the frontend right away
    mainWindow.webContents.send("summary-update", {
      meetingId,
      content: meeting.content,
    });

    // Create progress callback for streaming updates
    const streamProgress = (currentText) => {
      // Update content with current streaming text
      meeting.content = `# ${meetingTitle}\n\n## AI-Generated Meeting Summary\n${currentText}`;

      // Send immediate update to renderer - don't debounce or delay this
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          // Force immediate send of the update
          mainWindow.webContents.send("summary-update", {
            meetingId,
            content: meeting.content,
            timestamp: Date.now(), // Add timestamp to ensure uniqueness
          });
        } catch (err) {
          console.error("Error sending streaming update to renderer:", err);
        }
      }
    };

    // Generate summary with streaming
    const summary = await generateMeetingSummary(meeting, streamProgress);

    // Make sure the final content is set correctly
    meeting.content = `# ${meetingTitle}\n\n${summary}`;
    meeting.hasSummary = true;

    // Save the updated data with summary
    await fileOperationManager.writeData(meetingsData);

    console.log("Updated meeting note with AI summary (streaming)");

    // Final notification to renderer
    mainWindow.webContents.send("summary-generated", meetingId);

    return {
      success: true,
      summary,
    };
  } catch (error) {
    console.error("Error generating streaming summary:", error);
    return { success: false, error: error.message };
  }
});

// Handle loading meetings data
ipcMain.handle("loadMeetingsData", async () => {
  try {
    // Use our file operation manager to safely read the data
    const data = await fileOperationManager.readMeetingsData();

    // Return the data
    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error("Failed to load meetings data:", error);
    return { success: false, error: error.message };
  }
});

// Function to create a new meeting note and start recording
async function createMeetingNoteAndRecord(platformName) {
  console.log("Creating meeting note for platform:", platformName);
  try {
    if (!detectedMeeting) {
      console.error("No active meeting detected");
      return;
    }
    console.log(
      "Detected meeting info:",
      detectedMeeting.window.id,
      detectedMeeting.window.platform,
    );

    // Store the meeting window ID for later reference with transcript events
    global.activeMeetingIds = global.activeMeetingIds || {};
    global.activeMeetingIds[detectedMeeting.window.id] = { platformName };

    // Read the current meetings data
    let meetingsData;
    try {
      const fileData = await fs.promises.readFile(meetingsFilePath, "utf8");
      meetingsData = JSON.parse(fileData);
    } catch (error) {
      console.error("Error reading meetings data:", error);
      meetingsData = { upcomingMeetings: [], pastMeetings: [] };
    }

    // Generate a unique ID for the new meeting
    const id = "meeting-" + Date.now();

    // Current date and time
    const now = new Date();

    // Use the actual meeting title if available, otherwise fall back to platform name + time
    // NOTE: meeting-updated may fire after the user clicks to join, so this might not be
    // populated yet. The meeting-updated handler will update the title retroactively if needed.
    const meetingTitle = detectedMeeting.window.title
      ? detectedMeeting.window.title
      : `${platformName} Meeting - ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    // Capture window ID in local variable — detectedMeeting can be nulled by meeting-closed
    const meetingWindowId = detectedMeeting.window.id;

    // Create interview record in UpSight backend
    // Store promise so recording-ended can await it if needed
    const interviewPromise = createInterviewRecord(
      meetingTitle,
      platformName,
      id,
    ).then((result) => {
      if (result) {
        // Store the interview ID using captured local variable (not live detectedMeeting ref)
        if (
          global.activeMeetingIds &&
          global.activeMeetingIds[meetingWindowId]
        ) {
          global.activeMeetingIds[meetingWindowId].interviewId =
            result.interview_id;
        }
        // Also store in evidence extraction state for real-time persistence
        const extractionState = evidenceExtractionState.getState(id);
        extractionState.interviewId = result.interview_id;
        console.log(
          `[realtime-evidence] Set interviewId ${result.interview_id} for noteId ${id}`,
        );
        return result.interview_id;
      }
      console.warn(
        "[createInterviewRecord] Returned null — interview not created",
      );
      return null;
    });

    // Store promise so recording-ended handler can await if interviewId not yet set
    if (global.activeMeetingIds && global.activeMeetingIds[meetingWindowId]) {
      global.activeMeetingIds[meetingWindowId].interviewPromise =
        interviewPromise;
    }

    // Create a template for the note content
    const template = `# ${meetingTitle}\nRecording: In Progress...`;

    // Create a new meeting object
    const newMeeting = {
      id: id,
      type: "document",
      title: meetingTitle,
      subtitle: now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      hasDemo: false,
      date: now.toISOString(),
      participants: [],
      content: template,
      recordingId: meetingWindowId,
      platform: platformName,
      transcript: [], // Initialize an empty array for transcript data
    };

    // Update the active meeting tracking with the note ID
    if (global.activeMeetingIds && global.activeMeetingIds[meetingWindowId]) {
      global.activeMeetingIds[meetingWindowId].noteId = id;
    }

    // Register this meeting in our active recordings tracker (even before starting)
    // This ensures the UI knows about it immediately
    activeRecordings.addRecording(meetingWindowId, id, platformName);

    // Add to pastMeetings
    meetingsData.pastMeetings.unshift(newMeeting);

    // Save the updated data
    console.log(`Saving meeting data to ${meetingsFilePath} with ID: ${id}`);
    await fileOperationManager.writeData(meetingsData);

    // Verify the file was written by reading it back
    try {
      const verifyData = await fs.promises.readFile(meetingsFilePath, "utf8");
      const parsedData = JSON.parse(verifyData);
      const verifyMeeting = parsedData.pastMeetings.find((m) => m.id === id);

      if (verifyMeeting) {
        console.log(`Successfully verified meeting ${id} was saved`);

        // Tell the renderer to open the new note
        if (mainWindow && !mainWindow.isDestroyed()) {
          // We need a significant delay to make sure the file is fully processed and loaded
          // This ensures the renderer has time to process the file and recognize the new meeting
          setTimeout(async () => {
            try {
              // Force a file reload before sending the message
              await fs.promises.readFile(meetingsFilePath, "utf8");

              console.log(`Sending IPC message to open meeting note: ${id}`);
              mainWindow.webContents.send("open-meeting-note", id);

              // Send another message after 2 seconds as a backup
              setTimeout(() => {
                console.log(
                  `Sending backup IPC message to open meeting note: ${id}`,
                );
                mainWindow.webContents.send("open-meeting-note", id);
              }, 2000);
            } catch (error) {
              console.error(
                "Error before sending open-meeting-note message:",
                error,
              );
            }
          }, 1500); // Increased delay for safety
        }
      } else {
        console.error(`Meeting ${id} not found in saved data!`);
      }
    } catch (verifyError) {
      console.error("Error verifying saved data:", verifyError);
    }

    // Request microphone permission before recording
    const { systemPreferences } = require("electron");
    const micStatus = systemPreferences.getMediaAccessStatus("microphone");
    console.log("[RECORDING] Microphone permission status:", micStatus);
    if (micStatus !== "granted") {
      console.log("[RECORDING] Requesting microphone permission...");
      const granted = await systemPreferences.askForMediaAccess("microphone");
      console.log("[RECORDING] Microphone permission granted:", granted);
      if (!granted) {
        console.error(
          "[RECORDING] Microphone permission denied - cannot record",
        );
      }
    }

    // Also check screen capture
    const screenStatus = systemPreferences.getMediaAccessStatus("screen");
    console.log("[RECORDING] Screen capture permission status:", screenStatus);

    // Start recording with upload token
    console.log(
      "═══════════════════════════════════════════════════════════════",
    );
    console.log(
      "[RECORDING] Starting recording for meeting:",
      detectedMeeting.window.id,
    );
    console.log(
      "[RECORDING] Window platform:",
      detectedMeeting.window.platform,
    );
    console.log("[RECORDING] Window title:", detectedMeeting.window.title);
    console.log(
      "═══════════════════════════════════════════════════════════════",
    );

    try {
      // Get upload token
      console.log("[RECORDING] Requesting upload token...");
      const uploadData = await createDesktopSdkUpload();
      console.log(
        "[RECORDING] Upload token result:",
        uploadData ? "Got token" : "No token",
      );

      if (!uploadData || !uploadData.upload_token) {
        console.log(
          "[RECORDING] No upload token - starting recording without token",
        );

        // Log the startRecording API call (no token fallback)
        sdkLogger.logApiCall("startRecording", {
          windowId: detectedMeeting.window.id,
        });

        console.log("[RECORDING] Calling RecallAiSdk.startRecording...");
        const result = await RecallAiSdk.startRecording({
          windowId: detectedMeeting.window.id,
        });
        console.log("[RECORDING] startRecording result:", result);
      } else {
        console.log(
          "[RECORDING] Starting recording with upload token:",
          uploadData.upload_token.substring(0, 8) + "...",
        );

        // Log the startRecording API call with upload token
        sdkLogger.logApiCall("startRecording", {
          windowId: detectedMeeting.window.id,
          uploadToken: `${uploadData.upload_token.substring(0, 8)}...`, // Log truncated token for security
        });

        console.log(
          "[RECORDING] Calling RecallAiSdk.startRecording with token...",
        );
        const result = await RecallAiSdk.startRecording({
          windowId: detectedMeeting.window.id,
          uploadToken: uploadData.upload_token,
        });
        console.log("[RECORDING] startRecording with token result:", result);
      }
    } catch (error) {
      const errMsg =
        error instanceof Error
          ? `${error.message}\n${error.stack}`
          : JSON.stringify(error);
      console.error("Error starting recording with upload token:", errMsg);

      // Fallback to recording without token
      console.log(
        "[RECORDING] Attempting fallback startRecording without token...",
      );

      // Log the startRecording API call (error fallback)
      sdkLogger.logApiCall("startRecording", {
        windowId: detectedMeeting.window.id,
        error: "Fallback after error",
      });

      try {
        const fallbackResult = await RecallAiSdk.startRecording({
          windowId: detectedMeeting.window.id,
        });
        console.log(
          "[RECORDING] Fallback startRecording result:",
          fallbackResult,
        );
      } catch (fallbackErr) {
        const fbMsg =
          fallbackErr instanceof Error
            ? `${fallbackErr.message}\n${fallbackErr.stack}`
            : JSON.stringify(fallbackErr);
        console.error(
          "[RECORDING] Fallback startRecording also failed:",
          fbMsg,
        );
      }
    }

    return id;
  } catch (error) {
    console.error("Error creating meeting note:", error);
  }
}

// Function to process video frames
async function processVideoFrame(evt) {
  try {
    const windowId = evt.window?.id;
    if (!windowId) {
      console.error("Missing window ID in video frame event");
      return;
    }

    // Check if we have this meeting in our active meetings
    if (!global.activeMeetingIds || !global.activeMeetingIds[windowId]) {
      console.log(`No active meeting found for window ID: ${windowId}`);
      return;
    }

    const noteId = global.activeMeetingIds[windowId].noteId;
    if (!noteId) {
      console.log(`No note ID found for window ID: ${windowId}`);
      return;
    }

    // Extract the video data
    const frameData = evt.data.data;
    if (!frameData || !frameData.buffer) {
      console.log("No video frame data in event");
      return;
    }

    // Get data from the event
    const frameBuffer = frameData.buffer; // base64 encoded PNG
    const frameTimestamp = frameData.timestamp;
    const frameType = frameData.type; // 'webcam' or 'screenshare'
    const participantData = frameData.participant;

    // Extract participant info
    const participantId = participantData?.id;
    const participantName = participantData?.name || "Unknown";

    // Log minimal info to avoid flooding the console
    // console.log(`Received ${frameType} frame from ${participantName} (ID: ${participantId}) at ${frameTimestamp.absolute}`);

    // Send the frame to the renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("video-frame", {
        noteId,
        participantId,
        participantName,
        frameType,
        buffer: frameBuffer,
        timestamp: frameTimestamp,
      });
    }
  } catch (error) {
    console.error("Error processing video frame:", error);
  }
}

/**
 * Extract platform-specific user ID from participant data
 * Returns stable identifier for cross-meeting identity matching
 *
 * @param {string} platform - Platform name (zoom, teams, google-meet, etc.)
 * @param {object} extraData - Platform-specific extra data from Recall SDK
 * @param {string} fallbackId - Fallback to participant.id if no specific ID found
 * @returns {string} Platform user ID for identity matching
 */
function extractPlatformUserId(platform, extraData, fallbackId) {
  if (!platform || !extraData) {
    return fallbackId;
  }

  // Extract platform-specific stable identifiers
  switch (platform.toLowerCase()) {
    case "zoom":
      // Zoom provides conf_user_id which is stable across meetings
      return extraData.conf_user_id || extraData.user_id || fallbackId;

    case "microsoft-teams":
    case "teams":
      // Teams provides user_id in extra_data
      return extraData.user_id || extraData.aad_object_id || fallbackId;

    case "google-meet":
    case "meet":
      // Google Meet provides user_id
      return extraData.user_id || extraData.google_user_id || fallbackId;

    case "webex":
      // Webex provides webex_id
      return extraData.webex_id || extraData.user_id || fallbackId;

    default:
      // For unknown platforms, use participant.id
      console.log(
        `Unknown platform '${platform}', using fallback ID: ${fallbackId}`,
      );
      return fallbackId;
  }
}

// Function to process participant join events
async function processParticipantJoin(evt) {
  try {
    const windowId = evt.window?.id;
    if (!windowId) {
      console.error("Missing window ID in participant join event");
      return;
    }

    // Check if we have this meeting in our active meetings
    if (!global.activeMeetingIds || !global.activeMeetingIds[windowId]) {
      console.log(`No active meeting found for window ID: ${windowId}`);
      return;
    }

    const noteId = global.activeMeetingIds[windowId].noteId;
    if (!noteId) {
      console.log(`No note ID found for window ID: ${windowId}`);
      return;
    }

    // Extract the participant data
    const participantData = evt.data.data.participant;
    if (!participantData) {
      console.log("No participant data in event");
      return;
    }

    const participantName = participantData.name || "Unknown Participant";
    const participantId = participantData.id;
    const isHost = participantData.is_host;
    const platform = participantData.platform;
    const email = participantData.email || null; // Available via Calendar Integration
    const extraData = participantData.extra_data || {}; // Platform-specific data

    console.log(
      `Participant joined: ${participantName} (ID: ${participantId}, Host: ${isHost}, Email: ${email || "N/A"})`,
    );

    // Skip "Host" and "Guest" generic names
    if (
      participantName === "Host" ||
      participantName === "Guest" ||
      participantName.includes("others") ||
      participantName.split(" ").length > 3
    ) {
      console.log(`Skipping generic participant name: ${participantName}`);
      return;
    }

    // Use the file operation manager to safely update the meetings data
    await fileOperationManager.scheduleOperation(async (meetingsData) => {
      // Find the meeting note with this ID
      const noteIndex = meetingsData.pastMeetings.findIndex(
        (meeting) => meeting.id === noteId,
      );
      if (noteIndex === -1) {
        console.log(`No meeting note found with ID: ${noteId}`);
        return null; // Return null to indicate no changes needed
      }

      // Get the meeting and initialize participants array if needed
      const meeting = meetingsData.pastMeetings[noteIndex];
      if (!meeting.participants) {
        meeting.participants = [];
      }

      // Check if participant already exists (based on ID)
      const existingParticipantIndex = meeting.participants.findIndex(
        (p) => p.id === participantId,
      );

      // Extract platform-specific user ID for cross-meeting identity
      const platformUserId = extractPlatformUserId(
        platform,
        extraData,
        participantId,
      );

      const participantObj = {
        id: participantId,
        name: participantName,
        isHost: isHost,
        platform: platform,
        email: email,
        platformUserId: platformUserId,
        joinTime: new Date().toISOString(),
        status: "active",
      };

      if (existingParticipantIndex !== -1) {
        // Update existing participant
        meeting.participants[existingParticipantIndex] = participantObj;
      } else {
        // Add new participant
        meeting.participants.push(participantObj);
      }

      console.log(`Added/updated participant data for meeting: ${noteId}`);

      // Notify the renderer if this note is currently being edited
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("participants-updated", noteId);
      }

      // Return the updated data to be written
      return meetingsData;
    });

    console.log(`Processed participant join event for meeting: ${noteId}`);
  } catch (error) {
    console.error("Error processing participant join event:", error);
  }
}

let currentUnknownSpeaker = -1;

// ══════════════════════════════════════════════════════════════════════════════
// Real-time Evidence Extraction State
// ══════════════════════════════════════════════════════════════════════════════
// Track evidence extraction state per meeting to enable incremental extraction
// during the meeting instead of waiting for post-meeting upload/webhook.
const evidenceExtractionState = {
  // Map of noteId -> { lastExtractedIndex, batchIndex, isExtracting, pendingTimer, interviewId }
  meetings: {},

  // Get or create state for a meeting
  getState(noteId) {
    if (!this.meetings[noteId]) {
      this.meetings[noteId] = {
        lastExtractedIndex: 0,
        batchIndex: 0,
        isExtracting: false,
        pendingAfterExtraction: false,
        pendingTimer: null,
        evidence: [],
        tasks: [],
        people: [],
        interviewId: null, // Database interview ID for persistence
      };
    }
    return this.meetings[noteId];
  },

  // Clean up state for a meeting
  cleanup(noteId) {
    const state = this.meetings[noteId];
    if (state?.pendingTimer) {
      clearTimeout(state.pendingTimer);
    }
    delete this.meetings[noteId];
  },
};

// Extract evidence from transcript turns via web app API
// interviewId enables server-side persistence to database
async function extractRealtimeEvidence(
  noteId,
  utterances,
  batchIndex,
  interviewId,
  existingEvidence,
) {
  try {
    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
      console.log("[realtime-evidence] No access token, skipping extraction");
      return null;
    }

    const startTime = Date.now();
    console.log(
      `[realtime-evidence] Extracting from ${utterances.length} utterances (batch ${batchIndex}), ${existingEvidence?.length || 0} existing gists`,
      interviewId
        ? `[persisting to interview ${interviewId}]`
        : "[no persistence]",
    );

    const response = await axios.post(
      `${UPSIGHT_API_URL}/api/desktop/realtime-evidence`,
      {
        utterances,
        existingEvidence,
        sessionId: noteId,
        batchIndex,
        interviewId, // Pass for server-side DB persistence
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000, // 15 second timeout - should be <3s with gpt-4o-mini
      },
    );

    const elapsed = Date.now() - startTime;
    const savedCount = response.data.savedEvidenceIds?.length || 0;
    console.log(
      `[realtime-evidence] Extracted ${response.data.evidence?.length || 0} evidence in ${elapsed}ms` +
        (savedCount > 0 ? `, saved ${savedCount} to DB` : ""),
    );

    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    console.error(`[realtime-evidence] Extraction failed: ${errorMsg}`);
    return null;
  }
}

// Finalize an interview when recording ends
// Sends accumulated transcript, tasks, and people to the backend
/**
 * Merge Recall SDK participant data with AI-extracted people
 * Matches AI-extracted people with Recall participants by name similarity
 *
 * @param {Array} recallParticipants - Participants from Recall SDK join events
 * @param {Array} aiPeople - People extracted by AI from transcript
 * @returns {Array} Merged people array with enriched data
 */
function mergePeopleData(recallParticipants, aiPeople) {
  const merged = [];

  // For each AI-extracted person, try to match with Recall participant
  for (const aiPerson of aiPeople || []) {
    const match = recallParticipants?.find((p) => {
      if (!p.name || !aiPerson.person_name) return false;
      // Simple fuzzy match: check if one name contains the other (case-insensitive)
      const pName = p.name.toLowerCase();
      const aiName = aiPerson.person_name.toLowerCase();
      return pName.includes(aiName) || aiName.includes(pName);
    });

    merged.push({
      person_key: aiPerson.person_key,
      person_name: aiPerson.person_name,
      role: aiPerson.role,
      // Enrich with Recall data if matched
      recall_participant_id: match?.platformUserId,
      recall_platform: match?.platform,
      email: match?.email,
      is_host: match?.isHost,
    });
  }

  console.log(
    `[mergePeople] Merged ${aiPeople?.length || 0} AI people with ${recallParticipants?.length || 0} Recall participants → ${merged.length} enriched people`,
  );

  return merged;
}

async function finalizeInterview(
  noteId,
  interviewId,
  transcript,
  durationSeconds = null,
  platform = null,
) {
  if (!interviewId) {
    console.log("[finalize] No interviewId, skipping finalization");
    return null;
  }

  try {
    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
      console.log("[finalize] No access token, skipping finalization");
      return null;
    }

    // Get accumulated state
    const state = evidenceExtractionState.getState(noteId);

    // Get meeting data for Recall participants
    let recallParticipants = [];
    try {
      const meetingsData = await loadMeetingsData();
      const meeting = meetingsData.pastMeetings.find((m) => m.id === noteId);
      recallParticipants = meeting?.participants || [];
      console.log(
        `[finalize] Found ${recallParticipants.length} Recall participants for meeting`,
      );
    } catch (error) {
      console.warn("[finalize] Could not load Recall participants:", error);
    }

    // Merge AI-extracted people with Recall participant data
    const enrichedPeople = mergePeopleData(
      recallParticipants,
      state.people || [],
    );

    console.log(
      `[finalize] Finalizing interview ${interviewId} with ${transcript?.length || 0} turns, ${state.tasks?.length || 0} tasks, ${enrichedPeople.length} people`,
    );

    // Step 1: Resolve people via new API endpoint
    let peopleMap = new Map(); // person_key → person_id
    if (enrichedPeople.length > 0) {
      try {
        // Get account and project IDs from auth context
        const user = await auth.getUser();
        const accountId = user?.app_metadata?.claims?.sub;
        const projectId =
          global.selectedProjectId || user?.user_metadata?.default_project_id;

        if (!accountId || !projectId) {
          console.warn(
            "[finalize] Missing accountId or projectId, skipping person resolution",
          );
        } else {
          const resolveResponse = await axios.post(
            `${UPSIGHT_API_URL}/api/desktop/people/resolve`,
            {
              accountId: accountId,
              projectId: projectId,
              people: enrichedPeople,
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              timeout: 15000,
            },
          );

          const { resolved, errors } = resolveResponse.data;

          // Build person_key → person_id map
          for (const item of resolved || []) {
            peopleMap.set(item.person_key, item.person_id);
            console.log(
              `[finalize] Resolved ${item.person_key} → ${item.person_id} (${item.matched_by})`,
            );
          }

          if (errors?.length > 0) {
            console.warn(`[finalize] Person resolution errors:`, errors);
          }

          console.log(
            `[finalize] Resolved ${resolved?.length || 0} people, ${errors?.length || 0} errors`,
          );
        }
      } catch (error) {
        console.error("[finalize] Person resolution failed:", error.message);
        console.warn(
          "[finalize] Continuing with finalization without person IDs",
        );
      }
    }

    // Step 2: Finalize interview with enriched data
    const response = await axios.post(
      `${UPSIGHT_API_URL}/api/desktop/interviews/finalize`,
      {
        interview_id: interviewId,
        transcript: transcript || [],
        tasks: state.tasks || [],
        people: enrichedPeople,
        people_map: Array.from(peopleMap.entries()).map(([key, id]) => ({
          person_key: key,
          person_id: id,
        })),
        duration_seconds: durationSeconds,
        platform: platform,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout for finalization
      },
    );

    console.log("[finalize] Interview finalized:", response.data);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    console.error(`[finalize] Finalization failed: ${errorMsg}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Upload Recording to Cloudflare R2
// ══════════════════════════════════════════════════════════════════════════════
async function uploadRecordingToR2(recordingId, interviewId) {
  try {
    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
      console.log("[r2-upload] No access token, skipping upload");
      return null;
    }

    // Find the recording file on disk
    const possiblePaths = [
      path.join(RECORDING_PATH, `${recordingId}.mp4`),
      path.join(RECORDING_PATH, `macos-desktop-${recordingId}.mp4`),
      path.join(RECORDING_PATH, `macos-desktop${recordingId}.mp4`),
      path.join(RECORDING_PATH, `desktop-${recordingId}.mp4`),
    ];

    let recordingFilePath = null;
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        recordingFilePath = filePath;
        break;
      }
    }

    if (!recordingFilePath) {
      console.log(
        `[r2-upload] No recording file found for ${recordingId}`,
        possiblePaths,
      );
      return null;
    }

    const fileStats = fs.statSync(recordingFilePath);
    const fileName = path.basename(recordingFilePath);
    const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
    console.log(`[r2-upload] Found recording: ${fileName} (${fileSizeMB}MB)`);

    // Step 1: Get presigned upload URL from our API
    console.log(
      `[r2-upload] Requesting presigned URL for interview ${interviewId}`,
    );
    const presignedResponse = await axios.post(
      `${UPSIGHT_API_URL}/api/desktop/interviews/upload-media`,
      {
        interview_id: interviewId,
        file_name: fileName,
        file_type: "video/mp4",
        file_size: fileStats.size,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );

    const { upload_url, r2_key } = presignedResponse.data;
    if (!upload_url) {
      console.error("[r2-upload] No upload_url in response");
      return null;
    }

    console.log(
      `[r2-upload] Got presigned URL, uploading to R2 key: ${r2_key}`,
    );

    // Step 2: Upload file directly to R2 via presigned URL (stream to avoid memory issues)
    const fileStream = fs.createReadStream(recordingFilePath);
    const uploadResponse = await axios.put(upload_url, fileStream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": fileStats.size,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 300000, // 5 minute timeout for large files
      onUploadProgress: (progressEvent) => {
        const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total,
        );
        if (percent % 25 === 0) {
          console.log(`[r2-upload] Upload progress: ${percent}%`);
        }
      },
    });

    console.log(
      `[r2-upload] Upload complete! Status: ${uploadResponse.status}, R2 key: ${r2_key}`,
    );

    // Step 3: Confirm upload - update the interview record with media_url
    try {
      await axios.post(
        `${UPSIGHT_API_URL}/api/desktop/interviews/upload-media`,
        {
          action: "confirm",
          interview_id: interviewId,
          r2_key: r2_key,
          file_size: fileStats.size,
          file_type: "video/mp4",
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );
      console.log(
        `[r2-upload] Confirmed upload for interview ${interviewId}: ${r2_key}`,
      );
    } catch (confirmErr) {
      console.error(
        `[r2-upload] File uploaded to R2 but confirmation failed: ${confirmErr.message}`,
      );
      // File is on R2 but interview record not updated - log r2_key for manual recovery
      console.error(`[r2-upload] Orphaned R2 key: ${r2_key}`);
    }

    return { r2_key, size: fileStats.size };
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    console.error(`[r2-upload] Upload failed: ${errorMsg}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Sliding Window Evidence Extraction Algorithm
// ══════════════════════════════════════════════════════════════════════════════
// - Wait for MIN_BATCH_SIZE utterances OR IDLE_TIMEOUT before extracting
// - Only one extraction at a time (no parallel spam)
// - Track processed indices to avoid re-extraction
// - Deduplicate by gist before sending to UI
const MIN_BATCH_SIZE = 3; // Wait for at least 3 utterances
const MAX_BATCH_SIZE = 8; // Don't send more than 8 at once
const IDLE_TIMEOUT = 4000; // Extract after 4s of silence even if < MIN_BATCH_SIZE

// Schedule evidence extraction for a meeting (debounced sliding window)
async function scheduleEvidenceExtraction(noteId) {
  const state = evidenceExtractionState.getState(noteId);

  // Clear any pending timer
  if (state.pendingTimer) {
    clearTimeout(state.pendingTimer);
    state.pendingTimer = null;
  }

  // Don't schedule if already extracting - wait for it to finish
  if (state.isExtracting) {
    state.pendingAfterExtraction = true; // Re-check after current extraction
    return;
  }

  // Get the meeting's transcript
  const meetingsData = await fileOperationManager.readMeetingsData();
  const meeting = meetingsData.pastMeetings.find((m) => m.id === noteId);
  if (!meeting?.transcript) {
    return;
  }

  const newTurns = meeting.transcript.length - state.lastExtractedIndex;

  if (newTurns <= 0) {
    return;
  }

  // If we have enough utterances, extract after short debounce
  // Otherwise, wait for IDLE_TIMEOUT in case more utterances are coming
  const delay = newTurns >= MIN_BATCH_SIZE ? 1000 : IDLE_TIMEOUT;

  state.pendingTimer = setTimeout(() => {
    performEvidenceExtraction(noteId);
  }, delay);
}

// Perform the actual evidence extraction
async function performEvidenceExtraction(noteId) {
  const state = evidenceExtractionState.getState(noteId);

  // Prevent parallel extractions
  if (state.isExtracting) {
    return;
  }
  state.isExtracting = true;

  try {
    // Re-fetch transcript to get latest
    const meetingsData = await fileOperationManager.readMeetingsData();
    const meeting = meetingsData.pastMeetings.find((m) => m.id === noteId);
    if (!meeting?.transcript) {
      return;
    }

    const transcript = meeting.transcript;

    // Skip if no new turns
    if (transcript.length <= state.lastExtractedIndex) {
      return;
    }

    // Get unprocessed turns, limit to MAX_BATCH_SIZE
    const newTurns = transcript.slice(state.lastExtractedIndex);
    const turnsToProcess = newTurns.slice(0, MAX_BATCH_SIZE);

    // Mark as processed BEFORE API call
    const processedUpTo = state.lastExtractedIndex + turnsToProcess.length;
    state.lastExtractedIndex = processedUpTo;

    // Format for the API
    const utterances = turnsToProcess.map((turn) => ({
      speaker: turn.speaker,
      text: turn.text,
    }));

    // Pass existing evidence gists for deduplication
    const existingGists = state.evidence.map((e) => e.gist);

    console.log(
      `[realtime-evidence] Processing ${turnsToProcess.length} turns (${newTurns.length - turnsToProcess.length} remaining), ${existingGists.length} existing evidence`,
    );

    const result = await extractRealtimeEvidence(
      noteId,
      utterances,
      state.batchIndex++,
      state.interviewId,
      existingGists,
    );

    if (result) {
      // Handle evidence with action-aware deduplication
      if (result.evidence?.length) {
        const newEvidence = [];
        const updatedEvidence = [];

        for (const e of result.evidence) {
          // Strip action metadata before storing
          const cleanEvidence = {
            gist: e.gist,
            speaker_label: e.speaker_label,
            verbatim: e.verbatim,
            facet_mentions: e.facet_mentions,
          };

          if (e.action === "update" && e.updates_gist) {
            // Replace existing evidence with updated version
            const idx = state.evidence.findIndex(
              (existing) => existing.gist === e.updates_gist,
            );
            if (idx !== -1) {
              state.evidence[idx] = cleanEvidence;
              updatedEvidence.push(cleanEvidence);
            } else {
              // Couldn't find the original, treat as new
              state.evidence.push(cleanEvidence);
              newEvidence.push(cleanEvidence);
            }
          } else {
            // New evidence (action === "new" or no action)
            const existingGistSet = new Set(state.evidence.map((x) => x.gist));
            if (!existingGistSet.has(cleanEvidence.gist)) {
              state.evidence.push(cleanEvidence);
              newEvidence.push(cleanEvidence);
            }
          }
        }

        console.log(
          `[realtime-evidence] Got ${newEvidence.length} new, ${updatedEvidence.length} updated (total: ${state.evidence.length})`,
        );

        // Send new evidence to floating panel
        if (newEvidence.length > 0) {
          sendEvidenceToPanel(newEvidence);
        }
      }

      // Handle tasks - accumulate and send to panel
      if (result.tasks?.length) {
        // Accumulate tasks (deduplicate by text)
        const existingTexts = new Set(state.tasks.map((t) => t.text));
        const newTasks = result.tasks.filter((t) => !existingTexts.has(t.text));
        state.tasks.push(...newTasks);
        console.log(
          `[realtime-evidence] Got ${newTasks.length} new tasks (total: ${state.tasks.length})`,
        );
        sendTasksToPanel(result.tasks);
      }

      // Accumulate people (deduplicate by person_key)
      if (result.people?.length) {
        const existingKeys = new Set(state.people.map((p) => p.person_key));
        const newPeople = result.people.filter(
          (p) => !existingKeys.has(p.person_key),
        );
        state.people.push(...newPeople);
      }

      // Notify main window renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("evidence-updated", {
          noteId,
          evidence: state.evidence,
          people: state.people,
        });
      }
    }
  } catch (error) {
    console.error("[realtime-evidence] Extraction error:", error.message);
  } finally {
    // Always reset isExtracting flag
    state.isExtracting = false;

    // If more turns came in while we were extracting, schedule another
    if (state.pendingAfterExtraction) {
      state.pendingAfterExtraction = false;
      scheduleEvidenceExtraction(noteId);
    }
  }
}

async function processTranscriptProviderData(evt) {
  // let speakerId = evt.data.data.payload.
  try {
    if (
      evt.data.data.data.payload.channel.alternatives[0].words[0].speaker !==
      undefined
    ) {
      currentUnknownSpeaker =
        evt.data.data.data.payload.channel.alternatives[0].words[0].speaker;
    }
  } catch (error) {
    // console.error("Error processing provider data:", error);
  }
}

// Function to process transcript data and store it with the meeting note
async function processTranscriptData(evt) {
  try {
    const windowId = evt.window?.id;
    if (!windowId) {
      console.error("Missing window ID in transcript event");
      return;
    }

    // Check if we have this meeting in our active meetings
    if (!global.activeMeetingIds || !global.activeMeetingIds[windowId]) {
      console.log(`No active meeting found for window ID: ${windowId}`);
      return;
    }

    const noteId = global.activeMeetingIds[windowId].noteId;
    if (!noteId) {
      console.log(`No note ID found for window ID: ${windowId}`);
      return;
    }

    // Extract the transcript data
    const words = evt.data.data.words || [];
    if (words.length === 0) {
      return; // No words to process
    }

    // Get speaker information
    let speaker;
    if (
      evt.data.data.participant?.name &&
      evt.data.data.participant?.name !== "Host" &&
      evt.data.data.participant?.name !== "Guest"
    ) {
      speaker = evt.data.data.participant?.name;
    } else if (currentUnknownSpeaker !== -1) {
      speaker = `Speaker ${currentUnknownSpeaker}`;
    } else {
      speaker = "Unknown Speaker";
    }

    // Combine all words into a single text
    const text = words.map((word) => word.text).join(" ");

    console.log(`Transcript from ${speaker}: "${text}"`);

    // Use the file operation manager to safely update the meetings data
    await fileOperationManager.scheduleOperation(async (meetingsData) => {
      // Find the meeting note with this ID
      const noteIndex = meetingsData.pastMeetings.findIndex(
        (meeting) => meeting.id === noteId,
      );
      if (noteIndex === -1) {
        console.log(`No meeting note found with ID: ${noteId}`);
        return null; // Return null to indicate no changes needed
      }

      // Add the transcript data
      const meeting = meetingsData.pastMeetings[noteIndex];

      // Initialize transcript array if it doesn't exist
      if (!meeting.transcript) {
        meeting.transcript = [];
      }

      // Merge same-speaker entries within a 15-second window
      const MERGE_WINDOW_MS = 15000;
      const lastEntry = meeting.transcript[meeting.transcript.length - 1];
      const now = new Date();
      let merged = false;

      if (lastEntry && lastEntry.speaker === speaker) {
        const lastTime = new Date(lastEntry.timestamp);
        if (now - lastTime < MERGE_WINDOW_MS) {
          // Merge: append text to existing entry
          lastEntry.text += " " + text;
          lastEntry.timestamp = now.toISOString();
          merged = true;
        }
      }

      if (!merged) {
        meeting.transcript.push({
          text,
          speaker,
          timestamp: now.toISOString(),
        });
      }

      console.log(
        `${merged ? "Merged" : "Added"} transcript data for meeting: ${noteId}`,
      );

      // Notify the renderer if this note is currently being edited
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("transcript-updated", noteId);
      }

      // Also send transcript to floating panel
      sendTranscriptToPanel({
        speaker,
        text: merged ? lastEntry.text : text,
        timestamp: now.toISOString(),
        merged,
      });

      // Return the updated data to be written
      return meetingsData;
    });

    // ═══ Real-time Evidence Extraction ═══
    // Schedule evidence extraction after transcript is saved.
    // This enables near real-time insights during the meeting.
    scheduleEvidenceExtraction(noteId);

    console.log(`Processed transcript data for meeting: ${noteId}`);
  } catch (error) {
    console.error("Error processing transcript data:", error);
  }
}

// Function to generate AI summary from transcript with streaming support
async function generateMeetingSummary(meeting, progressCallback = null) {
  try {
    const openai = getOpenAIClient();
    if (!openai) {
      console.log(
        "AI summarization not available - OPENROUTER_KEY not configured",
      );
      return "AI summarization not available. Configure OPENROUTER_KEY for local AI features.";
    }

    if (!meeting.transcript || meeting.transcript.length === 0) {
      console.log("No transcript available to summarize");
      return "No transcript available to summarize.";
    }

    console.log(`Generating AI summary for meeting: ${meeting.id}`);

    // Format the transcript into a single text for the AI to process
    const transcriptText = meeting.transcript
      .map((entry) => `${entry.speaker}: ${entry.text}`)
      .join("\n");

    // Format detected participants if available
    let participantsText = "";
    if (meeting.participants && meeting.participants.length > 0) {
      participantsText =
        "Detected participants:\n" +
        meeting.participants
          .map((p) => `- ${p.name}${p.isHost ? " (Host)" : ""}`)
          .join("\n");
    }

    // Define a system prompt to guide the AI's response with a specific format
    const systemMessage =
      "You are an AI assistant that summarizes meeting transcripts. " +
      "You MUST format your response using the following structure:\n\n" +
      "# Participants\n" +
      "- [List all participants mentioned in the transcript]\n\n" +
      "# Summary\n" +
      "- [Key discussion point 1]\n" +
      "- [Key discussion point 2]\n" +
      "- [Key decisions made]\n" +
      "- [Include any important deadlines or dates mentioned]\n\n" +
      "# Action Items\n" +
      "- [Action item 1] - [Responsible person if mentioned]\n" +
      "- [Action item 2] - [Responsible person if mentioned]\n" +
      "- [Add any other action items discussed]\n\n" +
      "Stick strictly to this format with these exact section headers. Keep each bullet point concise but informative.";

    // Prepare the messages array for the API
    const messages = [
      { role: "system", content: systemMessage },
      {
        role: "user",
        content: `Summarize the following meeting transcript with the EXACT format specified in your instructions:
${participantsText ? participantsText + "\n\n" : ""}
Transcript:
${transcriptText}`,
      },
    ];

    // If no progress callback provided, use the non-streaming version
    if (!progressCallback) {
      // Call the OpenAI API (via OpenRouter) for summarization (non-streaming)
      const response = await openai.chat.completions.create({
        model: MODELS.PRIMARY, // Use our primary model for a good balance of quality and speed
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        fallbacks: MODELS.FALLBACKS, // Use our defined fallback models
        transform_to_openai: true, // Ensures consistent response format across models
        route: "fallback", // Automatically use fallbacks if the primary model is unavailable
      });

      // Log which model was actually used
      console.log(
        `AI summary generated successfully using model: ${response.model}`,
      );

      // Return the generated summary
      return response.choices[0].message.content;
    } else {
      // Use streaming version and accumulate the response
      let fullText = "";

      // Create a streaming request
      const stream = await openai.chat.completions.create({
        model: MODELS.PRIMARY, // Use our primary model for a good balance of quality and speed
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: true,
        fallbacks: MODELS.FALLBACKS, // Use our defined fallback models
        transform_to_openai: true, // Ensures consistent response format across models
        route: "fallback", // Automatically use fallbacks if the primary model is unavailable
      });

      // Handle streaming events
      return new Promise((resolve, reject) => {
        // Process the stream
        (async () => {
          try {
            // Log the model being used when first chunk arrives (if available)
            let modelLogged = false;

            for await (const chunk of stream) {
              // Log the model on first chunk if available
              if (!modelLogged && chunk.model) {
                console.log(`Streaming with model: ${chunk.model}`);
                modelLogged = true;
              }

              // Extract the text content from the chunk
              const content = chunk.choices[0]?.delta?.content || "";

              if (content) {
                // Add the new text chunk to our accumulated text
                fullText += content;

                // Log each token for debugging (less verbose)
                if (content.length < 50) {
                  console.log(`Received token: "${content}"`);
                } else {
                  console.log(`Received content of length: ${content.length}`);
                }

                // Call the progress callback immediately with each token
                if (progressCallback) {
                  progressCallback(fullText);
                }
              }
            }

            console.log("AI summary streaming completed");
            resolve(fullText);
          } catch (error) {
            console.error("Stream error:", error);
            reject(error);
          }
        })();
      });
    }
  } catch (error) {
    console.error("Error generating meeting summary:", error);

    // Check if it's an OpenRouter/OpenAI specific error
    if (error.status) {
      return `Error generating summary: API returned status ${error.status}: ${error.message}`;
    } else if (error.response) {
      // Handle errors with a response object
      return `Error generating summary: ${error.response.status} - ${error.response.data?.error?.message || error.message}`;
    } else {
      // Default error handling
      return `Error generating summary: ${error.message}`;
    }
  }
}

// Function to update a note with recording information when recording ends
async function updateNoteWithRecordingInfo(recordingId) {
  try {
    // Read the current meetings data
    let meetingsData;
    try {
      const fileData = await fs.promises.readFile(meetingsFilePath, "utf8");
      meetingsData = JSON.parse(fileData);
    } catch (error) {
      console.error("Error reading meetings data:", error);
      return;
    }

    // Debug: Log all meetings and their recordingIds
    console.log(`Looking for recording ID: ${recordingId}`);
    console.log(
      `Number of past meetings: ${meetingsData.pastMeetings?.length || 0}`,
    );
    meetingsData.pastMeetings?.forEach((m, i) => {
      console.log(`  Meeting ${i}: id=${m.id}, recordingId=${m.recordingId}`);
    });

    // Find the meeting note with this recording ID
    let noteIndex = meetingsData.pastMeetings.findIndex(
      (meeting) => meeting.recordingId === recordingId,
    );

    if (noteIndex === -1) {
      // Try to find by global state as fallback
      const globalInfo = global.activeMeetingIds?.[recordingId];
      if (globalInfo?.noteId) {
        console.log(`Found meeting via global state: ${globalInfo.noteId}`);
        noteIndex = meetingsData.pastMeetings.findIndex(
          (meeting) => meeting.id === globalInfo.noteId,
        );
        if (noteIndex !== -1) {
          // Update the recordingId in the meeting and continue
          meetingsData.pastMeetings[noteIndex].recordingId = recordingId;
          console.log(`Updated recordingId for meeting ${globalInfo.noteId}`);
        } else {
          console.log("No meeting note found for recording ID:", recordingId);
          return;
        }
      } else {
        console.log("No meeting note found for recording ID:", recordingId);
        return;
      }
    }

    // Format current date
    const now = new Date();
    const formattedDate = now.toLocaleString();

    // Update the meeting note content
    const meeting = meetingsData.pastMeetings[noteIndex];
    const content = meeting.content;

    // Replace the "Recording: In Progress..." line with completed information
    let updatedContent = content.replace(
      "Recording: In Progress...",
      `Recording: Completed at ${formattedDate}\n`,
    );

    // Update the meeting object
    meeting.content = updatedContent;
    meeting.recordingComplete = true;
    meeting.recordingEndTime = now.toISOString();

    // Save the initial update
    await fileOperationManager.writeData(meetingsData);

    // Generate AI summary if there's a transcript
    if (meeting.transcript && meeting.transcript.length > 0) {
      console.log(`Generating AI summary for meeting ${meeting.id}...`);

      // Log summary generation to console instead of showing a notification
      console.log("Generating AI summary for meeting: " + meeting.id);

      // Get meeting title for use in the new content
      const meetingTitle = meeting.title || "Meeting Notes";

      // Create initial content with placeholder
      meeting.content = `# ${meetingTitle}\nGenerating summary...`;

      // Notify any open editors immediately
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("summary-update", {
          meetingId: meeting.id,
          content: meeting.content,
        });
      }

      // Create progress callback for streaming updates
      const streamProgress = (currentText) => {
        // Update content with current streaming text
        meeting.content = `# ${meetingTitle}\n\n${currentText}`;

        // Send immediate update to renderer if note is open
        if (mainWindow && !mainWindow.isDestroyed()) {
          try {
            mainWindow.webContents.send("summary-update", {
              meetingId: meeting.id,
              content: meeting.content,
              timestamp: Date.now(), // Add timestamp to ensure uniqueness
            });
          } catch (err) {
            console.error("Error sending streaming update to renderer:", err);
          }
        }
      };

      // Generate the summary with streaming updates
      const summary = await generateMeetingSummary(meeting, streamProgress);

      // Check for different possible video file patterns
      const possibleFilePaths = [
        path.join(RECORDING_PATH, `${recordingId}.mp4`),
        path.join(RECORDING_PATH, `macos-desktop-${recordingId}.mp4`),
        path.join(RECORDING_PATH, `macos-desktop${recordingId}.mp4`),
        path.join(RECORDING_PATH, `desktop-${recordingId}.mp4`),
      ];

      // Find the first video file that exists
      let videoExists = false;
      let videoFilePath = null;

      try {
        for (const filePath of possibleFilePaths) {
          if (fs.existsSync(filePath)) {
            videoExists = true;
            videoFilePath = filePath;
            console.log(`Found video file at: ${videoFilePath}`);
            break;
          }
        }
      } catch (err) {
        console.error("Error checking for video files:", err);
      }

      console.log("Attempting to embed video file", videoFilePath);

      // Format the transcript for display
      let transcriptText = "";
      if (meeting.transcript && meeting.transcript.length > 0) {
        transcriptText = "\n\n---\n\n## Transcript\n\n";
        for (const entry of meeting.transcript) {
          const speaker = entry.speaker || "Unknown Speaker";
          const text = entry.text || "";
          transcriptText += `**${speaker}:** ${text}\n\n`;
        }
      }

      // Set the content to summary + transcript
      meeting.content = `${summary}${transcriptText}`;

      // If video exists, store the path separately but don't add it to the content
      if (videoExists) {
        meeting.videoPath = videoFilePath; // Store the path for future reference
        console.log(`Stored video path in meeting object: ${videoFilePath}`);
      } else {
        console.log("Video file not found, continuing without embedding");
      }

      meeting.hasSummary = true;

      // Save the updated data with summary
      await fileOperationManager.writeData(meetingsData);

      console.log("Updated meeting note with AI summary");
    }

    // If the note is currently open, notify the renderer to refresh it
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("recording-completed", meeting.id);
    }
  } catch (error) {
    console.error("Error updating note with recording info:", error);
  }
}

// Function to check if there's a detected meeting available
ipcMain.handle("checkForDetectedMeeting", async () => {
  return detectedMeeting !== null;
});

// Function to join the detected meeting
ipcMain.handle("joinDetectedMeeting", async () => {
  return joinDetectedMeeting();
});

// Function to handle joining a detected meeting
async function joinDetectedMeeting() {
  try {
    console.log("Join detected meeting called");

    if (!detectedMeeting) {
      console.log("No detected meeting available");
      return { success: false, error: "No active meeting detected" };
    }

    // Map platform codes to readable names
    const platformNames = {
      zoom: "Zoom",
      "google-meet": "Google Meet",
      slack: "Slack",
      teams: "Microsoft Teams",
    };

    // Get a user-friendly platform name, or use the raw platform name if not in our map
    const platformName =
      platformNames[detectedMeeting.window.platform] ||
      detectedMeeting.window.platform;

    console.log("Joining detected meeting for platform:", platformName);

    // Ensure main window exists and is visible
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.log("Creating new main window");
      createWindow();
    }

    // Only show main window if floating panel is not active
    if (!floatingPanelWindow || floatingPanelWindow.isDestroyed()) {
      // Bring window to front with focus
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      console.log("Floating panel active - keeping main window hidden");
    }

    // Process immediately - UI already shows recording state
    console.log("Creating new meeting note");

    try {
      // Create a new meeting note and start recording
      const id = await createMeetingNoteAndRecord(platformName);

      console.log("Created new meeting with ID:", id);
      return { success: true, meetingId: id };
    } catch (err) {
      console.error("Error creating meeting note:", err);
      return { success: false, error: err.message };
    }
  } catch (error) {
    console.error("Error in joinDetectedMeeting:", error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// Floating Panel IPC Handlers
// ==========================================

// Resize the floating panel
ipcMain.handle("resizePanel", async (event, size) => {
  if (floatingPanelWindow) {
    floatingPanelWindow.setSize(size.width, size.height);
  }
});

// Minimize panel to small circle in lower right corner
ipcMain.handle("minimizePanel", async () => {
  if (floatingPanelWindow) {
    const { screen } = require("electron");
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;

    // Position in lower right corner with some padding
    floatingPanelWindow.setSize(48, 48);
    floatingPanelWindow.setPosition(screenWidth - 68, screenHeight - 68);
  }
});

// Restore panel from minimized state
ipcMain.handle("restorePanel", async () => {
  if (floatingPanelWindow) {
    floatingPanelWindow.setSize(320, 400);
    // Move back to a reasonable position
    floatingPanelWindow.setPosition(100, 100);
  }
});

// Close the floating panel
ipcMain.handle("closePanel", async () => {
  hideFloatingPanel();
});

// Track if we're currently recording in floating panel mode
let floatingPanelRecordingActive = false;
let floatingPanelRecordingInProgress = false; // Guard against rapid clicks

// Toggle recording from floating panel
ipcMain.handle("toggleRecordingFromPanel", async () => {
  console.log(
    "toggleRecordingFromPanel called, active:",
    floatingPanelRecordingActive,
    "inProgress:",
    floatingPanelRecordingInProgress,
  );

  // Guard against rapid clicks
  if (floatingPanelRecordingInProgress) {
    console.log("Recording toggle already in progress, ignoring");
    return { success: false, action: "ignored", reason: "in_progress" };
  }

  if (floatingPanelRecordingActive) {
    // Stop recording
    console.log("Stopping recording from floating panel");
    floatingPanelRecordingInProgress = true;
    floatingPanelRecordingActive = false;
    sendRecordingStateToPanel(false, null);

    try {
      // Actually stop the SDK recording
      if (detectedMeeting) {
        console.log(
          "[STOP] Calling RecallAiSdk.stopRecording for:",
          detectedMeeting.window.id,
        );
        await Promise.race([
          RecallAiSdk.stopRecording({ windowId: detectedMeeting.window.id }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("stopRecording timeout")), 10000),
          ),
        ]);
        console.log("[STOP] Recording stopped successfully");
      }
    } catch (err) {
      console.error("[STOP] Error stopping recording:", err.message);
    } finally {
      floatingPanelRecordingInProgress = false;
    }
    return { success: true, action: "stopped" };
  }

  // Start recording
  if (detectedMeeting) {
    floatingPanelRecordingInProgress = true;
    console.log("Starting recording for detected meeting");
    floatingPanelRecordingActive = true;

    // IMMEDIATELY update UI - don't wait for backend work
    const recordingStartTime = Date.now();
    sendRecordingStateToPanel(true, recordingStartTime);

    try {
      // Join the detected meeting (this creates a note and starts recording)
      // Timeout after 15s to prevent hanging forever
      const result = await Promise.race([
        joinDetectedMeeting(),
        new Promise((resolve) =>
          setTimeout(() => {
            console.error(
              "[RECORDING] joinDetectedMeeting timed out after 15s",
            );
            resolve({ success: false, error: "timeout" });
          }, 15000),
        ),
      ]);
      console.log("joinDetectedMeeting result:", result);

      return result;
    } catch (err) {
      console.error("[RECORDING] Error in joinDetectedMeeting:", err.message);
      return { success: false, error: err.message };
    } finally {
      // Reset the in-progress flag after the operation completes
      floatingPanelRecordingInProgress = false;
    }
  } else {
    console.log("No detected meeting to record");
    return { success: false, error: "No meeting detected" };
  }
});

// Submit a note from floating panel
ipcMain.handle("submitNoteFromPanel", async (event, text) => {
  console.log("Note submitted from floating panel:", text);
  // TODO: Save the note to the current meeting
});

// Show floating panel (can be called from main window)
ipcMain.handle("showFloatingPanel", async () => {
  showFloatingPanel();
});

// Hide floating panel
ipcMain.handle("hideFloatingPanel", async () => {
  hideFloatingPanel();
});

// Send recording state to floating panel
function sendRecordingStateToPanel(isRecording, startTime) {
  if (floatingPanelWindow && !floatingPanelWindow.isDestroyed()) {
    floatingPanelWindow.webContents.send("recording-state", {
      isRecording,
      startTime,
    });
  }
}

// Send evidence to floating panel
function sendEvidenceToPanel(evidence) {
  console.log(
    "[sendEvidenceToPanel] Called with",
    evidence?.length || 0,
    "items, window exists:",
    !!floatingPanelWindow,
  );
  if (floatingPanelWindow && !floatingPanelWindow.isDestroyed()) {
    console.log(
      "[sendEvidenceToPanel] Sending via IPC:",
      JSON.stringify(evidence[0] || {}),
    );
    floatingPanelWindow.webContents.send("evidence-update", evidence);
  }
}

// Send tasks to floating panel
function sendTasksToPanel(tasks) {
  if (floatingPanelWindow && !floatingPanelWindow.isDestroyed()) {
    console.log("[sendTasksToPanel] Sending", tasks.length, "tasks");
    floatingPanelWindow.webContents.send("tasks-update", tasks);
  }
}

// Send transcript to floating panel
function sendTranscriptToPanel(transcript) {
  if (floatingPanelWindow && !floatingPanelWindow.isDestroyed()) {
    floatingPanelWindow.webContents.send("transcript-update", transcript);
  }
}
