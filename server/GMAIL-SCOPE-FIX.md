# Fixing Gmail Scope 403 Error

## Problem

If you see this error in the logs:
```
Gmail batchModify — 403 Insufficient Scopes
```

This means the OAuth token doesn't include the `https://www.googleapis.com/auth/gmail.modify` scope.

## Solution

### Step 1: Verify Scopes are Configured

The following scopes are now configured in `server/src/routes/googleAuth.ts`:

```typescript
const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.labels',
    'https://www.googleapis.com/auth/gmail.modify',      // required for batchModify
];
```

### Step 2: Clear Existing Tokens (Force Re-authentication)

Users with old tokens need to re-authenticate to grant the new scope. Run:

```bash
cd server
npx ts-node scripts/clear-gmail-tokens.ts
```

This will:
- Find all users with existing Gmail tokens
- Clear their tokens (access token, refresh token, email, enabled flag)
- Users will be prompted to re-connect their Gmail account on next use

### Step 3: User Re-authentication

After clearing tokens, users will see:
1. A message to connect their Gmail account when they try to scan their inbox
2. The Google OAuth consent screen with all required scopes listed
3. After granting permission, the new token will include `gmail.modify` scope

### Alternative: Manual Token Clear

You can also manually clear tokens in MongoDB:

```javascript
db.profiles.updateMany(
  { 'integrations.google.accessToken': { $ne: null } },
  {
    $set: {
      'integrations.google.accessToken': null,
      'integrations.google.refreshToken': null,
      'integrations.google.email': null,
      'integrations.google.enabled': false
    }
  }
)
```

## Verification

After re-authentication, check the logs when scanning emails:
- The 403 error should no longer appear
- `batchModify` should succeed
- Emails will be labeled with `vibe-hired-processed` as expected

## Scopes Explained

| Scope | Purpose |
|-------|---------|
| `gmail.readonly` | Read email messages |
| `gmail.labels` | Create and manage labels |
| `gmail.modify` | Add/remove labels from messages (required for batchModify) |
