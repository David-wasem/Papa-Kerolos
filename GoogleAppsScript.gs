// Google Apps Script - Deploy this as a Web App
// This code should be pasted into a Google Apps Script project

// Configuration
const SHEET_ID = '14pO4fR8zG8RA_qx39MAdovPJX6fpidVNQPfUm5cD2jw'; // Your Google Sheet ID
const SHEET_NAME = 'Sheet1'; // The name of your worksheet/tab
const RULES_SHEET_NAME = 'rules'; // sheet/tab that contains rules (one rule per row, first column)

/**
 * Handles HTTP POST requests from the web app
 * Receives: { timestamp, userId, scanned }
 * Writes to Google Sheet in columns: [Timestamp, ID, QR Value]
 */
function doPost(e) {
    try {
        // 1. Extract the JSON payload from the POST request
        const raw = e.postData && e.postData.contents ? e.postData.contents : null;
        
        if (!raw) {
            return ContentService.createTextOutput(
                JSON.stringify({ success: false, error: 'No data received' })
            ).setMimeType(ContentService.MimeType.JSON);
        }

        // 2. Parse the JSON payload
        const payload = JSON.parse(raw);

        // 3. Extract data fields
        // Prefer ISO timestamp from client; fall back to server time
        const timestampIso = payload.isoTs || (new Date()).toISOString();
        const userId = (payload.userId || 'Unknown').toString();
        const qrValue = (payload.scanned || '').toString();

        // 4. Open the spreadsheet and get the target sheet
        const ss = SpreadsheetApp.openById(SHEET_ID);
        const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];

        // 4a. Check for duplicate: same userId and qrValue within last 12 hours
        const data = sheet.getDataRange().getValues(); // includes header if present
        const now = new Date(timestampIso);
        const twelveHours = 12 * 60 * 60 * 1000;

        for (let i = data.length - 1; i >= 0; i--) {
            const row = data[i];
            const tsCell = row[0];
            const idCell = row[1] ? row[1].toString() : '';
            const qrCell = row[2] ? row[2].toString() : '';

            if (idCell === userId && qrCell === qrValue) {
                let prevTs = null;
                if (tsCell instanceof Date) prevTs = tsCell;
                else prevTs = new Date(tsCell);

                if (!isNaN(prevTs.getTime())) {
                    const diff = now.getTime() - prevTs.getTime();
                    if (diff < twelveHours) {
                        // Duplicate within 12 hours -> reject
                        return ContentService.createTextOutput(
                            JSON.stringify({ success: false, error: 'duplicate_12h' })
                        ).setMimeType(ContentService.MimeType.JSON);
                    }
                }
                // if older than 12h, we can break and allow append
                break;
            }
        }

        // 5. Append the row with: [ISO Timestamp, ID, QR Value]
        sheet.appendRow([timestampIso, userId, qrValue]);

        // 6. Return success response
        return ContentService.createTextOutput(
            JSON.stringify({ success: true, message: 'Data saved successfully' })
        ).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        // Return error response
        return ContentService.createTextOutput(
            JSON.stringify({ success: false, error: error.toString() })
        ).setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * Simple GET handler (optional - for testing)
 */
function doGet(e) {
    try {
        var params = e.parameter || {};
        // If caller asks for last timestamp check: ?action=last&userId=12&qrValue=10
        if (params.action === 'last' && params.userId && params.qrValue) {
            var ss = SpreadsheetApp.openById(SHEET_ID);
            var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
            var data = sheet.getDataRange().getValues();
            var userId = params.userId.toString();
            var qrValue = params.qrValue.toString();

            // search from bottom for most recent matching row
            for (var i = data.length - 1; i >= 0; i--) {
                var row = data[i];
                var tsCell = row[0];
                var idCell = row[1] ? row[1].toString() : '';
                var qrCell = row[2] ? row[2].toString() : '';
                if (idCell === userId && qrCell === qrValue) {
                    var prevTs = null;
                    if (tsCell instanceof Date) prevTs = tsCell;
                    else prevTs = new Date(tsCell);
                    if (!isNaN(prevTs.getTime())) {
                        return ContentService.createTextOutput(
                            JSON.stringify({ success: true, lastTimestamp: prevTs.toISOString() })
                        ).setMimeType(ContentService.MimeType.JSON);
                    }
                }
            }

            return ContentService.createTextOutput(
                JSON.stringify({ success: true, lastTimestamp: null })
            ).setMimeType(ContentService.MimeType.JSON);
        }

        // If caller requests rules: ?action=rules
        if (params.action === 'rules') {
            var ssRules = SpreadsheetApp.openById(SHEET_ID);
            var rulesSheet = ssRules.getSheetByName(RULES_SHEET_NAME);
            if (!rulesSheet) {
                return ContentService.createTextOutput(JSON.stringify({ success: true, rules: [] })).setMimeType(ContentService.MimeType.JSON);
            }
            var rulesData = rulesSheet.getDataRange().getValues();
            var rules = [];
            for (var r = 0; r < rulesData.length; r++) {
                var cell = rulesData[r][0];
                if (cell !== '' && cell !== null && typeof cell !== 'undefined') {
                    rules.push(cell.toString());
                }
            }
            return ContentService.createTextOutput(JSON.stringify({ success: true, rules: rules })).setMimeType(ContentService.MimeType.JSON);
        }

        return ContentService.createTextOutput(
            JSON.stringify({ message: 'QR Code Scanner API - Use POST method' })
        ).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(
            JSON.stringify({ success: false, error: err.toString() })
        ).setMimeType(ContentService.MimeType.JSON);
    }
}
