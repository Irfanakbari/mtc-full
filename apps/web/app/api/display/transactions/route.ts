import {
  allowDisplayMutation,
  displayApiFetch,
  displayErrorResponse,
  isSameOriginMutation,
} from "@/lib/display-server";

interface DisplayTransactionInput {
  direction?: unknown;
  operatorName?: unknown;
  itemId?: unknown;
  quantity?: unknown;
}

interface MutationPayload {
  data?: {
    ledger?: {
      Id?: string;
      TransactionDate?: string;
      BalanceAfter?: string;
    };
    item?: {
      AddressLocation?: string;
      Name?: string;
      Unit?: string;
      CurrentBalance?: string;
    };
  };
  message?: string;
  details?: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATOR_NAME = /^[\p{L}\p{N} .'-]{2,80}$/u;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,80}$/;

function invalid(message: string): Response {
  return Response.json({ message }, { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginMutation(request)) {
    return Response.json({ message: "Cross-origin mutation denied" }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) return Response.json({ message: "Request is too large" }, { status: 413 });

  const rawBody = await request.text();
  if (rawBody.length > 16_384) return Response.json({ message: "Request is too large" }, { status: 413 });
  const body = (() => {
    try { return JSON.parse(rawBody) as DisplayTransactionInput; }
    catch { return null; }
  })();
  if (!body || (body.direction !== "IN" && body.direction !== "OUT")) return invalid("Select Stock In or Stock Out");
  if (typeof body.operatorName !== "string" || !OPERATOR_NAME.test(body.operatorName.trim())) return invalid("Enter a valid operator name");
  if (typeof body.itemId !== "string" || !UUID.test(body.itemId)) return invalid("Select a valid inventory item");
  if (typeof body.quantity !== "number" || !Number.isFinite(body.quantity) || body.quantity <= 0 || Math.abs(body.quantity * 100 - Math.round(body.quantity * 100)) > 1e-8) return invalid("Quantity must be positive with no more than two decimals");
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) return invalid("A valid transaction request ID is required");
  if (!allowDisplayMutation(request)) {
    return Response.json({ message: "Too many transactions. Please wait before trying again." }, { status: 429 });
  }

  const operatorName = body.operatorName.trim().replace(/\s+/g, " ");
  const referenceDoc = `DISPLAY-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${idempotencyKey.slice(-8).toUpperCase()}`;
  const notes = `[Display operator: ${operatorName}] Scanner-first operator display transaction`;

  try {
    const response = await displayApiFetch(`/stock/${body.direction === "IN" ? "in" : "out"}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        itemId: body.itemId,
        quantity: body.quantity,
        referenceDoc,
        notes,
      }),
    });
    const payload = await response.json().catch(() => null) as MutationPayload | null;
    if (!response.ok) {
      const status = response.status === 401 || response.status === 403 ? 503 : response.status;
      const message = status === 503
        ? "Operator display is not configured"
        : payload?.message ?? "The transaction could not be completed";
      return Response.json({ message, details: payload?.details }, { status });
    }

    return Response.json({
      data: {
        ledgerId: payload?.data?.ledger?.Id,
        transactionDate: payload?.data?.ledger?.TransactionDate,
        addressLocation: payload?.data?.item?.AddressLocation,
        itemName: payload?.data?.item?.Name,
        unit: payload?.data?.item?.Unit,
        balanceAfter: payload?.data?.item?.CurrentBalance ?? payload?.data?.ledger?.BalanceAfter,
        direction: body.direction,
        quantity: body.quantity,
        referenceDoc,
        operatorName,
      },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return displayErrorResponse(error);
  }
}
