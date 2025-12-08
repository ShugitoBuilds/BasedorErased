#!/bin/bash
# Manual deployment script for Vercel
# Triggers deployment via Deploy Hook

DEPLOY_HOOK_URL="https://api.vercel.com/v1/integrations/deploy/prj_WZQmNvywGoX6WIrN6juxa9Ahsqnr/zddDJwVNgR"

echo "🚀 Triggering Vercel deployment..."
curl -X POST "$DEPLOY_HOOK_URL"
echo ""
echo "✅ Deployment triggered! Check https://vercel.com/juans-projects/basedorerased/deployments"
