# bookmark-bar-auditor
Walk through the Firefox bookmark bar bookmarks refreshing the icons and checking to see which are no longer valid.


## Capabilities

- Processes all bookmarks in the Firefox bookmark bar, opening each in a background tab.
- Refreshes bookmark favicons/icons by loading each URL.
- Skips bookmarks that are PDFs by URL pattern (no network request, fast; images are not skipped).
- Allows you to start processing at any bookmark index (resume or partial runs).
- Lets you set the maximum number of tabs to open at once.
- Provides real-time stats: tabs processed, tabs/sec, elapsed time (HH:MM:SS, live updating), and ETA.
- Lets you stop processing at any time; the current index is saved for easy resumption.
- Includes a reset button to quickly set the start index to zero.
- Handles CORS errors gracefully when checking Content-Type.
- Robust error handling for extension messaging.

## Usage

1. **Open the Extension Popup:**  
	Click the extension icon in your browser toolbar to open the popup.

2. **Set Start at Tab Index (optional):**  
	- Enter the index of the bookmark where you want to start processing.
	- Use the reset (↺) button to quickly set this value to zero.

3. **Set Max Open Tabs:**  
	- Enter the maximum number of tabs to open at once.  
	- This controls how many bookmarks are processed in parallel.

4. **Start Processing:**  
	- Click the **Start Processing** button.
	- The extension will begin opening bookmarks in background tabs, skipping PDFs and images.

5. **Monitor Progress:**  
	- The popup displays the number of tabs processed, total bookmarks, processing speed, elapsed time (HH:MM:SS, live updating), and ETA.

6. **Stop Processing:**  
	- Click the **Stop** button to pause processing at any time.
	- The current index will be saved for easy resumption.

7. **Resume Later:**  
	- When you reopen the popup, the “Start at tab index” field will show the last processed index.
	- Adjust as needed and click **Start Processing** to continue.
