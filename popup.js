// popup.js
function updateCountdownText(processed, total) {
  document.getElementById('countdown').textContent =
    `Tabs processed: ${processed} / ${total}`;
}

function updateStats(stats) {
  document.getElementById('stats').innerHTML =
    `<div><strong>Tabs/sec:</strong> ${stats.tabsPerSec.toFixed(2)}</div>
     <div><strong>Remaining time:</strong> ${stats.remainingTime}</div>
     <div><strong>ETA:</strong> ${stats.eta}</div>`;
}

// System theme detection for popup
function applySystemTheme() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('dark-theme', isDark);
}
applySystemTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);

browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'bookmarkCountdown') {
    updateCountdownText(message.processed, message.total);
    if (message.stats) {
      updateStats(message.stats);
    }
  }
  if (message.type === 'updateStartIndex') {
    document.getElementById('start-index').value = message.startIndex;
  }
});

// Request current countdown value and stats when popup loads
document.addEventListener('DOMContentLoaded', () => {
  browser.runtime.sendMessage({ type: 'getBookmarkCountdown' }).then((response) => {
    if (response && typeof response.processed === 'number' && typeof response.total === 'number') {
      updateCountdownText(response.processed, response.total);
      if (response.stats) {
        updateStats(response.stats);
      }
      // Set max-tabs input to last used value
      if (typeof response.maxTabs === 'number') {
        document.getElementById('max-tabs').value = response.maxTabs;
      }
    }
  });

  // Request last processed index and set start-index input
  browser.runtime.sendMessage({ type: 'getLastProcessedIndex' }).then((response) => {
    if (response && typeof response.startIndex === 'number') {
      document.getElementById('start-index').value = response.startIndex;
    }
  });

  // Add handler for Start Processing button
  const btn = document.getElementById('start-processing');
  if (btn) {
    btn.addEventListener('click', () => {
      // Always reset everything and start from scratch
      const maxTabs = parseInt(document.getElementById('max-tabs').value, 10) || 10;
      browser.runtime.sendMessage({ type: 'startBookmarkProcessing', startIndex: 0, reset: true, maxTabs });
    });
  }

  // Add handler for Resume button
  const resumeBtn = document.getElementById('resume-processing');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      const maxTabs = parseInt(document.getElementById('max-tabs').value, 10) || 10;
      browser.runtime.sendMessage({ type: 'resumeBookmarkProcessing', maxTabs });
    });
  }

  // Add handler for Stop button
  const stopBtn = document.getElementById('stop-processing');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      browser.runtime.sendMessage({ type: 'stopBookmarkProcessing' });
    });
  }
});
