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

function updateCountdown(remaining) {
    currentCountdown = remaining;
    // Calculate stats
    if (stats.startTime && stats.totalTabs > 0) {
      const now = Date.now();
      const elapsed = (now - stats.startTime) / 1000;
      stats.tabsProcessed = stats.totalTabs - remaining;
      stats.tabsPerSec = stats.tabsProcessed / (elapsed || 1);
      const tabsLeft = remaining;
      const estTimeLeft = tabsLeft / (stats.tabsPerSec || 1);
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

function openTabsInBatches(urls, start = 0) {
    // Always reset stopped and initialize for new session
    stats.startTime = Date.now();
    stats.totalTabs = urls.length;
    stats.tabsProcessed = 0;
    stats.tabsPerSec = 0;
    stats.remainingTime = '--';
    stats.eta = '--';
    processingState.paused = false;
    processingState.stopped = false;
    processingState.urls = urls;
    processingState.currentIndex = start;

    if (processingState.stopped) return;
    if (processingState.paused) {
      processingState.currentIndex = start;
      return;
    }
    console.log('openTabsInBatches called, start:', start, 'urls.length:', urls.length);
    const batch = urls.slice(start, start + max_tabs).filter(url => !url.startsWith('data:'));
    let closedCount = 0;
    const remaining = urls.length - start;
    updateCountdown(remaining);
    if (batch.length === 0) {
        console.log('No more tabs to process.');
        updateCountdown(0);
        return;
    }
    console.log('Processing batch:', batch);
    for (const url of batch) {
        if (processingState.stopped) return;
        browser.tabs.create({
            active: false,
            discarded: false,
            url: url
        })
        .then((tab) => {
            let closed = false;
            const timeoutId = setTimeout(() => {
                if (!closed) {
                    browser.tabs.remove(tab.id);
                    closed = true;
                    closedCount++;
                    updateCountdown(urls.length - (start + closedCount));
                    if (closedCount === batch.length && !processingState.stopped) {
                        setTimeout(() => openTabsInBatches(urls, start + max_tabs), BATCH_DELAY_MS);
                    }
                }
            }, TAB_TIMEOUT_MS);
            browser.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tabObj) {
                if (tabId === tab.id && changeInfo.status === "complete" && !closed) {
                    browser.tabs.remove(tab.id);
                    browser.tabs.onUpdated.removeListener(listener);
                    closed = true;
                    clearTimeout(timeoutId);
                    closedCount++;
                    updateCountdown(urls.length - (start + closedCount));
                    if (closedCount === batch.length && !processingState.stopped) {
                        setTimeout(() => openTabsInBatches(urls, start + max_tabs), BATCH_DELAY_MS);
                    }
                }
            });
        });
    }
}

function resumeProcessing() {
  if (processingState.paused && !processingState.stopped) {
    processingState.paused = false;
    openTabsInBatches(processingState.urls, processingState.currentIndex);
  }
}

function stopProcessing() {
  processingState.stopped = true;
  lastProcessedIndex = stats.tabsProcessed;
  browser.runtime.sendMessage({ type: 'updateStartIndex', startIndex: lastProcessedIndex });
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
        // Always reset everything and start from scratch
        max_tabs = (typeof message.maxTabs === 'number') ? message.maxTabs : MAX_TABS;
        browser.bookmarks.getTree()
        .then((bookmarkItems) => {
            const urls = flattenBookmarks(bookmarkItems[0]);
            openTabsInBatches(urls, 0);
        });
        sendResponse({ started: true });
    }
    if (message && message.type === 'resumeBookmarkProcessing') {
        // Resume from where processing stopped
        max_tabs = (typeof message.maxTabs === 'number') ? message.maxTabs : MAX_TABS;
        if (processingState.stopped || processingState.paused) {
            processingState.stopped = false;
            processingState.paused = false;
            openTabsInBatches(processingState.urls, lastProcessedIndex);
        }
        sendResponse({ resumed: true });
    }
    if (message && message.type === 'stopBookmarkProcessing') {
        stopProcessing();
        sendResponse({ stopped: true });
    }
});
