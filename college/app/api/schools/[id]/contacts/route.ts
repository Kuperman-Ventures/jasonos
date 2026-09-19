import { NextResponse } from "next/server";
import { addContact, deleteContact, supabaseConfigured, updateContact } from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as { name?: string; role?: string; email?: string; phone?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
  try {
    const school = await addContact(id, body);
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add contact";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request, context: Context) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as {
    contactId?: string;
    name?: string;
    role?: string;
    email?: string;
    phone?: string;
  };
  if (!body.contactId) return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  try {
    const school = await updateContact(id, body.contactId, body);
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update contact";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const contactId = new URL(request.url).searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  try {
    const school = await deleteContact(id, contactId);
    return NextResponse.json({ school });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete contact";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
