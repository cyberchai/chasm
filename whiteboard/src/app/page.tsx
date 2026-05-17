import { redirect } from "next/navigation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const params = await searchParams;
  redirect(`/board?b=${params.b ?? "demo"}`);
}
