import { redirect } from "next/navigation";

// Notes became private/public directives; keep old links working.
export default function NotesRedirect() {
  redirect("/backroom/directives");
}
