// components/skeletons/CampaignsSkeleton.tsx
'use client';

import { Skeleton } from './SkeletonBase';

export default function CampaignsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="w-8 h-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-10 w-64 rounded-lg" />
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Campaign', 'Agent', 'Status', 'Progress', 'Success Rate', 'Features', 'Created'].map((header, i) => (
                  <th key={i} className="text-left py-4 px-6">
                    <Skeleton className="h-3 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...Array(6)].map((_, i) => (
                <tr key={i}>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-40 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="w-32">
                      <div className="flex items-center justify-between mb-1">
                        <Skeleton className="h-3 w-10" />
                        <Skeleton className="h-3 w-14" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-4 w-14" />
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-12 rounded" />
                      <Skeleton className="h-6 w-12 rounded" />
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-3 w-28" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
