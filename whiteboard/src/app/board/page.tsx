import BoardClient from "./BoardClient";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const params = await searchParams;
  const businessId = params.b ?? "demo";
  return <BoardClient businessId={businessId} />;
}
