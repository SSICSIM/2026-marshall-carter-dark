import { redirect } from "next/navigation";

// The site opens on the frontroom board; the Crisis Tracker lives at /tracker.
export default function HomePage() {
  redirect("/frontroom");
}
