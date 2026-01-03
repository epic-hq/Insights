const { createClient } = require("@supabase/supabase-js");
const keytar = require("keytar");
const http = require("http");

const SERVICE_NAME = "upsight-desktop";
const ACCOUNT_NAME = "supabase-session";

// OAuth callback server state
let callbackServer = null;
let callbackPort = null;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Look up user profile from people table
async function getUserProfile(email) {
  const { data, error } = await supabase
    .from("people")
    .select("first_name, last_name")
    .eq("email", email)
    .single();

  if (error || !data) return null;
  return {
    firstName: data.first_name,
    lastName: data.last_name,
    fullName: `${data.first_name} ${data.last_name}`.trim(),
  };
}

// Get user name from OAuth metadata or fallback to people table
async function getUserName(user) {
  // Try OAuth metadata first (Google provides these)
  const metadata = user.user_metadata || {};
  if (metadata.full_name || metadata.name) {
    return {
      fullName: metadata.full_name || metadata.name,
      firstName: metadata.given_name || metadata.full_name?.split(" ")[0],
      lastName:
        metadata.family_name ||
        metadata.full_name?.split(" ").slice(1).join(" "),
    };
  }

  // Fallback to people table lookup
  const profile = await getUserProfile(user.email);
  if (profile) return profile;

  // Last resort: use email prefix
  return {
    fullName: user.email.split("@")[0],
    firstName: user.email.split("@")[0],
    lastName: "",
  };
}

// Email/password login
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Get user name
  const nameInfo = await getUserName(data.user);
  const userWithName = { ...data.user, ...nameInfo };

  await storeSession(data.session, userWithName);
  return { user: userWithName, session: data.session };
}

// Start local OAuth callback server
function startCallbackServer() {
  return new Promise((resolve, reject) => {
    // Close existing server if any
    if (callbackServer) {
      callbackServer.close();
    }

    callbackServer = http.createServer();

    // Listen on random available port
    callbackServer.listen(0, "127.0.0.1", () => {
      callbackPort = callbackServer.address().port;
      console.log(`OAuth callback server started on port ${callbackPort}`);
      resolve(callbackPort);
    });

    callbackServer.on("error", (err) => {
      console.error("Callback server error:", err);
      reject(err);
    });
  });
}

// Stop the callback server
function stopCallbackServer() {
  if (callbackServer) {
    callbackServer.close();
    callbackServer = null;
    callbackPort = null;
    console.log("OAuth callback server stopped");
  }
}

// Wait for OAuth callback on the local server
function waitForOAuthCallback() {
  return new Promise((resolve, reject) => {
    if (!callbackServer) {
      reject(new Error("Callback server not started"));
      return;
    }

    const timeout = setTimeout(
      () => {
        stopCallbackServer();
        reject(new Error("OAuth callback timeout"));
      },
      5 * 60 * 1000,
    ); // 5 minute timeout

    callbackServer.on("request", async (req, res) => {
      clearTimeout(timeout);

      // Parse the callback URL
      const url = new URL(req.url, `http://127.0.0.1:${callbackPort}`);
      console.log("OAuth callback received:", url.pathname, url.search);

      // Check for error
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");
      if (error) {
        // Send error page
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: white;">
              <div style="text-align: center;">
                <h1>❌ Authentication Failed</h1>
                <p>${errorDescription || error}</p>
                <p>You can close this window.</p>
              </div>
            </body>
          </html>
        `);
        stopCallbackServer();
        reject(new Error(errorDescription || error));
        return;
      }

      // Get the code from query params (PKCE flow)
      const code = url.searchParams.get("code");

      if (code) {
        // Send success page
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: white;">
              <div style="text-align: center;">
                <h1>✅ Signed in successfully!</h1>
                <p>You can close this window and return to UpSight.</p>
                <script>setTimeout(() => window.close(), 2000);</script>
              </div>
            </body>
          </html>
        `);
        stopCallbackServer();
        resolve({ code });
      } else {
        // Check for tokens in hash (implicit flow - sent as query params by some browsers)
        const accessToken = url.searchParams.get("access_token");
        const refreshToken = url.searchParams.get("refresh_token");

        if (accessToken) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: white;">
                <div style="text-align: center;">
                  <h1>✅ Signed in successfully!</h1>
                  <p>You can close this window and return to UpSight.</p>
                  <script>setTimeout(() => window.close(), 2000);</script>
                </div>
              </body>
            </html>
          `);
          stopCallbackServer();
          resolve({ accessToken, refreshToken });
        } else {
          // Maybe tokens are in hash fragment - serve a page that extracts them
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: white;">
                <div style="text-align: center;">
                  <h1>Processing...</h1>
                  <p>Please wait...</p>
                </div>
                <script>
                  // Extract tokens from hash fragment and redirect to query params
                  const hash = window.location.hash.substring(1);
                  if (hash) {
                    const params = new URLSearchParams(hash);
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');
                    if (accessToken) {
                      window.location.href = '/?access_token=' + encodeURIComponent(accessToken) +
                        (refreshToken ? '&refresh_token=' + encodeURIComponent(refreshToken) : '');
                    }
                  }
                </script>
              </body>
            </html>
          `);
          // Don't resolve yet - wait for the redirect with tokens in query params
        }
      }
    });
  });
}

