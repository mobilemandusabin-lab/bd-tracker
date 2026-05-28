import { useState, useCallback } from 'react';

export function useWhatsApp() {
  const [showModal, setShowModal] = useState(false);
  const [pendingPhone, setPendingPhone] = useState(null);
  const [whatsappType, setWhatsappType] = useState(() => localStorage.getItem('bd_whatsapp_type'));

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

  const handleSelect = useCallback((type) => {
    localStorage.setItem('bd_whatsapp_type', type);
    setWhatsappType(type);
    setShowModal(false);
    if (pendingPhone) {
      const cleanPhone = pendingPhone.replace(/\D/g, '');
      const url = type === 'business'
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}`
        : `https://wa.me/${cleanPhone}`;
      window.open(url, '_blank');
      setPendingPhone(null);
    }
  }, [pendingPhone]);

  const resetType = useCallback(() => {
    localStorage.removeItem('bd_whatsapp_type');
    setWhatsappType(null);
  }, []);

  return { showModal, whatsappType, openWhatsApp, handleSelect, resetType, closeModal: () => { setShowModal(false); setPendingPhone(null); } };
}
