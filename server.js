const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// متغيرات النظام
let systemState = {
    temp: 25.0,
    humidity: 50.0,
    motion: false,
    acPower: false,
    setTemp: 24,
    mode: 'cool',
    fanSpeed: 'auto',
    lastCommandSource: 'Web',
    lastUpdate: new Date().toLocaleTimeString(),
    autoModeEnabled: true
};

// متغيرات تتبع الغياب والأتمتة الذكية
let lastMotionTime = Date.now();
let lastTempRaiseTime = Date.now();

setInterval(() => {
    if (!systemState.autoModeEnabled) return;

    const currentTime = Date.now();
    const absenceMinutes = (currentTime - lastMotionTime) / 60000; // مدة غياب الأشخاص بالدقائق

    if (systemState.motion) {
        lastMotionTime = currentTime; // تحديث الوقت لو وُجدت حركة
    } else {
        // لو لم توجد حركة لمدة تتجاوز 10 دقائق والتكييف يعمل
        if (absenceMinutes >= 10 && systemState.acPower) {
            
            // الحد الأقصى لدرجة الحرارة قبل الإيقاف النهائي (مثلاً 29 درجة)
            const MAX_ABSENCE_TEMP = 29;

            // رفع درجة الحرارة تدريجياً كل دقيقتين في حال غياب الحركة ولم تصل للحد الأقصى بعد
            if (systemState.setTemp < MAX_ABSENCE_TEMP) {
                if ((currentTime - lastTempRaiseTime) / 60000 >= 2) { // كل دقيقتين درجة
                    systemState.setTemp += 1;
                    lastTempRaiseTime = currentTime;
                    systemState.lastCommandSource = 'Smart-Auto (Energy Saver)';
                    console.log(`[Eco-Saver] No motion. Raising set temp to ${systemState.setTemp}°C`);
                }
            } else {
                // عندما تصل لدرجة الحرارة القصوى ولا يوجد أحد، يتم إيقاف التكييف تماماً
                systemState.acPower = false;
                systemState.lastCommandSource = 'Smart-Auto (Turned Off)';
                console.log(`[Eco-Saver] Max absence temp reached. AC turned OFF.`);
            }
        }
    }
}, 5000);

// --- مسارات الـ API ---

app.get('/api/status', (req, res) => {
    res.json(systemState);
});

app.post('/api/update-sensor', (req, res) => {
    const { temp, humidity, motion } = req.body;
    if (temp !== undefined) systemState.temp = temp;
    if (humidity !== undefined) systemState.humidity = humidity;
    if (motion !== undefined) {
        systemState.motion = motion;
        if (motion) lastMotionTime = Date.now();
    }
    systemState.lastUpdate = new Date().toLocaleTimeString();

    console.log(`[Sensor Update] Temp: ${temp}°C | Hum: ${humidity}% | Motion: ${motion}`);
    res.json({ status: 'success', message: 'Sensors updated successfully' });
});

app.post('/api/control', (req, res) => {
    const { acPower, setTemp, mode, fanSpeed, lastCommandSource, autoModeEnabled } = req.body;
    
    if (acPower !== undefined) systemState.acPower = acPower;
    if (setTemp !== undefined) systemState.setTemp = setTemp;
    if (mode !== undefined) systemState.mode = mode;
    if (fanSpeed !== undefined) systemState.fanSpeed = fanSpeed;
    if (lastCommandSource !== undefined) systemState.lastCommandSource = lastCommandSource;
    if (autoModeEnabled !== undefined) systemState.autoModeEnabled = autoModeEnabled;
    
    systemState.lastUpdate = new Date().toLocaleTimeString();

    console.log(`[Control] Power: ${systemState.acPower} | Temp: ${systemState.setTemp}°C | Source: ${systemState.lastCommandSource}`);
    res.json({ status: 'success', systemState });
});

app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 LAMMAH Server running on port ${PORT}`);
    console.log(`🔗 Local Link: http://localhost:${PORT}`);
    console.log(`=================================`);
});