import { displayApiFetch, displayErrorResponse } from "@/lib/display-server";

interface ApiItem {
  Id: string;
  ItemCode: string;
  Name: string;
  Brand?: string | null;
  Model?: string | null;
  SerialNumber?: string | null;
  Unit: string;
  AddressLocation: string;
  CurrentBalance: string;
  IsActive: boolean;
}

interface ApiPayload {
  data?: ApiItem[];
  message?: string;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const scanned = new URL(request.url).searchParams.get("partNumber")?.trim() ?? "";
  if (!scanned || scanned.length > 160) return Response.json({ message: "Scan or enter a valid item code, serial number, or rack location" }, { status: 400 });

  const query = new URLSearchParams({ search: scanned, limit: "100" });

  try {
    const response = await displayApiFetch(`/items?${query}`);
    const payload = (await response.json().catch(() => null)) as ApiPayload | null;
    if (!response.ok) {
      const status = response.status === 401 || response.status === 403 ? 503 : response.status;
      return Response.json({ message: status === 503 ? "Operator display is not configured" : payload?.message ?? "Unable to load inventory items" }, { status });
    }

    const code = scanned.toLocaleUpperCase("en-US");
    const exactItem = (payload?.data ?? []).find(
      (item) =>
        item.IsActive &&
        (item.ItemCode?.toLocaleUpperCase("en-US") === code ||
          item.AddressLocation?.toLocaleUpperCase("en-US") === code ||
          item.SerialNumber?.toLocaleUpperCase("en-US") === code)
    );

    if (!exactItem) {
      return Response.json({ message: `Item with code, rack, or serial '${scanned}' was not found or is inactive` }, { status: 404 });
    }

    const item = {
      Id: exactItem.Id,
      ItemCode: exactItem.ItemCode,
      Name: exactItem.Name,
      SerialNumber: exactItem.SerialNumber ?? null,
      Unit: exactItem.Unit,
      AddressLocation: exactItem.AddressLocation,
      CurrentBalance: exactItem.CurrentBalance,
    };

    return Response.json({ data: item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return displayErrorResponse(error);
  }
}
