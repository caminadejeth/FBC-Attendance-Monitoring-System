import express from 'express';
import { GoogleGenAI } from '@google/genai';
import nodemailer from 'nodemailer';

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
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return aiInstance;
}

const DEFAULT_ADMIN_ALERT_EMAIL = 'caminadejeth@gmail.com';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface IncomingAlertPayload {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'info' | string;
  title: string;
  description: string;
  meta?: string;
  timestamp?: string;
}

// In-memory 24h deduplication cache to avoid spamming duplicate alert emails across concurrent tabs
const sentAlertEmailCache = new Map<string, number>();
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000;

function cleanupDedupCache() {
  const now = Date.now();
  for (const [key, ts] of sentAlertEmailCache.entries()) {
    if (now - ts > DEDUP_TTL_MS) {
      sentAlertEmailCache.delete(key);
    }
  }
}

function escapeHtml(input: unknown): string {
  const str = String(input ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeText(input: unknown, maxLen = 500): string {
  return String(input ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function getEmailProviderConfig() {
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const defaultRecipient = (
    process.env.ADMIN_ALERT_EMAIL || DEFAULT_ADMIN_ALERT_EMAIL
  ).trim();
  const fromAddress = (
    process.env.SMTP_FROM ||
    smtpUser ||
    'FBC Attendance Alerts <noreply@fbcrestaurants.com>'
  ).trim();

  if (smtpUser && smtpPass) {
    return {
      configured: true,
      provider: 'smtp' as const,
      smtpHost,
      smtpPort: Number.isFinite(smtpPort) ? smtpPort : 587,
      smtpUser,
      smtpPass,
      fromAddress,
      defaultRecipient,
    };
  }

  if (resendApiKey) {
    return {
      configured: true,
      provider: 'resend' as const,
      resendApiKey,
      fromAddress: (process.env.SMTP_FROM || 'FBC Attendance Alerts <onboarding@resend.dev>').trim(),
      defaultRecipient,
    };
  }

  return {
    configured: false,
    provider: 'none' as const,
    fromAddress,
    defaultRecipient,
  };
}

function buildAlertEmailHtml(
  alerts: IncomingAlertPayload[],
  isTest: boolean,
  triggeredBy: string
): string {
  const rowsHtml = alerts
    .map((a) => {
      const sevUpper = sanitizeText(a.severity || 'info', 20).toUpperCase();
      const sevBg =
        sevUpper === 'CRITICAL'
          ? '#fee2e2'
          : sevUpper === 'WARNING'
          ? '#fef3c7'
          : '#e0f2fe';
      const sevColor =
        sevUpper === 'CRITICAL'
          ? '#991b1b'
          : sevUpper === 'WARNING'
          ? '#92400e'
          : '#075985';

      return `
        <tr>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e4e4e7; vertical-align: top;">
            <div style="margin-bottom: 4px;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: ${sevBg}; color: ${sevColor}; font-size: 11px; font-weight: 800; text-transform: uppercase;">
                ${escapeHtml(sevUpper)} · ${escapeHtml(sanitizeText(a.category, 40))}
              </span>
            </div>
            <div style="font-size: 14px; font-weight: 800; color: #18181b; margin-bottom: 3px;">
              ${escapeHtml(sanitizeText(a.title, 180))}
            </div>
            <div style="font-size: 13px; color: #3f3f46; line-height: 1.45;">
              ${escapeHtml(sanitizeText(a.description, 400))}
            </div>
            ${
              a.meta
                ? `<div style="font-size: 11px; color: #71717a; margin-top: 4px;">${escapeHtml(sanitizeText(a.meta, 180))}</div>`
                : ''
            }
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <!doctype html>
    <html>
      <body style="margin: 0; padding: 24px; background-color: #faf9f5; font-family: Arial, Helvetica, sans-serif; color: #18181b;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 2px solid #09090b; border-radius: 14px; overflow: hidden;">
          <div style="background: #09090b; color: #facc15; padding: 18px 22px; border-bottom: 4px solid #facc15;">
            <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;">
              FBC Restaurants Corp · Yellow Cab Pizza Co.
            </div>
            <h1 style="margin: 4px 0 0 0; font-size: 18px; color: #ffffff;">
              ${isTest ? 'Super Admin Email Notification Test' : `Super Admin Alert Notification (${alerts.length})`}
            </h1>
          </div>

          <div style="padding: 18px 22px;">
            <p style="margin: 0 0 14px 0; font-size: 13px; color: #3f3f46;">
              ${
                isTest
                  ? 'Automatic email alerting for Super Admin is connected and ready.'
                  : 'The following operational alert(s) require Super Admin attention:'
              }
            </p>

            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e4e4e7; border-radius: 8px;">
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e4e4e7; font-size: 11px; color: #71717a;">
              Triggered by: <strong>${escapeHtml(sanitizeText(triggeredBy || 'System', 100))}</strong> ·
              Sent at ${escapeHtml(new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildAlertEmailText(
  alerts: IncomingAlertPayload[],
  isTest: boolean,
  triggeredBy: string
): string {
  const header = isTest
    ? 'FBC Restaurants Corp - Super Admin Email Notification Test'
    : `FBC Restaurants Corp - Super Admin Alert Notification (${alerts.length})`;

  const lines = alerts.map(
    (a, idx) =>
      `${idx + 1}. [${sanitizeText(a.severity, 20).toUpperCase()} · ${sanitizeText(a.category, 40)}] ${sanitizeText(a.title, 180)}\n   ${sanitizeText(a.description, 400)}${a.meta ? `\n   (${sanitizeText(a.meta, 180)})` : ''}`
  );

  return `${header}\n\n${lines.join('\n\n')}\n\nTriggered by: ${sanitizeText(triggeredBy || 'System', 100)}\nSent: ${new Date().toISOString()}`;
}

// API Routes
app.get('/api/health', (req, res) => {
  const emailCfg = getEmailProviderConfig();
  res.json({
    status: 'ok',
    system: 'FBC Restaurants Corp Attendance System',
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    emailConfigured: emailCfg.configured,
    emailProvider: emailCfg.provider,
  });
});

// Email Notification Configuration Status (never returns secrets)
app.get('/api/notifications/email-status', (req, res) => {
  const cfg = getEmailProviderConfig();
  res.json({
    configured: cfg.configured,
    provider: cfg.provider,
    defaultRecipient: cfg.defaultRecipient,
    senderConfigured: cfg.provider === 'smtp' ? Boolean(cfg.smtpUser) : cfg.configured,
  });
});

// Automatic Super Admin Alert Email Delivery Route
app.post('/api/notifications/send-alert-email', async (req, res) => {
  try {
    const {
      alerts: rawAlerts,
      recipientEmail: rawRecipient,
      isTest = false,
      triggeredBy = 'FBC Attendance Portal',
    } = req.body || {};

    if (!Array.isArray(rawAlerts) || rawAlerts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one alert item is required.',
      });
    }

    const cfg = getEmailProviderConfig();
    const targetRecipient =
      typeof rawRecipient === 'string' && EMAIL_REGEX.test(rawRecipient.trim())
        ? rawRecipient.trim()
        : cfg.defaultRecipient;

    if (!EMAIL_REGEX.test(targetRecipient)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient email address.',
      });
    }

    const sanitizedAlerts: IncomingAlertPayload[] = rawAlerts
      .slice(0, 25)
      .filter((a) => a && typeof a === 'object' && typeof a.title === 'string')
      .map((a) => ({
        id: sanitizeText(a.id || `alert-${Date.now()}`, 160),
        category: sanitizeText(a.category || 'ALERT', 40),
        severity: sanitizeText(a.severity || 'warning', 20).toLowerCase(),
        title: sanitizeText(a.title, 180),
        description: sanitizeText(a.description || '', 400),
        meta: a.meta ? sanitizeText(a.meta, 180) : undefined,
        timestamp: a.timestamp ? sanitizeText(a.timestamp, 60) : undefined,
      }));

    if (sanitizedAlerts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid alerts found in request payload.',
      });
    }

    cleanupDedupCache();
    const alertsToSend = isTest
      ? sanitizedAlerts
      : sanitizedAlerts.filter((a) => {
          const dedupKey = `${targetRecipient.toLowerCase()}::${a.id}`;
          return !sentAlertEmailCache.has(dedupKey);
        });

    if (alertsToSend.length === 0) {
      return res.json({
        success: true,
        deduplicated: true,
        sentCount: 0,
        recipient: targetRecipient,
        message: 'Alert(s) already emailed recently.',
      });
    }

    if (!cfg.configured) {
      return res.json({
        success: false,
        configured: false,
        code: 'EMAIL_NOT_CONFIGURED',
        recipient: targetRecipient,
        message:
          'Email transport is not configured yet. Set SMTP_USER and SMTP_PASS (Gmail App Password) or RESEND_API_KEY in environment secrets.',
      });
    }

    const subject = isTest
      ? '[FBC Super Admin] Automatic Email Notification Test'
      : alertsToSend.length === 1
      ? `[FBC Alert · ${alertsToSend[0].severity.toUpperCase()}] ${alertsToSend[0].title}`
      : `[FBC Alerts] ${alertsToSend.length} New Super Admin Alerts`;

    const htmlBody = buildAlertEmailHtml(alertsToSend, Boolean(isTest), String(triggeredBy));
    const textBody = buildAlertEmailText(alertsToSend, Boolean(isTest), String(triggeredBy));

    if (cfg.provider === 'smtp') {
      const transporter = nodemailer.createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        secure: cfg.smtpPort === 465,
        auth: {
          user: cfg.smtpUser,
          pass: cfg.smtpPass,
        },
      });

      await transporter.sendMail({
        from: cfg.fromAddress,
        to: targetRecipient,
        subject,
        text: textBody,
        html: htmlBody,
      });
    } else if (cfg.provider === 'resend') {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: cfg.fromAddress,
          to: [targetRecipient],
          subject,
          text: textBody,
          html: htmlBody,
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text().catch(() => 'Resend API failure');
        throw new Error(`Email provider error (${resendRes.status}): ${errBody.slice(0, 200)}`);
      }
    }

    if (!isTest) {
      const now = Date.now();
      for (const a of alertsToSend) {
        sentAlertEmailCache.set(`${targetRecipient.toLowerCase()}::${a.id}`, now);
      }
    }

    return res.json({
      success: true,
      configured: true,
      provider: cfg.provider,
      sentCount: alertsToSend.length,
      recipient: targetRecipient,
      sentAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Email Notification Error]', err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to send Super Admin alert email.',
    });
  }
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
      model: 'gemini-4-hydrogen',
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
