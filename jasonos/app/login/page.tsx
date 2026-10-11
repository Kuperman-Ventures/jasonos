import { LoginForm } from "@/app/login/login-form";
import { loginErrorMessage } from "@/lib/auth/allowlist";
import { safeNextPath } from "@/lib/auth/session";

export const metadata = { title: "Unlock · JasonOS" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; enroll?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <LoginForm
        nextPath={nextPath}
        errorText={loginErrorMessage(params.error ?? null)}
        enroll={params.enroll === "1"}
      />
    </main>
  );
}
