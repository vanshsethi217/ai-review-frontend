const API_BASE_URL = "https://ogle-gratified-imperial.ngrok-free.dev";
const DEFAULT_OWNER = "vanshsethi217";

let scanTimerInterval = null;
let scanStartTime = null;

function setPreset(text) {
    document.getElementById("prompt").value = text;
}

function loadRepoDropdown() {
    const repoSelect = document.getElementById("repo");
    fetch(API_BASE_URL + "/list-repos")
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

function startScanTimer() {
    scanStartTime = Date.now();
    const statusDiv = document.getElementById("status");
    scanTimerInterval = setInterval(function() {
        const elapsedSeconds = Math.floor((Date.now() - scanStartTime) / 1000);
        statusDiv.textContent = "Scanning repository... " + elapsedSeconds + "s elapsed (large repos may take a few minutes)";
    }, 1000);
}

function stopScanTimer() {
    if (scanTimerInterval) {
        clearInterval(scanTimerInterval);
        scanTimerInterval = null;
    }
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

    scanButton.disabled = true;
    scanButton.textContent = "Scanning...";
    startScanTimer();

    fetch(API_BASE_URL + "/scan-repo", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ owner: DEFAULT_OWNER, repo: repo, prompt: prompt })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        stopScanTimer();
        scanButton.disabled = false;
        scanButton.textContent = "Run Scan Now";

        if (data.error) {
            statusDiv.textContent = "Error: " + data.error;
            return;
        }

        statusDiv.textContent = "";

        document.getElementById("resultSummary").textContent =
            "Scanned " + data.files_scanned + " file(s), found " + data.total_findings + " finding(s).";

        document.getElementById("reportLink").href = data.report_url;

        resultBox.classList.remove("hidden");
    })
    .catch(function(error) {
        stopScanTimer();
        scanButton.disabled = false;
        scanButton.textContent = "Run Scan Now";
        statusDiv.textContent = "Request failed: " + error;
    });
}

loadRepoDropdown();
loadSavedPrompts();
