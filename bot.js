const API_KEY = process.env.8b0b67f5cff246dcbbb98035d6d91a0a;
const TELEGRAM_TOKEN = process.env.8976318830:AAE8bEZSSxIUUmNg9bnePypQROz_LykVDxI;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TIMEFRAME = process.env.TIMEFRAME || '1h';

function calculateSMA(data, period) {
    let sma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            sma.push(null);
        } else {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j];
            }
            sma.push(sum / period);
        }
    }
    return sma;
}

async function run() {
    if (!API_KEY || !TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error('Environment Variables belum lengkap!');
        process.exit(1);
    }

    console.log(`[${new Date().toISOString()}] Memulai scanning XAU/USD...`);

    try {
        const url = `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=${TIMEFRAME}&outputsize=60&apikey=${API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === 'error') throw new Error(data.message);

        const candles = data.values.reverse();
        const medianPrices = candles.map(c => (parseFloat(c.high) + parseFloat(c.low)) / 2);
        const closes = candles.map(c => parseFloat(c.close));
        const highs = candles.map(c => parseFloat(c.high));
        const lows = candles.map(c => parseFloat(c.low));

        // Awesome Oscillator
        const sma5 = calculateSMA(medianPrices, 5);
        const sma34 = calculateSMA(medianPrices, 34);
        const aoValues = sma5.map((v, idx) => v && sma34[idx] ? v - sma34[idx] : null);

        const len = candles.length;
        const currPrice = closes[len - 1];
        const prevPrice = closes[len - 5];
        const currAO = aoValues[len - 1];
        const prevAO = aoValues[len - 5];

        let divergence = "Tidak Terdeteksi";
        let signal = "NEUTRAL";

        if (currPrice < prevPrice && currAO > prevAO && currAO < 0) {
            divergence = "Bullish Divergence 🚀";
            signal = "BUY";
        } else if (currPrice > prevPrice && currAO < prevAO && currAO > 0) {
            divergence = "Bearish Divergence 📉";
            signal = "SELL";
        }

        console.log(`Hasil Scan: Price $${currPrice.toFixed(2)} | Signal: ${signal}`);

        // Jika terdeteksi BUY atau SELL, kirim ke Telegram
        if (signal === "BUY" || signal === "SELL") {
            const recentHighs = highs.slice(-30);
            const recentLows = lows.slice(-30);
            const swingHigh = Math.max(...recentHighs);
            const swingLow = Math.min(...recentLows);
            const diff = swingHigh - swingLow;

            let entry = signal === "BUY" ? swingHigh - (diff * 0.618) : swingLow + (diff * 0.618);
            let tp = signal === "BUY" ? swingHigh : swingLow;
            let sl = signal === "BUY" ? swingLow - (diff * 0.05) : swingHigh + (diff * 0.05);

            const emoji = signal === 'BUY' ? '🟢 BUY' : '🔴 SELL';
            const message = `
<b>📢 TRADING SIGNAL XAUUSD (GitHub Cron)</b>
-----------------------------------
<b>Pair:</b> XAU/USD (GOLD)
<b>Timeframe:</b> ${TIMEFRAME}
<b>Signal:</b> ${emoji}
<b>AO Status:</b> ${divergence}

<b>Current Price:</b> $${currPrice.toFixed(2)}
<b>Entry Limit (Fibo 61.8%):</b> $${entry.toFixed(2)}
<b>Take Profit (TP):</b> $${tp.toFixed(2)}
<b>Stop Loss (SL):</b> $${sl.toFixed(2)}
            `.trim();

            await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' })
            });
            console.log('✅ Telegram alert terkirim!');
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

run();

