# BD Tracker CRM - Vendor Acquisition System

A scalable, event-driven CRM for E-commerce vendor acquisition using the MERN stack.

## 🚀 Key Features
- **Event-Driven Architecture**: Automated module synchronization via EventEmitter.
- **Lead Pipeline**: Comprehensive tracking from 'New' to 'Activated Seller'.
- **Audit Logging**: Full history of data changes and API actions.
- **Role-Based Access**: Secure routes for Super Admin, Admin, User, and Viewer.
- **Analytics Dashboard**: Real-time stats and growth charts.
- **Mobile Responsive**: Built with Tailwind CSS for all devices.

## 🛠 Tech Stack
- **Frontend**: React.js, Redux Toolkit, Tailwind CSS, Recharts, Lucide-React.
- **Backend**: Node.js, Express.js, Mongoose ODM.
- **Database**: MongoDB.
- **Auth**: JWT with Role-Based Access Control (RBAC).

## 📂 Project Structure
```text
/backend
  /src
    /controllers    # Business logic for API endpoints
    /models         # Mongoose schemas
    /routes         # API route definitions
    /services       # Core services (Events, Audit, etc.)
    /middlewares    # Auth & validation middlewares
    /config         # DB and environment config
/frontend
  /src
    /components     # Reusable UI components
    /pages          # Main application views
    /store          # Redux state management
    /layouts        # Page wrapper components
```

## ⚙️ Setup Instructions
1. **Prerequisites**: Install Node.js and MongoDB.
2. **Backend**:
   ```bash
   cd backend
   npm install
   # Configure .env file
   npm run dev
   ```
3. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 📝 Module Dependency Map
| Trigger | Affected Modules |
|---------|------------------|
| Lead Status → 'Onboarding' | Creates Vendor & Product Readiness records |
| Lead Status → 'Activated' | Updates Vendor stage to 'seller_activated' |
| Vendor Stage → 'seller_activated' | Updates Lead status to 'Activated' |
| Any Status Change | Logs Audit Entry & Creates Activity record |
