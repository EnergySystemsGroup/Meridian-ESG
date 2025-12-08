# Azure AD SSO Integration Requirements

## Overview

The Meridian ESG platform requires Microsoft Azure AD Single Sign-On (SSO) integration through Supabase authentication. This document outlines the specific configuration requirements needed from the Azure AD administrator.

## Current Authentication Setup

- **Platform**: Supabase Authentication with SSR utilities
- **Framework**: Next.js 15 with App Router
- **Session Management**: Cookie-based (via `@supabase/ssr`)
- **Environments**: Staging and Production

## Requirements for Azure AD Administrator (Jeff)

### Application Registrations Needed

Please create **two separate Azure AD App Registrations**:
1. Meridian ESG - Staging
2. Meridian ESG - Production

### Configuration Details Required

For **each environment** (Staging and Production), we need:

#### 1. Application (Client) ID
- The unique identifier for the Azure AD application
- Found in Azure Portal → App Registrations → Overview

#### 2. Client Secret
- Generated from Azure Portal → App Registrations → Certificates & secrets
- **Important**: Provide the secret value (visible only once at creation)
- Recommended: Set expiration to 24 months

#### 3. Tenant ID (Directory ID)
- The Azure AD tenant identifier
- Found in Azure Portal → App Registrations → Overview
- Also available in Azure Active Directory → Overview

#### 4. Redirect URIs

These need to be configured in Azure AD under "Authentication" → "Platform configurations" → "Web":

**Staging Environment:**
```
https://[staging-project-ref].supabase.co/auth/v1/callback
```

**Production Environment:**
```
https://[production-project-ref].supabase.co/auth/v1/callback
```

> **Note**: The exact Supabase project URLs will be provided once the Azure AD apps are created.

### Azure AD App Registration Settings

When creating each app registration, please configure:

#### Supported Account Types
- **Setting**: Accounts in this organizational directory only (single tenant)
- **Reason**: Restricts authentication to our organization's users only

#### API Permissions
Add the following Microsoft Graph permissions:
- `openid` - Sign users in
- `email` - View users' email address
- `profile` - View users' basic profile

**Grant admin consent** for these permissions if required by organizational policy.

#### Platform Configuration
- **Type**: Web application
- **Redirect URIs**: As specified above
- **Front-channel logout URL**: (Optional) Can be configured later
- **Implicit grant and hybrid flows**: None required

#### Authentication Settings
- **Allow public client flows**: No
- **Supported account types**: Single tenant
- **Treat application as a public client**: No

### Security Considerations

#### Client Secret Management
- Generate secrets with 24-month expiration
- Plan for secret rotation before expiration
- Never commit secrets to source control
- Secrets will be stored securely in Supabase dashboard

#### Access Control
- Only users in our Azure AD tenant can authenticate
- Consider configuring Conditional Access policies if required
- Optional: Restrict to specific security groups if needed

## Questions for Azure AD Administrator

1. **Tenant Policies**: Are there any specific security policies or restrictions for our Azure tenant that we should be aware of?

2. **Admin Consent**: Do we need any special approvals or admin consent for these app registrations?

3. **Naming Convention**: Should we use a specific naming convention for the app registrations?

4. **Security Groups**: Should authentication be restricted to specific Azure AD security groups?

5. **Conditional Access**: Are there any Conditional Access policies we need to consider?

6. **MFA Requirements**: Are there any Multi-Factor Authentication requirements that affect SSO integration?

## Implementation Timeline

1. **Phase 1**: Azure AD app registrations created (Jeff)
2. **Phase 2**: Credentials provided securely
3. **Phase 3**: Supabase configuration (Development team)
4. **Phase 4**: Testing in staging environment
5. **Phase 5**: Production deployment

## Integration Overview

### How It Works

1. User clicks "Sign in with Microsoft" on Meridian platform
2. User is redirected to Microsoft login page
3. User authenticates with Azure AD credentials
4. Azure AD redirects back to Supabase callback URL
5. Supabase creates/updates user session
6. User is redirected to Meridian application with active session

### Supabase Configuration (Post-Credential Receipt)

Once credentials are provided, the development team will:

1. Add Azure provider configuration in Supabase dashboard
2. Update `supabase/config.toml` for local development:
   ```toml
   [auth.external.azure]
   enabled = true
   client_id = "env(AZURE_CLIENT_ID)"
   secret = "env(AZURE_SECRET)"
   url = "https://login.microsoftonline.com/{tenant_id}/v2.0"
   ```
3. Test authentication flow in staging
4. Deploy to production

### Environment Variables (Development Team)

These will be configured in Supabase dashboard (not in code):
- `AZURE_CLIENT_ID` (staging)
- `AZURE_SECRET` (staging)
- `AZURE_CLIENT_ID` (production)
- `AZURE_SECRET` (production)

## Testing Checklist

After configuration:

- [ ] User can sign in with Microsoft account (staging)
- [ ] User profile information correctly populated
- [ ] Session persists across page refreshes
- [ ] Sign out functionality works
- [ ] Redirect URLs work correctly
- [ ] No console errors during auth flow
- [ ] Repeat all tests in production environment

## Support Contacts

**Azure AD Configuration**: Jeff (Azure AD Administrator)
**Supabase Configuration**: Development Team
**Integration Testing**: Development Team + QA

## References

- [Supabase Azure AD Integration Docs](https://supabase.com/docs/guides/auth/social-login/auth-azure)
- [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Azure AD App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

---

**Document Version**: 1.0
**Last Updated**: 2025-12-05
**Status**: Pending Azure AD Configuration
