# 🔒 Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | ✅ Yes             |
| < 1.0   | ❌ No              |

---

## 🛡️ Security Features

### Authentication & Authorization
- **Supabase Auth** - Industry-standard authentication
- **Row Level Security (RLS)** - Database-level access control
- **JWT tokens** - Secure session management
- **Email verification** - Prevent fake accounts

### Data Protection
- **Encrypted connections** - All API calls use HTTPS
- **RLS policies** - Users can only access their own data
- **Input sanitization** - Protection against XSS attacks
- **SQL injection prevention** - Supabase parameterized queries

### API Security
- **Environment variables** - API keys never exposed in code
- **Rate limiting** - Prevent abuse of Gemini and Weather APIs
- **CORS policies** - Controlled cross-origin requests
- **Secure headers** - CSP, X-Frame-Options, etc.

---

## 🚨 Reporting a Vulnerability

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them responsibly:

### How to Report

1. **Email**: Send details to `aryanyadav@example.com` (replace with actual email)
2. **Subject**: "KhetGo Security Vulnerability"
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Fix timeline**: Depends on severity
  - **Critical**: 1-7 days
  - **High**: 7-30 days
  - **Medium**: 30-90 days
  - **Low**: Best effort

### Safe Harbor

We support responsible disclosure and will not take legal action against researchers who:
- Make a good faith effort to avoid privacy violations
- Do not exploit the vulnerability beyond demonstration
- Wait for our fix before public disclosure

---

## 🔐 Security Best Practices for Deployers

### Environment Variables

**Never commit these to Git:**
```bash
# ❌ NEVER EXPOSE PUBLICLY
VITE_SUPABASE_ANON_KEY=...
VITE_GEMINI_API_KEY=...
VITE_OPENWEATHER_API_KEY=...
```

**Always use:**
- `.env` file locally (gitignored)
- Vercel environment variables for production
- `.env.example` for reference (no real keys)

### Supabase Security

1. **Enable RLS on all tables**
   ```sql
   ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
   ```

2. **Create restrictive policies**
   ```sql
   -- Users can only read their own data
   CREATE POLICY "Users can view own listings"
   ON marketplace_listings FOR SELECT
   USING (auth.uid() = user_id);
   ```

3. **Use anon key in frontend** (not service_role key)
4. **Enable email verification**
5. **Set up database backups**

### Rate Limiting

Implement client-side rate limiting for API calls:

```javascript
// Example: Limit Gemini API calls
let lastAPICall = 0;
const API_COOLDOWN = 2000; // 2 seconds

async function callGeminiAPI(prompt) {
  const now = Date.now();
  if (now - lastAPICall < API_COOLDOWN) {
    throw new Error('Please wait before making another request');
  }
  lastAPICall = now;
  // Proceed with API call...
}
```

### Content Security Policy

Add to `index.html`:
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: https:; 
               connect-src 'self' https://niexjhbhotnzrkddlfwm.supabase.co https://api.openweathermap.org https://generativelanguage.googleapis.com">
```

---

## 🔍 Security Audits

### Self-Audit Checklist

Before deploying, verify:

- [ ] All `.env` files are in `.gitignore`
- [ ] No API keys in source code
- [ ] RLS enabled on all Supabase tables
- [ ] RLS policies tested and working
- [ ] Input validation on all forms
- [ ] XSS protection implemented
- [ ] HTTPS enforced in production
- [ ] Security headers configured
- [ ] Dependencies up to date (`npm audit`)
- [ ] Error messages don't leak sensitive info

### Automated Security

Run regularly:
```bash
# Check for vulnerable dependencies
npm audit

# Fix vulnerabilities
npm audit fix
```

---

## 🚀 Incident Response

In case of a security breach:

1. **Immediate**: Revoke compromised API keys
2. **Assess**: Determine scope of breach
3. **Notify**: Inform affected users within 72 hours
4. **Fix**: Deploy patches
5. **Post-mortem**: Document and learn

---

## 📋 Known Security Considerations

### API Keys in Frontend
- **Issue**: Frontend API keys are visible in browser
- **Mitigation**: 
  - Using anon keys (limited permissions)
  - RLS policies prevent unauthorized access
  - Rate limiting prevents abuse
  - Consider backend proxy for production

### File Uploads
- **Issue**: Users can upload malicious files
- **Mitigation**:
  - Supabase Storage security policies
  - File type validation
  - Size limits enforced
  - Public bucket (no executable files served)

### GPS Location
- **Issue**: User location privacy
- **Mitigation**:
  - User must explicitly allow location
  - Approximate location used (not exact GPS)
  - No location stored permanently

---

## 📚 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

## 🏆 Hall of Fame

Security researchers who have responsibly disclosed vulnerabilities:

*(None yet - be the first!)*

---

**Last Updated**: 2026-01-14  
**Version**: 1.0.0

**Security is a journey, not a destination. Stay vigilant!** 🛡️
