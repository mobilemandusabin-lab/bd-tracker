import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

import { API_URL as BASE_URL } from '../config/api';

const API_URL = `${BASE_URL}/goals`;

export const fetchGoals = createAsyncThunk('goals/fetchAll', async (_, { getState, rejectWithValue }) => {
  try {
    const { token } = getState().auth;
    const response = await axios.get(API_URL, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (err) {
    return rejectWithValue(err.response.data);
  }
});

export const createGoal = createAsyncThunk('goals/create', async (goalData, { getState, rejectWithValue }) => {
  try {
    const { token } = getState().auth;
    const response = await axios.post(API_URL, goalData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (err) {
    return rejectWithValue(err.response.data);
  }
});

export const updateGoal = createAsyncThunk('goals/update', async ({ id, goalData }, { getState, rejectWithValue }) => {
  try {
    const { token } = getState().auth;
    const response = await axios.patch(`${API_URL}/${id}`, goalData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (err) {
    return rejectWithValue(err.response.data);
  }
});

export const deleteGoal = createAsyncThunk('goals/delete', async (id, { getState, rejectWithValue }) => {
  try {
    const { token } = getState().auth;
    await axios.delete(`${API_URL}/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return id;
  } catch (err) {
    return rejectWithValue(err.response.data);
  }
});

export const updateGoalProgress = createAsyncThunk('goals/updateProgress', async ({ id, progressData }, { getState, rejectWithValue }) => {
  try {
    const { token } = getState().auth;
    const response = await axios.patch(`${API_URL}/${id}/progress`, progressData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (err) {
    return rejectWithValue(err.response.data);
  }
});

const goalSlice = createSlice({
  name: 'goals',
  initialState: {
    items: [],
    loading: false,
    error: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch goals
      .addCase(fetchGoals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGoals.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data.goals;
      })
      .addCase(fetchGoals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload.message;
      })
      // Create goal
      .addCase(createGoal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createGoal.fulfilled, (state, action) => {
        state.loading = false;
        state.items.push(action.payload.data.goal);
      })
      .addCase(createGoal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload.message;
      })
      // Update goal
      .addCase(updateGoal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateGoal.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex(goal => goal._id === action.payload.data.goal._id);
        if (index !== -1) {
          state.items[index] = action.payload.data.goal;
        }
      })
      .addCase(updateGoal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload.message;
      })
      // Delete goal
      .addCase(deleteGoal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteGoal.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter(goal => goal._id !== action.payload);
      })
      .addCase(deleteGoal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload.message;
      })
      // Update goal progress
      .addCase(updateGoalProgress.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateGoalProgress.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.items.findIndex(goal => goal._id === action.payload.data.goal._id);
        if (index !== -1) {
          state.items[index] = action.payload.data.goal;
        }
      })
      .addCase(updateGoalProgress.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload.message;
      });
  }
});

export default goalSlice.reducer;