# Invite Email Template — Left Field Labs

Shared invite email template used by every Gathered app (Magnify, Steward, Tidings, Knit, Glean). The same template lives in two Supabase projects:

- **`jdlykebsqafcngpntxma`** (Tidings) — currently used.
- **`isogetmvnpimcmouakeg`** (Magnify, Steward, Glean, Knit) — paste so it's ready when those apps add invite flows.

Each app's invite-create code passes `app: '<App Name>'` in `auth.admin.inviteUserByEmail({ data: { app } })`. The template reads it as `{{ .Data.app }}` to swap the app name into the subject and body.

If a future call doesn't pass `app` for any reason, the template falls back to "Left Field Labs" so the email is still coherent.

---

## Where to paste

Supabase dashboard → **Authentication → Emails → Invite user**.

There are two fields:

### Subject

```
You've been invited to {{ if .Data.app }}{{ .Data.app }}{{ else }}Left Field Labs{{ end }}
```

### Message body (HTML)

Paste the full HTML below. Supabase will render it as-is.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>You're invited</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background:#0f172a;padding:24px 28px;">
              <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Left Field Labs</p>
              <p style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:600;">{{ if .Data.app }}{{ .Data.app }}{{ else }}Gathered apps{{ end }}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:600;">
                You're invited to {{ if .Data.app }}{{ .Data.app }}{{ else }}a Left Field Labs app{{ end }}
              </h1>
              <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.55;">
                Your stake leadership has set up an account for you on
                <strong>{{ if .Data.app }}{{ .Data.app }}{{ else }}a Left Field Labs app{{ end }}</strong>.
                Tap the button below to choose your password and finish setup.
              </p>
              <p style="margin:0 0 28px;text-align:center;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 28px;border-radius:8px;">
                  Accept invite
                </a>
              </p>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.55;">
                This link is good for 7 days and only works for <strong>{{ .Email }}</strong>.
                If you weren't expecting this email you can ignore it — nothing happens until you click.
              </p>
              <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.55;">
                Trouble with the button? Copy this URL into your browser:<br>
                <span style="word-break:break-all;color:#475569;">{{ .ConfirmationURL }}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:18px 28px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                Sent by <strong style="color:#475569;">Left Field Labs</strong> — the team that builds
                {{ if .Data.app }}{{ .Data.app }}{{ else }}Magnify, Steward, Tidings, Knit, and Glean{{ end }}
                and other tools for Latter-day Saint stake leadership.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## How the per-app branding works

Each app's invite flow calls `supabase.auth.admin.inviteUserByEmail` with a `data` field containing `app: '<App Name>'`. Supabase stashes that on the new user's `raw_user_meta_data`, and the template reads it as `{{ .Data.app }}`.

| App | `data.app` value passed | Where set |
|---|---|---|
| Tidings | `"Tidings"` | [supabase/functions/invite-create](../supabase/functions/invite-create/index.ts), [supabase/functions/invite-resend](../supabase/functions/invite-resend/index.ts) |
| Magnify | `"Magnify"` | _not yet implemented — when invite flow is added, set `data.app = "Magnify"`_ |
| Steward | `"Steward"` | _not yet implemented_ |
| Knit | `"Knit"` | _not yet implemented_ |
| Glean | `"Glean"` | _not yet implemented_ |

If you're adding an invite flow to one of the other apps, follow Tidings's pattern — pass `data: { app: 'Magnify' }` (or whatever) and the same template renders correctly.

---

## Sender domain

The "From" address on these emails comes from whatever Supabase has configured for that project (default: `noreply@mail.app.supabase.io`). If you eventually verify a Left Field Labs domain in Resend or another SMTP provider and configure custom SMTP in Supabase, the template stays the same — only the From address changes.

---

## Testing the template

Cheapest test: in Supabase dashboard, **Authentication → Emails → Invite user → Send test email**. The dashboard's preview won't substitute `{{ .Data.app }}` since there's no real user metadata, but you'll see the layout. For a real test, send yourself an invite from one of the apps (e.g., Tidings → Admin → Send Invite) and check the email.
