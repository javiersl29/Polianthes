import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  listAdminOrders,
  getAdminOrder,
  updateOrderStatus,
  updateOrderTracking,
  updateOrderNotes,
  ORDER_STATUSES,
  OrderStatus
} from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const limit = Math.min(500, Number(req.nextUrl.searchParams.get("limit") ?? "100"));
  const orders = await listAdminOrders(Number.isFinite(limit) ? limit : 100);
  return NextResponse.json({ orders, statuses: ORDER_STATUSES });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthenticated()) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const body = await req.json();
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }
  if (body.action === "status") {
    const status = String(body.status) as OrderStatus;
    if (!ORDER_STATUSES.some((s) => s.value === status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }
    try {
      await updateOrderStatus(id, status, body.note);
    } catch (e) {
      console.error("[admin/orders] updateOrderStatus failed:", e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "Error al actualizar" }, { status: 500 });
    }

    // Notificar al cliente según el nuevo estado (fire-and-forget)
    try {
      const { sendOrderStatusEmail, sendShippedNotification } = await import("@/lib/notifications");
      if (status === "in_transit") {
        const fullOrder = await getAdminOrder(id);
        if (fullOrder) {
          await sendShippedNotification(id, fullOrder.carrier ?? null, fullOrder.tracking_number ?? null);
        }
      } else {
        await sendOrderStatusEmail(id, status, body.note);
      }
    } catch (e) {
      console.error("[admin/orders] notify error:", e);
    }

    const order = await getAdminOrder(id);
    return NextResponse.json({ order });
  }
  if (body.action === "tracking") {
    await updateOrderTracking(
      id,
      body.carrier ?? null,
      body.tracking_number ?? null,
      body.tracking_url ?? null
    );
    const order = await getAdminOrder(id);
    return NextResponse.json({ order });
  }
  if (body.action === "notes") {
    await updateOrderNotes(id, body.notes ?? null);
    const order = await getAdminOrder(id);
    return NextResponse.json({ order });
  }
  return NextResponse.json({ error: "acción no reconocida" }, { status: 400 });
}
