// components/ui/Breadcrumbs.tsx
'use client';

import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm mb-4">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            )}
            {isLast || !item.href ? (
              <span className={`font-medium ${isLast ? 'text-slate-900' : 'text-slate-500'}`}>
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="font-medium text-slate-500 hover:text-[var(--color-primary)] transition-colors"
              >
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
