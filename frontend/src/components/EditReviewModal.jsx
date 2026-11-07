import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function EditReviewModal({ isOpen, onClose, review, onReviewUpdated, showToast }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(5);
  const [customerName, setCustomerName] = useState('');
  const [status, setStatus] = useState('pending');
  const [tags, setTags] = useState('');
  const [moderationNote, setModerationNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (review && isOpen) {
      setTitle(review.title || '');
      setBody(review.body || '');
      setRating(review.rating || 5);
      setCustomerName(review.customer_name || '');
      setStatus(review.status || 'pending');
      setTags(review.tags || '');
      setModerationNote(review.moderation_note || '');
      setError(null);
    }
  }, [review, isOpen]);

  if (!isOpen || !review) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please provide a review headline / title.');
      return;
    }
    if (!body.trim()) {
      setError('Please provide review feedback text.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: title.trim(),
        body: body.trim(),
        rating: Number(rating),
        customer_name: customerName.trim(),
        status: status.toLowerCase(),
        tags: tags.trim(),
        moderation_note: moderationNote.trim() || undefined
      };

      await api.updateReview(review.id, payload);
      showToast?.('Feedback updated and telemetry recalculated successfully!', 'success');
      onReviewUpdated?.();
      onClose();
    } catch (err) {
      console.error('Failed to update review:', err);
      setError(err.message || 'Failed to update review. Please try again.');
      showToast?.(err.message || 'Error updating review', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-3xl border border-purple-200 shadow-[0_24px_70px_rgba(81,34,254,0.22)] max-w-xl w-full p-5 sm:p-6 animate-in zoom-in-95 duration-150 my-auto text-xs sm:text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 flex items-center justify-center transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-3.5 mb-4 border-b border-purple-100 pr-8">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#5122fe] to-[#7b4eff] text-white flex items-center justify-center shadow-md shadow-[#5122fe]/25 shrink-0">
            <span className="material-symbols-outlined text-[20px]">edit_note</span>
          </div>
          <div>
            <h2 className="font-headline text-base sm:text-lg font-bold text-purple-950 tracking-tight">
              Edit User Feedback
            </h2>
            <p className="text-xs text-purple-900/60 mt-0.5">
              Modify review text, star rating, or update moderation audit notes.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-rose-600 shrink-0 mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={handleSave} className="space-y-3.5">
          
          {/* Review Title */}
          <div>
            <label className="block text-xs font-bold text-purple-950 mb-1">
              Review Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-purple-50/40 border border-purple-200 text-xs sm:text-sm text-purple-950 font-semibold focus:outline-none focus:bg-white focus:border-[#5122fe] focus:ring-2 focus:ring-[#5122fe]/20 transition-all"
              placeholder="e.g. Incredibly comfortable shoe"
              required
            />
          </div>

          {/* Review Body */}
          <div>
            <label className="block text-xs font-bold text-purple-950 mb-1">
              Written Feedback <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-3 rounded-xl bg-purple-50/40 border border-purple-200 text-xs sm:text-sm text-purple-950 focus:outline-none focus:bg-white focus:border-[#5122fe] focus:ring-2 focus:ring-[#5122fe]/20 transition-all leading-relaxed"
              placeholder="User review feedback..."
              required
            />
          </div>

          {/* Row 2: Rating & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Rating Selector */}
            <div>
              <label className="block text-xs font-bold text-purple-950 mb-1">
                Rating ({rating}/5 Stars)
              </label>
              <div className="flex items-center gap-1.5 h-10 px-3 rounded-xl bg-purple-50/40 border border-purple-200">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px] material-symbols-filled">
                      {star <= rating ? 'star' : 'star_border'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Moderation Status */}
            <div>
              <label className="block text-xs font-bold text-purple-950 mb-1">
                Moderation Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-purple-50/40 border border-purple-200 text-xs sm:text-sm font-semibold text-purple-950 focus:outline-none focus:bg-white focus:border-[#5122fe] capitalize cursor-pointer"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="flagged">Flagged</option>
                <option value="escalated">Escalated</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Row 3: Customer Name & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-purple-950 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-purple-50/40 border border-purple-200 text-xs sm:text-sm text-purple-950 focus:outline-none focus:bg-white focus:border-[#5122fe]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-950 mb-1">
                Tags (Comma separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Comfort, Traction, Cushioning"
                className="w-full h-10 px-3 rounded-xl bg-purple-50/40 border border-purple-200 text-xs sm:text-sm text-purple-950 focus:outline-none focus:bg-white focus:border-[#5122fe]"
              />
            </div>
          </div>

          {/* Moderation / Audit Note */}
          <div>
            <label className="block text-xs font-bold text-purple-950 mb-1">
              Audit Note / Moderator Log
            </label>
            <input
              type="text"
              value={moderationNote}
              onChange={(e) => setModerationNote(e.target.value)}
              placeholder="e.g. Fixed customer typos with user consent"
              className="w-full h-10 px-3.5 rounded-xl bg-purple-50/40 border border-purple-200 text-xs sm:text-sm text-purple-950 focus:outline-none focus:bg-white focus:border-[#5122fe]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-purple-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-purple-900/70 hover:text-purple-950 hover:bg-purple-50 border border-purple-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#5122fe] to-[#7b4eff] hover:from-[#4316df] hover:to-[#6a3bf0] text-white shadow-md shadow-[#5122fe]/25 transition-all cursor-pointer flex items-center gap-1.5 active:scale-98 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
