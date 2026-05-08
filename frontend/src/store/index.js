import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import leadReducer from './leadSlice';
import goalReducer from './goalSlice';
import taskReducer from './taskSlice';
import ticketReducer from './ticketSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    leads: leadReducer,
    goals: goalReducer,
    tasks: taskReducer,
    tickets: ticketReducer
  }
});
