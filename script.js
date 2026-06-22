const API_BASE_URL = "https://ogle-gratified-imperial.ngrok-free.dev";

function setPreset(text) {
    document.getElementById("prompt").value = text;
}

function runScan() {
    const owner = document.getElementById("owner").value.trim();
    const repo = document.getElementById("repo").value.trim();
    const prompt = document.getElementById("prompt").value.trim();
    const statusDiv = document.getElementById("status");
    const resultBox = document.getElementById("resultBox");
    const scanButton = document.getElementById("scanButton");

    resultBox.classList.add("hidden");

    if (!owner || !repo) {
        statusDiv.textContent = "Please enter both a GitHub username and repository name.";
        return;
    }

    scanButton.disabled = true;
    scanButton.textContent = "Scanning...";
    statusDiv.textContent = "Scanning repository, this may take a minute...";

    fetch(API_BASE_URL + "/scan-repo", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ owner: owner, repo: repo, prompt: prompt })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
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
        scanButton.disabled = false;
        scanButton.textContent = "Run Scan Now";
        statusDiv.textContent = "Request failed: " + error;
    });
}
