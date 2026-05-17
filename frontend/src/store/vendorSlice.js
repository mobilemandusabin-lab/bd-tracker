import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

import { API_URL as BASE_URL } from '../config/api';

const API_URL = `${BASE_URL}/leads`;

export const fetchVendors = createAsyncThunk('vendors/fetchAll', async (params = {}, { getState, rejectWithValue }) => {
  try {
    const { token } = getState().auth;
    const { page = 1, limit = 25, ...otherParams } = params;
    const queryParams = { type: 'vendor', page, limit, ...otherParams };

    const response = await axios.get(API_URL, {
      headers: { Authorization: `Bearer ${token}` },
      params: queryParams
    });
    return response.data;
  } catch (err) {
    return rejectWithValue(err.response.data);
  }
});

const vendorSlice = createSlice({
  name: 'vendors',
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
    resetVendors: (state) => {
      state.items = [];
      state.currentPage = 1;
      state.hasMore = true;
      state.pagination = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendors.pending, (state, action) => {
        const page = action.meta.arg?.page || 1;
        if (page > 1 && state.items.length > 0) {
          state.loadingMore = true;
        } else {
          state.loading = true;
        }
      })
      .addCase(fetchVendors.fulfilled, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        const newVendors = action.payload.data.leads;
        const pagination = action.payload.pagination;

        if (pagination && pagination.page > 1) {
          state.items = [...state.items, ...newVendors];
        } else {
          state.items = newVendors;
        }

        state.currentPage = pagination ? pagination.page : 1;
        if (pagination && pagination.totalPages) {
          state.hasMore = pagination.page < pagination.totalPages;
        } else if (newVendors.length === 0 || newVendors.length < (pagination?.limit || newVendors.length)) {
          state.hasMore = false;
        } else {
          state.hasMore = true;
        }
        state.pagination = pagination;
      })
      .addCase(fetchVendors.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload?.message || 'Failed to fetch vendors';
      });
  }
});

export const { resetVendors } = vendorSlice.actions;
export default vendorSlice.reducer;