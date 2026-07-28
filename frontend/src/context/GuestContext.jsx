import React, { createContext, useContext, useState, useEffect } from 'react';
import { getBrowserFingerprint } from '../utils/guestUtils';
import { API_BASE_URL } from '../apiConfig';

const GuestContext = createContext();

export const useGuest = () => useContext(GuestContext);

const NAME_STORAGE_KEY = 'restobot_guest_name';

export const GuestProvider = ({ children }) => {
    const [guest, setGuest] = useState(null);
    const [guestName, setGuestName] = useState(() => localStorage.getItem(NAME_STORAGE_KEY) || '');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const identify = async () => {
            try {
                const fingerprint = getBrowserFingerprint();
                const res = await fetch(`${API_BASE_URL}/guests/identify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fingerprint })
                });
                const data = await res.json();
                if (data.success) {
                    setGuest(data);
                    const serverName = typeof data.name === 'string' ? data.name.trim() : '';
                    if (serverName) {
                        setGuestName(serverName);
                        localStorage.setItem(NAME_STORAGE_KEY, serverName);
                    }
                }
            } catch (err) {
                console.error('Guest identification failed:', err);
            } finally {
                setLoading(false);
            }
        };

        identify();
    }, []);

    const saveGuestName = async (rawName) => {
        const name = (rawName || '').trim();
        if (!name) return false;
        const guestId = guest?.guest_id;
        try {
            if (guestId) {
                const res = await fetch(`${API_BASE_URL}/guests/${guestId}/name`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                if (!res.ok) return false;
            }
            setGuestName(name);
            localStorage.setItem(NAME_STORAGE_KEY, name);
            return true;
        } catch (err) {
            console.error('Failed to save guest name:', err);
            return false;
        }
    };

    return (
        <GuestContext.Provider value={{ guest, loading, guestName, saveGuestName }}>
            {children}
        </GuestContext.Provider>
    );
};
