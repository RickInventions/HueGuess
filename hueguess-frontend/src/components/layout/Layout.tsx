import { Outlet } from 'react-router-dom';
import { FloatingChips } from './FloatingChips';

export function Layout() {
  return (
    <div className="min-h-screen bg-surface-base relative overflow-hidden">
      <FloatingChips />
      <main className="relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
