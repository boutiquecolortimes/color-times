import { ListPageSkeleton } from "@/components/admin/page-skeletons";

export default function Loading() {
  return <ListPageSkeleton rows={6} columns={5} showStats={false} />;
}
