import { useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { setUser } from '../store/authSlice';
import { API_URL } from '../config/api';

export function useWhatsApp() {
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);
  const [showModal, setShowModal] = useState(false);
  const [pendingPhone, setPendingPhone] = useState(null);

  // Read from user profile; fall back to localStorage for migration
  const whatsappType = user?.preferences?.whatsapp_type || localStorage.getItem('bd_whatsapp_type') || null;

  const openWhatsApp = useCallback((phone) => {
    if (!phone) return;
    if (!whatsappType) {
      setPendingPhone(phone);
      setShowModal(true);
    } else {
      const cleanPhone = phone.replace(/\D/g, '');
      const url = whatsappType === 'business'
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}`
        : `https://wa.me/${cleanPhone}`;
      window.open(url, '_blank');
    }
  }, [whatsappType]);

  const handleSelect = useCallback(async (type) => {
    setShowModal(false);

    // Save to backend
    try {
      await axios.patch(`${API_URL}/auth/preferences`, { whatsapp_type: type }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Update Redux store
      dispatch(setUser({ ...user, preferences: { ...user?.preferences, whatsapp_type: type } }));
      // Clean up legacy localStorage
      localStorage.removeItem('bd_whatsapp_type');
    } catch (err) {
      // Fallback to localStorage if backend fails
      localStorage.setItem('bd_whatsapp_type', type);
    }

    if (pendingPhone) {
      const cleanPhone = pendingPhone.replace(/\D/g, '');
      const url = type === 'business'
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}`
        : `https://wa.me/${cleanPhone}`;
      window.open(url, '_blank');
      setPendingPhone(null);
    }
  }, [pendingPhone, token, user, dispatch]);

  const resetType = useCallback(async () => {
    try {
      await axios.patch(`${API_URL}/auth/preferences`, { whatsapp_type: null }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      dispatch(setUser({ ...user, preferences: { ...user?.preferences, whatsapp_type: null } }));
    } catch (err) {
      localStorage.removeItem('bd_whatsapp_type');
    }
  }, [token, user, dispatch]);

  return { showModal, whatsappType, openWhatsApp, handleSelect, resetType, closeModal: () => { setShowModal(false); setPendingPhone(null); } };
}
