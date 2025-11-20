# Google Sheets Check PDF Processor

Extracts check information (name, amount, date, check number) from PDFs in a Google Drive folder.

## Setup

1. Get a free OCR.space API key at https://ocr.space/ocrapi/freekey
2. Open Google Sheets and go to **Extensions > Apps Script**
3. Copy the contents of `Code.gs` into the script editor
4. Add your API key:
   - Go to **Project Settings** (gear icon)
   - Scroll to **Script Properties** > **Add script property**
   - Name: `OCR_API_KEY`, Value: your API key
5. Save the project and reload your spreadsheet

## Usage

1. Reload the spreadsheet to see the **Check Processor** menu
2. Click **Check Processor > Process Check PDFs**
3. Enter the Google Drive folder URL or folder ID
4. The script will process all PDFs and populate the sheet

## Notes

- The script uses OCR to read PDF text, so results depend on PDF quality
- You may need to adjust the regex patterns in `parseCheckText()` to match your specific check format
- Temporary Google Docs are created during processing and automatically deleted
