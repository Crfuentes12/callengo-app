export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-2',
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div className={`animate-spin ${sizeClasses[size]} border-[var(--color-primary)] border-t-transparent rounded-full`} />
    </div>
  );
}
