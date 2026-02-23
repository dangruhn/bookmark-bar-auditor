// Check Content-Type via HEAD request; skip PDFs and images
async function shouldSkipUrl(url) {
    try {
        const res = await fetch(url, { method: 'HEAD' });
        const ct = res.headers.get('Content-Type') || '';
        if (ct.includes('application/pdf') || ct.startsWith('image/')) {
            return true;
        }
    } catch (e) {
        console.warn('HEAD request failed (likely CORS):', url, e);
        // If HEAD fails (CORS), process as normal
    }
    return false;
}
const MAX_TABS = 10;
let max_tabs = MAX_TABS;

const BATCH_DELAY_MS = 1000;
const TAB_TIMEOUT_MS = 20000;

let currentCountdown = 0;
let stats = {
  startTime: null,
  totalTabs: 0,
  tabsProcessed: 0,
  tabsPerSec: 0,
  remainingTime: '--',
  eta: '--'
};
let processingState = {
  paused: false,
  stopped: false,
  urls: [],
  currentIndex: 0
};
let lastProcessedIndex = 0;
let runStartIndex = 0; // Index where the current run started

function updateCountdown(remaining) {
    currentCountdown = remaining;
        // Calculate stats based on current run (ignoring initially skipped tabs)
        if (stats.startTime && stats.totalTabs > 0) {
      const now = Date.now();
      const elapsed = (now - stats.startTime) / 1000;
            // Global processed index (including skipped at the beginning)
            const globalProcessed = stats.totalTabs - remaining;
            // Tabs processed during this run only (exclude those skipped via Start at tab index)
            const processedThisRun = Math.max(0, globalProcessed - runStartIndex);
            // Use globalProcessed for the displayed "Tabs processed" value
            stats.tabsProcessed = globalProcessed;
            // Tabs/sec and remaining time are based only on this run
            stats.tabsPerSec = processedThisRun / (elapsed || 1);
            const tabsLeftThisRun = (stats.totalTabs - runStartIndex) - processedThisRun;
            const estTimeLeft = tabsLeftThisRun / (stats.tabsPerSec || 1);
      const etaDate = new Date(now + estTimeLeft * 1000);
      stats.remainingTime = estTimeLeft > 0 ? `${Math.round(estTimeLeft)}s` : '0s';
      stats.eta = etaDate.toLocaleTimeString();
    }
    browser.browserAction.setBadgeText({ text: remaining > 0 ? String(remaining) : '' });
    browser.runtime.sendMessage({ type: 'bookmarkCountdown', processed: stats.tabsProcessed, total: stats.totalTabs, stats });
}

function flattenBookmarks(bookmarkItem, urls = []) {
    // Debug: log folder/bookmark
    if (bookmarkItem.title) {
        console.log('Traversing:', bookmarkItem.title);
    }
    if (bookmarkItem.children) {
        // Sort children alphabetically by title
        const sortedChildren = bookmarkItem.children.slice().sort((a, b) => {
            const ta = a.title ? a.title.toLowerCase() : '';
            const tb = b.title ? b.title.toLowerCase() : '';
            return ta.localeCompare(tb);
        });
        for (const child of sortedChildren) {
            flattenBookmarks(child, urls);
        }
    }
    if (bookmarkItem.url) {
        urls.push(bookmarkItem.url);
    }
    return urls;
}

