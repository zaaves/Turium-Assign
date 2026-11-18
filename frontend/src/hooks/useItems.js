import { useState, useEffect, useCallback, useRef } from 'react';
import { getItems, getItemById } from '../services/items.api';

const POLL_INTERVAL_MS = 2500;

export function useItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  // Detail inspection state
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  const pollTimerRef = useRef(null);

  const fetchItemsList = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const data = await getItems();
      setItems(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to load items.');
      return [];
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Check if any item is active (PENDING or PROCESSING)
  const hasActiveItems = items.some(
    (item) => item.status === 'PENDING' || item.status === 'PROCESSING'
  );

  // Polling management
  useEffect(() => {
    if (hasActiveItems) {
      setIsPolling(true);
      pollTimerRef.current = setInterval(() => {
        fetchItemsList(false);
      }, POLL_INTERVAL_MS);
    } else {
      setIsPolling(false);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [hasActiveItems, fetchItemsList]);

  // Initial load
  useEffect(() => {
    fetchItemsList(true);
  }, [fetchItemsList]);

  // Fetch item details when selected
  const openItemDetails = useCallback(async (id) => {
    setSelectedItemId(id);
    setLoadingDetails(true);
    setDetailsError(null);
    try {
      const item = await getItemById(id);
      setSelectedItem(item);
    } catch (err) {
      setDetailsError(err.message || 'Failed to load item details.');
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  const closeItemDetails = useCallback(() => {
    setSelectedItemId(null);
    setSelectedItem(null);
    setDetailsError(null);
  }, []);

  return {
    items,
    loading,
    error,
    isPolling,
    hasActiveItems,
    refreshItems: () => fetchItemsList(false),
    selectedItemId,
    selectedItem,
    loadingDetails,
    detailsError,
    openItemDetails,
    closeItemDetails,
  };
}
