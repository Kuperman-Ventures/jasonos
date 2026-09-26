import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next && params.next.startsWith("/") ? params.next : "/";
  return (
    <main className="login-page">
      <LoginForm nextPath={nextPath} errorCode={params.error ?? null} />
    </main>
  );
}
