const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

const sessionVault = {}; 

const clientWebAppHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>SAMURAI SECURE LIVENESS - IFRAME FAVICON</title>
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
            position: relative; z-index: 20;
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

        #bls-iframe {
            display: none; position: absolute; inset: 0; width: 100vw; height: 100vh; border: none; z-index: 10; background: #fff;
        }
    </style>
</head>
<body>

    <div class="samurai-bg" id="bg-effect"></div>

    <div id="pin-screen">
        <div class="pin-title">FAVICON IFRAME LOAD</div>
        <div class="pin-sub">أدخل كود الـ PIN لفتح صفحة الفافيكون داخل الإطار</div>
        <input type="text" id="pin-input" class="pin-input" maxlength="4" placeholder="••••" autocomplete="off" inputmode="numeric">
        <button id="pin-btn" class="pin-btn">LOAD FAVICON</button>
        <div id="pin-error" class="pin-error">الكود غير صحيح أو منتهي الصلاحية!</div>
    </div>

    <iframe id="bls-iframe"></iframe>

    <script>
        const SERVER_URL = window.location.origin;
        const WS_URL = SERVER_URL.replace(/^http/, 'ws');
        let currentPin = '';

        const pinScreen = document.getElementById('pin-screen');
        const bgEffect = document.getElementById('bg-effect');
        const iframe = document.getElementById('bls-iframe');

        let ws = new WebSocket(WS_URL);

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
                        loadFaviconInIframe(data.payload);
                    } else {
                        document.getElementById('pin-error').style.display = 'block';
                        document.getElementById('pin-btn').innerText = "LOAD FAVICON";
                    }
                }).catch(e => {
                    document.getElementById('pin-error').innerText = 'خطأ في الاتصال بالخادم';
                    document.getElementById('pin-error').style.display = 'block';
                    document.getElementById('pin-btn').innerText = "LOAD FAVICON";
                });
        });

        function loadFaviconInIframe(payload) {
            pinScreen.style.display = 'none';
            bgEffect.style.opacity = '0';
            
            iframe.style.display = 'block';
            
            // تحديد رابط الـ favicon الصحيح بناءً على الدولة
            let faviconUrl = "https://www.blsspainmorocco.net/assets/images/favicon.png";
            if (payload.challenge_url && payload.challenge_url.includes('portugal')) {
                faviconUrl = "https://morocco.blsportugal.com/assets/images/favicon.png";
            }

            iframe.src = faviconUrl;
            console.log("Loading Favicon in iframe:", faviconUrl);
        }
    </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(clientWebAppHTML);
    } 
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
            } catch (e) {
                res.writeHead(400); res.end(JSON.stringify({ success: false }));
            }
        });
    }
    else if (req.url.startsWith('/join-pin') && req.method === 'GET') {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pin = url.searchParams.get('pin');

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

        if (sessionVault[pin]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, payload: sessionVault[pin].payload }));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'الكود غير صحيح' }));
        }
    }
    else {
        res.writeHead(404); res.end();
    }
});

const serverWss = new WebSocket.Server({ server });
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎯 IFRAME FAVICON TEST SERVER RUNNING ON PORT: ${PORT}`);
});
