import { displayApiFetch, displayErrorResponse } from "@/lib/display-server";

interface ApiItem {
  Id: string;
  Name: string;
  Model: string | null;
  Specification: string | null;
  Unit: string;
  AddressLocation: string;
  CurrentBalance: string;
  IsActive: boolean;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const scanned = new URL(request.url).searchParams.get("partNumber")?.trim() ?? "";
  if (!scanned || scanned.length > 120) return Response.json({ message: "Scan or enter a valid rack location" }, { status: 400 });
  try {
    const response = await displayApiFetch(`/items/address/${encodeURIComponent(scanned)}`);
    const payload = await response.json().catch(() => null) as { data?: ApiItem; message?: string } | null;
    if (!response.ok) {
      const status = response.status === 401 || response.status === 403 ? 503 : response.status;
      return Response.json({ message: status === 503 ? "Operator display is not configured" : payload?.message ?? "Unable to load inventory item" }, { status });
    }
    const item = payload?.data;
    if (!item?.IsActive) return Response.json({ message: "Item at this rack location was not found or is inactive" }, { status: 404 });
    const { Id, Name, Model, Specification, Unit, AddressLocation, CurrentBalance } = item;
    return Response.json({ data: { Id, Name, Model, Specification, Unit, AddressLocation, CurrentBalance } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return displayErrorResponse(error);
  }
}
