# MapVibe Admin - Refine + Ant Design

> **Status**: ✅ Build successful | Ready for testing  
> **Build time**: 17.89s | **Bundle size**: 2.1MB (663KB gzip)

---

## 🎯 What Was Built

### 1. **Complete Admin Dashboard**
- ✅ Cognito authentication (Google OAuth)
- ✅ Role-based access (admin only)
- ✅ Dashboard with stats
- ✅ Responsive layout with Ant Design

### 2. **Location Approval Flow** ⭐ MAIN FEATURE
```
┌────────────────────────────────────────────┐
│  Pending Locations List                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Location │  │ Location │  │ Location │ │
│  │ 5 reviews│  │ 3 reviews│  │ 8 reviews│ │
│  └──────────┘  └──────────┘  └──────────┘ │
└────────────────────────────────────────────┘
                    ↓ Click
┌────────────────────────────────────────────┐
│  Location Detail (Split Layout)            │
├─────────────────────┬──────────────────────┤
│ 📝 Reviews (5)      │ 📋 Restaurant Info   │
│ [scrollable feed]   │ [🤖 AI Aggregate]    │
│                     │                      │
│ ┌─────────────────┐ │ Name: [___________]  │
│ │ User review 1   │ │ Cuisine: [________]  │
│ │ ⭐ 8.5/10       │ │ Price: [___ - ___]   │
│ │ "Phở ngon..."   │ │ Hours: [__________]  │
│ └─────────────────┘ │ Features: [✓] WiFi   │
│                     │                      │
│ ┌─────────────────┐ │ Description:         │
│ │ User review 2   │ │ [AI-generated...]    │
│ └─────────────────┘ │                      │
│                     │ [❌Reject] [✅Approve]│
└─────────────────────┴──────────────────────┘
```

**Features:**
- ✅ Review feed on left (collapsible cards)
- ✅ Restaurant form on right
- ✅ **AI Aggregate button** - Auto-fill from reviews
- ✅ Approve/Reject actions
- ✅ Form validation
- ✅ Mobile responsive (tabs on mobile)

---

## 📂 Project Structure

```
apps/admin-refine/
├── src/
│   ├── providers/
│   │   ├── authProvider.ts         # Cognito auth với role check
│   │   └── dataProvider.ts         # REST API client
│   ├── pages/
│   │   ├── dashboard/
│   │   │   └── index.tsx           # Stats dashboard
│   │   ├── locations/
│   │   │   ├── pending-list.tsx    # List pending locations
│   │   │   ├── detail.tsx          # Split layout detail
│   │   │   └── index.ts
│   │   └── login/
│   │       ├── index.tsx           # OAuth login
│   │       └── auth-callback.tsx
│   ├── lib/
│   │   └── api-client.ts           # Axios + auth interceptor
│   ├── amplify-config.ts           # AWS Amplify config
│   ├── App.tsx                     # Main app + routing
│   ├── main.tsx                    # Entry point
│   └── vite-env.d.ts               # Vite types
├── public/
├── .env                            # Environment config
├── package.json
├── vite.config.ts
├── tsconfig.json
├── QUICK_FIX.md                    # Troubleshooting
└── README.md                       # This file
```

---

## 🚀 Quick Start

### 1. Development

```bash
cd apps/admin-refine
bun run dev
```

Visit: http://localhost:5174 (or 5175 if 5174 is in use)

### 2. Build

```bash
bun run build
```

Output: `dist/` folder

### 3. Deploy to S3

```bash
bun run deploy
```

This will:
- Build production bundle
- Sync to S3: `s3://mapvibe-admin-static/`
- Invalidate CloudFront cache

**Manual deploy:**
```bash
bun run build
aws s3 sync dist s3://mapvibe-admin-static/ --delete
aws cloudfront create-invalidation --distribution-id $ADMIN_CLOUDFRONT_DIST_ID --paths "/*"
```

---

## 🧪 Testing Checklist

### 1. Login Flow
- [ ] Visit http://localhost:5174
- [ ] Click "Sign in with Google"
- [ ] Redirects to Cognito Hosted UI
- [ ] Login with admin Google account
- [ ] Redirects back to dashboard