// Get OAuth URL for Google sign-in with local callback
async function getGoogleOAuthUrl() {
  // Start the callback server first
  const port = await startCallbackServer();
  const redirectUrl = `http://127.0.0.1:${port}/callback`;

  console.log("Starting OAuth with redirect URL:", redirectUrl);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    stopCallbackServer();
    throw error;
  }

  return data.url;
}

// Perform OAuth and wait for callback
async function performOAuthFlow() {
  const authUrl = await getGoogleOAuthUrl();

  // Wait for the callback
  const callbackPromise = waitForOAuthCallback();

  // Return both the URL and the promise
  return { authUrl, callbackPromise };
}

// Exchange OAuth code for session
async function exchangeCodeForSession(code) {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) throw error;

  // Get user name
  const nameInfo = await getUserName(data.user);
  const userWithName = { ...data.user, ...nameInfo };

  await storeSession(data.session, userWithName);
  return { user: userWithName, session: data.session };
}

// Store session in OS keychain
async function storeSession(session, userWithName = null) {
  await keytar.setPassword(
    SERVICE_NAME,
    ACCOUNT_NAME,
    JSON.stringify({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at * 1000, // Convert to ms
      user: userWithName || session.user,
    }),
  );
}

// Get stored session from keychain
async function getStoredSession() {
  const stored = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  if (!stored) return null;
  return JSON.parse(stored);
}

// Clear session (logout)
async function clearSession() {
  await supabase.auth.signOut();
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}

// Check if user is authenticated
async function isAuthenticated() {
  const session = await getStoredSession();
  if (!session) return false;

  // Check if token is expired (with 5 min buffer)
  if (session.expiresAt < Date.now() + 5 * 60 * 1000) {
    return await refreshSession();
  }
  return true;
}

// Refresh the session using stored refresh token
async function refreshSession() {
  const session = await getStoredSession();
  if (!session?.refreshToken) return false;

  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: session.refreshToken,
    });

    if (error) throw error;

    await storeSession(data.session);
    return true;
  } catch (error) {
    await clearSession();
    return false;
  }
}

// Get current user from stored session
async function getCurrentUser() {
  const session = await getStoredSession();
  return session?.user || null;
}

// Get access token for API calls
async function getAccessToken() {
  const session = await getStoredSession();
  if (!session) return null;

  // Refresh if needed
  if (session.expiresAt < Date.now() + 5 * 60 * 1000) {
    await refreshSession();
    const refreshed = await getStoredSession();
    return refreshed?.accessToken || null;
  }

  return session.accessToken;
}

// Set session from tokens (for implicit OAuth flow)
async function setSessionFromTokens(accessToken, refreshToken) {
  // Set the session in Supabase client
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) throw error;

  // Get user name
  const nameInfo = await getUserName(data.user);
  const userWithName = { ...data.user, ...nameInfo };

  await storeSession(data.session, userWithName);
  return { user: userWithName, session: data.session };
}

module.exports = {
  login,
  getGoogleOAuthUrl,
  performOAuthFlow,
  exchangeCodeForSession,
  setSessionFromTokens,
  getStoredSession,
  clearSession,
  isAuthenticated,
  refreshSession,
  getCurrentUser,
  getAccessToken,
  stopCallbackServer,
};
