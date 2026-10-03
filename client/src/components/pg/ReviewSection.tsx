import { useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { usePGReviews, useAddOrUpdateReview, useDeleteReview } from '@/hooks/useReview';
import { cn, getInitials } from '@/lib/utils';

interface ReviewSectionProps {
  pgId: string;
}

export function ReviewSection({ pgId }: ReviewSectionProps) {
  const { isAuthenticated, user } = useAuthStore();
  const { data, isLoading } = usePGReviews(pgId);
  const addOrUpdateReview = useAddOrUpdateReview(pgId);
  const deleteReview = useDeleteReview(pgId);

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showForm, setShowForm] = useState(false);

  const reviews = data?.data?.reviews ?? [];
  const total = data?.data?.total ?? 0;
  const ratingDist = data?.data?.ratingDistribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  // Calculate average rating
  const totalSum = Object.entries(ratingDist).reduce((sum, [star, count]) => sum + Number(star) * count, 0);
  const avgRating = total > 0 ? (totalSum / total).toFixed(1) : '0.0';

  const userExistingReview = reviews.find((r) => r.user?._id === user?._id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    await addOrUpdateReview.mutateAsync({ rating, comment });
    setComment('');
    setShowForm(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-40 animate-pulse rounded-full bg-surface" />
        <div className="h-28 animate-pulse rounded-[24px] bg-surface" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Reviews <span className="font-normal text-muted">({total})</span>
        </h2>
        {isAuthenticated && user?.role === 'student' && (
          <button
            type="button"
            id="write-review-btn"
            onClick={() => {
              if (userExistingReview) {
                setRating(userExistingReview.rating);
                setComment(userExistingReview.comment);
              }
              setShowForm(!showForm);
            }}
            className="h-10 rounded-2xl border border-black/[0.08] px-4 text-[13px] font-medium transition-colors hover:bg-surface"
          >
            {userExistingReview ? 'Edit your review' : 'Write a review'}
          </button>
        )}
      </div>

      {total > 0 && (
        <div className="mb-5 grid items-center gap-6 rounded-[24px] bg-surface p-5 sm:grid-cols-[auto_1fr]">
          <div className="text-center sm:pr-6">
            <p className="text-4xl font-semibold tracking-tight">{avgRating}</p>
            <Stars value={Math.round(Number(avgRating))} className="mt-1.5 justify-center" />
            <p className="mt-1 text-xs text-muted">
              {total} review{total !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = ratingDist[stars] ?? 0;
              const percentage = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={stars} className="flex items-center gap-3 text-xs">
                  <span className="w-3 font-medium">{stars}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
                    <div className="h-full rounded-full bg-ink transition-all duration-500" style={{ width: `${percentage}%` }} />
                  </div>
                  <span className="w-6 text-right text-muted">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 space-y-4 rounded-[24px] border border-black/[0.08] p-5 animate-fade-in">
          <div>
            <p className="mb-2 text-[13px] font-medium">Your rating</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'h-7 w-7 transition-colors',
                      star <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-black/15'
                    )}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted">{hoverRating || rating} / 5</span>
            </div>
          </div>
          <div>
            <label htmlFor="review-comment" className="mb-1.5 block text-[13px] font-medium">
              Your review
            </label>
            <textarea
              id="review-comment"
              placeholder="Cleanliness, room comfort, food, safety, how the broker treated you…"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              minLength={5}
              className="w-full resize-none rounded-2xl border border-transparent bg-surface px-4 py-3 text-sm leading-relaxed outline-none transition-all placeholder:text-muted/80 focus:border-black/10 focus:bg-white focus:ring-4 focus:ring-black/[0.04]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="h-11 rounded-2xl px-4 text-sm font-medium hover:bg-surface">
              Cancel
            </button>
            <button
              type="submit"
              id="submit-review-btn"
              disabled={addOrUpdateReview.isPending}
              className="h-11 rounded-2xl bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-60"
            >
              {userExistingReview ? 'Update review' : 'Post review'}
            </button>
          </div>
        </form>
      )}

      {reviews.length > 0 ? (
        <div className="divide-y divide-black/[0.06]">
          {reviews.map((r) => {
            const isMine = user?._id === r.user?._id;
            return (
              <div key={r._id} className="py-4 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-surface text-xs font-semibold">
                      {r.user?.avatar ? (
                        <img src={r.user.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        getInitials(r.user?.name || 'S')
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium leading-tight">{r.user?.name || 'Student'}</p>
                      <p className="text-xs text-muted">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} />
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => deleteReview.mutate(r._id)}
                        disabled={deleteReview.isPending}
                        aria-label="Delete your review"
                        title="Delete your review"
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 pl-12 text-sm leading-relaxed text-muted">{r.comment}</p>
              </div>
            );
          })}
        </div>
      ) : (
        !showForm && (
          <div className="rounded-[24px] bg-surface px-6 py-10 text-center">
            <Star className="mx-auto h-6 w-6 text-black/20" />
            <p className="mt-2 text-sm font-medium">No reviews yet</p>
            <p className="mt-0.5 text-[13px] text-muted">Stayed here? Help other students by sharing how it was.</p>
          </div>
        )
      )}
    </div>
  );
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('flex gap-0.5', className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn('h-3.5 w-3.5', s <= value ? 'fill-amber-400 text-amber-400' : 'text-black/15')} />
      ))}
    </div>
  );
}
