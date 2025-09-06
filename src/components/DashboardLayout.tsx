"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Users,
  FileText,
  Upload,
  Settings,
  LogOut,
  Menu,
  X,
  GraduationCap,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Base navigation items
  const baseNavigation = [
    { name: "Dashboard", href: "/dashboard", icon: BookOpen },
    { name: "Students", href: "/students", icon: GraduationCap },
    { name: "Materials", href: "/materials", icon: FileText },
    { name: "Upload", href: "/upload", icon: Upload },
  ];

  // Add Teachers menu for school admins only
  const navigation = session?.user?.isSchoolAdmin
    ? [
        ...baseNavigation.slice(0, 2), // Dashboard, Students
        { name: "Teachers", href: "/teachers", icon: Users },
        ...baseNavigation.slice(2), // Materials, Upload
        { name: "Settings", href: "/settings", icon: Settings },
      ]
    : [
        ...baseNavigation,
        { name: "Settings", href: "/settings", icon: Settings },
      ];

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          mobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center gap-4 h-16 px-4 border-b">
          <Image
            src="/persona-lingua-logo-blue-simple.svg"
            alt="Logo"
            width={48}
            height={48}
            className="h-14 w-14"
          />
          <h1 className="text-xl font-bold text-gray-900">PersonaLingua</h1>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-5 px-2">
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                    isActive
                      ? "bg-blue-100 text-blue-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon
                    className={cn(
                      "mr-3 flex-shrink-0 h-5 w-5",
                      isActive
                        ? "text-blue-500"
                        : "text-gray-400 group-hover:text-gray-500"
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User info */}
        <div className="absolute bottom-0 w-full p-4 border-t">
          <div className="flex items-center">
            {/* Profile picture */}
            {session.user.profilePicture ? (
              <Image
                src={session.user.profilePicture}
                width={36}
                height={36}
                alt="Profile"
                className="h-9 w-9 rounded-full object-cover mr-3 border border-gray-200"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center mr-3 text-gray-400">
                <span className="text-lg font-bold">
                  {session.user.name?.[0] ?? "?"}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.user.name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {session.user.schoolName}
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="ml-3 p-2 rounded-md text-gray-400 hover:text-gray-700 hover:cursor-pointer"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 z-40 flex items-center justify-between w-full h-16 px-4 bg-white border-b">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-md text-gray-400 hover:text-gray-500"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">PersonaLingua</h1>
        <div className="w-8" /> {/* Spacer */}
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-25"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        <div className="pt-16 lg:pt-0 flex-1">{children}</div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 py-4 px-6 mt-auto">
          <div className="text-center text-sm text-gray-500">
            © {new Date().getFullYear()} PersonaLingua. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
}
