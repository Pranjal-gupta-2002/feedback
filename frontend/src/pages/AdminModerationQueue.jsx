import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../api/client';
import StaffToolbar from '../components/StaffToolbar';
import EditReviewModal from '../components/EditReviewModal';
import CustomDropdown from '../components/CustomDropdown';
import { useDebounce } from '../hooks/useDebounce';
import { throttle } from '../utils/throttle';

const QUEUE_PAGE_SIZE = 8;

export default function AdminModerationQueue({ showToast, onQueueUpdated, searchQuery = '', onSearch }) {
  const [activeTab, setActiveTab] = useState('pending');
  const [data, setData] = useState({ metrics: {}, reviews: [] });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [localSearch, setLocalSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [selectedRating, setSelectedRating] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetReviewId, setTargetReviewId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [inspectPhoto, setInspectPhoto] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);

  const handleClearSearch = () => {
    setLocalSearch('');
    onSearch?.('');
  };

  useEffect(() => {
    let isMounted = true;
    api.getMetadata()
      .then((meta) => {
        if (!isMounted) return;
        if (meta?.products) setProducts(meta.products);
        if (meta?.channels) setChannels(meta.channels);
      })
      .catch((err) => console.error('Failed to load queue metadata:', err));
    return () => { isMounted = false; };
  }, []);

  const distinctProducts = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p.sku) map.set(p.sku, { sku: p.sku, name: p.name || p.sku });
    });
    (data.reviews || []).forEach((r) => {
      if (r.sku && !map.has(r.sku)) {
        map.set(r.sku, { sku: r.sku, name: r.product_name || r.sku });
      }
    });
    return Array.from(map.values());
  }, [products, data.reviews]);

  const distinctChannels = useMemo(() => {
    const set = new Set([...channels, 'Direct Web', 'Retail Store', 'Mobile App', 'In-App iOS']);
    (data.reviews || []).forEach((r) => { if (r.channel) set.add(r.channel); });
    return Array.from(set).filter(Boolean);
  }, [channels, data.reviews]);

  const formatProductLabel = (p) => {
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
    const brand = cap(p.sku);
    const model = cap(p.name);
    if (brand && model && brand.toLowerCase() !== model.toLowerCase()) {
      return `${brand} • ${model}`;
    }
    return model || brand || 'Unknown Shoe';
  };

  const handleOpenEdit = (review) => {
    setEditingReview(review);
    setEditModalOpen(true);
  };

  const effectiveSearch = searchQuery || localSearch;
  const debouncedSearch = useDebounce(effectiveSearch, 350);

  const loadQueue = async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await api.getModerationQueue({
          tab: activeTab,
          search: debouncedSearch || undefined,
          sku: selectedSku || undefined,
          channel: selectedChannel || undefined,
          rating: selectedRating !== null ? selectedRating : undefined,
          limit: QUEUE_PAGE_SIZE,
          offset: 0
        });
      } catch (queueErr) {
        // Fallback for deployed backend where tab=rejected regex might not be deployed yet
        if (activeTab === 'rejected') {
          const allRes = await api.getModerationQueue({
            tab: 'all',
            search: debouncedSearch || undefined,
            sku: selectedSku || undefined,
            channel: selectedChannel || undefined,
            rating: selectedRating !== null ? selectedRating : undefined,
            limit: QUEUE_PAGE_SIZE,
            offset: 0
          });
          const allReviews = allRes.reviews || [];
          const rejectedReviews = allReviews.filter(r => r.status === 'rejected');
          res = {
            ...allRes,
            reviews: rejectedReviews,
            metrics: {
              ...allRes.metrics,
              rejected_count: rejectedReviews.length
            }
          };
        } else {
          throw queueErr;
        }
      }

      if (res && res.metrics && res.metrics.rejected_count === undefined) {
        const rejectedEstimate = Math.max(0, (res.metrics.total_count || 0) - (res.metrics.pending_count || 0) - (res.metrics.approved_count || 0));
        res.metrics.rejected_count = rejectedEstimate;
      }

      setData(res);
      setSelectedIds([]);
      const loadedCount = (res?.reviews || []).length;
      setHasMore(loadedCount >= QUEUE_PAGE_SIZE);
    } catch (err) {
      console.error(err);
      showToast?.('Error loading moderation queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [activeTab, debouncedSearch, selectedSku, selectedChannel, selectedRating]);

  // Load next page of moderation queue items (Infinite Scroll)
  const loadMoreQueue = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const currentOffset = (data.reviews || []).length;
      let nextBatch = [];

      try {
        const res = await api.getModerationQueue({
          tab: activeTab,
          search: debouncedSearch || undefined,
          sku: selectedSku || undefined,
          channel: selectedChannel || undefined,
          rating: selectedRating !== null ? selectedRating : undefined,
          limit: QUEUE_PAGE_SIZE,
          offset: currentOffset
        });
        nextBatch = res?.reviews || [];
      } catch (queueErr) {
        if (activeTab === 'rejected') {
          const allRes = await api.getModerationQueue({
            tab: 'all',
            search: debouncedSearch || undefined,
            sku: selectedSku || undefined,
            channel: selectedChannel || undefined,
            rating: selectedRating !== null ? selectedRating : undefined,
            limit: QUEUE_PAGE_SIZE,
            offset: currentOffset
          });
          nextBatch = (allRes?.reviews || []).filter(r => r.status === 'rejected');
        } else {
          throw queueErr;
        }
      }

      if (!nextBatch || nextBatch.length === 0) {
        setHasMore(false);
      } else {
        setData(prev => {
          const prevReviews = prev?.reviews || [];
          const existingIds = new Set(prevReviews.map(r => r.id));
          const filteredNew = nextBatch.filter(r => !existingIds.has(r.id));
          return {
            ...prev,
            reviews: [...prevReviews, ...filteredNew]
          };
        });
        if (nextBatch.length < QUEUE_PAGE_SIZE) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Failed to load more queue items:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, (data.reviews || []).length, activeTab, debouncedSearch, selectedSku, selectedChannel, selectedRating]);

  // Throttled window scroll listener for infinite scroll
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const handleScroll = throttle(() => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 350;

      if (scrollPosition >= threshold) {
        loadMoreQueue();
      }
    }, 250);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      handleScroll.cancel();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [hasMore, loading, loadingMore, loadMoreQueue]);

  // Throttled IntersectionObserver on sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || loadingMore) return;

    let lastTriggerTime = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          const now = Date.now();
          if (now - lastTriggerTime > 300) {
            lastTriggerTime = now;
            loadMoreQueue();
          }
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMoreQueue]);

  const handleAction = async (reviewId, action, note = '') => {
    try {
      await api.executeAction(reviewId, action, note, 'Staff Moderator');
      showToast?.(`Review ${action}d successfully!`, 'success');
      loadQueue();
      onQueueUpdated?.();
    } catch (err) {
      showToast?.(`Error updating review: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm('Are you sure you want to permanently delete this review?')) return;
    try {
      await api.deleteReview(reviewId);
      showToast?.('Review permanently deleted', 'success');
      loadQueue();
      onQueueUpdated?.();
    } catch (err) {
      showToast?.(`Error deleting review: ${err.message}`, 'error');
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.length === 0) return;
    try {
      await api.executeBulkAction(selectedIds, action, '');
      showToast?.(`Applied ${action} to ${selectedIds.length} reviews`, 'success');
      setSelectedIds([]);
      loadQueue();
      onQueueUpdated?.();
    } catch (err) {
      showToast?.(`Bulk operation failed: ${err.message}`, 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedIds.length} selected review(s)?`)) return;
    try {
      await Promise.all(selectedIds.map(id => api.deleteReview(id)));
      showToast?.(`Permanently deleted ${selectedIds.length} reviews`, 'success');
      setSelectedIds([]);
      loadQueue();
      onQueueUpdated?.();
    } catch (err) {
      showToast?.(`Bulk delete failed: ${err.message}`, 'error');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data.reviews.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.reviews.map(r => r.id));
    }
  };

  const metrics = data.metrics || {};
  const reviews = data.reviews || [];

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 space-y-4 overflow-x-hidden">
      
      {/* Staff Portal Toolbar */}
      <StaffToolbar pendingCount={metrics.pending_count || 0} />

      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-purple-200/80 shadow-[0_4px_24px_rgba(81,34,254,0.06)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-full border border-purple-200">
              Moderation Pipeline
            </span>
            <span className="text-[11px] text-purple-400">&bull; Verification Active</span>
          </div>
          <h1 className="font-headline text-lg sm:text-xl font-bold text-purple-950 tracking-tight mt-1">
            Shoe Review Moderation Queue
          </h1>
        </div>

        {/* Compact SLA Counter Pills & Refresh */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 flex-1 sm:flex-initial">
            <div className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-50/70 border border-purple-200 text-center sm:text-left">
              <div className="text-[9px] font-semibold text-purple-500 uppercase">SLA</div>
              <div className="text-xs font-bold text-purple-950">{metrics.median_sla_minutes !== undefined ? metrics.median_sla_minutes : 0}m</div>
            </div>

            <div className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-50/70 border border-purple-200 text-center sm:text-left">
              <div className="text-[9px] font-semibold text-purple-500 uppercase">Yield</div>
              <div className="text-xs font-bold text-emerald-700">{metrics.auto_clear_rate !== undefined ? metrics.auto_clear_rate : 0}%</div>
            </div>

            <div className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-100/80 border border-purple-300 text-center sm:text-left">
              <div className="text-[9px] font-semibold text-purple-800 uppercase">Pending</div>
              <div className="text-xs font-bold text-purple-900">{metrics.pending_count || 0}</div>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              loadQueue();
              onQueueUpdated?.();
            }}
            disabled={loading}
            title="Refresh moderation queue and metrics"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold border border-purple-200 shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
          >
            <span className={`material-symbols-outlined text-[16px] text-[#5122fe] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Moderation Control Hub: Tabs, Filters, Search & Bulk Actions */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xs border border-purple-200/80 space-y-3">
        {/* Row 1: Triage Tabs & Batch Operations */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pb-2.5 border-b border-purple-100">
          {/* Triage Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 md:pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden w-full md:w-auto">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold shadow-xs'
                  : 'text-purple-900/70 hover:bg-purple-50'
              }`}
            >
              <span>Pending</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
              }`}>
                {metrics.pending_count || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('approved')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'approved'
                  ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold shadow-xs'
                  : 'text-purple-900/70 hover:bg-purple-50'
              }`}
            >
              <span>Approved</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                activeTab === 'approved' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
              }`}>
                {metrics.approved_count || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'rejected'
                  ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white font-semibold shadow-xs'
                  : 'text-purple-900/70 hover:bg-purple-50'
              }`}
            >
              <span>Rejected</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                activeTab === 'rejected' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {metrics.rejected_count ?? 0}
              </span>
            </button>
          </div>

          {/* Batch Operations Bar */}
          <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-purple-100 w-full md:w-auto">
            {reviews.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="text-xs text-purple-700 hover:text-purple-950 font-medium px-2.5 py-1 rounded-lg hover:bg-purple-50 transition-colors cursor-pointer"
              >
                {selectedIds.length === reviews.length ? 'Deselect All' : 'Select All'}
              </button>
            )}

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-purple-200">
                <span className="text-xs font-bold text-purple-900 px-1">
                  {selectedIds.length} chosen
                </span>
                <button
                  onClick={() => handleBulkAction('approve')}
                  className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Reject
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-2.5 py-1 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Product, Channel, Rating Dropdowns & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Shoe / Product Filter */}
            <CustomDropdown
              value={selectedSku}
              onChange={setSelectedSku}
              options={[
                { value: '', label: 'All Shoes & Models' },
                ...distinctProducts.map((p) => ({
                  value: p.sku,
                  label: formatProductLabel(p)
                }))
              ]}
              icon="steps"
              className="w-full sm:w-auto"
            />

            {/* Sales Channel Selector */}
            <CustomDropdown
              value={selectedChannel}
              onChange={setSelectedChannel}
              options={[
                { value: '', label: 'All Channels' },
                ...distinctChannels.map((ch) => ({
                  value: ch,
                  label: ch
                }))
              ]}
              icon="storefront"
              className="w-full sm:w-auto"
            />

            {/* Star Rating Selector */}
            <CustomDropdown
              value={selectedRating !== null ? String(selectedRating) : ''}
              onChange={(val) => setSelectedRating(val ? Number(val) : null)}
              options={[
                { value: '', label: 'All Star Ratings' },
                { value: '5', label: '5 Stars ★★★★★' },
                { value: '4', label: '4 Stars ★★★★' },
                { value: '3', label: '3 Stars ★★★' },
                { value: '2', label: '2 Stars ★★' },
                { value: '1', label: '1 Star ★' }
              ]}
              icon="star"
              className="w-full sm:w-auto"
            />

            {/* Reset Filters Pill */}
            {(selectedSku || selectedChannel || selectedRating !== null || localSearch || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSku('');
                  setSelectedChannel('');
                  setSelectedRating(null);
                  handleClearSearch();
                }}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 transition-colors cursor-pointer shrink-0"
                title="Reset queue filters"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Dedicated Search Input for Queue */}
          <div className="relative w-full sm:w-56 shrink-0">
            <input
              type="text"
              value={localSearch || searchQuery}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search reviews..."
              className="w-full h-8.5 sm:h-9 pl-8 pr-8 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-[#5122fe] transition-all placeholder:text-purple-300 font-medium"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-purple-400 text-[15px] pointer-events-none select-none">
              search
            </span>
            {(localSearch || searchQuery) && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClearSearch();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClearSearch();
                }}
                className="absolute right-1 top-1 w-7 h-7 flex items-center justify-center text-purple-400 hover:text-purple-700 cursor-pointer z-30 rounded-full hover:bg-purple-100 transition-colors"
                title="Clear search"
              >
                <span className="material-symbols-outlined text-[15px] pointer-events-none select-none">close</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reviews Queue List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-purple-100">
            <span className="material-symbols-outlined text-purple-600 text-3xl animate-spin">refresh</span>
            <p className="text-xs text-purple-900/60 mt-2 font-medium">Checking moderation triage pipeline...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-purple-100 p-6">
            <span className="material-symbols-outlined text-emerald-600 text-4xl">task_alt</span>
            <h3 className="text-sm font-semibold text-purple-950 mt-2">No items in {activeTab} queue</h3>
            <p className="text-xs text-purple-900/60 mt-0.5">
              All submissions in this category have been processed.
            </p>
          </div>
        ) : (
          reviews.map((r) => {
            const isSelected = selectedIds.includes(r.id);
            const toxicityPct = Math.round(r.toxicity_score * 100);
            const sentimentPct = Math.round(r.sentiment_score * 100);
            const formattedDate = new Date(r.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            const statusBadge = 
              r.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
              r.status === 'flagged' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              r.status === 'pending' ? 'bg-purple-100 text-purple-800 border-purple-200' :
              r.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-purple-50 text-purple-700 border-purple-200';

            const photoList = (r.images && r.images.length > 0)
              ? r.images
              : (r.image_url ? [r.image_url] : []);

            return (
              <div
                key={r.id}
                className={`bg-white rounded-2xl p-5 border transition-all ${
                  isSelected 
                    ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-md' 
                    : 'border-purple-100 hover:border-purple-300 shadow-[0_1px_3px_rgba(81,34,254,0.04)]'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  
                  {/* Left Column: Select, Info, Text, Photo Thumbnails */}
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(r.id)}
                      className="mt-1 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />

                    <div className="space-y-2 flex-1">
                      {/* Sub-header row */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${statusBadge}`}>
                          {r.status}
                        </span>
                        <span className="font-bold text-purple-950">{r.customer_name}</span>
                        <span className="text-purple-400">({r.customer_email})</span>
                        <span className="text-purple-200">&bull;</span>
                        <span className="font-mono text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200/60">{r.sku}</span>
                        <span className="text-purple-200">&bull;</span>
                        <span className="text-purple-700 font-medium">{r.channel}</span>
                        <span className="text-purple-200">&bull;</span>
                        <span className="text-purple-400">{formattedDate}</span>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(r)}
                          className="ml-auto flex items-center gap-1 text-[11px] font-bold text-[#5122fe] bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-lg border border-purple-200 transition-colors cursor-pointer"
                          title="Edit user review"
                        >
                          <span className="material-symbols-outlined text-[13px]">edit_note</span>
                          <span>Edit</span>
                        </button>
                      </div>

                      {/* Stars & Title */}
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <div className="flex items-center text-amber-400">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span key={star} className="material-symbols-outlined text-[14px] material-symbols-filled">
                                {star <= r.rating ? 'star' : 'star_border'}
                              </span>
                            ))}
                          </div>
                          <span className="text-[11px] font-bold text-purple-950">{r.rating}/5</span>
                        </div>
                        <h3 className="font-headline font-bold text-sm sm:text-base text-purple-950">
                          {r.title}
                        </h3>
                      </div>

                      {/* Review Body */}
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-purple-50/40 p-3 rounded-xl border border-purple-100">
                        {r.body}
                      </p>

                      {/* Shoe Photo Gallery in Moderation (Up to 6 photos preview) */}
                      {photoList.length > 0 && (
                        <div className="pt-1">
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-900 mb-1.5">
                            <span className="material-symbols-outlined text-[14px] text-purple-600">photo_library</span>
                            <span>Shoe Photos Uploaded ({photoList.length} of 6)</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {photoList.map((imgUrl, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setInspectPhoto(imgUrl)}
                                className="w-14 h-14 rounded-lg overflow-hidden border border-purple-200 hover:border-purple-600 transition-all cursor-pointer relative group"
                              >
                                <img src={imgUrl} alt="Shoe" className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                <div className="absolute inset-0 bg-purple-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes / Risk callouts */}
                      {r.moderation_note && !r.moderation_note.toLowerCase().includes('eleanor vance') && !r.moderation_note.toLowerCase().includes('bulk operation') && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-rose-600">info</span>
                          <div>
                            <span className="font-bold">Audit Flag:</span> {r.moderation_note}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Moderation Actions */}
                  <div className="lg:w-56 shrink-0 flex flex-col justify-center gap-2 pt-3 lg:pt-0 lg:pl-5 border-t lg:border-t-0 lg:border-l border-purple-100/80">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-purple-900/40 mb-0.5">
                      Moderator Actions
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleAction(r.id, 'approve')}
                        className="h-9 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 hover:shadow-md transition-all cursor-pointer active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>Approve</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setTargetReviewId(r.id);
                          setRejectModalOpen(true);
                        }}
                        className="h-9 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 hover:border-rose-300 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">cancel</span>
                        <span>Reject</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(r)}
                        className="h-9 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#5122fe] border border-purple-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 hover:border-[#5122fe]/40 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit_note</span>
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="h-9 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 hover:border-red-300 shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Loading More Spinner (Throttled Infinite Scroll) */}
        {loadingMore && (
          <div className="flex items-center justify-center py-6 gap-2 text-xs text-purple-700 font-semibold bg-white/70 rounded-2xl border border-purple-100 shadow-2xs animate-pulse">
            <span className="material-symbols-outlined text-base animate-spin text-[#5122fe]">progress_activity</span>
            <span>Loading more moderation items...</span>
          </div>
        )}

        {/* Infinite Scroll Sentinel element */}
        <div ref={sentinelRef} className="h-4 w-full pointer-events-none opacity-0" />

        {/* End of list confirmation */}
        {!hasMore && !loading && reviews.length > 0 && (
          <div className="flex items-center justify-center py-6 text-xs text-purple-900/40 gap-2">
            <span className="w-12 h-px bg-purple-200"></span>
            <span className="flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-[15px] text-purple-400">check_circle</span>
              All {reviews.length} reviews loaded
            </span>
            <span className="w-12 h-px bg-purple-200"></span>
          </div>
        )}
      </div>

      {/* Photo Inspector Modal */}
      {inspectPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setInspectPhoto(null)}
        >
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden p-3 border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 text-white">
              <span className="text-xs font-bold text-purple-300">Moderation Photo Audit</span>
              <button onClick={() => setInspectPhoto(null)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <img src={inspectPhoto} alt="Shoe audit" className="max-h-[70vh] w-full object-contain rounded-xl" />
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {/* Edit Review Modal */}
      <EditReviewModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingReview(null);
        }}
        review={editingReview}
        onReviewUpdated={() => {
          loadQueue();
          onQueueUpdated?.();
        }}
        showToast={showToast}
      />

      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-purple-200 space-y-3 animate-in zoom-in-95">
            <h3 className="font-headline font-bold text-sm text-purple-950">
              Reject Review
            </h3>
            <p className="text-xs text-purple-900/60">
              Provide an internal audit note explaining why this shoe review does not meet broadcast criteria.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Inappropriate language, counterfeit accusation without receipt..."
              className="w-full p-2.5 rounded-xl bg-purple-50/50 border border-purple-200 text-xs focus:outline-none focus:border-rose-500"
            ></textarea>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setTargetReviewId(null);
                  setRejectionReason('');
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-700 hover:bg-purple-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleAction(targetReviewId, 'reject', rejectionReason);
                  setRejectModalOpen(false);
                  setTargetReviewId(null);
                  setRejectionReason('');
                }}
                className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shadow-xs"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
