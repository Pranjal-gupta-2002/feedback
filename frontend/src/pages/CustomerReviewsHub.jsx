import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../api/client';
import SubmitReview from './SubmitReview';
import CustomDropdown from '../components/CustomDropdown';
import { useDebounce } from '../hooks/useDebounce';
import { throttle } from '../utils/throttle';

const PAGE_SIZE = 6;

const DEFAULT_CHANNELS = [
  'Direct Web',
  'Nike SNKRS App',
  'Shopify Store',
  'Amazon Global',
  'In-App iOS'
];

export default function CustomerReviewsHub({ onNavigateWrite, showToast, searchQuery = '', onSearch }) {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef(null);
  const [selectedRating, setSelectedRating] = useState(null);
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedSku, setSelectedSku] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [photosOnly, setPhotosOnly] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [writeModalOpen, setWriteModalOpen] = useState(false);

  const handleClearSearch = () => {
    setLocalSearch('');
    onSearch?.('');
  };

  const effectiveSearch = searchQuery || localSearch;
  const debouncedSearch = useDebounce(effectiveSearch, 350);

  // 1. Fetch static metadata (channels & products catalog) once on mount
  useEffect(() => {
    let isMounted = true;
    api.getMetadata()
      .then((meta) => {
        if (!isMounted) return;
        if (meta?.channels && meta.channels.length > 0) {
          setChannels(meta.channels);
        }
        if (meta?.products && meta.products.length > 0) {
          setProducts(meta.products);
        }
      })
      .catch((err) => console.error('Failed to load metadata:', err));
    return () => { isMounted = false; };
  }, []);

  // Compute distinct channels from metadata + loaded reviews
  const distinctChannels = useMemo(() => {
    const set = new Set([...channels, ...DEFAULT_CHANNELS]);
    reviews.forEach((r) => { if (r.channel) set.add(r.channel); });
    return Array.from(set).filter(Boolean);
  }, [channels, reviews]);

  // Compute distinct shoes/products from catalog + loaded reviews
  const distinctProducts = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p.sku) map.set(p.sku, { sku: p.sku, name: p.name || p.sku });
    });
    reviews.forEach((r) => {
      if (r.sku && !map.has(r.sku)) {
        map.set(r.sku, { sku: r.sku, name: r.product_name || r.sku });
      }
    });
    return Array.from(map.values());
  }, [products, reviews]);

  // Helper to format shoe/product labels nicely (e.g. "Nike • Snaker" instead of "snaker (nike)")
  const formatProductLabel = (p) => {
    if (!p) return '';
    const cap = (s) => s ? s.split(/[\s_-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';
    const brand = cap(p.sku);
    const model = cap(p.name);
    if (brand && model && brand.toLowerCase() !== model.toLowerCase()) {
      return `${brand} • ${model}`;
    }
    return model || brand || 'Unknown Shoe';
  };

  // 2. Fetch aggregate review summary (filters by channel and shoe/sku)
  const loadSummary = async (ch = selectedChannel, sku = selectedSku) => {
    try {
      const sum = await api.getReviewsSummary({
        channel: ch || undefined,
        sku: sku || undefined
      });
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load review summary:', err);
    }
  };

  useEffect(() => {
    loadSummary(selectedChannel, selectedSku);
  }, [selectedChannel, selectedSku]);

  // 3. Fetch reviews list whenever rating, channel, shoe/sku, sort, or search changes (debounced)
  const loadReviews = async () => {
    try {
      setLoading(true);
      const revs = await api.getReviews({
        status: 'approved',
        rating: selectedRating || undefined,
        channel: selectedChannel || undefined,
        sku: selectedSku || undefined,
        sort: sortBy,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset: 0
      });
      const items = revs || [];
      setReviews(items);
      setHasMore(items.length >= PAGE_SIZE);
    } catch (err) {
      console.error(err);
      showToast?.('Error loading customer reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [selectedRating, selectedChannel, selectedSku, sortBy, debouncedSearch]);

  // Load next batch of reviews (Infinite Scroll)
  const loadMoreReviews = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const currentOffset = reviews.length;
      const nextBatch = await api.getReviews({
        status: 'approved',
        rating: selectedRating || undefined,
        channel: selectedChannel || undefined,
        sku: selectedSku || undefined,
        sort: sortBy,
        search: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset: currentOffset
      });

      if (!nextBatch || nextBatch.length === 0) {
        setHasMore(false);
      } else {
        setReviews(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const filteredNew = nextBatch.filter(r => !existingIds.has(r.id));
          return [...prev, ...filteredNew];
        });
        if (nextBatch.length < PAGE_SIZE) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Failed to load more reviews:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, reviews.length, selectedRating, selectedChannel, selectedSku, sortBy, debouncedSearch]);

  // Throttled window scroll listener for infinite scroll
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const handleScroll = throttle(() => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 350;

      if (scrollPosition >= threshold) {
        loadMoreReviews();
      }
    }, 250);

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      handleScroll.cancel();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [hasMore, loading, loadingMore, loadMoreReviews]);

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
            loadMoreReviews();
          }
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMoreReviews]);

  // 4. Full refresh triggered by the manual Refresh button or review submission
  const handleFullRefresh = async () => {
    try {
      setLoading(true);
      const [revs, sum, meta] = await Promise.all([
        api.getReviews({
          status: 'approved',
          rating: selectedRating || undefined,
          channel: selectedChannel || undefined,
          sku: selectedSku || undefined,
          sort: sortBy,
          search: debouncedSearch || undefined,
          limit: PAGE_SIZE,
          offset: 0
        }),
        api.getReviewsSummary({
          channel: selectedChannel || undefined,
          sku: selectedSku || undefined
        }),
        api.getMetadata()
      ]);
      const items = revs || [];
      setReviews(items);
      setHasMore(items.length >= PAGE_SIZE);
      setSummary(sum);
      if (meta?.channels && meta.channels.length > 0) setChannels(meta.channels);
      if (meta?.products && meta.products.length > 0) setProducts(meta.products);
      showToast?.('Reviews refreshed', 'success');
    } catch (err) {
      console.error(err);
      showToast?.('Error refreshing reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (id, voteType) => {
    try {
      const updated = await api.voteReview(id, voteType);
      setReviews(prev => prev.map(r => r.id === id ? updated : r));
      showToast?.(`Feedback recorded`, 'success');
    } catch (err) {
      showToast?.('Could not record vote', 'error');
    }
  };

  // Filter for photos only
  const displayedReviews = photosOnly
    ? reviews.filter(r => (r.images && r.images.length > 0) || r.image_url)
    : reviews;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">

      {/* Upfront Community Wear-Test Callout with Resembling UI */}
      <div className="bg-gradient-to-r from-purple-50/90 via-white to-purple-50/60 rounded-2xl border border-purple-200/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#5122fe] to-[#7b4eff] text-white flex items-center justify-center shadow-md shadow-[#5122fe]/25 shrink-0">
            <span className="material-symbols-outlined text-[20px]">rate_review</span>
          </div>
          <div>
            <h2 className="font-headline text-sm sm:text-base font-bold text-purple-950">
              Tested footwear recently? Add your feedback
            </h2>
            <p className="text-xs text-purple-900/60 mt-0.5">
              Share real-world cushioning, fit ratings, and up to 6 on-foot wear photos with fellow sneakerheads.
            </p>
          </div>
        </div>

        <button
          onClick={() => setWriteModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#5122fe] to-[#7b4eff] hover:from-[#4316df] hover:to-[#6830ff] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#5122fe]/25 hover:shadow-lg hover:shadow-[#5122fe]/40 hover:-translate-y-0.5 transition-all cursor-pointer whitespace-nowrap active:scale-98"
        >
          <span className="material-symbols-outlined text-[17px]">add_a_photo</span>
          <span>Write a Review</span>
        </button>
      </div>

      {/* Overview Card: Full Graceful Coverage across max-w-6xl */}
      <div className="bg-white rounded-2xl border border-purple-200/80 shadow-[0_4px_24px_rgba(81,34,254,0.06)] p-5 sm:p-6 transition-all">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">

          {/* Left Rating Block (Col 1-4) */}
          <div className="md:col-span-5 flex flex-col space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-full border border-purple-200">
                Shoe Ratings & Feed
              </span>
              <span className="text-[11px] text-purple-400">&bull; Live Customer Aggregate</span>
            </div>

            <div className="flex items-baseline gap-3">
              <span className="font-headline text-3xl sm:text-4xl font-extrabold text-purple-950 tracking-tight">
                {summary && summary.total_reviews > 0 ? summary.average_rating.toFixed(1) : '0.0'}
              </span>
              <div className="flex flex-col">
                <div className="flex items-center text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className="material-symbols-outlined text-[18px] material-symbols-filled">
                      {star <= Math.round(summary?.average_rating || 0) ? 'star' : 'star_border'}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-purple-900/70 mt-0.5">
                  Based on {summary?.total_reviews ?? reviews.length} customer review{(summary?.total_reviews ?? reviews.length) === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setWriteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white text-xs font-semibold shadow-sm shadow-purple-300 transition-all active:scale-98 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">rate_review</span>
                Write Review with Photos
              </button>
            </div>
          </div>

          {/* Center Rating Distribution (Col 5-8) */}
          <div className="md:col-span-4 space-y-1.5 md:border-l border-purple-100 md:pl-6">
            <div className="text-[11px] font-semibold text-purple-900 mb-1">
              Rating Distribution
            </div>
            {[5, 4, 3, 2, 1].map((star) => {
              const key = `${star}_star`;
              const data = summary?.rating_distribution?.[key] || { count: 0, percentage: 0 };
              const barColor = star >= 4
                ? 'bg-gradient-to-r from-purple-600 to-violet-500'
                : star === 3
                  ? 'bg-purple-400'
                  : 'bg-rose-400';
              return (
                <button
                  key={star}
                  onClick={() => setSelectedRating(selectedRating === star ? null : star)}
                  className={`w-full flex items-center gap-2 text-xs transition-colors p-1 rounded-lg hover:bg-purple-50/70 ${selectedRating === star ? 'font-semibold text-purple-900 bg-purple-100/60' : 'text-slate-600'
                    }`}
                >
                  <span className="w-6 text-left flex items-center gap-0.5 text-[11px]">
                    <span>{star}</span>
                    <span className="material-symbols-outlined text-[12px] material-symbols-filled text-amber-400">star</span>
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-purple-100/80 overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all duration-500`}
                      style={{ width: `${data.percentage}%` }}
                    ></div>
                  </div>
                  <span className="w-8 text-right font-medium text-purple-900/60 text-[10px]">{data.percentage}%</span>
                </button>
              );
            })}
          </div>

          {/* Right Highlights & Category Telemetry (Col 9-12) */}
          <div className="md:col-span-3 space-y-2.5 md:border-l border-purple-100 md:pl-6 text-xs">
            <div className="text-[11px] font-semibold text-purple-900 mb-1">
              Shoe Quality Indicators
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-purple-700/80 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600 material-symbols-filled">verified</span>
                  Verified Orders
                </span>
                <span className="font-bold text-purple-950">{summary ? summary.verified_percentage : 0}%</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-purple-700/80 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-purple-600">photo_camera</span>
                  With Photo Proof
                </span>
                <span className="font-bold text-purple-950">{summary ? summary.photo_percentage : 0}%</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-purple-700/80 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600 material-symbols-filled">thumb_up</span>
                  Recommend Rate
                </span>
                <span className="font-bold text-emerald-700">{summary ? (summary.recommend_percentage ?? 0) : 0}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Micro Signals Strip */}
        <div className="mt-4 pt-3.5 border-t border-purple-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-purple-900/70">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-emerald-600 material-symbols-filled">verified</span>
            <span>{summary ? summary.verified_percentage : 0}% Verified Buyer Reviews</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-purple-600">thumb_up</span>
            <span>{summary ? (summary.recommend_percentage ?? 0) : 0}% Recommendation Rate</span>
          </div>
        </div>
      </div>

      {/* Filter & Control Toolbar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-purple-200/80 shadow-2xs space-y-2.5 sm:space-y-3">
        {/* Row 1: Dropdown Selectors & Actions (2x2 grid on mobile, inline flex on desktop) */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between gap-2">
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

          {/* Channel Selector */}
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

          {/* Sort Selector */}
          <CustomDropdown
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'recent', label: 'Most Recent' },
              { value: 'highest_rating', label: 'Highest Rating' },
              { value: 'lowest_rating', label: 'Lowest Rating' },
              { value: 'most_helpful', label: 'Most Helpful' }
            ]}
            icon="sort"
            className="w-full sm:w-auto sm:ml-auto"
          />

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleFullRefresh}
            disabled={loading}
            title="Refresh latest reviews"
            className="h-8.5 sm:h-9 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 text-[11px] sm:text-xs font-semibold border border-purple-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50 w-full sm:w-auto shrink-0"
          >
            <span className={`material-symbols-outlined text-[15px] text-[#5122fe] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Refresh</span>
          </button>
        </div>

        {/* Subtle Separator */}
        <div className="border-t border-purple-100/90" />

        {/* Row 2: Star Rating Filter Pills & Photo Proof Filter (Single Swipeable Strip) */}
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 w-full">
          <span className="text-[10px] sm:text-[11px] font-semibold text-purple-900/60 uppercase tracking-wider shrink-0 mr-0.5">
            Rating:
          </span>
          <button
            onClick={() => setSelectedRating(null)}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${selectedRating === null
              ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-xs'
              : 'text-purple-900/70 hover:bg-purple-50 bg-purple-50/40 border border-purple-200/50'
            }`}
          >
            All
          </button>
          {[5, 4, 3, 2, 1].map((s) => (
            <button
              key={s}
              onClick={() => setSelectedRating(selectedRating === s ? null : s)}
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all flex items-center gap-0.5 sm:gap-1 cursor-pointer ${selectedRating === s
                ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-xs'
                : 'text-purple-900/70 hover:bg-purple-50 bg-purple-50/40 border border-purple-200/50'
              }`}
            >
              <span>{s}</span>
              <span className="material-symbols-outlined text-[12px] sm:text-[13px] material-symbols-filled text-amber-400">star</span>
            </button>
          ))}

          <div className="h-4 w-px bg-purple-200/80 shrink-0 mx-1" />

          {/* Toggle Photos Only Button */}
          <button
            onClick={() => setPhotosOnly(!photosOnly)}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 border cursor-pointer ${photosOnly
              ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
              : 'bg-purple-50/80 text-purple-800 border-purple-200 hover:bg-purple-100'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">photo_camera</span>
            <span>With Photos ({reviews.filter(r => (r.images && r.images.length > 0) || r.image_url).length})</span>
          </button>
        </div>

        {/* Active Filters Bar */}
        {(selectedSku || selectedChannel || selectedRating !== null || photosOnly || effectiveSearch) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-purple-100 text-xs w-full">
            <span className="text-purple-900/60 text-[11px] font-medium mr-1">Active filters:</span>
            {selectedSku && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-900 font-medium text-[11px]">
                <span>Shoe: {distinctProducts.find(p => p.sku === selectedSku)?.name || selectedSku}</span>
                <button onClick={() => setSelectedSku('')} className="hover:text-purple-600 font-bold cursor-pointer">×</button>
              </span>
            )}
            {selectedChannel && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-900 font-medium text-[11px]">
                <span>Channel: {selectedChannel}</span>
                <button onClick={() => setSelectedChannel('')} className="hover:text-purple-600 font-bold cursor-pointer">×</button>
              </span>
            )}
            {selectedRating !== null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-900 font-medium text-[11px]">
                <span>Rating: {selectedRating}★</span>
                <button onClick={() => setSelectedRating(null)} className="hover:text-purple-600 font-bold cursor-pointer">×</button>
              </span>
            )}
            {photosOnly && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-900 font-medium text-[11px]">
                <span>With Photos</span>
                <button onClick={() => setPhotosOnly(false)} className="hover:text-purple-600 font-bold cursor-pointer">×</button>
              </span>
            )}
            {effectiveSearch && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-900 font-medium text-[11px]">
                <span>Search: "{effectiveSearch}"</span>
                <button onClick={handleClearSearch} className="hover:text-purple-600 font-bold cursor-pointer">×</button>
              </span>
            )}
            <button
              onClick={() => { setSelectedRating(null); setSelectedChannel(''); setSelectedSku(''); setPhotosOnly(false); handleClearSearch(); }}
              className="text-[11px] text-purple-700 hover:text-purple-950 underline ml-1 cursor-pointer font-medium"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-purple-100">
            <span className="material-symbols-outlined text-purple-600 text-3xl animate-spin">refresh</span>
            <p className="text-xs text-purple-900/60 mt-2 font-medium">Loading shoe evaluations and photo galleries...</p>
          </div>
        ) : displayedReviews.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-purple-100 p-6">
            <span className="material-symbols-outlined text-purple-300 text-4xl">inventory_2</span>
            <h3 className="text-sm font-semibold text-purple-950 mt-2">No shoe reviews match current filters</h3>
            <p className="text-xs text-purple-900/60 mt-1">
              Try resetting your filters or search terms.
            </p>
            <button
              onClick={() => { setSelectedRating(null); setSelectedChannel(''); setSelectedSku(''); setPhotosOnly(false); setLocalSearch(''); }}
              className="mt-3 px-4 py-1.5 rounded-xl bg-purple-700 text-white text-xs font-semibold hover:bg-purple-800 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          displayedReviews.map((r) => {
            const initials = r.customer_name ? r.customer_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'CU';
            const formattedDate = new Date(r.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            // Extract photo list: supports array or legacy image_url
            const photoList = (r.images && r.images.length > 0)
              ? r.images
              : (r.image_url ? [r.image_url] : []);

            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl p-5 sm:p-6 border border-purple-100 hover:border-purple-300 shadow-[0_1px_3px_rgba(81,34,254,0.03)] hover:shadow-[0_4px_20px_rgba(81,34,254,0.08)] transition-all flex flex-col space-y-3"
              >
                {/* Header row: User, Product, Rating, Channel */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-700 to-violet-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-purple-950">{r.customer_name}</span>
                        {r.verified_purchase && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="material-symbols-outlined text-[11px] material-symbols-filled">verified</span>
                            Verified Purchase
                          </span>
                        )}
                        <span className="text-[11px] text-purple-900/40">&bull; {formattedDate}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-purple-900/70 mt-0.5">
                        <span className="font-semibold text-purple-900">{r.product_name}</span>
                        <span className="text-purple-300">&bull;</span>
                        <span className="font-mono text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200/60">{r.sku}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className="material-symbols-outlined text-[15px] material-symbols-filled">
                          {star <= r.rating ? 'star' : 'star_border'}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-200/60">
                      {r.channel}
                    </span>
                  </div>
                </div>

                {/* Review Title & Body */}
                <div className="space-y-1.5">
                  <h3 className="font-headline font-bold text-sm sm:text-base text-purple-950">
                    {r.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {r.body}
                  </p>
                </div>

                {/* Customer Shoe Photo Gallery (Up to 6 photos with interactive preview) */}
                {photoList.length > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-purple-950 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-purple-600">photo_library</span>
                        <span>Customer Photos ({photoList.length} of 6)</span>
                      </div>
                      <span className="text-[10px] text-purple-500 font-medium hidden sm:inline-block">Click photo to zoom</span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {photoList.map((imgUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setLightbox({
                            images: photoList,
                            currentIndex: idx,
                            title: r.title,
                            customer: r.customer_name,
                            product: r.product_name
                          })}
                          className="relative group aspect-square rounded-xl overflow-hidden border border-purple-200/80 bg-purple-50/50 shadow-2xs hover:shadow-md hover:border-purple-600 transition-all cursor-pointer focus:outline-none"
                        >
                          <img
                            src={imgUrl}
                            alt={`Shoe view ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300"
                            loading="lazy"
                          />
                          <span className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.2 rounded font-mono font-medium">
                            {idx + 1}
                          </span>
                          <div className="absolute inset-0 bg-purple-900/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-[20px]">zoom_in</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feature Tags & Recommendation */}
                {r.tags && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {r.tags.split(',').map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200/60"
                      >
                        {tag.trim()}
                      </span>
                    ))}
                    {r.recommend && (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[11px] material-symbols-filled">thumb_up</span>
                        Recommends Shoe
                      </span>
                    )}
                  </div>
                )}

                {/* Footer with Helpful voting */}
                <div className="flex items-center justify-between pt-3 border-t border-purple-100 text-xs text-purple-900/70">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-purple-900/60 font-medium">Helpful wear review?</span>
                    <button
                      onClick={() => handleVote(r.id, 'helpful')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-medium border border-purple-200 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">thumb_up</span>
                      <span>Yes ({r.helpful_count})</span>
                    </button>
                    <button
                      onClick={() => handleVote(r.id, 'unhelpful')}
                      className="inline-flex items-center px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 text-[11px] border border-purple-200 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">thumb_down</span>
                    </button>
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
            <span>Loading more shoe reviews...</span>
          </div>
        )}

        {/* Infinite Scroll Sentinel element */}
        <div ref={sentinelRef} className="h-4 w-full pointer-events-none opacity-0" />

        {/* End of list confirmation */}
        {!hasMore && !loading && displayedReviews.length > 0 && (
          <div className="flex items-center justify-center py-6 text-xs text-purple-900/40 gap-2">
            <span className="w-12 h-px bg-purple-200"></span>
            <span className="flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-[15px] text-purple-400">check_circle</span>
              All {displayedReviews.length} reviews loaded
            </span>
            <span className="w-12 h-px bg-purple-200"></span>
          </div>
        )}
      </div>

      {/* Interactive Photo Lightbox Dialog */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-950 rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="p-4 bg-slate-900/90 border-b border-white/10 flex items-center justify-between gap-3 text-white">
              <div>
                <h4 className="font-headline font-bold text-sm text-purple-300">
                  {lightbox.product}
                </h4>
                <p className="text-xs text-slate-400">
                  Review by <strong>{lightbox.customer}</strong> &bull; Photo {lightbox.currentIndex + 1} of {lightbox.images.length}
                </p>
              </div>

              <button
                onClick={() => setLightbox(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Lightbox Image Preview with Navigation */}
            <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px] sm:min-h-[480px] p-4">
              <img
                src={lightbox.images[lightbox.currentIndex]}
                alt="Shoe full size"
                className="max-h-[65vh] max-w-full object-contain rounded-lg"
              />

              {lightbox.images.length > 1 && (
                <>
                  <button
                    onClick={() => setLightbox({
                      ...lightbox,
                      currentIndex: (lightbox.currentIndex - 1 + lightbox.images.length) % lightbox.images.length
                    })}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  <button
                    onClick={() => setLightbox({
                      ...lightbox,
                      currentIndex: (lightbox.currentIndex + 1) % lightbox.images.length
                    })}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                </>
              )}
            </div>

            {/* Lightbox Footer Thumbnails Strip */}
            <div className="p-3 bg-slate-900 border-t border-white/10 flex items-center justify-center gap-2 overflow-x-auto">
              {lightbox.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setLightbox({ ...lightbox, currentIndex: i })}
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${lightbox.currentIndex === i ? 'border-purple-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                >
                  <img src={img} alt="Thumb" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Write Review Popup Modal */}
      <SubmitReview
        isOpen={writeModalOpen}
        onClose={() => setWriteModalOpen(false)}
        onReviewSubmitted={() => {
          handleFullRefresh();
          showToast?.('Shoe wear-test review published live!', 'success');
        }}
        showToast={showToast}
      />
    </div>
  );
}
