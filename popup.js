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
    // Always update Start at tab index input when processing stops or last batch closes
    const startIndexInput = document.getElementById('start-index');
    if (startIndexInput) {
      startIndexInput.value = message.startIndex;
    }
    // Optionally, update countdown display as well for consistency
    updateCountdownText(message.startIndex, document.getElementById('countdown').textContent.split(' / ')[1] || '');
  }
});

// Request current countdown value and stats when popup loads
document.addEventListener('DOMContentLoaded', () => {
  browser.runtime.sendMessage({ type: 'getBookmarkCountdown' })
    .then((response) => {
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
    })
    .catch(e => {
      if (e && e.message && e.message.includes('Could not establish connection')) return;
      console.warn('sendMessage error:', e);
    });

  // Request last processed index and set start-index input
  browser.runtime.sendMessage({ type: 'getLastProcessedIndex' })
    .then((response) => {
      if (response && typeof response.startIndex === 'number') {
        document.getElementById('start-index').value = response.startIndex;
      }
    })
    .catch(e => {
      if (e && e.message && e.message.includes('Could not establish connection')) return;
      console.warn('sendMessage error:', e);
    });

  // Add handler for Start Processing button — uses Start at tab index value
  const btn = document.getElementById('start-processing');
  if (btn) {
    btn.addEventListener('click', () => {
      const maxTabs = parseInt(document.getElementById('max-tabs').value, 10) || 10;
      const startIndex = parseInt(document.getElementById('start-index').value, 10) || 0;
      browser.runtime.sendMessage({ type: 'startBookmarkProcessing', startIndex, reset: true, maxTabs })
        .catch(e => {
          if (e && e.message && e.message.includes('Could not establish connection')) return;
          console.warn('sendMessage error:', e);
        });
    });
  }

  // Reset button clears Start at tab index to 0
  const resetBtn = document.getElementById('reset-start-index');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      document.getElementById('start-index').value = 0;
    });
  }

  // Add handler for Stop button
  const stopBtn = document.getElementById('stop-processing');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      browser.runtime.sendMessage({ type: 'stopBookmarkProcessing' })
        .then(() => {
          // After stopping, update start-index input with current processed value
          browser.runtime.sendMessage({ type: 'getBookmarkCountdown' })
            .then((response) => {
              if (response && typeof response.processed === 'number') {
                document.getElementById('start-index').value = response.processed;
              }
            })
            .catch(e => {
              if (e && e.message && e.message.includes('Could not establish connection')) return;
              console.warn('sendMessage error:', e);
            });
        })
        .catch(e => {
          if (e && e.message && e.message.includes('Could not establish connection')) return;
          console.warn('sendMessage error:', e);
        });
    });
  }
});
