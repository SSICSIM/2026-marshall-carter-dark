import { BackroomShell } from "@/components/mechanics/BackroomShell";

export default function Layout(props: { children: React.ReactNode }) {
  return <BackroomShell>{props.children}</BackroomShell>;
}
