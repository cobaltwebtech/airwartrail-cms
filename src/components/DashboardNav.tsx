import { useState, useEffect } from "react";
import { LayoutDashboard, Film, FolderOpen, Settings, BarChart3, LogOut, Sun, Moon } from 'lucide-react';
import { Button } from "./ui/button";
import { Switch } from "@/components/ui/switch";

export function DashboardNav() {
  const [activePath, setActivePath] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    setActivePath(window.location.pathname);

    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
    } else {
      setIsDarkMode(false);
    }
  }, []);

  const handleThemeChange = () => {
    const newTheme = !isDarkMode ? "dark" : "light";
    setIsDarkMode(!isDarkMode);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", !isDarkMode);
  };

  const navItems = [
    { title: "Dashboard", href: "/", icon: LayoutDashboard },
    { title: "Videos", href: "/videos", icon: Film },
    { title: "Collections", href: "/collections", icon: FolderOpen },
    { title: "Analytics", href: "/analytics", icon: BarChart3 },
    { title: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-full flex-col border-r bg-muted/40">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <a href="/" className="flex items-center gap-2 font-semibold">
          <Film className="h-6 w-6" />
          <span>Video Admin</span>
        </a>
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
                className={`group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground ${isActive ? "bg-accent" : "transparent"}`}
                onClick={() => setActivePath(item.href)}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{item.title}</span>
              </a>
            );
          })}
        </nav>
        <div className="flex flex-row gap-4 p-4">
          <Sun className="size-4"/>
          <Switch checked={isDarkMode} onCheckedChange={handleThemeChange} />
          <Moon className="size-4"/>
        </div>
      </div>
      <div className="mt-auto p-4">
        <Button variant="outline" className="w-full justify-start" size="sm">
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  );
}