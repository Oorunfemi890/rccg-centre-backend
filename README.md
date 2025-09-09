# RCCG Liberty Christian Center - Admin Backend

A comprehensive backend API for church administration built with Node.js, Express, PostgreSQL, and Socket.IO.

## 🚀 Features

- **Authentication & Authorization**
  - JWT-based authentication with refresh tokens
  - Role-based permissions (Super Admin, Admin)
  - Password reset functionality
  - Rate limiting and security middleware

- **Member Management**
  - Complete CRUD operations for church members
  - Department management
  - Search and filtering
  - Export to CSV
  - Emergency contact information

- **Event Management**
  - Create, update, and delete events
  - Recurring events support
  - Image upload with Cloudinary
  - Event categories and status tracking
  - Registration and capacity management

- **Attendance Tracking**
  - Service attendance recording
  - Individual member attendance tracking
  - Statistics and reporting
  - Multiple service types support

- **Celebrations Management**
  - Birthday, anniversary, and milestone celebrations
  - Approval workflow
  - Automated email notifications
  - Public celebration requests

- **Real-time Features**
  - Socket.IO for live updates
  - Real-time dashboard statistics
  - Instant notifications for admin actions

- **Email Notifications**
  - Welcome emails for new members
  - Birthday and celebration wishes
  - Event reminders
  - Celebration approval notifications

- **Automated Tasks**
  - Daily birthday email sending
  - Event reminder notifications
  - Token cleanup
  - Event status updates

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.IO
- **File Upload**: Cloudinary
- **Email**: Nodemailer
- **Validation**: Express Validator
- **Logging**: Winston
- **Task Scheduling**: Node Cron
- **Security**: Helmet, CORS, Rate Limiting

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## 🔧 Installation & Setup

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd church-admin-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and configure the following variables:

```bash
# Environment
NODE_ENV=development
PORT=5000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=church_admin_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_very_long_and_random
JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key_here_also_very_long_and_random
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM="RCCG Liberty Christian Center <noreply@rccglcc.org>"

# CORS Configuration
CLIENT_URL=http://localhost:3000
ADMIN_URL=http://localhost:3000/admin

# Church Information
CHURCH_NAME="RCCG Liberty Christian Center"
CHURCH_EMAIL=info@rccglcc.org
CHURCH_PHONE="+234 803 331 7762"
CHURCH_ADDRESS="Akins Bus stop, Marshy Hill Estate, 31 Bisi Afolabi St, Addo Rd, Ajah"
```

### 4. Database Setup
Run the following commands in order:

```bash
# Setup database (creates database and extensions)
npm run setup-db

# Run migrations (creates tables)
npm run migrate

# Seed initial data (creates admin accounts and sample data)
npm run seed
```

### 5. Start the server

For development:
```bash
npm run dev
```

For production:
```bash
npm start
```

The server will start on `http://localhost:5000`

## 📚 API Documentation

### Authentication Endpoints
```
POST   /api/auth/login              # Admin login
POST   /api/auth/refresh            # Refresh access token
GET    /api/auth/verify             # Verify token
POST   /api/auth/logout             # Logout admin
PUT    /api/auth/profile            # Update admin profile
PUT    /api/auth/change-password    # Change password
GET    /api/auth/me                 # Get current admin info
POST   /api/auth/forgot-password    # Request password reset
```

### Members Endpoints
```
GET    /api/members                 # Get all members (with filtering)
GET    /api/members/stats           # Get member statistics
GET    /api/members/departments     # Get departments list
GET    /api/members/search          # Search members
GET    /api/members/:id             # Get member by ID
POST   /api/members                 # Create new member
PUT    /api/members/:id             # Update member
PATCH  /api/members/:id/status      # Update member status
DELETE /api/members/:id             # Soft delete member
GET    /api/members/export          # Export members to CSV
```

### Events Endpoints
```
GET    /api/events                  # Get all events (public + admin)
GET    /api/events/upcoming         # Get upcoming events (public)
GET    /api/events/categories       # Get event categories
GET    /api/events/stats            # Get event statistics (admin)
GET    /api/events/:id              # Get event by ID
POST   /api/events                  # Create new event (admin)
PUT    /api/events/:id              # Update event (admin)
PATCH  /api/events/:id/attendance   # Update event attendance (admin)
POST   /api/events/:id/duplicate    # Duplicate event (admin)
DELETE /api/events/:id              # Delete event (admin)
GET    /api/events/export           # Export events to CSV (admin)
```

### Celebrations Endpoints
```
GET    /api/celebrations            # Get celebrations (admin)
GET    /api/celebrations/stats      # Get celebration statistics (admin)
GET    /api/celebrations/upcoming   # Get upcoming celebrations (admin)
GET    /api/celebrations/:id        # Get celebration by ID (admin)
POST   /api/celebrations            # Submit celebration request (public)
PATCH  /api/celebrations/:id/status # Update celebration status (admin)
DELETE /api/celebrations/:id        # Delete celebration (admin)
GET    /api/celebrations/export     # Export celebrations (admin)
```

