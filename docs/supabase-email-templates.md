# Supabase Email Templates

Update these templates in your Supabase Dashboard:
**Authentication > Email Templates**

https://supabase.com/dashboard/project/vfmodxydmunqgbkjolpz/auth/templates

---

## Magic Link (OTP) Template

**Subject:** Your QM System verification code

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155;">
          <tr>
            <td style="padding: 40px;">
              <!-- Logo -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <div style="width: 64px; height: 64px; background-color: #d97706; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                      <img src="https://api.iconify.design/lucide:package.svg?color=%23ffffff" width="32" height="32" alt="QM" style="display: block;">
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #f8fafc; letter-spacing: -0.025em;">
                      Your Verification Code
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <p style="margin: 0; font-size: 14px; color: #94a3b8;">
                      Enter this code to sign in to QM System
                    </p>
                  </td>
                </tr>
              </table>

              <!-- OTP Code -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <div style="background-color: #0f172a; border: 2px solid #d97706; border-radius: 12px; padding: 20px 32px; display: inline-block;">
                      <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #f8fafc; font-family: 'Courier New', monospace;">
                        {{ .Token }}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Info -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">
                      This code will expire in <strong style="color: #f8fafc;">10 minutes</strong>.
                      <br>
                      If you didn't request this code, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 24px 0;">
                    <div style="border-top: 1px solid #334155;"></div>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-size: 12px; color: #64748b;">
                      QM System - Request & Inventory Management
                      <br>
                      This is an automated message, please do not reply.
                    </p>
                  </td>
                </tr>
              </table>
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

## Confirmation Email Template (Optional)

**Subject:** Confirm your QM System account

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your Account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155;">
          <tr>
            <td style="padding: 40px;">
              <!-- Logo -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <div style="width: 64px; height: 64px; background-color: #d97706; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                      <img src="https://api.iconify.design/lucide:package.svg?color=%23ffffff" width="32" height="32" alt="QM" style="display: block;">
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #f8fafc; letter-spacing: -0.025em;">
                      Welcome to QM System
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <p style="margin: 0; font-size: 14px; color: #94a3b8;">
                      Click the button below to confirm your account
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #d97706; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                      Confirm Account
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Alternative Link -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                      Or copy and paste this link in your browser:
                      <br>
                      <a href="{{ .ConfirmationURL }}" style="color: #d97706; word-break: break-all;">{{ .ConfirmationURL }}</a>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 24px 0;">
                    <div style="border-top: 1px solid #334155;"></div>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-size: 12px; color: #64748b;">
                      QM System - Request & Inventory Management
                      <br>
                      This is an automated message, please do not reply.
                    </p>
                  </td>
                </tr>
              </table>
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

## How to Update Templates

1. Go to **Supabase Dashboard** > **Authentication** > **Email Templates**
2. Select **Magic Link** template
3. Update **Subject** and **Body** with the content above
4. Click **Save**

The `{{ .Token }}` variable will be replaced with the 6-digit OTP code automatically.

---

## Email Provider Setup (Required)

For emails to be sent, you need to configure SMTP in Supabase:

1. Go to **Project Settings** > **Authentication**
2. Scroll to **SMTP Settings**
3. Enable **Custom SMTP**
4. Enter your SMTP credentials:
   - **Host**: smtp.gmail.com (or your provider)
   - **Port**: 587
   - **User**: your-email@gmail.com
   - **Password**: your-app-password (for Gmail, use App Passwords)
   - **Sender email**: noreply@yourdomain.com
   - **Sender name**: QM System

### Gmail App Password Setup

If using Gmail:
1. Go to Google Account > Security
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate a new app password for "Mail"
5. Use this password in Supabase SMTP settings
