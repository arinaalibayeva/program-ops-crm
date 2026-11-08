import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { REQUIRE_SIGN_IN } from "@/lib/api";

// The front door: sign in first, unless sign-in is off or this browser is already signed in.
export default async function Home() {
  const signedIn = (await cookies()).has("session");
  redirect(!REQUIRE_SIGN_IN || signedIn ? "/admin" : "/login");
}
