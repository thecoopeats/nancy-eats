// The sign-in email, styled to match the site's cozy pastel look.
// Email apps are picky, so this uses tables and inline styles only (no CSS
// classes, no SVG) and stays a single centered column that fits phones.

const colors = {
  background: "#fcf7f2",
  card: "#fffdfb",
  border: "#ecdcdf",
  foreground: "#3b2f36",
  muted: "#6a5a62",
  accent: "#a3486a",
  blush: "#fbe3ea",
  sage: "#e0efdf",
};

const headingFont = "Lora, Georgia, 'Times New Roman', serif";
const bodyFont = "'Atkinson Hyperlegible', Verdana, Arial, Helvetica, sans-serif";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const signInEmailSubject = "Your Nancy Eats sign-in link";

export function signInEmailHtml(url: string) {
  const { origin } = new URL(url);
  const link = escapeHtml(url);
  const logo = escapeHtml(`${origin}/email-logo.png`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${signInEmailSubject}</title>
</head>
<body style="margin:0;padding:0;background-color:${colors.background};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tap the big button to sign in to Nancy Eats.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${colors.background};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <img src="${logo}" width="72" height="72" alt="" style="display:block;border:0;width:72px;height:72px;">
            <div style="padding-top:10px;font-family:${headingFont};font-size:32px;line-height:1.2;font-weight:bold;font-style:italic;color:${colors.accent};">Nancy Eats</div>
          </td>
        </tr>
        <tr>
          <td style="background-color:${colors.card};border:2px solid ${colors.border};border-radius:24px;padding:32px 24px;">
            <h1 style="margin:0 0 16px;font-family:${headingFont};font-size:28px;line-height:1.3;font-weight:bold;color:${colors.foreground};">Hello! Ready to sign in?</h1>
            <p style="margin:0 0 28px;font-family:${bodyFont};font-size:20px;line-height:1.6;color:${colors.foreground};">Tap the big button below and you'll be signed in to Nancy Eats.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="${colors.accent}" style="border-radius:16px;background-color:${colors.accent};">
                  <a href="${link}" target="_blank" style="display:block;padding:20px 24px;font-family:${bodyFont};font-size:24px;line-height:1.2;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:16px;">Sign in</a>
                </td>
              </tr>
            </table>
            <p style="margin:28px 0 0;font-family:${bodyFont};font-size:18px;line-height:1.6;color:${colors.muted};">This link works for 24 hours. Once you're in, you'll stay signed in on this device.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 8px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:${colors.sage};border-radius:16px;padding:16px 20px;font-family:${bodyFont};font-size:17px;line-height:1.6;color:${colors.foreground};">
                  <strong>Button not working?</strong> Copy this link into your web browser:<br>
                  <a href="${link}" target="_blank" style="color:${colors.accent};word-break:break-all;">${link}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 8px 0;font-family:${bodyFont};font-size:16px;line-height:1.6;color:${colors.muted};">
            Didn't ask to sign in? You can safely ignore this email.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function signInEmailText(url: string) {
  return `Hello! Ready to sign in to Nancy Eats?

Open this link to sign in:
${url}

This link works for 24 hours. Once you're in, you'll stay signed in on this device.

Didn't ask to sign in? You can safely ignore this email.
`;
}
