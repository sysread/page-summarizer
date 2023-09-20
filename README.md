# Page Summarizer

Page Summarizer is a Chrome extension that utilizes OpenAI's GPT-3 API to
summarize text from a web page. Just highlight the text you want to summarize,
click the extension icon, and get a concise summary!

## Features

- Highlight and summarize text from any web page.
- Stores the last summary for quick retrieval.
- Uses OpenAI's powerful GPT-3 API for accurate summaries.

## Installation

### Prerequisites

You'll need to have Google Chrome or a Chromium-based browser installed. Obtain
an API key from OpenAI.

### Installation from Latest Release

1. Go to the [Releases](https://github.com/sysread/page-summarizer/releases) page of this repository.
2. Download the latest `chrome-extension.zip` or `firefox-extension.zip` based on your browser.
3. Open Google Chrome and navigate to `chrome://extensions/`.
4. Drag and drop the downloaded ZIP file onto the extensions page.
5. The extension icon should now appear in your Chrome toolbar.
6. Right-click the extension icon and choose "Options", then enter your OpenAI API key and preferred model.

### Manual Installation from Repo

1. Clone this repository to your local machine:

```bash
   git clone https://github.com/sysread/page-summarizer.git
```
2. Open Google Chrome and navigate to chrome://extensions/.
3. Enable "Developer mode" in the top-right corner.
4. Click "Load unpacked" and select the directory where you cloned the repository.
5. The extension icon should now appear in your Chrome toolbar.
6. Right-click the extension icon and choose "Options", then enter your OpenAI API key and preferred model.

## Usage

- Highlight text on any webpage.
- Click the Page Summarizer extension icon.
- Click "Generate Summary" in the popup to get your summary.

## Troubleshooting

- Make sure you've entered the correct OpenAI API key.
- Make sure your OpenAI account has sufficient API quota.
- Check the JavaScript console for any errors.

## Contributing

Pull requests are welcome! For major changes, please open an issue first to
discuss what you would like to change.
