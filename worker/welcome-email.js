/**
 * Welcome email sent right after a job-alert signup.
 *
 * The signup worker does not send this HTML itself. A transactional send
 * leaves {{{RESEND_UNSUBSCRIBE_URL}}} as literal text and does not add
 * List-Unsubscribe headers. Job-alert broadcasts use that same placeholder;
 * Resend replaces it per contact and adds List-Unsubscribe and
 * List-Unsubscribe-Post. The published template job-alerts-welcome-v2 is
 * sent by the job_alerts.subscribed automation so this welcome gets that
 * same link.
 *
 * Keep this file identical to the published template.
 */

export const WELCOME_TEMPLATE_ALIAS = "job-alerts-welcome-v2";

export const WELCOME_SUBJECT = "You're on PublicJobs.ca job alerts";

export const WELCOME_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>You're signed up for job alerts</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f7f9;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f7f9" style="background-color:#f6f7f9;">
<tr>
<td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;max-width:600px;width:100%;">
<tr>
<td style="padding-top:32px;padding-bottom:8px;padding-left:32px;padding-right:32px;font-family:Arial, Helvetica, sans-serif;font-size:22px;line-height:30px;color:#16202C;font-weight:bold;">
You're signed up for job alerts
</td>
</tr>
<tr>
<td style="padding-top:8px;padding-bottom:16px;padding-left:32px;padding-right:32px;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:24px;color:#374151;">
Thanks for joining PublicJobs.ca. We'll email you when new openings at public employers in Toronto and the GTA are posted.
</td>
</tr>
<tr>
<td style="padding-top:0;padding-bottom:16px;padding-left:32px;padding-right:32px;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:24px;color:#374151;">
Browse openings anytime: <a href="https://publicjobs.ca" style="color:#1F4E79;text-decoration:underline;">publicjobs.ca</a>
</td>
</tr>
<tr>
<td style="padding-top:0;padding-bottom:16px;padding-left:32px;padding-right:32px;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation">
<tr>
<td align="center" bgcolor="#ffffff" style="background-color:#ffffff;border-width:1px;border-style:solid;border-color:#1F4E79;border-radius:4px;">
<a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="display:inline-block;padding-top:6px;padding-bottom:6px;padding-left:14px;padding-right:14px;font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:18px;color:#1F4E79;text-decoration:none;">Unsubscribe</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding-top:0;padding-bottom:32px;padding-left:32px;padding-right:32px;font-family:Arial, Helvetica, sans-serif;font-size:8px;line-height:11px;color:#6b7280;">
PublicJobs.ca, 65 Thorncliffe Park Drive, Apartment 603, Toronto, Ontario M4H 1L2, Canada. Contact: <a href="mailto:hello@publicjobs.ca" style="color:#6b7280;text-decoration:underline;">hello@publicjobs.ca</a>. <a href="https://publicjobs.ca/privacy/" style="color:#6b7280;text-decoration:underline;">Privacy policy</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

export const WELCOME_TEXT = `You're signed up for PublicJobs.ca job alerts.

Thanks for joining PublicJobs.ca. We'll email you when new openings at public employers in Toronto and the GTA are posted.

Browse openings anytime: https://publicjobs.ca

Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}

--
PublicJobs.ca, 65 Thorncliffe Park Drive, Apartment 603, Toronto, Ontario M4H 1L2, Canada. Contact: hello@publicjobs.ca.
Privacy policy: https://publicjobs.ca/privacy/
`;
