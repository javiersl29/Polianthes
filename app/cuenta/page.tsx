import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { query } from "@/lib/db";
import CuentaClient from "./CuentaClient";

export const dynamic = "force-dynamic";

type CustomerOrder = {
  id: number;
  public_id: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
  items_count: number;
};

export default async function CuentaPage() {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/login?redirect=/cuenta");
  }

  const ordersRes = await query<CustomerOrder>(
    `SELECT o.id, o.public_id, o.status, o.total_cents, o.currency, o.created_at, o.paid_at,
            COALESCE((SELECT COUNT(*) FROM order_item WHERE order_id = o.id), 0)::int AS items_count
     FROM "order" o
     WHERE o.customer_id = $1
     ORDER BY o.created_at DESC
     LIMIT 50`,
    [customer.id]
  );
  const orders = ordersRes.rows;

  return <CuentaClient initialCustomer={customer} initialOrders={orders} />;
}
