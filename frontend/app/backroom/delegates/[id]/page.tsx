import { BackroomDelegatePage } from "@/components/mechanics/BackroomDelegatePage";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <BackroomDelegatePage delegateId={Number(id)} />;
}
