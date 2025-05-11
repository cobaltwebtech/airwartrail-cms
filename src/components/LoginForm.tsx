import type React from "react";
import { useState, useEffect } from "react";
import { signIn } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Check for error query parameter on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");
    if (error) {
      setErrorMessage(decodeURIComponent(error));
      toast.error(decodeURIComponent(error));

      // Clean up the URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !password) {
      setErrorMessage("Email and password are required");
      toast.error("Email and password are required");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await signIn.email({
        email,
        password,
        callbackURL: "/",
        rememberMe: true,
      });

      // Handle successful login
      if (response && !response.error) {
        toast.success("Login successful!");
        window.location.href = "/";
        return;
      }

      // Handle error case
      if (response.error) {
        const errorMsg =
          response.error.message || "Login failed. Please try again.";
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
        return;
      }
    } catch (error) {
      console.error("Login failed", error);
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Login failed. Please check your credentials and try again.";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className={cn("flex flex-col gap-6", className)} {...props}>
          <Card>
            <CardHeader>
              <CardTitle>Login to your account</CardTitle>
              <CardDescription>
                Enter your email below to login to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} noValidate>
                <div className="flex flex-col gap-6">
                  <div className="grid gap-3">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                  <div className="grid gap-3">
                    <div className="flex items-center">
                      <Label htmlFor="password">Password</Label>
                      <a
                        href="/forgot-password"
                        className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                      >
                        Forgot your password?
                      </a>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                  </div>

                  {errorMessage && (
                    <div className="text-destructive text-sm">
                      {errorMessage}
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        "Login"
                      )}
                    </Button>
                  </div>
                </div>
              </form>
              <div className="flex flex-col gap-2 pt-4">
                <Button
                  className="gap-2"
                  variant="outline"
                  onClick={async () => {
                    await signIn.passkey({
                      fetchOptions: {
                        onError(context) {
                          alert(context.error.message);
                        },
                        onSuccess() {
                          window.location.href = "/";
                        },
                      },
                    });
                  }}
                >
                  <KeyRound />
                  Login with Passkey
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center">
              <div className="text-center text-sm">
                Don&apos;t have an account?{" "}
                <a href="/signup" className="underline underline-offset-4">
                  Sign up
                </a>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
