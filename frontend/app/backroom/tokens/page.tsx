import { redirect } from "next/navigation";

// Physical tokens were renamed to seals; keep old links working.
export default function TokensRedirect() {
  redirect("/backroom/seals");
}
