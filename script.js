const API_BASE_URL = "https://ogle-gratified-imperial.ngrok-free.dev";
const DEFAULT_OWNER = "vanshsethi217";
const SESSION_STORAGE_KEY = "github_session_id";

let scanTimerInterval = null;
let scanStartTime = null;
let progressPollInterval = null;
let currentScanId = null;

function getSessionId() {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
}

function captureSessionIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");
    const loginError = urlParams.get("login_error");

    if (sessionId) {
        sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (loginError) {
        document.getElementById("loginStatus").textContent = "Login failed: " + loginError;
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function updateLoginUI() {
    const sessionId = getSessionId();
    const loginStatusEl = document.getElementById("loginStatus");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const scanForm = document.getElementById("scanForm");
    const signedOutMessage = document.getElementById("signedOutMessage");

    if (!sessionId) {
        loginStatusEl.textContent = "Not signed in.";
        loginBtn.classList.remove("hidden");
        logoutBtn.classList.add("hidden");
        scanForm.classList.add("hidden");
        signedOutMessage.classList.remove("hidden");
        return;
    }

    fetch(API_BASE_URL + "/auth/me?session_id=" + encodeURIComponent(sessionId), {
        headers: { "ngrok-skip-browser-warning": "true" }
    })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.logged_in) {
                loginStatusEl.textContent = "Signed in as " + data.username;
                loginBtn.classList.add("hidden");
                logoutBtn.classList.remove("hidden");
                scanForm.classList.remove("hidden");
                signedOutMessage.classList.add("hidden");
                loadRepoDropdown();
            } else {
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
                loginStatusEl.textContent = "Not signed in.";
                loginBtn.classList.remove("hidden");
                logoutBtn.classList.add("hidden");
                scanForm.classList.add("hidden");
                signedOutMessage.classList.remove("hidden");
            }
        })
        .catch(function() {
            loginStatusEl.textContent = "Not signed in.";
            scanForm.classList.add("hidden");
            signedOutMessage.classList.remove("hidden");
        });
}

function loginWithGitHub() {
    window.location.href = API_BASE_URL + "/auth/github/login";
}

function logout() {
    const sessionId = getSessionId();
    fetch(API_BASE_URL + "/auth/logout", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ session_id: sessionId })
    })
        .then(function() {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            updateLoginUI();
        })
        .catch(function() {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            updateLoginUI();
        });
}

function setPreset(text) {
    document.getElementById("prompt").value = text;
}

function loadRepoDropdown() {
    const repoSelect = document.getElementById("repo");
    const sessionId = getSessionId();
    const url = API_BASE_URL + "/list-repos" + (sessionId ? "?session_id=" + encodeURIComponent(sessionId) : "");
    fetch(url, {
        headers: { "ngrok-skip-browser-warning": "true" }
    })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.error || !data.repos) {
                repoSelect.innerHTML = '<option value="">Could not load repos - type owner/repo manually below</option>';
                return;
            }
            repoSelect.innerHTML = "";
            data.repos.forEach(function(repo) {
                const option = document.createElement("option");
                option.value = repo.full_name;
                option.textContent = repo.full_name + (repo.private ? " (private)" : "");
                repoSelect.appendChild(option);
            });
        })
        .catch(function(error) {
            repoSelect.innerHTML = '<option value="">Could not reach API - is ngrok running?</option>';
        });
}

function loadSavedPrompts() {
    const listDiv = document.getElementById("savedPromptsList");
    fetch(API_BASE_URL + "/prompts", {
        headers: { "ngrok-skip-browser-warning": "true" }
    })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            const saved = data.prompts || [];
            listDiv.innerHTML = "";
            saved.forEach(function(promptObj) {
                const promptText = promptObj.prompt_text;
                const promptId = promptObj.id;

                const chip = document.createElement("span");
                chip.className = "saved-prompt-chip";
                const shortLabel = promptText.length > 30 ? promptText.substring(0, 30) + "..." : promptText;
                chip.textContent = shortLabel;
                chip.title = promptText + (promptObj.created_by ? " (saved by " + promptObj.created_by + ")" : "");
                chip.onclick = function() { setPreset(promptText); };

                const removeBtn = document.createElement("span");
                removeBtn.textContent = " x";
                removeBtn.className = "remove-prompt-x";
                removeBtn.onclick = function(e) {
                    e.stopPropagation();
                    removeSavedPrompt(promptId);
                };
                chip.appendChild(removeBtn);
                listDiv.appendChild(chip);
            });
        })
        .catch(function() {
            listDiv.innerHTML = "";
        });
}

function saveCurrentPrompt() {
    const promptText = document.getElementById("prompt").value.trim();
    if (!promptText) {
        return;
    }
    fetch(API_BASE_URL + "/prompts", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ prompt_text: promptText, created_by: "dashboard-user" })
    })
        .then(function(response) { return response.json(); })
        .then(function() {
            loadSavedPrompts();
        })
        .catch(function() {});
}