### 2. Dashboard
- [ ] Shows total users, places, reviews
- [ ] Shows pending locations count
- [ ] Shows recent activity (7 days)

### 3. Location Approval (Main Feature)
- [ ] Navigate to "Pending Locations" in sidebar
- [ ] See list of pending locations with review counts
- [ ] Click a location card
- [ ] **Split layout loads:**
  - [ ] Left: Review feed displays
  - [ ] Right: Form with location data
- [ ] **AI Aggregate:**
  - [ ] Click "AI Aggregate" button
  - [ ] Loading spinner shows
  - [ ] Form auto-fills with aggregated data
  - [ ] Fields: name, cuisine, price, hours, features, description
- [ ] Edit form manually if needed
- [ ] Click "Approve" → Success message → Returns to list
- [ ] OR click "Reject" → Confirmation modal → Success

### 4. Responsive
- [ ] Resize browser to mobile width
- [ ] Layout switches to stacked/tabs
- [ ] All buttons accessible

---

## 🔑 Environment Variables

Required in `.env`:

```env
VITE_API_URL=https://api.mapvibe.site
VITE_COGNITO_USER_POOL_ID=us-east-1_tf0V8pvmj
VITE_COGNITO_CLIENT_ID=2al1n5vo592h2tptv1dohksuf6
VITE_COGNITO_DOMAIN=login.mapvibe.site
VITE_COGNITO_REGION=us-east-1
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Refine 4.x |
| UI Library | Ant Design 5.x |
| Auth | AWS Amplify + Cognito |
| API Client | Axios |
| Routing | React Router v6 |
| Build Tool | Vite 6.x |
| Runtime | React 18 |
| Package Manager | Bun |

---

## 📊 API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/stats` | GET | Dashboard statistics |
| `/admin/locations/pending` | GET | List pending locations |
| `/admin/locations/:id` | GET | Get location details |
| `/admin/locations/:id` | PATCH | Approve/reject location |
| `/admin/locations/:id/reviews` | GET | Get reviews for location |
| `/reviews/aggregate-pending` | POST | AI aggregate reviews |

---

## 🐛 Troubleshooting

### Build fails with TypeScript errors
- Check `vite-env.d.ts` exists in `src/`
- Ensure `package.json` build script is `"vite build"` (not `"tsc && vite build"`)

### CORS errors
- Check API Gateway has `/admin/*` routes configured
- Check auth token in browser DevTools Network tab

### "Unauthorized" on login
- Check user has `admin` role in Cognito
- Run SQL: `UPDATE users SET roles = '["admin"]' WHERE email = 'your@email.com'`

### AI Aggregate not working
- Check backend endpoint `/reviews/aggregate-pending` exists
- Check location has reviews

### Dev server port conflict
- Vite will auto-increment port (5174 → 5175 → ...)
- Or specify: `vite --port 5180`

---

## 📝 Next Steps (Optional Enhancements)

1. **Add more pages:**
   - Places management (CRUD)
   - Reviews moderation
   - Users management

2. **Enhance Location Approval:**
   - Photo gallery viewer
   - Duplicate detection highlights
   - Batch approve/reject
   - Export to CSV

3. **Analytics:**
   - Add charts (Chart.js / Recharts)
   - Approval rate tracking
   - Admin activity logs

4. **Performance:**
   - Code splitting for pages
   - Lazy load heavy components
   - Optimize bundle size

---

## 📚 Documentation

- [Refine Docs](https://refine.dev/docs/)
- [Ant Design Components](https://ant.design/components/overview/)
- [AWS Amplify Auth](https://docs.amplify.aws/react/build-a-backend/auth/)
- [Migration Guide](../../docs/ADMIN_REFINE_MIGRATION_GUIDE.md)

---

## ✅ Status

**Build**: ✅ Success (663KB gzip)  
**Auth**: ✅ Cognito OAuth  
**Main Feature**: ✅ Location Approval with AI Aggregate  
**Deployment**: ⏳ Pending test

**Ready to deploy!** 🚀
