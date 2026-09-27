import { connectToDatabase } from "@/backend/db/connect";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const mongoose = await connectToDatabase();
    const state = mongoose.connection.readyState; // 1 = connected
    return Response.json({ ok: state === 1 });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
