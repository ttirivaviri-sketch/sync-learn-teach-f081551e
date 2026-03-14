# StudySync - Tutor Booking Platform

A modern React-based platform connecting learners with tutors for personalized education sessions.

## 🔒 Security Status

**✅ PRODUCTION READY** - Critical security vulnerabilities have been fixed:
- Customer data exposure resolved with proper RLS policies
- Business intelligence data protected from scraping
- Enhanced authentication and authorization
- Audit logging and monitoring implemented
- Rate limiting and suspicious activity detection

## 🌟 Features

- **Real-time tutor discovery** with proximity-based search
- **Live booking system** with instant notifications  
- **Video meeting integration** for online sessions
- **Geolocation support** for finding nearby tutors
- **Admin dashboard** for platform management
- **Mobile-responsive PWA** with offline support

## 🚀 Live Demo

**URL**: https://lovable.dev/projects/e0da842e-0970-4b5c-8c27-0c559f93a2fb

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account for backend services

## 🛠️ Local Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd studysync-platform

# Install dependencies
npm install

# Start development server
npm run dev
```

### 2. Environment Setup

Create a `.env` file in the project root:

```env
VITE_SUPABASE_PROJECT_ID="uynoykcratwbcdzmsxfw"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
VITE_SUPABASE_URL="https://uynoykcratwbcdzmsxfw.supabase.co"
```

### 3. Database Setup

The project uses Supabase with the following key tables:
- `profiles` - User profiles and preferences
- `tutor_subjects` - Tutor expertise and pricing
- `bookings` - Session bookings and status
- `conversations` - In-app messaging
- `payments` - Transaction records

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **shadcn/ui** for component library
- **React Query** for data fetching
- **React Router** for navigation

### Backend Integration
- **Supabase** for database and authentication
- **Real-time subscriptions** for live updates
- **Row Level Security (RLS)** for data protection
- **Edge Functions** for serverless logic

### Key Features
- **Geolocation API** for proximity search
- **WebRTC** for video meetings
- **PWA capabilities** with offline support
- **Real-time presence tracking**

## 📱 User Roles

### Learners
- Browse and search for tutors by subject and location
- Book tutoring sessions with real-time availability
- Join video meetings and chat with tutors
- Rate and review completed sessions

### Tutors  
- Manage profile, subjects, and availability
- Accept/decline booking requests
- Conduct video sessions with learners
- Track earnings and session history

### Administrators
- Monitor platform activity and users
- Manage bookings and resolve disputes
- Access analytics and reports
- Configure platform settings

## 🔧 Development Workflow

### Using Lovable (Recommended)
1. Visit the [Lovable Project](https://lovable.dev/projects/e0da842e-0970-4b5c-8c27-0c559f93a2fb)
2. Make changes using AI-powered development
3. Changes sync automatically to GitHub

### Using Local IDE
1. Clone repository and install dependencies
2. Make changes locally
3. Push to GitHub - changes sync to Lovable automatically

### Using GitHub Codespaces
1. Open repository on GitHub
2. Click "Code" → "Codespaces" → "New codespace"
3. Develop in browser-based VS Code environment

## 🚀 Deployment

### Quick Deploy with Lovable
1. Open [Lovable Project](https://lovable.dev/projects/e0da842e-0970-4b5c-8c27-0c559f93a2fb)
2. Click Share → Publish
3. Your app is live instantly!

### Custom Domain Setup
1. Navigate to Project > Settings > Domains in Lovable
2. Click Connect Domain
3. Follow the [custom domain guide](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

### Manual Deployment
The project can be deployed to any static hosting service:

```bash
# Build for production
npm run build

# Deploy the dist/ folder to your hosting provider
```

## 📈 Improvement Roadmap

If you are planning the next iteration of StudySync, start with the prioritized improvement plan in [`docs/study-sync-improvements.md`](docs/study-sync-improvements.md).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

- 📖 [Lovable Documentation](https://docs.lovable.dev/)
- 💬 [Discord Community](https://discord.com/channels/1119885301872070706/1280461670979993613)
- 🎥 [Video Tutorials](https://www.youtube.com/watch?v=9KHLTZaJcR8&list=PLbVHz4urQBZkJiAWdG8HWoJTdgEysigIO)