function removeSavedPrompt(promptId) {
    fetch(API_BASE_URL + "/prompts/" + promptId, {
        method: "DELETE",
        headers: { "ngrok-skip-browser-warning": "true" }
    })
        .then(function(response) { return response.json(); })
        .then(function() {
            loadSavedPrompts();
        })
        .catch(function() {});
}

function generateScanId() {
    return "scan_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
}

function startScanTimer() {
    scanStartTime = Date.now();
    const statusDiv = document.getElementById("status");
    scanTimerInterval = setInterval(function() {
        const elapsedSeconds = Math.floor((Date.now() - scanStartTime) / 1000);
        statusDiv.textContent = elapsedSeconds + "s elapsed (large repos may take a few minutes)";
    }, 1000);
}

function stopScanTimer() {
    if (scanTimerInterval) {
        clearInterval(scanTimerInterval);
        scanTimerInterval = null;
    }
}

function startProgressPolling(scanId) {
    const progressList = document.getElementById("progressList");
    progressList.innerHTML = "";
    progressPollInterval = setInterval(function() {
        fetch(API_BASE_URL + "/scan-status?scan_id=" + scanId, {
            headers: { "ngrok-skip-browser-warning": "true" }
        })
            .then(function(response) { return response.json(); })
            .then(function(data) {
                progressList.textContent = data.message || "";
            })
            .catch(function() {});
    }, 1000);
}

function stopProgressPolling() {
    if (progressPollInterval) {
        clearInterval(progressPollInterval);
        progressPollInterval = null;
    }
}

function waitForReportAvailable(reportUrl, onReady, attemptsLeft) {
    if (attemptsLeft <= 0) {
        onReady(false);
        return;
    }
    fetch(reportUrl, { method: "HEAD", cache: "no-store" })
        .then(function(response) {
            if (response.ok) {
                onReady(true);
            } else {
                setTimeout(function() {
                    waitForReportAvailable(reportUrl, onReady, attemptsLeft - 1);
                }, 5000);
            }
        })
        .catch(function() {
            setTimeout(function() {
                waitForReportAvailable(reportUrl, onReady, attemptsLeft - 1);
            }, 5000);
        });
}

function runScan() {
    const repoFullName = document.getElementById("repo").value.trim();
    const repoParts = repoFullName.split("/");
    const scanOwner = repoParts.length === 2 ? repoParts[0] : DEFAULT_OWNER;
    const repo = repoParts.length === 2 ? repoParts[1] : repoFullName;
    const prompt = document.getElementById("prompt").value.trim();
    const statusDiv = document.getElementById("status");
    const resultBox = document.getElementById("resultBox");
    const scanButton = document.getElementById("scanButton");

    resultBox.classList.add("hidden");

    if (!repo) {
        statusDiv.textContent = "Please select a repository.";
        return;
    }

    currentScanId = generateScanId();
    scanButton.disabled = true;
    scanButton.textContent = "Scanning...";
    startScanTimer();
    startProgressPolling(currentScanId);

    fetch(API_BASE_URL + "/scan-repo", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ owner: scanOwner, repo: repo, prompt: prompt, scan_id: currentScanId, session_id: getSessionId() })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        stopScanTimer();
        stopProgressPolling();
        document.getElementById("progressList").textContent = "";
        scanButton.disabled = false;
        scanButton.textContent = "Run Scan Now";

        if (data.error) {
            statusDiv.textContent = "Error: " + data.error;
            return;
        }

        statusDiv.textContent = "";

        document.getElementById("resultSummary").textContent =
            "Scanned " + data.files_scanned + " file(s), found " + data.total_findings + " finding(s).";

        const reportLinkEl = document.getElementById("reportLink");
        reportLinkEl.removeAttribute("href");
        reportLinkEl.classList.add("preparing");
        reportLinkEl.textContent = "Preparing report link... (usually under 30s)";
        resultBox.classList.remove("hidden");

        waitForReportAvailable(data.report_url, function(isReady) {
            reportLinkEl.classList.remove("preparing");
            reportLinkEl.href = data.report_url;
            if (isReady) {
                reportLinkEl.textContent = "Open Report";
            } else {
                reportLinkEl.textContent = "Open Report (may still be deploying - retry if blank)";
            }
        }, 12);
    })
    .catch(function(error) {
        stopScanTimer();
        stopProgressPolling();
        scanButton.disabled = false;
        scanButton.textContent = "Run Scan Now";
        statusDiv.textContent = "Request failed: " + error;
    });
}

captureSessionIdFromUrl();
updateLoginUI();
loadSavedPrompts();
