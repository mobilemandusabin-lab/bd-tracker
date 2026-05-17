# AGENTS.md

## Commands

### Frontend
- Build: `cd frontend && npm run build`
- Dev server: `cd frontend && npm run dev`

### Backend
- Start: `cd backend && npm run start`
- Dev: `cd backend && npm run dev`
- Seed: `cd backend && npm run seed`

## Verification
- Frontend build must pass: `cd frontend && npm run build`
- Backend syntax: `node --check backend/src/controllers/*.js && node --check backend/src/services/*.js`