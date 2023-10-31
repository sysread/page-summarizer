import { connectPageSummarizer } from './page_summarizer.js';
import { connectSelectionSummarizer } from './selection_summarizer.js';
import { connectFormFiller } from './form_filler.js';

// Summarize page
connectPageSummarizer();

// Summarize selected text (context menu item)
connectSelectionSummarizer();

// Fill in form input (context menu item)
connectFormFiller();
