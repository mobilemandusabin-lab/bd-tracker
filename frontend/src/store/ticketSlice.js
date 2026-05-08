import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

import { API_URL as BASE_URL } from '../config/api';

const API_ENDPOINT = `${BASE_URL}/tickets`;

// Helper to get auth header
const getAuthConfig = (getState) => ({
  headers: { Authorization: `Bearer ${getState().auth.token}` }
});

// Get all tickets
export const fetchTickets = createAsyncThunk(
  'tickets/fetchTickets',
  async (_, { rejectWithValue, getState }) => {
    try {
      const response = await axios.get(API_ENDPOINT, getAuthConfig(getState));
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

// Get all admins (for ticket creation)
export const fetchAdmins = createAsyncThunk(
  'tickets/fetchAdmins',
  async (_, { rejectWithValue, getState }) => {
    try {
      const response = await axios.get(`${API_ENDPOINT}/admins`, getAuthConfig(getState));
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

// Create ticket
export const createTicket = createAsyncThunk(
  'tickets/createTicket',
  async (ticketData, { rejectWithValue, getState }) => {
    try {
      const response = await axios.post(API_ENDPOINT, ticketData, getAuthConfig(getState));
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

// Update ticket
export const updateTicket = createAsyncThunk(
  'tickets/updateTicket',
  async ({ id, ...ticketData }, { rejectWithValue, getState }) => {
    try {
      const response = await axios.put(`${API_ENDPOINT}/${id}`, ticketData, getAuthConfig(getState));
      return response.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

// Delete ticket
export const deleteTicket = createAsyncThunk(
  'tickets/deleteTicket',
  async (id, { rejectWithValue, getState }) => {
    try {
      await axios.delete(`${API_ENDPOINT}/${id}`, getAuthConfig(getState));
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

const ticketSlice = createSlice({
  name: 'tickets',
  initialState: {
    tickets: [],
    admins: [],
    loading: false,
    error: null,
    selectedTicket: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setSelectedTicket: (state, action) => {
      state.selectedTicket = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch tickets
      .addCase(fetchTickets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.loading = false;
        state.tickets = action.payload;
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch tickets';
      })
      // Fetch admins
      .addCase(fetchAdmins.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdmins.fulfilled, (state, action) => {
        state.loading = false;
        state.admins = action.payload;
      })
      .addCase(fetchAdmins.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch admins';
      })
      // Create ticket
      .addCase(createTicket.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTicket.fulfilled, (state, action) => {
        state.loading = false;
        state.tickets.unshift(action.payload);
      })
      .addCase(createTicket.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to create ticket';
      })
      // Update ticket
      .addCase(updateTicket.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateTicket.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.tickets.findIndex(t => t._id === action.payload._id);
        if (index !== -1) {
          state.tickets[index] = action.payload;
        }
      })
      .addCase(updateTicket.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to update ticket';
      })
      // Delete ticket
      .addCase(deleteTicket.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteTicket.fulfilled, (state, action) => {
        state.loading = false;
        state.tickets = state.tickets.filter(t => t._id !== action.payload);
      })
      .addCase(deleteTicket.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to delete ticket';
      });
  }
});

export const { clearError, setSelectedTicket } = ticketSlice.actions;
export default ticketSlice.reducer;
