// Google Apps Script - Deploy this as a Web App
// This code should be pasted into a Google Apps Script project

// Configuration
const SHEET_ID = '14pO4fR8zG8RA_qx39MAdovPJX6fpidVNQPfUm5cD2jw'; // Your Google Sheet ID
const SHEET_NAME = 'Sheet1'; // The name of your worksheet/tab
const RULES_SHEET_NAME = 'rules'; // sheet/tab that contains rules (one rule per row, first column)
const DATA_SHEET_NAME = 'data'; // The sheet containing user IDs and names


function doGet(e) {
    try {
        var params = e.parameter || {};

        if (params.action === 'checkId' && params.userId) {
            var ss = SpreadsheetApp.openById(SHEET_ID);
            var sheet = ss.getSheetByName(DATA_SHEET_NAME);
            if (!sheet) {
                return ContentService.createTextOutput(JSON.stringify({ success: false, error: "'data' sheet not found" })).setMimeType(ContentService.MimeType.JSON);
            }
            // Assuming IDs are in the first column (A)
            var columnValues = sheet.getRange('A1:A' + sheet.getLastRow()).getValues();
            var idList = columnValues.map(function(row) { return row[0].toString().trim(); });
            
            var userId = params.userId.toString().trim();
            var exists = idList.indexOf(userId) !== -1;

            return ContentService.createTextOutput(
                JSON.stringify({ success: true, exists: exists })
            ).setMimeType(ContentService.MimeType.JSON);
        }

        if (params.action === 'getUserData' && params.userId) {
            var ss = SpreadsheetApp.openById(SHEET_ID);
            var sheet = ss.getSheetByName(DATA_SHEET_NAME);
            if (!sheet) {
                return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Data sheet not found' })).setMimeType(ContentService.MimeType.JSON);
            }
            var data = sheet.getDataRange().getValues();
            var userId = params.userId.toString().trim();
            var userData = { success: true, found: false };

            for (var i = 0; i < data.length; i++) {
                // Assuming ID is in column 1 (A) and Name is in column 2 (B)
                if (data[i][0].toString().trim() === userId) {
                    userData.found = true;
                    userData.name = data[i][1].toString();
                    break;
                }
            }
            return ContentService.createTextOutput(JSON.stringify(userData)).setMimeType(ContentService.MimeType.JSON);
        }
        
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
