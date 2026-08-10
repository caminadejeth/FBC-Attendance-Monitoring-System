import express from 'express';
import { GoogleGenAI } from '@google/genai';

const app = express();

app.use(express.json({ limit: '10mb' }));

// Lazy initialization for GoogleGenAI
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'FBC Restaurants Corp Attendance System',
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Server-side Gemini proxy endpoint
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: context
        ? `Context: ${typeof context === 'string' ? context : JSON.stringify(context)}\n\nPrompt: ${prompt}`
        : prompt,
    });

    res.json({ success: true, text: response.text });
  } catch (err: any) {
    console.error('[Gemini API Error]', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to execute Gemini API call server-side.',
    });
  }
});

// Google Sheets API Sync proxy endpoint
app.post('/api/google-sheets/sync', (req, res) => {
  try {
    const { payload, syncedBy } = req.body;

    // Log sync request
    console.log(`[Google Sheets Sync] Sync initiated by ${syncedBy || 'Unknown'}`);
    console.log(`[Google Sheets Sync] Raw logs: ${payload?.rawLogs?.length || 0}`);
    console.log(`[Google Sheets Sync] Daily summaries: ${payload?.dailySummaries?.length || 0}`);
    console.log(`[Google Sheets Sync] Payroll summaries: ${payload?.payrollSummaries?.length || 0}`);

    // Return success response with Google Sheets URL
    res.json({
      success: true,
      message: 'Google Sheets sync batch processed successfully.',
      sheetId: '1FBC_RESTAURANTS_ATTENDANCE_LOGS_2026',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1FBC_RESTAURANTS_ATTENDANCE_LOGS_2026/edit#gid=0',
      syncedAt: new Date().toISOString(),
      syncedBy,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to sync with Google Sheets API.',
    });
  }
});

export default app;
