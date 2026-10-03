import { useDashboard } from '@/hooks/useInquiry';
import { useMyListings } from '@/hooks/usePG';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';
import {
  Building2, Eye, MessageSquare, Heart, PlusCircle,
  BarChart3,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

function StatCard({
  icon, label, value, color = 'violet',
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: 'violet' | 'cyan' | 'emerald' | 'amber';
}) {
  const colors = {
    violet: 'bg-blue-50 text-blue-600 border border-blue-100',
    cyan: 'bg-sky-50 text-sky-600 border border-sky-100',
    emerald: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border border-amber-100',
  };
  return (
    <Card glow={false} className="premium-shadow border border-slate-100 bg-white">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 font-semibold">{label}</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colors[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: dashData, isLoading: dashLoading } = useDashboard();
  const { data: listingsData, isLoading: listLoading } = useMyListings();

  const isOwner = user?.role === 'owner';
  const stats = dashData?.data;
  const listings = listingsData?.data?.listings ?? [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-500">
            {isOwner ? "Here's how your PGs are performing" : "Manage your PG search"}
          </p>
        </div>
        {isOwner && (
          <Link to="/dashboard/listings/new">
            <Button id="add-listing-btn">
              <PlusCircle className="h-4 w-4" />
              Add Listing
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      {isOwner && (
        <>
          {dashLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="premium-shadow border border-slate-100 bg-white"><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<Building2 className="h-6 w-6" />} label="Active Listings" value={stats?.availableListings ?? 0} color="violet" />
              <StatCard icon={<Eye className="h-6 w-6" />} label="Total Views" value={stats?.totalViews ?? 0} color="cyan" />
              <StatCard icon={<MessageSquare className="h-6 w-6" />} label="Inquiries" value={stats?.totalInquiries ?? 0} color="emerald" />
              <StatCard icon={<Heart className="h-6 w-6" />} label="Total Saves" value={stats?.totalSaves ?? 0} color="amber" />
            </div>
          )}
        </>
      )}

      {/* Student stats */}
      {!isOwner && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={<Building2 className="h-6 w-6" />} label="Browse PGs" value="Explore →" color="violet" />
          <StatCard icon={<Heart className="h-6 w-6" />} label="Saved PGs" value={stats?.totalSaves ?? 0} color="cyan" />
          <StatCard icon={<MessageSquare className="h-6 w-6" />} label="My Inquiries" value={stats?.totalInquiries ?? 0} color="emerald" />
        </div>
      )}

      {/* My Listings (Owner) */}
      {isOwner && (
        <Card className="premium-shadow border border-slate-100 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>My Listings</CardTitle>
              <Link to="/dashboard/listings">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : listings.length === 0 ? (
              <div className="py-8 text-center">
                <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-slate-500">No listings yet</p>
                <Link to="/dashboard/listings/new" className="mt-3 inline-block">
                  <Button size="sm">Create your first listing</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.slice(0, 5).map((pg) => (
                  <div key={pg._id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{pg.title}</p>
                        <p className="text-sm text-slate-500 font-medium">{pg.location.city} · {formatCurrency(pg.rent)}/mo</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden gap-4 text-sm text-slate-400 sm:flex">
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {pg.analytics?.views ?? 0}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {pg.analytics?.inquiries ?? 0}</span>
                      </div>
                      <Badge variant={pg.availableRooms > 0 ? 'success' : 'destructive'}>
                        {pg.availableRooms > 0 ? 'Active' : 'Full'}
                      </Badge>
                      <Link to={`/dashboard/listings/${pg._id}/edit`}>
                        <Button size="sm" variant="ghost">Edit</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick actions */}
      <Card className="premium-shadow border border-slate-100 bg-white">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link to="/">
              <div className="flex items-center gap-3 rounded-xl border border-slate-150 bg-slate-50/50 p-4 hover:border-blue-500/20 hover:bg-slate-50 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Browse PGs</p>
                  <p className="text-xs text-slate-550">Explore all listings</p>
                </div>
              </div>
            </Link>
            <Link to="/dashboard/inquiries">
              <div className="flex items-center gap-3 rounded-xl border border-slate-150 bg-slate-50/50 p-4 hover:border-emerald-500/20 hover:bg-slate-50 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Inquiries</p>
                  <p className="text-xs text-slate-550">{isOwner ? 'View inbox' : 'My inquiries'}</p>
                </div>
              </div>
            </Link>
            {!isOwner && (
              <Link to="/dashboard/saved">
                <div className="flex items-center gap-3 rounded-xl border border-slate-150 bg-slate-50/50 p-4 hover:border-amber-500/20 hover:bg-slate-50 hover:shadow-sm transition-all cursor-pointer">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                    <Heart className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Saved PGs</p>
                    <p className="text-xs text-slate-550">Your wishlist</p>
                  </div>
                </div>
              </Link>
            )}
            {isOwner && (
              <Link to="/dashboard/listings/new">
                <div className="flex items-center gap-3 rounded-xl border border-slate-150 bg-slate-50/50 p-4 hover:border-sky-500/20 hover:bg-slate-50 hover:shadow-sm transition-all cursor-pointer">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 border border-sky-100">
                    <PlusCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Add PG</p>
                    <p className="text-xs text-slate-550">Create new listing</p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
