import { useEffect } from "react";

export function DashboardFooter() {
  useEffect(() => {
    const currentYearElement = document.getElementById("current-year");
    if (currentYearElement) {
      currentYearElement.textContent = new Date().getFullYear().toString();
    }
  }, []);

  return (
    <footer className="bg-muted w-full col-start-2 flex flex-nowrap gap-2 self-end border-t p-2 md:gap-6 md:p-4">
      <h6 className="font-heading content-end text-lg/5">
        &copy;<span id="current-year"></span> Air War Trail
      </h6>
      <p className="text-muted-foreground content-end text-sm">
        Custom digital asset management dashboard built by{" "}
        <a
          href="https://www.cobaltweb.tech/"
          className="text-accent font-semibold"
        >
          Cobalt Web Technologies
        </a>
      </p>
    </footer>
  );
}
