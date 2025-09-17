# StudySync Platform Architecture

## System Overview

StudySync is a modern tutoring platform built with React, TypeScript, and Supabase, featuring real-time communication, geolocation services, and comprehensive user management.

## Frontend Architecture

### Core Technologies
- **React 18** with hooks and functional components
- **TypeScript** for type safety and developer experience
- **Vite** for fast development and optimized builds
- **Tailwind CSS** with custom design system
- **shadcn/ui** for consistent UI components

### State Management
- **React Query** for server state and caching
- **React Context** for global UI state
- **Local Storage** for client-side persistence
- **Real-time subscriptions** via Supabase

### Routing & Navigation
- **React Router v6** with nested routes
- **Lazy loading** for code splitting
- **Protected routes** with authentication guards

## Backend Architecture (Supabase)

### Database Schema

#### Core Tables
```sql
-- User profiles with authentication integration
profiles (id, email, full_name, user_type, phone, bio, avatar_url, online_status, location_lat, location_lng, study_level)

-- Tutor subject expertise and pricing
tutor_subjects (id, user_id, subject, level, hourly_rate)

-- Session bookings and scheduling
bookings (id, learner_id, tutor_id, tutor_subject_id, scheduled_at, duration_minutes, status, price)

-- Real-time messaging system
conversations (id, tutor_id, learner_id, last_message_at)
messages (id, conversation_id, sender_id, content, message_type, read_at)

-- Reviews and ratings
reviews (id, booking_id, reviewer_id, reviewed_id, rating, comment)

-- Payment processing
payments (id, booking_id, payer_id, amount, status, currency, provider, provider_ref)
```

#### Supporting Tables
```sql
-- User role management
user_roles (id, user_id, role)

-- Tutor verification process
tutor_verifications (id, user_id, id_number, id_document_url, profile_photo_url, police_clearance_url, verification_status)
verification_reviews (id, verification_id, reviewer_id, decision, notes)

-- Educational qualifications
qualifications (id, user_id, qualification_type, institution, year_obtained, document_url)

-- Support system
support_tickets (id, creator_id, assignee_id, status, priority, subject, message)

-- Location and offline support
location_codes (code, name, city, region, latitude, longitude, active)
offline_booking_requests (id, channel, learner_msisdn, tutor_msisdn, subject_code, location_code, status)
ussd_sessions (id, msisdn, provider_session_id, current_step, data, is_active)
message_logs (id, channel, direction, from_msisdn, to_msisdn, body, provider_message_id, error)
```

### Row Level Security (RLS)

All tables implement comprehensive RLS policies:
- **User isolation** - Users can only access their own data
- **Role-based access** - Admin privileges for management operations
- **Public discovery** - Tutor profiles visible for learner searching
- **Booking participation** - Access limited to booking participants

### Real-time Features
- **Live presence tracking** for online/offline status
- **Instant messaging** with conversation threads
- **Booking notifications** for status changes
- **Location updates** for proximity search

## Key Features Implementation

### 1. Geolocation & Proximity Search
```typescript
// Haversine formula for distance calculation
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};
```

### 2. Real-time Communication
```typescript
// Supabase real-time subscriptions
const subscription = supabase
  .channel('conversations')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages'
  }, handleNewMessage)
  .subscribe();
```

### 3. Authentication Flow
- **Supabase Auth** with email/password
- **Automatic profile creation** via database triggers
- **Role-based routing** (learner/tutor/admin)
- **Session persistence** with automatic refresh

### 4. Progressive Web App (PWA)
- **Service worker** for offline functionality
- **App manifest** for installation
- **Offline indicators** and graceful degradation
- **Background sync** for critical operations

## Security Implementation

### Authentication & Authorization
- **JWT tokens** with automatic refresh
- **Row Level Security** on all database tables
- **Input validation** with Zod schemas
- **XSS protection** through React's built-in sanitization

### Data Protection
- **Encrypted sensitive data** (documents, personal info)
- **Secure file storage** with Supabase Storage
- **GDPR compliance** ready structure
- **Audit trails** for admin actions

### API Security
- **Rate limiting** on Supabase edges
- **CORS configuration** for domain restrictions
- **Environment variables** for sensitive config
- **Database connection pooling**

## Performance Optimizations

### Frontend
- **Code splitting** with React.lazy()
- **Image optimization** with proper formats and lazy loading
- **Memoization** of expensive calculations
- **Virtual scrolling** for large lists (when needed)
- **Bundle analysis** and tree shaking

### Backend
- **Database indexing** on frequently queried columns
- **Query optimization** with proper JOINs
- **Caching strategies** with React Query
- **CDN integration** for static assets

### Real-time Efficiency
- **Selective subscriptions** to minimize bandwidth
- **Message batching** for high-frequency updates
- **Connection pooling** for WebSocket management
- **Graceful fallbacks** for connectivity issues

## Deployment & DevOps

### Build Process
```bash
# Development
npm run dev          # Vite dev server with HMR

# Production
npm run build        # TypeScript compilation + Vite bundling
npm run preview      # Preview production build locally
```

### Environment Configuration
```env
# Supabase Configuration
VITE_SUPABASE_PROJECT_ID=uynoykcratwbcdzmsxfw
VITE_SUPABASE_URL=https://uynoykcratwbcdzmsxfw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Monitoring & Analytics
- **Error tracking** with built-in error boundaries
- **Performance monitoring** via Web Vitals
- **User analytics** through Supabase analytics
- **Database monitoring** via Supabase dashboard

## Future Scalability Considerations

### Horizontal Scaling
- **Microservices architecture** ready
- **API Gateway** for service orchestration
- **Load balancing** strategies
- **Geographic distribution**

### Feature Extensions
- **Mobile apps** with React Native
- **Advanced scheduling** with calendar integrations
- **Payment gateway** diversification
- **AI-powered tutor matching**

### Data Architecture Evolution
- **Data warehousing** for analytics
- **Event sourcing** for audit compliance
- **CQRS pattern** for read/write optimization
- **Message queuing** for async processing