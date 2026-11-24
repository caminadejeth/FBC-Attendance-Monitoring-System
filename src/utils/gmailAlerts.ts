import {
  GoogleAuthProvider,
  User as FirebaseAuthUser,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { AdminAlertItem } from './adminAlerts';

export const SCOPES = ['https://www.googleapis.com/auth/gmail.send'] as const;

export const DEFAULT_SUPER_ADMIN_ALERT_EMAIL = 'caminadejeth@gmail.com';

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

// Store access token strictly in memory (never in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;
let cachedGoogleEmail: string | null = null;
let isSigningIn = false;

export class GmailAuthExpiredError extends Error {
  constructor(message = 'Gmail authorization expired or unavailable. Please reconnect Google.') {
    super(message);
    this.name = 'GmailAuthExpiredError';
  }
}

export const initGmailAuth = (
  onAuthSuccess?: (user: FirebaseAuthUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: FirebaseAuthUser | null) => {
    if (user) {
      if (cachedAccessToken) {
        cachedGoogleEmail = user.email || cachedGoogleEmail;
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        cachedGoogleEmail = user.email || null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      cachedGoogleEmail = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignInForGmail = async (): Promise<{
  user: FirebaseAuthUser;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get Gmail access token from Google Sign-In');
    }
    cachedAccessToken = credential.accessToken;
    cachedGoogleEmail = result.user.email || null;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const getGmailAccessToken = (): string | null => cachedAccessToken;

export const getConnectedGmailAddress = (): string | null =>
  cachedGoogleEmail || auth.currentUser?.email || null;

export const logoutGmailAuth = async (): Promise<void> => {
  cachedAccessToken = null;
  cachedGoogleEmail = null;
  try {
    await auth.signOut();
  } catch (err) {
    console.error('Failed signing out Gmail auth:', err);
  }
};

export function isValidEmailAddress(email: string): boolean {
  const trimmed = (email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

const escapeHtml = (value: string): string =>
  (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function encodeBase64UrlUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeMimeHeaderUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

export function buildAlertEmailHtml(
  alerts: AdminAlertItem[],
  options: {
    recipientEmail: string;
    triggeredBy?: string;
    isTest?: boolean;
  }
): { subject: string; htmlBody: string } {
  const safeRecipient = escapeHtml(options.recipientEmail);
  const safeTriggeredBy = escapeHtml(options.triggeredBy || 'Super Admin');
  const sentAt = new Date().toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  if (options.isTest) {
    const subject = '[FBC Yellow Cab] Test Super Admin Alert Notification';
    const htmlBody = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; border: 2px solid #09090b; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: #09090b; color: #fbbf24; padding: 16px 20px;">
          <div style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">FBC Restaurants Corp · Yellow Cab Pizza Co.</div>
          <h2 style="margin: 4px 0 0; font-size: 18px; color: #ffffff;">Super Admin Email Alerts Connected</h2>
        </div>
        <div style="padding: 20px; color: #18181b; font-size: 13px; line-height: 1.6;">
          <p style="margin-top: 0;">This is a test notification confirming that <strong>${safeRecipient}</strong> is ready to receive Super Admin operational alerts via Gmail.</p>
          <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin: 14px 0;">
            <div><strong>Enabled Alert Streams:</strong></div>
            <ul style="margin: 6px 0 0; padding-left: 18px;">
              <li>Pending STR Requisitions needing Super Admin Review</li>
              <li>Monitored Branch Low Stock &amp; Out-of-Stock Warnings</li>
              <li>Near-Expiry &amp; Expired Inventory Alerts</li>
              <li>Employee Attendance Disputes, CTO Requests &amp; Missing Punches</li>
            </ul>
          </div>
          <p style="font-size: 11px; color: #71717a; margin-bottom: 0;">Triggered by ${safeTriggeredBy} · ${escapeHtml(sentAt)}</p>
        </div>
      </div>
    `;
    return { subject, htmlBody };
  }

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  const firstAlert = alerts[0];
  const subject =
    alerts.length === 1 && firstAlert
      ? `[FBC Alert · ${firstAlert.severity.toUpperCase()}] ${firstAlert.title}`
      : `[FBC Alert${criticalCount > 0 ? ' · CRITICAL' : ''}] ${alerts.length} Super Admin Notification${alerts.length === 1 ? '' : 's'}`;

  const rowsHtml = alerts
    .map((alert) => {
      const badgeBg =
        alert.severity === 'critical'
          ? '#fee2e2'
          : alert.severity === 'warning'
          ? '#fef3c7'
          : '#e0f2fe';
      const badgeText =
        alert.severity === 'critical'
          ? '#991b1b'
          : alert.severity === 'warning'
          ? '#92400e'
          : '#075985';
      const sevLabel =
        alert.severity === 'critical'
          ? 'CRITICAL'
          : alert.severity === 'warning'
          ? 'ACTION NEEDED'
          : 'NOTICE';

      return `
        <tr>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e4e4e7; vertical-align: top;">
            <div style="margin-bottom: 4px;">
              <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 800; background: ${badgeBg}; color: ${badgeText}; text-transform: uppercase;">
                ${sevLabel} · ${escapeHtml(alert.category.replace('_', ' '))}
              </span>
            </div>
            <div style="font-size: 13px; font-weight: 800; color: #09090b; margin-bottom: 2px;">
              ${escapeHtml(alert.title)}
            </div>
            <div style="font-size: 12px; color: #3f3f46; margin-bottom: 3px;">
              ${escapeHtml(alert.description)}
            </div>
            <div style="font-size: 11px; color: #71717a;">
              ${escapeHtml(alert.meta)} · Action: <strong>${escapeHtml(alert.actionLabel)}</strong>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  const htmlBody = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 680px; margin: 0 auto; border: 2px solid #09090b; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: #09090b; color: #fbbf24; padding: 16px 20px;">
        <div style="font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">FBC Restaurants Corp · Yellow Cab Pizza Co.</div>
        <h2 style="margin: 4px 0 0; font-size: 18px; color: #ffffff;">
          Super Admin Alert Digest (${alerts.length})
        </h2>
        <div style="font-size: 11px; color: #d4d4d8; margin-top: 4px;">
          Critical: ${criticalCount} · Action Needed: ${warningCount} · Sent to ${safeRecipient}
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div style="padding: 12px 16px; background: #fafafa; font-size: 11px; color: #71717a; border-top: 1px solid #e4e4e7;">
        Sent from FBC Biometric Attendance &amp; Warehouse Inventory Portal by ${safeTriggeredBy} · ${escapeHtml(sentAt)}
      </div>
    </div>
  `;

  return { subject, htmlBody };
}

export async function sendGmailAlertEmail(params: {
  accessToken: string;
  to: string;
  fromEmail?: string | null;
  alerts: AdminAlertItem[];
  triggeredBy?: string;
  isTest?: boolean;
}): Promise<{ id?: string; threadId?: string; subject: string }> {
  const recipient = (params.to || '').trim();
  if (!isValidEmailAddress(recipient)) {
    throw new Error('Please enter a valid recipient email address.');
  }
  if (!params.accessToken) {
    throw new GmailAuthExpiredError();
  }

  const { subject, htmlBody } = buildAlertEmailHtml(params.alerts, {
    recipientEmail: recipient,
    triggeredBy: params.triggeredBy,
    isTest: params.isTest,
  });

  const headers = [
    params.fromEmail ? `From: ${params.fromEmail}` : '',
    `To: ${recipient}`,
    `Subject: ${encodeMimeHeaderUtf8(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ].filter(Boolean);

  const rawMime = `${headers.join('\r\n')}\r\n\r\n${htmlBody}`;
  const raw = encodeBase64UrlUtf8(rawMime);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (res.status === 401 || res.status === 403) {
    cachedAccessToken = null;
    throw new GmailAuthExpiredError(
      'Gmail session expired or permission was revoked. Please sign in with Google again.'
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = data?.error?.message || `Gmail send failed (${res.status})`;
    throw new Error(errMsg);
  }

  return {
    id: data.id,
    threadId: data.threadId,
    subject,
  };
}
