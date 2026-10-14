import { redirect } from "next/navigation";

// No login yet: send everyone to the admin side. Later this becomes the
// login page, which redirects to /admin or /portal based on role.
export default function Home() {
  redirect("/admin");
}
