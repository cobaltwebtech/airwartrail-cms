import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        duration: 8000,
        unstyled: true,
        classNames: {
          toast:
            "group toast group-[.toaster]:w-[400px] group-[.toaster]:rounded-lg group-[.toaster]:flex group-[.toaster]:gap-2 group-[.toaster]:align-center group-[.toaster]:p-4 group-[.toaster]:text-sm group-[.toaster]:bg-foreground group-[.toaster]:text-popover group-[.toaster]:border-2 group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
