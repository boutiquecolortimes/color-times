import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function apiErrorFromUnknown(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Invalid input";
    return apiError(message, 422);
  }

  if (error instanceof Error) {
    if (error.name === "CastError") {
      return apiError("Invalid ID", 400);
    }
    if (error.name === "ValidationError") {
      return apiError(error.message, 422);
    }
    if (error.message.includes("E11000")) {
      return apiError("An account with this email already exists", 409);
    }
    // Anything else is unexpected — log the real error server-side for
    // debugging, but never hand raw error internals (stack traces, DB
    // details, file paths) back to the client.
    console.error("Unhandled API error:", error);
    return apiError("Something went wrong. Please try again.", 500);
  }

  console.error("Unhandled API error (non-Error thrown):", error);
  return apiError("Something went wrong. Please try again.", 500);
}
