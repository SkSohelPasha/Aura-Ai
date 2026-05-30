# Aura AI Backend - Render Deployment Guide

## Prerequisites
- GitHub repository with the code pushed
- Render account (https://render.com)
- Supabase PostgreSQL database credentials

## Step-by-Step Deployment

### 1. Connect GitHub to Render
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Select "Deploy an existing repository"
4. Connect your GitHub account and select the `aura-ai` repository

### 2. Configure the Web Service

**Basic Settings:**
- Name: `aura-ai-backend`
- Environment: `Python 3`
- Build Command: `pip install -r backend/requirements.txt`
- Start Command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Instance Type: `Free` (or upgrade as needed)

### 3. Set Environment Variables

In the Render dashboard, add these environment variables under "Environment":

```
APP_ENV = production
SECRET_KEY = <generate-a-strong-random-secret-key-min-32-chars>
ALLOWED_ORIGINS = https://your-frontend-domain.onrender.com,https://yourdomain.com
user = postgres.xxxxx (from Supabase)
password = <your-supabase-password>
host = aws-0-region.pooler.supabase.com (from Supabase)
port = 5432
dbname = postgres
OPENAI_API_KEY = sk-your-api-key
GOOGLE_API_KEY = your-google-api-key
GOOGLE_CLIENT_ID = your-google-client-id.apps.googleusercontent.com
```

**How to get Supabase credentials:**
1. Go to https://app.supabase.com
2. Select your project
3. Settings → Database → Connection string
4. Choose "URI" and copy the connection details
5. Extract: user, password, host from the URI

### 4. Enable Auto-Deploy
1. Check "Auto-deploy" to automatically redeploy when you push to GitHub

### 5. Deploy
Click "Create Web Service" to start the deployment.

## Monitoring Deployment

### Check Deployment Status
1. Go to the web service dashboard
2. Click "Logs" to see real-time deployment logs
3. Check for errors in the build process

### Common Issues & Solutions

#### Issue: "Exit status 1" Error
**Causes:**
- Missing environment variables
- Database connection failed
- Missing dependencies

**Solution:**
```bash
# Check logs for detailed error message
# Verify all environment variables are set
# Ensure database credentials are correct
```

#### Issue: Database Connection Failed
**Solution:**
1. Verify Supabase credentials are correct
2. Check that Supabase is accessible from Render (it should be)
3. Ensure SSL mode is set to `require` in the connection string

#### Issue: Module Not Found
**Solution:**
- Ensure all dependencies are in `backend/requirements.txt`
- Verify the build command includes the correct path

### View Logs
```bash
# In Render dashboard:
# Service → Logs (real-time)
# Service → Logs (historical)
```

### Test the API
Once deployed, test your backend:
```bash
curl https://your-service-name.onrender.com/docs
```

## Updating the Deployment

### After Making Code Changes:
1. Commit and push to GitHub
2. If auto-deploy is enabled, Render will automatically redeploy
3. If not, manually trigger by clicking "Manual Deploy" in Render dashboard

## Connecting Frontend

Update your frontend API client to point to the Render backend:

```javascript
// frontend/src/api/client.js
const BASE_URL = 'https://your-service-name.onrender.com';
```

## Performance Tips

1. **Scale up if needed:** Upgrade from Free tier to Starter/Standard for production
2. **Use caching:** Consider adding Redis for session/cache management
3. **Monitor usage:** Use Render's monitoring to track CPU/Memory usage
4. **Set up alerts:** Configure email alerts for deployment failures

## Security Checklist

- [ ] SECRET_KEY is a strong random string (>32 characters)
- [ ] ALLOWED_ORIGINS doesn't include wildcards in production
- [ ] Database password is securely stored in Render secrets
- [ ] API keys (OpenAI, Google) are stored as secrets
- [ ] HTTPS is enabled (automatic with Render)

## Rollback

If deployment fails:
1. Go to Service → Deploys
2. Find the previous successful deployment
3. Click "Redeploy"

## Additional Resources

- [Render Python Deployment Docs](https://render.com/docs/deploy-python)
- [Supabase Connection Strings](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
