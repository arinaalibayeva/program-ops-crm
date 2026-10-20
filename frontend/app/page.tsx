import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { USE_BACKEND } from "@/lib/api";

// The front door: sign in first, unless this browser is already signed in.
export default async function Home() {
  const signedIn = (await cookies()).has("session");
  redirect(!USE_BACKEND || signedIn ? "/admin" : "/login");
}
