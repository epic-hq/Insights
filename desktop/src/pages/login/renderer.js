import "./styles.css";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    setLoading(true);
    hideError();
    const result = await window.electronAPI.login(email, password);
    if (result.success) {
      // Navigate to main app - main process will handle this
      window.electronAPI.navigateToHome();
    } else {
      showError(result.error || "Login failed. Please check your credentials.");
    }
  } catch (error) {
    showError("Login failed. Please try again.");
  } finally {
    setLoading(false);
  }
});

document.getElementById("googleBtn").addEventListener("click", async () => {
  try {
    await window.electronAPI.loginWithGoogle();
    // Browser will open and OAuth flow will redirect back to app
  } catch (error) {
    showError("Could not open Google sign-in. Please try again.");
  }
});

function showError(message) {
  const el = document.getElementById("errorMessage");
  el.textContent = message;
  el.classList.add("visible");
}

function hideError() {
  const el = document.getElementById("errorMessage");
  el.textContent = "";
  el.classList.remove("visible");
}

function setLoading(loading) {
  const btn = document.getElementById("loginBtn");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const googleBtn = document.getElementById("googleBtn");

  btn.disabled = loading;
  emailInput.disabled = loading;
  passwordInput.disabled = loading;
  googleBtn.disabled = loading;

  btn.textContent = loading ? "Signing in..." : "Sign In";
}
