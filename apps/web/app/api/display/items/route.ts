import { displayApiFetch, displayErrorResponse } from "@/lib/display-server";

interface ApiItem {
  Id: string;
  ItemCode: string;
  Name: string;
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
  const partNumber = new URL(request.url).searchParams.get("partNumber")?.trim() ?? "";
  if (!partNumber || partNumber.length > 80) return Response.json({ message: "Scan or enter a valid part number" }, { status: 400 });

  const query = new URLSearchParams({ search: partNumber });

  try {
    const response = await displayApiFetch(`/items?${query}`);
    const payload = await response.json().catch(() => null) as ApiPayload | null;
    if (!response.ok) {
      const status = response.status === 401 || response.status === 403 ? 503 : response.status;
      return Response.json({ message: status === 503 ? "Operator display is not configured" : payload?.message ?? "Unable to load inventory items" }, { status });
    }

    const exactItem = (payload?.data ?? []).find((item) => item.IsActive && item.ItemCode.toLocaleUpperCase("en-US") === partNumber.toLocaleUpperCase("en-US"));
    if (!exactItem) return Response.json({ message: `Part number ${partNumber} was not found or is inactive` }, { status: 404 });
    const item = (({ Id, ItemCode, Name, Unit, AddressLocation, CurrentBalance }) => ({
      Id,
      ItemCode,
      Name,
      Unit,
      AddressLocation,
      CurrentBalance,
    }))(exactItem);
    return Response.json({ data: item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return displayErrorResponse(error);
  }
}
