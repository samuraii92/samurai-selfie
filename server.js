const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

// 🏦 خزنة الجلسات (لتخزين بيانات الماستر)
const sessionVault = {}; 

// ===============================================
// 🎨 واجهة الكليان المدمجة بالكامل في السيرفر (HTML/JS/CSS)
// ===============================================
const clientWebAppHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>SAMURAI SECURE LIVENESS</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;800&family=JetBrains+Mono:wght@700&display=swap');
        
        :root { 
            --brand: #38bdf8; 
            --brand-rgb: 56, 189, 248; 
            --green: #00ff9d;
            --red: #ff003c;
        }

        body {
            margin: 0; padding: 0; background: #050505; color: #fff;
            font-family: 'Rajdhani', sans-serif; overflow: hidden;
            display: flex; align-items: center; justify-content: center;
            height: 100vh; width: 100vw;
        }

        .samurai-bg { 
            position: absolute; inset: 0; opacity: 0.15; z-index: 1;
            background-image: linear-gradient(var(--brand) 1px, transparent 1px), linear-gradient(90deg, var(--brand) 1px, transparent 1px); 
            background-size: 50px 50px; 
            mask-image: radial-gradient(circle at center, black 30%, transparent 80%);
            -webkit-mask-image: radial-gradient(circle at center, black 30%, transparent 80%);
            transition: 0.5s;
        }

        #pin-screen {
            position: relative; z-index: 10;
            background: rgba(15,23,42,0.9); padding: 40px; border-radius: 20px; 
            border-top: 4px solid var(--brand); box-shadow: 0 20px 50px rgba(0,0,0,0.8); 
            text-align: center; width: 90%; max-width: 400px;
            backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
        }
        .pin-title { font-size: 26px; font-weight: 800; letter-spacing: 2px; margin-bottom: 10px; color: #fff;}
        .pin-sub { color: #94a3b8; font-size: 15px; margin-bottom: 30px; }
        .pin-input { background: #000; border: 2px solid #334155; color: var(--brand); font-size: 40px; text-align: center; width: 100%; box-sizing: border-box; padding: 15px; border-radius: 12px; font-weight: bold; letter-spacing: 20px; outline: none; transition: 0.3s; }
        .pin-input:focus { border-color: var(--brand); box-shadow: 0 0 20px rgba(var(--brand-rgb),0.3); }
        .pin-btn { background: var(--brand); color: #000; border: none; width: 100%; padding: 18px; font-size: 18px; font-weight: 900; border-radius: 12px; margin-top: 25px; cursor: pointer; transition: 0.3s; letter-spacing: 1px; }
        .pin-btn:hover { background: #0284c7; color: #fff; }
        .pin-error { color: var(--red); font-size: 15px; margin-top: 15px; font-weight: bold; display: none; }

        #camera-screen {
            display: none; position: relative; z-index: 10; width: 100%; height: 100%;
            flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 30px;
        }
        .glass-panel {
            width: 90%; max-width: 850px; border-radius: 100px;
            background: rgba(20, 20, 25, 0.95); border: 1px solid rgba(255,255,255,0.1); 
            border-top: 1px solid rgba(255,255,255,0.15);
            box-shadow: 0 15px 35px rgba(0,0,0,0.8), 0 0 25px rgba(var(--brand-rgb), 0.2);
            padding: 12px 30px; display: flex; justify-content: space-between; align-items: center;
            backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
        }
        .camera-title { font-size: 1.5rem; font-weight: 800; color: var(--brand); margin: 0; letter-spacing: 2px; }
        .camera-status { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #fff; text-align: left; border-left: 1px solid rgba(255,255,255,0.15); padding-left: 15px; flex-grow: 1; margin: 0 15px; }
        .timer-display { font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 800; color: var(--brand); margin: 0; }

        #success-screen {
            display: none; position: relative; z-index: 10; width: 90%; max-width: 500px;
            background: rgba(12, 12, 16, 0.95); border-radius: 20px; padding: 40px 30px;
            border-top: 4px solid var(--green); text-align: center;
            box-shadow: 0 30px 60px rgba(0,0,0,0.9), 0 0 40px rgba(0,255,157,0.3);
        }
        .success-title { color: var(--green); font-size: 3rem; margin: 0; text-shadow: 0 0 20px rgba(0,255,157,0.5); }
        .success-sub { color: #d0d0d0; font-family: monospace; font-size: 15px; margin-bottom: 20px; }
        .success-btn { background: var(--green); color: #000; border: none; padding: 15px 30px; font-weight: 800; font-size: 18px; border-radius: 12px; cursor: pointer; text-transform: uppercase; }
    </style>
</head>
<body>

    <div class="samurai-bg" id="bg-effect"></div>

    <div id="pin-screen">
        <div class="pin-title">SECURE CONNECTION</div>
        <div class="pin-sub">الرجاء إدخال كود التفعيل المكون من 4 أرقام لفتح الكاميرا</div>
        <input type="text" id="pin-input" class="pin-input" maxlength="4" placeholder="••••" autocomplete="off" inputmode="numeric">
        <button id="pin-btn" class="pin-btn">START CAMERA</button>
        <div id="pin-error" class="pin-error">الكود غير صحيح أو منتهي الصلاحية!</div>
    </div>

    <div id="camera-screen">
        <div class="glass-panel">
            <h1 class="camera-title" id="cam-title">SAMURAI</h1>
            <div class="camera-status" id="cam-status">📸 CAMERA ACTIVE - PLEASE CENTER YOUR FACE</div>
            <div class="timer-display" id="cam-timer">03:00</div>
        </div>
    </div>

    <div id="success-screen">
        <h1 class="success-title">SUCCESS</h1>
        <div class="success-sub">VERIFICATION COMPLETE</div>
        <button class="success-btn" onclick="window.close()">CLOSE SECURE SESSION</button>
    </div>

    <script>
        const SERVER_URL = window.location.origin;
        const WS_URL = SERVER_URL.replace(/^http/, 'ws');
        let currentPin = '';
        let timerInterval;

        const pinScreen = document.getElementById('pin-screen');
        const cameraScreen = document.getElementById('camera-screen');
        const successScreen = document.getElementById('success-screen');
        const bgEffect = document.getElementById('bg-effect');
        const camStatus = document.getElementById('cam-status');
        const camTimer = document.getElementById('cam-timer');

        let ws = new WebSocket(WS_URL);
        function sendWsUpdate(type, step, uuid = null) {
            if(ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: type, step: step, session_id: currentPin, uuid: uuid }));
            }
        }

        document.getElementById('pin-btn').addEventListener('click', () => {
            const pin = document.getElementById('pin-input').value.trim();
            if(pin.length !== 4) return;
            
            document.getElementById('pin-btn').innerText = "CONNECTING...";
            document.getElementById('pin-error').style.display = 'none';
            
            fetch('/join-pin?pin=' + pin)
                .then(res => res.json())
                .then(data => {
                    if(data.success) {
                        currentPin = pin;
                        startLivenessProcess(data.payload);
                    } else {
                        document.getElementById('pin-error').style.display = 'block';
                        document.getElementById('pin-btn').innerText = "START CAMERA";
                    }
                }).catch(e => {
                    document.getElementById('pin-error').innerText = 'خطأ في الاتصال بالخادم';
                    document.getElementById('pin-error').style.display = 'block';
                    document.getElementById('pin-btn').innerText = "START CAMERA";
                });
        });

        function startTimer() {
            let timeLeft = 180;
            timerInterval = setInterval(() => {
                timeLeft--;
                if(timeLeft <= 0) {
                    clearInterval(timerInterval);
                    camTimer.innerText = "00:00";
                    camStatus.innerText = "❌ TIMEOUT - SESSION EXPIRED";
                    return;
                }
                let m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
                let s = (timeLeft % 60).toString().padStart(2, '0');
                camTimer.innerText = m + ':' + s;
                if(timeLeft < 30) camTimer.style.color = "#ff003c";
            }, 1000);
        }

        function startLivenessProcess(payload) {
            pinScreen.style.display = 'none';
            bgEffect.style.opacity = '0';
            cameraScreen.style.display = 'flex';
            
            if(payload.challenge_url && payload.challenge_url.includes('portugal')) {
                document.getElementById('cam-title').innerText = "PORTUGAL";
                document.documentElement.style.setProperty('--brand', '#00ff9d');
            }

            startTimer();
            sendWsUpdate('SAMURAI_CLIENT_STEP', 'SYSTEM READY - INITIALIZING CAMERA');

            const script = document.createElement('script');
            script.src = payload.plugin_liveness_url;
            script.onload = () => {
                sendWsUpdate('SAMURAI_CLIENT_STEP', 'CLIENT_STARTED_LIVENESS');
                
                OzLiveness.open({
                    lang: 'en',
                    meta: { user_id: payload.user_id, transaction_id: payload.transaction_id },
                    overlay_options: false,
                    action: ['video_selfie_blank'],
                    result_mode: 'safe',
                    on_complete: function(result) {
                        const uuid = result.event_session_id;
                        clearInterval(timerInterval);
                        camStatus.innerText = "✅ SUCCESS - ENCRYPTING DATA...";
                        
                        fetch('/submit-uuid', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ session_id: currentPin, uuid: uuid })
                        }).then(() => {
                            sendWsUpdate('SAMURAI_CLIENT_SUCCESS', 'VERIFICATION COMPLETE', uuid);
                            cameraScreen.style.display = 'none';
                            successScreen.style.display = 'block';
                            bgEffect.style.backgroundImage = 'linear-gradient(#00ff9d 1px, transparent 1px), linear-gradient(90deg, #00ff9d 1px, transparent 1px)';
                            bgEffect.style.opacity = '0.15';
                        });
                    },
                    on_error: function(err) {
                        camStatus.innerText = "❌ CAMERA ERROR - PLEASE ALLOW PERMISSIONS";
                        sendWsUpdate('SAMURAI_CLIENT_STEP', 'CAMERA ERROR');
                    }
                });
            };
            document.head.appendChild(script);
        }
    </script>
