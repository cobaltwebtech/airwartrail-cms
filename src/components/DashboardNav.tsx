import { useState, useEffect } from "react";
import { Film, FolderOpen, Files, LogOut, Pencil } from "lucide-react";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { VideoUpload } from "./videos/VideoUpload";
import { useSession, signOut } from "@/lib/auth-client";
import type { ActiveSession } from "@/types";

interface DashboardNavProps {
  initialSession: ActiveSession | null;
}

export function DashboardNav({ initialSession }: DashboardNavProps) {
  const { data: clientSession, isPending: loading } = useSession();
  const [activePath, setActivePath] = useState("");
  const session = clientSession || initialSession;

  useEffect(() => {
    setActivePath(window.location.pathname);
  }, []);

  const navItems = [
    { title: "Videos", href: "/videos", icon: Film },
    { title: "Collections", href: "/collections", icon: FolderOpen },
    { title: "Other Content", href: "/assets", icon: Files },
  ];

  return (
    <div className="bg-muted row-span-2 flex h-full flex-col border-r">
      <div className="sticky top-0">
        <div className="flex h-14 items-center justify-center border-b px-4 lg:h-[60px] lg:px-6">
          <a href="/">
            <h1 className="text-center font-semibold">Air War Trail</h1>
          </a>
        </div>
        <div className="flex flex-col gap-4 border-b p-4">
          <VideoUpload />
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-2 text-sm font-medium">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activePath === item.href;
              return (
                <a
                  key={index}
                  href={item.href}
                  className={`group hover:bg-sidebar-accent hover:text-accent-foreground flex items-center rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-sidebar-accent" : "transparent"}`}
                  onClick={() => setActivePath(item.href)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{item.title}</span>
                </a>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-col gap-2 border-y p-4">
          {loading && !initialSession ? (
            <p className="text-muted-foreground text-sm">
              Loading user data...
            </p>
          ) : session?.user ? (
            <>
              <p className="font-medium">
                <a href={`/user/${session.user.id}`}>
                  {session.user.name || "User"}
                </a>
              </p>
              <p className="text-muted-foreground text-sm">
                {session.user.email}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Not signed in</p>
          )}
          <Button asChild variant="link" className="justify-start">
            <a href={`/user/${session.user.id}`}>
              <Pencil className="mr-2 size-4" />
              Edit Profile
            </a>
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              await signOut();
              window.location.reload();
            }}
            className="w-full justify-start"
          >
            <LogOut className="mr-2 size-4" />
            Log Out
          </Button>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
