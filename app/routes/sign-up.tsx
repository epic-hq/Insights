import consola from "consola";
import { useEffect } from "react";
import {
  type ActionFunctionArgs,
  Link,
  redirect,
  useFetcher,
  useSearchParams,
} from "react-router";
import { LogoBrand } from "~/components/branding";
import { LoginForm } from "~/components/login-form";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getServerClient } from "~/lib/supabase/client.server";
import {
  extractUtmParamsFromSearch,
  hasUtmParams,
  mergeUtmParams,
  UTM_COOKIE_NAME,
  type UtmParams,
} from "~/utils/utm";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client: supabase } = getServerClient(request);

  const url = new URL(request.url);
  const origin = url.origin;

  const formData = await request.formData();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const repeatPassword = formData.get("repeat-password") as string;

  if (!password) {
    return {
      error: "Password is required",
    };
  }

  if (password !== repeatPassword) {
    return { error: "Passwords do not match" };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/login_success`,
    },
  });

  if (error) {
    return { error: error.message };
  }
  consola.log("redirecting to /login_success");
  return redirect("/login_success");
  // return redirect("/sign-up?success")
};

export default function SignUp() {
  const fetcher = useFetcher<typeof action>();
  const [searchParams] = useSearchParams();

  const success = !!searchParams.has("success");
  const error = fetcher.data?.error;
  const loading = fetcher.state === "submitting";

  useEffect(() => {
    // Store plan parameter for post-signup checkout
    const plan = searchParams.get("plan");
    if (plan) {
      try {
        const secure = window.location.protocol === "https:" ? "; Secure" : "";
        const oneWeekSeconds = 60 * 60 * 24 * 7;
        document.cookie = `selected_plan=${plan}; Path=/; Max-Age=${oneWeekSeconds}; SameSite=Lax${secure}`;
        consola.info("[REGISTER] Stored selected plan:", plan);
      } catch (error) {
        consola.warn("[REGISTER] Failed to persist plan param", error);
      }
    }

    // Handle UTM params
    const utmParams = extractUtmParamsFromSearch(location.search);
    if (!hasUtmParams(utmParams)) {
      return;
    }

    try {
      const existingRaw = document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${UTM_COOKIE_NAME}=`))
        ?.split("=")[1];

      const existing = existingRaw
        ? (JSON.parse(decodeURIComponent(existingRaw)) as UtmParams)
        : {};
      const merged = mergeUtmParams(existing, utmParams);
      const cookieValue = encodeURIComponent(JSON.stringify(merged));
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      const oneWeekSeconds = 60 * 60 * 24 * 7;

      document.cookie = `${UTM_COOKIE_NAME}=${cookieValue}; Path=/; Max-Age=${oneWeekSeconds}; SameSite=Lax${secure}`;
    } catch (error) {
      consola.warn("[REGISTER] Failed to persist UTM params", error);
    }
  }, [searchParams]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-3xl">
        <Card className="overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Left: Marketing */}
            <div className="hidden flex-col justify-between bg-gradient-to-br from-primary/5 via-transparent to-primary/10 p-8 md:flex">
              <Link to="/">
                <LogoBrand />
                <p className="mt-4 text-lg text-muted-foreground">
                  Get more out of every conversation
                </p>
              </Link>

              <p className="text-center font-semibold text-foreground/50 text-xl">
                Start free for 14 days
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-primary">✓</span>
                  <span className="mt-1 text-primary/70">
                    Intuitive and comprehensive
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-primary">✓</span>
                  <span className="mt-1 text-primary/70">
                    Auto-personas from real people
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 text-primary">✓</span>
                  <span className="mt-1 text-primary/70">
                    Clear, powerful insights
                  </span>
                </li>
              </ul>
            </div>
            {/* Right: Signup Form */}
            <div className="flex flex-col gap-6 p-8">
              {success ? (
                <>
                  <CardHeader>
                    <CardTitle className="text-2xl">
                      Thank you for signing up!
                    </CardTitle>
                    <CardDescription>
                      Check your email to confirm
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-muted-foreground text-sm">
                      You've successfully signed up. Please check your email to
                      confirm your account before signing in.
                    </p>
                  </CardContent>
                </>
              ) : (
                <>
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Sign up</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <LoginForm />
                    <fetcher.Form method="post">
                      <div className="flex flex-col gap-6">
                        <div className="grid gap-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="m@example.com"
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <div className="flex items-center">
                            <Label htmlFor="password">Password</Label>
                          </div>
                          <Input
                            id="password"
                            name="password"
                            type="password"
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <div className="flex items-center">
                            <Label htmlFor="repeat-password">
                              Repeat Password
                            </Label>
                          </div>
                          <Input
                            id="repeat-password"
                            name="repeat-password"
                            type="password"
                            required
                          />
                        </div>
                        {error && (
                          <p className="text-red-500 text-sm">{error}</p>
                        )}
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={loading}
                        >
                          {loading ? "Creating an account..." : "Sign up"}
                        </Button>
                      </div>
                      <div className="mt-4 text-center text-sm">
                        Already have an account?{" "}
                        <Link
                          to="/login"
                          className="underline underline-offset-4"
                        >
                          Login
                        </Link>
                      </div>
                    </fetcher.Form>
                  </CardContent>
                </>
              )}
              <div className="text-center text-slate-500 text-xs dark:text-slate-400">
                <p>
                  By signing in, you agree to our Terms of Service and Privacy
                  Policy.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
