export default function CallPage({
  searchParams,
}: {
  searchParams: { title?: string };
}) {
  const title = searchParams?.title || "Call";
  return (
    <div className="min-h-screen w-full px-6 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Call initialized. This is a placeholder — connect your call experience here.
        </p>
      </div>
    </div>
  );
}


