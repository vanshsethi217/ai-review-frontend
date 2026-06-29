const API_BASE_URL = "https://ogle-gratified-imperial.ngrok-free.dev";
const DEFAULT_OWNER = "vanshsethi217";

let scanTimerInterval = null;
let scanStartTime = null;
let progressPollInterval = null;
let currentScanId = null;

function setPreset(text) {
    document.getElementById("prompt").value = text;
}

function loadRepoDropdown() {
    const repoSelect = document.getElementById("repo");
    fetch(API_BASE_URL + "/list-repos", {
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
                option.value = repo.name;
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
    const saved = JSON.parse(localStorage.getItem("savedPrompts") || "[]");
    listDiv.innerHTML = "";
    saved.forEach(function(promptText, index) {
        const chip = document.createElement("span");
        chip.className = "saved-prompt-chip";
        const shortLabel = promptText.length > 30 ? promptText.substring(0, 30) + "..." : promptText;
        chip.textContent = shortLabel;
        chip.title = promptText;
        chip.onclick = function() { setPreset(promptText); };

        const removeBtn = document.createElement("span");
        removeBtn.textContent = " x";
        removeBtn.className = "remove-prompt-x";
        removeBtn.onclick = function(e) {
            e.stopPropagation();
            removeSavedPrompt(index);
        };
        chip.appendChild(removeBtn);
        listDiv.appendChild(chip);
    });
}

function saveCurrentPrompt() {
    const promptText = document.getElementById("prompt").value.trim();
    if (!promptText) {
        return;
    }
    const saved = JSON.parse(localStorage.getItem("savedPrompts") || "[]");
    if (saved.indexOf(promptText) === -1) {
        saved.push(promptText);
        localStorage.setItem("savedPrompts", JSON.stringify(saved));
        loadSavedPrompts();
    }
}

function removeSavedPrompt(index) {
    const saved = JSON.parse(localStorage.getItem("savedPrompts") || "[]");
    saved.splice(index, 1);
    localStorage.setItem("savedPrompts", JSON.stringify(saved));
    loadSavedPrompts();
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
    const repo = document.getElementById("repo").value.trim();
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
        body: JSON.stringify({ owner: DEFAULT_OWNER, repo: repo, prompt: prompt, scan_id: currentScanId })
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
        reportLinkEl.href = "#";
        reportLinkEl.textContent = "Preparing report link... (usually under 30s)";
        resultBox.classList.remove("hidden");

        waitForReportAvailable(data.report_url, function(isReady) {
            if (isReady) {
                reportLinkEl.href = data.report_url;
                reportLinkEl.textContent = "Open Report";
            } else {
                reportLinkEl.href = data.report_url;
                reportLinkEl.textContent = "Open Report (may still be deploying - retry if blank)";
            }
        }, 8);
    })
    .catch(function(error) {
        stopScanTimer();
        stopProgressPolling();
        scanButton.disabled = false;
        scanButton.textContent = "Run Scan Now";
        statusDiv.textContent = "Request failed: " + error;
    });
}

loadRepoDropdown();
loadSavedPrompts();
