/**
 * Google Sheets Check PDF Processor
 * Reads PDFs from a Google Drive folder and extracts check information
 */

// Add custom menu when spreadsheet opens
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Check Processor')
    .addItem('Process Check PDFs', 'showFolderDialog')
    .addToUi();
}

// Show dialog to get folder URL/ID
function showFolderDialog() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Process Check PDFs',
    'Enter the Google Drive folder URL or ID containing check PDFs:',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const input = response.getResponseText().trim();
    const folderId = extractFolderId(input);

    if (folderId) {
      processCheckFolder(folderId);
    } else {
      ui.alert('Error', 'Invalid folder URL or ID. Please try again.', ui.ButtonSet.OK);
    }
  }
}

// Extract folder ID from URL or return as-is if already an ID
function extractFolderId(input) {
  // Check if it's a full URL
  const urlMatch = input.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Check if it's just an ID (alphanumeric with dashes/underscores)
  if (/^[a-zA-Z0-9_-]+$/.test(input)) {
    return input;
  }

  return null;
}

// Main function to process all PDFs in the folder
function processCheckFolder(folderId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ui = SpreadsheetApp.getUi();

  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByType(MimeType.PDF);

    // Set up headers
    setupHeaders(sheet);

    let rowIndex = 2; // Start after header row
    let processedCount = 0;
    let errorCount = 0;
    let errors = [];

    while (files.hasNext()) {
      const file = files.next();

      try {
        const checkData = extractCheckData(file);

        if (checkData) {
          sheet.getRange(rowIndex, 1, 1, 5).setValues([[
            checkData.name,
            checkData.amount,
            checkData.checkDate,
            checkData.checkNumber,
            file.getName()
          ]]);
          rowIndex++;
          processedCount++;
        }
      } catch (error) {
        Logger.log('Error processing file ' + file.getName() + ': ' + error.message);
        errors.push(file.getName() + ': ' + error.message);
        errorCount++;
      }
    }

    // Format the amount column as currency
    if (rowIndex > 2) {
      sheet.getRange(2, 2, rowIndex - 2, 1).setNumberFormat('$#,##0.00');
    }

    // Show results with error details
    let message = `Processed: ${processedCount} checks\nErrors: ${errorCount}`;
    if (errors.length > 0) {
      message += '\n\nFirst error:\n' + errors[0];
      if (errors[0].includes('Drive') || errors[0].includes('not defined')) {
        message += '\n\nTIP: Make sure you enabled the Drive API in Services (click + in left sidebar of Apps Script editor)';
      }
    }

    ui.alert('Processing Complete', message, ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('Error', 'Failed to access folder: ' + error.message, ui.ButtonSet.OK);
  }
}

// Set up column headers
function setupHeaders(sheet) {
  const headers = ['Name', 'Amount', 'Check Date', 'Check Number', 'Source File'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
}

// Extract check data from PDF using Drive's built-in OCR
function extractCheckData(file) {
  const blob = file.getBlob();

  // Use Drive API v2 REST endpoint for reliable OCR conversion
  const metadata = {
    title: file.getName().replace('.pdf', '_temp'),
    mimeType: 'application/vnd.google-apps.document'
  };

  const boundary = '-------314159265358979323846';
  const delimiter = '\r\n--' + boundary + '\r\n';
  const closeDelimiter = '\r\n--' + boundary + '--';

  const requestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/pdf\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    Utilities.base64Encode(blob.getBytes()) +
    closeDelimiter;

  const response = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&ocr=true&ocrLanguage=en',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
      },
      payload: requestBody
    }
  );

  const result = JSON.parse(response.getContentText());
  const docId = result.id;

  // Get the text content
  const doc = DocumentApp.openById(docId);
  const text = doc.getBody().getText();

  // Delete the temporary document
  DriveApp.getFileById(docId).setTrashed(true);

  // Parse the text to extract check information
  return parseCheckText(text);
}

// Parse extracted text to find check details
function parseCheckText(text) {
  const data = {
    name: '',
    amount: '',
    checkDate: '',
    checkNumber: ''
  };

  // Extract check number (common patterns)
  const checkNumPatterns = [
    /check\s*#?\s*:?\s*(\d+)/i,
    /check\s+number\s*:?\s*(\d+)/i,
    /no\.?\s*:?\s*(\d+)/i,
    /\b(\d{4,})\b/  // Fallback: any 4+ digit number
  ];

  for (const pattern of checkNumPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.checkNumber = match[1];
      break;
    }
  }

  // Extract amount (dollar amounts)
  const amountPatterns = [
    /\$\s*([\d,]+\.?\d*)/,
    /amount\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
    /\*\*([\d,]+\.?\d*)\*\*/  // Amount often appears between asterisks
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.amount = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  // Extract date
  const datePatterns = [
    /date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/  // "January 15, 2024" format
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.checkDate = match[1];
      break;
    }
  }

  // Extract payee name (typically after "Pay to the order of" or similar)
  const namePatterns = [
    /pay\s+to\s+(?:the\s+order\s+of)?\s*:?\s*([^\n\r$]+)/i,
    /payee\s*:?\s*([^\n\r$]+)/i,
    /to\s*:?\s*([^\n\r$]+)/i
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.name = match[1].trim();
      break;
    }
  }

  return data;
}

// Test function for development
function testProcess() {
  // Replace with your test folder ID
  const testFolderId = 'YOUR_FOLDER_ID_HERE';
  processCheckFolder(testFolderId);
}
