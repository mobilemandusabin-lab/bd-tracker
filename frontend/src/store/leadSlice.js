import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

import { API_URL as BASE_URL } from '../config/api';

const API_URL = `${BASE_URL}/leads`;

export const fetchLeads = createAsyncThunk('leads/fetchAll', async (params = {}, { getState, rejectWithValue }) => {
  try {
    const { token } = getState().auth;
    const { page = 1, limit = 0, ...otherParams } = params;
    const queryParams = { page, limit, ...otherParams };
    
    const response = await axios.get(API_URL, {
      headers: { Authorization: `Bearer ${token}` },
      params: queryParams
    });
    return response.data;
  } catch (err) {
    return rejectWithValue(err.response.data);
  }
});

const leadSlice = createSlice({
  name: 'leads',
  initialState: {
    items: [],
    loading: false,
    loadingMore: false,
    error: null,
    pagination: null,
    currentPage: 1,
    hasMore: true
  },
  reducers: {
    resetLeads: (state) => {
      state.items = [];
      state.currentPage = 1;
      state.hasMore = true;
      state.pagination = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeads.pending, (state, action) => {
        // Check if this is a load more request (page > 1)
        const page = action.meta.arg?.page || 1;
        if (page > 1 && state.items.length > 0) {
          state.loadingMore = true;
        } else {
          state.loading = true;
        }
      })
      .addCase(fetchLeads.fulfilled, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        const newLeads = action.payload.data.leads;
        const pagination = action.payload.pagination;
        
        if (pagination && pagination.page > 1) {
          // Append for subsequent pages
          state.items = [...state.items, ...newLeads];
        } else {
          // Replace for first page
          state.items = newLeads;
        }
        
        state.currentPage = pagination ? pagination.page : 1;
        // Determine hasMore: if pagination info exists, use totalPages; otherwise compare results to limit
        if (pagination && pagination.totalPages) {
          state.hasMore = pagination.page < pagination.totalPages;
        } else if (newLeads.length === 0 || newLeads.length < (pagination?.limit || newLeads.length)) {
          state.hasMore = false;
        } else {
          state.hasMore = true;
        }
        state.pagination = pagination;
      })
      .addCase(fetchLeads.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload?.message || 'Failed to fetch leads';
      });
  }
});

export const { resetLeads } = leadSlice.actions;
export default leadSlice.reducer;
