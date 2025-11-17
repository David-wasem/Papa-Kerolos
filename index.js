document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger');
    const drawer = document.querySelector('.drawer');
    let drawerTimeout;

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            drawer.classList.toggle('open');

            // Clear any existing timer
            clearTimeout(drawerTimeout);

            // If the drawer is open, set a timer to close it
            if (drawer.classList.contains('open')) {
                drawerTimeout = setTimeout(() => {
                    drawer.classList.remove('open');
                }, 3000); // 3000 milliseconds = 3 seconds
            }
        });
    }

    // --- Login + QR scanner UI logic ---
    const enterBtn = document.getElementById('enter-btn');
    const userIdInput = document.getElementById('user-id');
    const loadingEl = document.getElementById('loading');
    const scanBtn = document.getElementById('scan-btn');
    const scanner = document.getElementById('scanner');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const scanResult = document.getElementById('scan-result');
    const stopScanBtn = document.getElementById('stop-scan');
    const messageBox = document.getElementById('message-box');
    const messageContent = document.querySelector('.message-content');
    const messageIcon = document.getElementById('message-icon');
    const messageText = document.getElementById('message-text');
    const messageClose = document.getElementById('message-close');

    let stream = null;
    let scanning = false;
    let scanLoopId = null;
    let isLocked = false; // tracks whether an ID is confirmed (locked)

    // --- CONFIGURATION ---
    // Replace with your Google Apps Script Web App URL
    const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbx678RKKugjzaj_jcPT9wU-2fX0WEJqyypOWcEyEabgtjik9KiRjzu7QWMOzIKjcvcb/exec'; // You'll need to deploy a Google Apps Script and add the URL here

    /**
     * Sends scanned QR data to Google Sheets via Google Apps Script
     * @param {string} qrValue The scanned QR code value
     * @param {string} userId The user ID entered
     * @param {string} timestamp The current timestamp
     */
    async function sendToGoogleSheets(qrValue, userId, timestamp) {
        if (!WEBAPP_URL) {
            console.error('WEBAPP_URL not configured. Please set up Google Apps Script deployment.');
            scanResult.textContent = 'Error: Server not configured. Contact admin.';
            return false;
        }

        try {
            // send ISO timestamp for reliable server parsing
            const isoTs = (new Date()).toISOString();
            const payload = {
                isoTs: isoTs,
                timestamp: timestamp,
                userId: userId,
                scanned: qrValue
            };

            // Try CORS first (preferred). If it fails at runtime due to server CORS, fall back to no-cors.
            try {
                const response = await fetch(WEBAPP_URL, {
                    method: 'POST',
                    mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                // If server responds with JSON, parse it
                if (response && response.ok) {
                    try {
                        const json = await response.json();
                        return json;
                    } catch (e) {
                        return { success: true };
                    }
                }
                // If not ok, still try a no-cors request below
            } catch (e) {
                console.warn('CORS request failed, falling back to no-cors:', e);
            }

            // Fallback: send as no-cors (opaque) so the request reaches Apps Script even if CORS headers are missing.
            await fetch(WEBAPP_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(payload)
            });

            // With no-cors the response is opaque, assume success (server may still reject duplicates).
            return { success: true };
        } catch (error) {
            console.error('Error sending to Google Sheets:', error);
            scanResult.textContent = 'Error: Failed to save data. ' + error.message;
            return false;
        }
    }

    // Client-side 12-hour check using localStorage
    function canScanNow(userId, qrValue) {
        if (!userId || !qrValue) return false;
        try {
            const key = 'scan_' + userId + '_' + qrValue;
            const last = localStorage.getItem(key);
            if (!last) return true;
            const lastTs = parseInt(last, 10);
            const diff = Date.now() - lastTs;
            return diff >= 12 * 60 * 60 * 1000; // 12 hours
        } catch (e) {
            return true; // on error, don't block
        }
    }

    function markScanned(userId, qrValue) {
        try {
            const key = 'scan_' + userId + '_' + qrValue;
            localStorage.setItem(key, Date.now().toString());
        } catch (e) {
            // ignore storage errors
        }
    }

    function show(el) { el.classList.remove('hidden'); }
    function hide(el) { el.classList.add('hidden'); }

    /**
     * Show a success or error message box to the user
     * @param {string} type - 'success' or 'error'
     * @param {string} title - The message title/text
     */
    function showMessageBox(type, title) {
        messageContent.classList.remove('success', 'error');
        messageContent.classList.add(type);

        if (type === 'success') {
            messageIcon.textContent = '✓';
        } else {
            messageIcon.textContent = '✕';
        }

        messageText.textContent = title;
        show(messageBox);
    }

    messageClose && messageClose.addEventListener('click', () => {
        hide(messageBox);
    });

    enterBtn && enterBtn.addEventListener('click', () => {
        const id = userIdInput.value.trim();

        // If ID not locked yet, treat this as confirmation
        if (!isLocked) {
            if (!id) {
                userIdInput.focus();
                return;
            }

            // show loading, then reveal Scan button and lock the ID
            show(loadingEl);
            hide(scanResult);
            setTimeout(() => {
                hide(loadingEl);
                show(scanBtn);
                scanBtn.disabled = false;
                isLocked = true;
                enterBtn.textContent = 'Enter again';
                userIdInput.disabled = true;
            }, 900);

            return;
        }

        // If already locked -> user wants to rewrite the code
        isLocked = false;
        enterBtn.textContent = 'Enter';
        userIdInput.disabled = false;
        userIdInput.value = '';
        userIdInput.focus();

        // Hide and disable Scan button until new ID entered
        hide(scanBtn);
        scanBtn.disabled = true;
        scanResult.textContent = '';
    });

    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            await video.play();
            return true;
        } catch (e) {
            console.error('Camera start failed', e);
            scanResult.textContent = 'Camera not available or permission denied.';
            return false;
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
        }
        video.srcObject = null;
    }

    function handleResult(text) {
        scanning = false;
        hide(stopScanBtn);
        scanBtn.disabled = false;
        stopCamera();
        if (scanLoopId) cancelAnimationFrame(scanLoopId);

        // Get current timestamp
        const now = new Date();
        const timestamp = now.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        const userId = userIdInput.value.trim();

        // Show scanning result
        scanResult.textContent = 'Scanned: ' + text + ' | Time: ' + timestamp;

        // First, check server for the last timestamp
        show(loadingEl);
        fetch(WEBAPP_URL + '?action=last&userId=' + encodeURIComponent(userId) + '&qrValue=' + encodeURIComponent(text), { method: 'GET', mode: 'cors' })
            .then(r => r.json())
            .then(serverRes => {
                hide(loadingEl);
                if (serverRes && serverRes.success) {
                    const last = serverRes.lastTimestamp; // ISO or null
                    if (last) {
                        const lastTs = new Date(last).getTime();
                        const diff = Date.now() - lastTs;
                        if (diff < 12 * 60 * 60 * 1000) {
                            showMessageBox('error', 'الكود ده اتسجل قبل كده !!');
                            return;
                        }
                    }

                    // server says ok -> proceed to send
                    show(loadingEl);
                    hide(scanner);
                    sendToGoogleSheets(text, userId, timestamp).then(result => {
                        hide(loadingEl);
                        if (result && result.success) {
                            // mark locally
                            markScanned(userId, text);
                            showMessageBox('success', 'التسجيل تمام💪\n' + '\nالكود : ' + userId);
                            setTimeout(() => {
                                hide(scanner);
                                show(scanBtn);
                            }, 1500);
                        } else if (result && result.error === 'duplicate_12h') {
                            showMessageBox('error', 'الكود ده اتسجل قبل كده !!');
                        } else {
                            showMessageBox('error', 'فشل حفظ البيانات \n\nحاول مرة أخرى');
                        }
                    }).catch(err => {
                        hide(loadingEl);
                        showMessageBox('error', 'خطأ في الاتصال بالخادم');
                    });

                } else {
                    // server didn't return good JSON; allow scan as fallback
                    showMessageBox('error', 'لم يتمكن الخادم من التحقق، حاول مرة أخرى');
                }
            })
            .catch(err => {
                hide(loadingEl);
                // CORS or network error — fall back to client-side check
                if (!canScanNow(userId, text)) {
                    showMessageBox('error', 'الكود ده اتسجل قبل كده !!');
                    return;
                }
                // proceed anyway
                show(loadingEl);
                hide(scanner);
                sendToGoogleSheets(text, userId, timestamp).then(result => {
                    hide(loadingEl);
                    if (result && result.success) {
                        markScanned(userId, text);
                        showMessageBox('success', 'التسجيل تمام💪\n' + '\nالكود : ' + userId);
                        setTimeout(() => {
                            hide(scanner);
                            show(scanBtn);
                        }, 1500);
                    } else {
                        showMessageBox('error', 'فشل حفظ البيانات \n\nحاول مرة أخرى');
                    }
                }).catch(() => {
                    hide(loadingEl);
                    showMessageBox('error', 'خطأ في الاتصال بالخادم');
                });
            });
    }

    async function scanWithBarcodeDetector() {
        try {
            const detector = new BarcodeDetector({ formats: ['qr_code'] });
            while (scanning) {
                try {
                    const results = await detector.detect(video);
                    if (results && results.length) {
                        handleResult(results[0].rawValue);
                        break;
                    }
                } catch (e) {
                    // continue scanning loop on occasional errors
                    console.warn('Detector error', e);
                }
                // small pause
                await new Promise(r => setTimeout(r, 150));
            }
        } catch (e) {
            console.error('BarcodeDetector not supported or failed:', e);
            // fallback will be attempted by caller
        }
    }

    function scanWithJsQR() {
        const ctx = canvas.getContext('2d');

        function tick() {
            if (!scanning) return;
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                try {
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    if (code) {
                        handleResult(code.data);
                        return;
                    }
                } catch (e) {
                    console.warn('jsQR error', e);
                }
            }
            scanLoopId = requestAnimationFrame(tick);
        }

        tick();
    }

    scanBtn && scanBtn.addEventListener('click', async () => {
        if (scanning) return;
        scanResult.textContent = '';
        const ok = await startCamera();
        if (!ok) return;

        show(scanner);
        show(stopScanBtn);
        scanBtn.disabled = true;
        scanning = true;

        // Scroll to camera
        setTimeout(() => {
            scanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);

        // Try BarcodeDetector first, fallback to jsQR if not available
        if ('BarcodeDetector' in window) {
            scanWithBarcodeDetector();
            // still set a timeout to fallback if detector isn't working
            setTimeout(() => {
                if (scanning && (typeof BarcodeDetector === 'undefined' || !window.BarcodeDetector)) {
                    scanWithJsQR();
                }
            }, 600);
        } else if (typeof jsQR === 'function' || typeof jsQR === 'object') {
            scanWithJsQR();
        } else {
            scanResult.textContent = 'No QR decoder available in this browser.';
        }
    });

    stopScanBtn && stopScanBtn.addEventListener('click', () => {
        scanning = false;
        hide(stopScanBtn);
        show(scanBtn);
        scanBtn.disabled = false;
        hide(scanner);
        stopCamera();
        if (scanLoopId) cancelAnimationFrame(scanLoopId);
        scanResult.textContent = 'Scanning stopped.';
    });

    const rulesContent = document.querySelector('.rules-content');
    function fetchRules() {
        if (rulesContent) {
            fetch(`https://docs.google.com/spreadsheets/d/14pO4fR8zG8RA_qx39MAdovPJX6fpidVNQPfUm5cD2jw/gviz/tq?tqx=out:csv&sheet=rules`)
                .then(response => response.text())
                .then(csvText => {
                    rulesContent.innerHTML = ''; // Clear existing rules
                    const rows = csvText.split('\n').map(row => row.replace(/"/g, ''));
                    rows.shift(); // Remove header row
                    rows.forEach(row => {
                        if (row.trim() !== '') {
                            const p = document.createElement('li');
                            p.textContent = row;
                            rulesContent.appendChild(p);
                        }
                    });
                })
                .catch(error => {
                    console.error('Error fetching Google Sheet data:', error);
                    rulesContent.textContent = 'Failed to load rules. Please try again later.';
                });
        }
    }

    if (rulesContent) {
        fetchRules(); // Initial fetch
        setInterval(fetchRules, 5000); // Refresh every 5 seconds
    }
});