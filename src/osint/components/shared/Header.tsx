// @ts-nocheck
import { Link } from 'react-router-dom';
import { Shield } from "lucide-react";

export function Header() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Shield className="h-5 w-5 text-blue-600" />
          <span>Prodigy OSINT</span>
        </Link>
      </div>
    </header>
  );
}