async function openTabsInBatches(urls, start = 0) {
    // Always reset stopped and initialize for new session
    stats.startTime = Date.now();
    stats.totalTabs = urls.length;
    // Run starts at this index; stats for Tabs/sec and remaining time will
    // be based only on tabs from this index onward.
    runStartIndex = start;
    stats.tabsProcessed = start; // Displayed "Tabs processed" starts at this index
    stats.tabsPerSec = 0;
    stats.remainingTime = '--';
    stats.eta = '--';
    processingState.paused = false;
    processingState.stopped = false;
    processingState.urls = urls;
    processingState.currentIndex = start;

    const batchSize = max_tabs; // Use max_tabs from UI/constant
    let current = start;
    while (current < urls.length && !processingState.stopped && !processingState.paused) {
        const batchRaw = urls.slice(current, current + batchSize).filter(url => !url.startsWith('data:'));
        // Filter batch: skip PDFs and images
        const batch = [];
        for (const url of batchRaw) {
            if (await shouldSkipUrl(url)) {
                console.log('Skipping PDF/image:', url);
                continue;
            }
            batch.push(url);
        }
        updateCountdown(urls.length - current);
        if (batch.length === 0) {
            console.log('No more tabs to process.');
            updateCountdown(0);
            return;
        }
        console.log('Processing batch:', batch);
        // Open all tabs in the batch
        const tabPromises = batch.map(url => {
            return browser.tabs.create({
                active: false,
                discarded: false,
                url: url
            }).then(tab => {
                return new Promise(resolve => {
                    let closed = false;
                    const timeoutId = setTimeout(() => {
                        if (!closed) {
                            browser.tabs.remove(tab.id);
                            closed = true;
                            resolve();
                        }
                    }, TAB_TIMEOUT_MS);
                    browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tabObj) {
                        if (tabId === tab.id && changeInfo.status === "complete" && !closed) {
                            browser.tabs.remove(tab.id);
                            browser.tabs.onUpdated.removeListener(listener);
                            closed = true;
                            clearTimeout(timeoutId);
                            resolve();
                        }
                    });
                });
            });
        });
        // Wait for all tabs in the batch to finish
        await Promise.allSettled(tabPromises);
        stats.tabsProcessed += batch.length;
        updateCountdown(urls.length - (current + batch.length));
        current += batchRaw.length; // Move forward by original batch size
        // Yield control to keep UI responsive
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
    // If we processed everything without being stopped/paused, mark complete
    if (!processingState.stopped && !processingState.paused && current >= urls.length) {
        updateCountdown(0);
    }
    // In all cases (stopped early or completed), update lastProcessedIndex
    lastProcessedIndex = stats.tabsProcessed;
    browser.runtime.sendMessage({ type: 'updateStartIndex', startIndex: lastProcessedIndex });
}

function resumeProcessing() {
  if (processingState.paused && !processingState.stopped) {
    processingState.paused = false;
    openTabsInBatches(processingState.urls, processingState.currentIndex);
  }
}

function stopProcessing() {
    // Signal processing to stop; current batch will finish,
    // and openTabsInBatches will update lastProcessedIndex when done.
    processingState.stopped = true;
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'getBookmarkCountdown') {
        sendResponse({ processed: stats.tabsProcessed, total: stats.totalTabs, stats, maxTabs: max_tabs });
    }
    if (message && message.type === 'getLastProcessedIndex') {
        sendResponse({ startIndex: lastProcessedIndex });
    }
    // Handle startBookmarkProcessing from popup
    if (message && message.type === 'startBookmarkProcessing') {
        max_tabs = (typeof message.maxTabs === 'number') ? message.maxTabs : MAX_TABS;
        const startIndex = (typeof message.startIndex === 'number') ? message.startIndex : 0;
        browser.bookmarks.getTree()
        .then((bookmarkItems) => {
            const urls = flattenBookmarks(bookmarkItems[0]);
            openTabsInBatches(urls, startIndex);
        });
        sendResponse({ started: true });
    }
    if (message && message.type === 'resumeBookmarkProcessing') {
        // Resume from where processing stopped or from Start At Tab value
        max_tabs = (typeof message.maxTabs === 'number') ? message.maxTabs : MAX_TABS;
        // Use stats.tabsProcessed as the default start index
        let startIndex = stats.tabsProcessed;
        if (typeof message.startIndex === 'number') {
            startIndex = message.startIndex;
        }
        if (processingState.stopped || processingState.paused) {
            processingState.stopped = false;
            processingState.paused = false;
            openTabsInBatches(processingState.urls, startIndex);
        }
        sendResponse({ resumed: true });
    }
    if (message && message.type === 'stopBookmarkProcessing') {
        stopProcessing();
        sendResponse({ stopped: true });
    }
});
