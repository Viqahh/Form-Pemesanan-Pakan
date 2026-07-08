import { OrderForm } from "@/components/order-form";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--secondary)),transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef8f4_100%)] px-4 py-6 sm:py-10">
      <section className="container">
        <div className="mx-auto mb-6 max-w-3xl text-center sm:mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Sistem Order Pakan
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Form Pemesanan Pakan
          </h1>
        </div>
        <OrderForm />
      </section>
    </main>
  );
}
