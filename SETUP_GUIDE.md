# QR Code Scanner - Google Sheets Integration Setup Guide

## Overview
This system will:
1. **Scan QR Codes** using your web camera
2. **Record Timestamp** when the QR is scanned
3. **Record User ID** from your input
4. **Record QR Value** (the data from the QR code)
5. **Save to Google Sheets** automatically

The data is saved in 3 columns:
- **Column A**: Timestamp (when scanned)
- **Column B**: User ID (your code)
- **Column C**: QR Value (the scanned data)

---

## Setup Instructions

### Step 1: Create a Google Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **"New Project"** (or click the **+** button)
3. Name your project: "QR Code Scanner API"
4. Delete the default code and copy-paste all the code from `GoogleAppsScript.gs`

### Step 2: Update the Google Sheet ID

1. Open your Google Sheet
2. Copy the Sheet ID from the URL (the long string between `/d/` and `/edit`)
   - Example: `https://docs.google.com/spreadsheets/d/14pO4fR8zG8RA_qx39MAdovPJX6fpidVNQPfUm5cD2jw/edit`
   - Sheet ID: `14pO4fR8zG8RA_qx39MAdovPJX6fpidVNQPfUm5cD2jw`
3. In the Google Apps Script, update this line:
   ```javascript
   const SHEET_ID = '14pO4fR8zG8RA_qx39MAdovPJX6fpidVNQPfUm5cD2jw';
   ```

4. Also make sure the `SHEET_NAME` matches your worksheet name (default is 'Sheet1')

### Step 3: Deploy as Web App

1. In Google Apps Script, click **Deploy** → **New Deployment**
2. Click the **gear icon** and select **Web app**
3. Fill in:
   - **Description**: "QR Code Scanner"
   - **Execute as**: Your email/account
   - **Who has access**: "Anyone"
4. Click **Deploy**
5. **Important**: Copy the deployment URL (it will look like: `https://script.google.com/macros/d/...../usercontent`)

### Step 4: Add the Web App URL to Your Web App

1. Open `index.js` in your editor
2. Find this line at the top:
   ```javascript
   const WEBAPP_URL = '';
   ```
3. Replace it with your deployment URL:
   ```javascript
   const WEBAPP_URL = 'https://script.google.com/macros/d/YOUR_DEPLOYMENT_ID/usercontent';
   ```
4. Save the file

### Step 5: Test the Integration

1. Open your web app in a browser
2. Enter a User ID in the input field
3. Click "Enter"
4. Click "Scan QR"
5. Scan a QR code
6. Check your Google Sheet - the data should appear with the timestamp, ID, and QR value

---

## Troubleshooting

### Data not saving to Google Sheet?
- ✓ Verify the WEBAPP_URL is correctly set in `index.js`
- ✓ Check that the Google Apps Script deployment is set to "Anyone"
- ✓ Make sure the Sheet ID and Sheet Name are correct
- ✓ Check browser console for errors (F12 → Console tab)

### QR Code not scanning?
- ✓ Grant camera permission when prompted
- ✓ Ensure good lighting on the QR code
- ✓ Try different browsers (Chrome works best)
- ✓ Check that BarcodeDetector is supported or jsQR library loads

### Getting CORS errors?
- ✓ The deployment must use `no-cors` mode
- ✓ This is already configured in the code
- ✓ The data will still be saved even without a CORS response

---

## File Structure

- `index.html` - Main HTML page with QR scanner UI
- `index.js` - JavaScript for QR scanning and sending data to Google Sheets
- `index.css` - Styling
- `GoogleAppsScript.gs` - Server-side code (deploy to Google Apps Script)

---

## Column Headers (Optional)

To add headers to your Google Sheet:
1. In cell A1, enter: `Timestamp`
2. In cell B1, enter: `User ID`
3. In cell C1, enter: `QR Value`
4. Then update the Google Apps Script to start appending from row 2:
   ```javascript
   sheet.appendRow([timestamp, userId, qrValue]); // This is already correct
   ```

---

## Additional Notes

- **Timestamps** are in your local timezone and format
- **No data** is lost if there's a temporary connection issue - the scan completes locally first
- **Multiple scans** can be done in sequence without refreshing
- The system works **offline** for scanning, then syncs when connection is available

For more help, check the browser console (F12) for error messages.