### Attendance Endpoints
```
GET    /api/attendance              # Get attendance records (admin)
GET    /api/attendance/stats        # Get attendance statistics (admin)
GET    /api/attendance/service-types # Get service types (admin)
GET    /api/attendance/members      # Get members for attendance (admin)
GET    /api/attendance/:id          # Get attendance by ID (admin)
POST   /api/attendance              # Create attendance record (admin)
PUT    /api/attendance/:id          # Update attendance record (admin)
DELETE /api/attendance/:id          # Delete attendance record (admin)
POST   /api/attendance/report       # Generate attendance report (admin)
```

### Dashboard Endpoints
```
GET    /api/dashboard/stats         # Get dashboard statistics (admin)
GET    /api/dashboard/recent-activities # Get recent activities (admin)
GET    /api/dashboard/upcoming-events   # Get upcoming events (admin)
GET    /api/dashboard/attendance-summary # Get attendance summary (admin)
GET    /api/dashboard/member-growth     # Get member growth data (admin)
```

## 🔐 Default Admin Accounts

After seeding, you can login with these accounts:

**Super Admin:**
- Email: `admin@rccglcc.org`
- Password: `admin123`
- Role: Super Admin (all permissions)

**Regular Admin:**
- Email: `sarah@rccglcc.org`
- Password: `sarah123`
- Role: Admin (limited permissions)

⚠️ **Important**: Change these passwords immediately in production!

## 🌐 Frontend Integration

To connect your React frontend:

1. Update the `CLIENT_URL` and `ADMIN_URL` in your `.env` file
2. Replace the mock API calls in your frontend services with the actual API endpoints
3. Update the `REACT_APP_API_URL` in your frontend `.env` to point to this backend

Example frontend API configuration:
```javascript
// In your frontend .env
REACT_APP_API_URL=http://localhost:5000/api

// In your frontend services
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
```

## 📧 Email Configuration

For Gmail SMTP:
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password (not your regular password)
3. Use the App Password in the `EMAIL_PASS` environment variable

For other email providers, update the SMTP settings accordingly.

## ☁️ Cloudinary Setup

1. Create a free account at [Cloudinary](https://cloudinary.com)
2. Get your Cloud Name, API Key, and API Secret from the dashboard
3. Add them to your `.env` file
4. Images will be automatically uploaded and optimized

## 🔧 Useful Scripts

```bash
npm run dev          # Start development server with nodemon
npm start           # Start production server
npm run setup-db    # Setup database and extensions
npm run migrate     # Run database migrations
npm run seed        # Seed initial data
npm test           # Run tests (if configured)
```

## 📁 Project Structure

```
church-admin-backend/
├── config/
│   └── cloudinary.js
├── middleware/
│   ├── auth.js
│   ├── upload.js
│   └── errorHandler.js
├── models/
│   ├── index.js
│   ├── Admin.js
│   ├── Member.js
│   ├── Event.js
│   ├── Attendance.js
│   ├── MemberAttendance.js
│   └── Celebration.js
├── routes/
│   ├── auth.js
│   ├── members.js
│   ├── events.js
│   ├── attendance.js
│   ├── celebrations.js
│   ├── dashboard.js
│   └── public.js
├── services/
│   ├── emailService.js
│   └── cronJobs.js
├── scripts/
│   ├── setupDatabase.js
│   ├── migrate.js
│   └── seedData.js
├── utils/
│   ├── logger.js
│   └── helpers.js
├── logs/
├── uploads/
├── .env
├── server.js
└── package.json
```

## 🚀 Deployment

### Environment Variables for Production

Ensure these environment variables are set in production:
- Set `NODE_ENV=production`
- Use strong, unique JWT secrets
- Configure production database
- Set up production email service
- Configure Cloudinary for production
- Set proper CORS origins

### Database Considerations

- Use connection pooling for better performance
- Set up database backups
- Consider read replicas for high traffic
- Monitor database performance

### Security Recommendations

- Use HTTPS in production
- Set up proper firewall rules
- Enable database SSL
- Use environment variables for all secrets
- Regular security updates
- Monitor for suspicious activities

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL service status
sudo service postgresql status

# Check database exists
psql -U your_username -l

# Test connection
psql -h localhost -U your_username -d church_admin_db
```

### Email Issues
- Verify SMTP credentials
- Check firewall settings for SMTP ports
- Ensure 2FA and app passwords are configured correctly

### File Upload Issues
- Verify Cloudinary credentials
- Check file size limits
- Ensure proper file permissions

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Commit your changes
6. Push to the branch
7. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Support

For support, email [your-email] or create an issue in the repository.

---

**Built with ❤️ for RCCG Liberty Christian Center**