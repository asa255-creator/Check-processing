# Google Sheets Check PDF Processor

Extracts check information (name, amount, date, check number) from PDFs in a Google Drive folder.

## Setup

1. Open Google Sheets and go to **Extensions > Apps Script**
2. Copy the contents of `Code.gs` into the script editor
3. Set up Google Cloud Vision API:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a project (or select existing)
   - Enable the **Cloud Vision API**
   - Go to **APIs & Services > Credentials**
   - Create an **API Key**
4. Add the API key to your script:
   - In Apps Script, go to **Project Settings** (gear icon)
   - Scroll to **Script Properties**
   - Click **Add script property**
   - Name: `VISION_API_KEY`, Value: your API key
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