</body>
</html>
`;

// ===============================================
// ⚙️ إعداد السيرفر والمسارات (HTTP Server Setup)
// ===============================================

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 1. مسار الصفحة الرئيسية
    if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(clientWebAppHTML);
    } 
    
    // 2. الماستر يطلب إنشاء كود PIN جديد
    else if (req.url === '/create-pin' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                let pin;
                do { pin = Math.floor(1000 + Math.random() * 9000).toString(); } while (sessionVault[pin] || pin === '0000');

                sessionVault[pin] = { payload: data.payload, createdAt: Date.now() };
                setTimeout(() => { delete sessionVault[pin]; }, 5 * 60 * 1000);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, pin: pin }));
                console.log(`[+] Master generated PIN: ${pin}`);
            } catch (e) {
                res.writeHead(400); res.end(JSON.stringify({ success: false }));
            }
        });
    }
    
    // 3. ✨ المسار الذي كان يعطي 404 (تم إضافته بنجاح هنا)
    else if (req.url.startsWith('/join-pin') && req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pin = url.searchParams.get('pin');

        // 🧪 وضع الاختبار 0000
        if (pin === '0000') {
            const testPayload = {
                user_id: "TEST_USER_9999", 
                transaction_id: "TEST_TRANS_9999", 
                ip_address: "127.0.0.1",
                plugin_liveness_url: "https://web-sdk.prod.cdn.spain.ozforensics.com/blsinternational/plugin_liveness.php",
                challenge_url: "https://www.blsspainmorocco.net/MAR/appointment/livenessrequest",
                selfie_code: "0000", 
                check_id: "TEST_CHECK_9999"
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, payload: testPayload }));
            return;
        }

        // 🔒 الجلسات الحقيقية
        if (sessionVault[pin]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, payload: sessionVault[pin].payload }));
            console.log(`[>] Client WebApp successfully joined using PIN: ${pin}`);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'الكود غير صحيح' }));
        }
    }
    
    // 4. إرسال النتيجة النهائية
    else if (req.method === 'POST' && req.url === '/submit-uuid') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'UUID_RECEIVED', session_id: data.session_id, uuid: data.uuid
                        }));
                    }
                });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    else {
        res.writeHead(404); res.end();
    }
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        } catch (e) { console.error("WebSocket Message Error:", e); }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎯 سيرفر SAMURAI WEB APP يعمل الآن بنجاح على البورت: ${PORT}`);
});
